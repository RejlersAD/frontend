import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../config/routes.config'
import {
  ArrowLeft, BookOpen, FileText, Workflow, CheckCircle2, Upload, Table2, Sparkles,
  Zap, Shield, Clock, Layers, Download, Eye, AlertCircle, ChevronRight, Lightbulb,
} from 'lucide-react'
import workflowDiagram from '../../../assets/docs/pid-checker-v2-workflow.png'

// ═══════════════════════════════════════════════════════════════════════════════
// P&ID Checker V2 — Documentation & Workflow
// Standalone reference page. All copy, colours, and layout constants are
// soft-coded at the top of this module so they can be tuned in one place.
// ═══════════════════════════════════════════════════════════════════════════════

const PAGE_TITLE = 'P&ID Checker V2'
const PAGE_KICKER = 'Documentation & Workflow'
const PAGE_SUBTITLE = 'A modern extraction engine for pipeline line tags — from PDF ingestion through legend-aware parsing, OCR, vision AI, and audit-ready exports.'
const BACK_ROUTE = '/engineering/process/pid-checker-v2'
const BACK_LABEL = 'Back to Checker'
const BACK_TO_V1_LABEL = 'Back to V1'
const BACK_TO_V1_TITLE = 'Return to P&ID Verification V1 (Quality Checker)'

// ── Theme ─────────────────────────────────────────────────────────────────────
const THEME = {
  primary: '#7c3aed',
  accent: '#ec4899',
  emerald: '#10b981',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  ink: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  borderSoft: '#eef2f7',
  surface: '#ffffff',
  surfaceSoft: '#f8fafc',
  surfaceInk: '#0b1220',
}
const GRADIENT_HERO = `linear-gradient(135deg, #0b1220 0%, #1e1b4b 45%, #4c1d95 100%)`
const GRADIENT_ACCENT = `linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.accent} 100%)`
const GRADIENT_SOFT = `linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)`

const PAGE_MAX_WIDTH = 1180
const TOP_NAV_OFFSET_PX = 64

// ── Hero stats ────────────────────────────────────────────────────────────────
const HERO_STATS = [
  { label: 'Max upload size', value: '25 MB', hint: 'per PDF' },
  { label: 'Output fields', value: '6', hint: 'CSV columns' },
  { label: 'Fallback layers', value: '3', hint: 'legend resolution' },
  { label: 'Extraction modes', value: '2', hint: 'OCR + Vision' },
]

// ── Table of contents ─────────────────────────────────────────────────────────
const TOC = [
  { id: 'overview',   label: 'Overview',           icon: BookOpen },
  { id: 'workflow',   label: 'Workflow',           icon: Workflow },
  { id: 'inputs',     label: 'Supported inputs',   icon: Upload },
  { id: 'legend',     label: 'Legend fallback',    icon: Layers },
  { id: 'output',     label: 'Output columns',     icon: Table2 },
  { id: 'rules',      label: 'Operational rules',  icon: Shield },
  { id: 'tips',       label: 'Tips & tricks',      icon: Lightbulb },
]

// ── Workflow ──────────────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  {
    icon: Upload,
    title: 'Upload a P&ID or Line-List PDF',
    body: 'Drop a single- or multi-sheet PDF (up to 25 MB). Vector PDFs give the best OCR/vision quality; scans are supported but slower.',
    accent: THEME.sky,
  },
  {
    icon: BookOpen,
    title: 'Activate the correct Legend Sheet',
    body: 'The active legend controls how composite tags (size · service · spec · serial) are parsed. Without one, the checker falls back to the most recent legend, then to the built-in default template.',
    accent: THEME.primary,
  },
  {
    icon: Sparkles,
    title: 'Choose extraction mode (OCR or Vision)',
    body: 'OCR mode is fast and cheap. Vision mode uses an LLM (BYOK) for higher recall on messy drawings — requires a provider + API key in the header.',
    accent: THEME.accent,
  },
  {
    icon: Table2,
    title: 'Review, filter and export',
    body: 'Extracted tags appear in the Results tabs. Cross-check against your Line List, Equipment List and Instrument Index, then export to CSV or push to downstream tools.',
    accent: THEME.emerald,
  },
  {
    icon: CheckCircle2,
    title: 'Persist and re-open',
    body: 'Every extraction is saved server-side and listed in Previous Extractions. Re-open any run to inspect the exact inputs, legend and outputs used.',
    accent: THEME.amber,
  },
]

const WORKFLOW_DIAGRAM_CAPTION = 'Reference workflow diagram — data flow from PDF upload through legend resolution, OCR/Vision extraction, tag parsing, cross-checks, and export.'

// ── Supported inputs ──────────────────────────────────────────────────────────
const INPUT_ROWS = [
  { name: 'P&ID / Line-List PDF', required: true,  detail: '.pdf up to 25 MB per upload', icon: FileText },
  { name: 'Legend Sheet',         required: false, detail: 'Strongly recommended · activated per project', icon: BookOpen },
  { name: 'Line List',            required: false, detail: 'Enables tag cross-checks and gap reporting', icon: Table2 },
  { name: 'Equipment List',       required: false, detail: 'Used to disambiguate equipment tags', icon: Layers },
  { name: 'Instrument Index',     required: false, detail: 'Used to filter and label instrument tags', icon: Eye },
]

// ── Legend fallback chain ─────────────────────────────────────────────────────
const LEGEND_FALLBACK = [
  { level: 1, title: 'Active legend',       body: 'The legend the user has activated for this section (highest precedence).' },
  { level: 2, title: 'Recent legend',       body: 'The most recently used legend across the entire workspace.' },
  { level: 3, title: 'Built-in default',    body: 'The default template shipped with RAD AI — used only when nothing else matches.' },
]

// ── Output & rules ────────────────────────────────────────────────────────────
const OUTPUT_COLUMNS = [
  { name: 'tag',           description: 'Composite pipeline tag as printed on the drawing' },
  { name: 'size',          description: 'Nominal pipe size, parsed from the tag prefix' },
  { name: 'service',       description: 'Service code — resolved via the active legend' },
  { name: 'spec',          description: 'Material / piping specification code' },
  { name: 'serial',        description: 'Line serial or sequence number' },
  { name: 'service_group', description: 'Higher-level service grouping used for reports' },
]

const RULES = [
  { icon: Clock,       body: 'Extraction runs asynchronously — the UI is never blocked while a job is running.' },
  { icon: Shield,      body: 'Uploads and results are per-user; other users cannot see your extractions.' },
  { icon: Zap,         body: 'BYOK keys (Vision mode) live only in sessionStorage and are cleared when the tab closes.' },
  { icon: AlertCircle, body: 'Deleting an extraction is permanent for the user — a full audit trail is preserved server-side.' },
]

const TIPS = [
  'Prefer vector PDFs (native CAD exports) over scanned images for the highest tag-recovery rate.',
  'Activate the legend before running an extraction — legend switches after the fact require a re-run.',
  'When BYOK Vision mode is enabled, keep the model at its default unless you have benchmarked an alternative.',
  'Use the Previous Extractions list as your audit trail — re-open a run to see exactly which legend and inputs were used.',
]

// ═════════════════════════════════════════════════════════════════════════════
// UI helpers
// ═════════════════════════════════════════════════════════════════════════════

function SectionCard({ id, eyebrow, title, description, icon: Icon, active = true, children }) {
  if (!active) return null
  return (
    <section id={id} style={{
      background: THEME.surface,
      border: `1px solid ${THEME.border}`,
      borderRadius: 16,
      padding: '24px 26px',
      marginBottom: 20,
      boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
      scrollMarginTop: TOP_NAV_OFFSET_PX + 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: GRADIENT_ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 14px rgba(124,58,237,0.25)',
          flexShrink: 0,
        }}>
          <Icon size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
              color: THEME.primary, textTransform: 'uppercase', marginBottom: 4,
            }}>{eyebrow}</div>
          )}
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: THEME.ink, letterSpacing: -0.2 }}>
            {title}
          </h2>
          {description && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: THEME.muted, lineHeight: 1.55 }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12,
      padding: '12px 14px',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{hint}</div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════

export default function PIDCheckerV2Docs() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(TOC[0].id)
  const activeIndex = TOC.findIndex((t) => t.id === activeSection)

  const goTo = (id) => {
    setActiveSection(id)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goPrev = () => { if (activeIndex > 0) goTo(TOC[activeIndex - 1].id) }
  const goNext = () => { if (activeIndex < TOC.length - 1) goTo(TOC[activeIndex + 1].id) }

  return (
    <div style={{
      minHeight: `calc(100vh - ${TOP_NAV_OFFSET_PX}px)`,
      background: THEME.surfaceSoft,
      paddingTop: TOP_NAV_OFFSET_PX,
    }}>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: GRADIENT_HERO,
        color: '#fff',
        padding: '26px 20px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative gradient blobs */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(236,72,153,0.35), transparent 70%)',
          filter: 'blur(20px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, left: -40, width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(124,58,237,0.4), transparent 70%)',
          filter: 'blur(30px)', pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: PAGE_MAX_WIDTH, margin: '0 auto', position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Top row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate(BACK_ROUTE)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <ArrowLeft size={14} /> {BACK_LABEL}
              </button>

              <button
                type="button"
                onClick={() => navigate(ROUTES.PID_VERIFICATION)}
                title={BACK_TO_V1_TITLE}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 999,
                  background: 'rgba(124,58,237,0.15)', color: '#c4b5fd',
                  border: '1px solid rgba(124,58,237,0.3)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <ArrowLeft size={14} /> {BACK_TO_V1_LABEL}
              </button>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              background: 'rgba(16,185,129,0.15)', color: '#6ee7b7',
              border: '1px solid rgba(16,185,129,0.3)',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#10b981', boxShadow: '0 0 10px #10b981',
              }} />
              Live · v2
            </div>
          </div>

          {/* Title + subtitle */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 2,
              color: '#c4b5fd', textTransform: 'uppercase', marginBottom: 4,
            }}>
              {PAGE_KICKER}
            </div>
            <h1 style={{
              margin: 0, fontSize: 32, fontWeight: 800,
              letterSpacing: -0.8, lineHeight: 1.1,
              background: 'linear-gradient(135deg, #ffffff 0%, #e9d5ff 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {PAGE_TITLE}
            </h1>
            <p style={{
              margin: '8px 0 0', maxWidth: 720,
              fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)',
            }}>
              {PAGE_SUBTITLE}
            </p>
          </div>

          {/* Stat strip */}
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}>
            {HERO_STATS.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </div>

      {/* ── Body: sidebar + content ─────────────────────────────────────── */}
      <div style={{
        maxWidth: PAGE_MAX_WIDTH, margin: '-24px auto 0', padding: '0 20px 60px',
        display: 'grid', gap: 20,
        gridTemplateColumns: 'minmax(0, 1fr)',
      }}>
        <div style={{
          display: 'grid', gap: 24,
          gridTemplateColumns: '220px minmax(0, 1fr)',
        }} className="pid-docs-grid">
          {/* Sticky TOC */}
          <aside style={{ position: 'relative' }}>
            <nav style={{
              position: 'sticky', top: TOP_NAV_OFFSET_PX + 16,
              background: THEME.surface,
              border: `1px solid ${THEME.border}`,
              borderRadius: 14, padding: 12,
              boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                color: THEME.faint, textTransform: 'uppercase',
                padding: '6px 8px 10px',
              }}>
                On this page
              </div>
              {TOC.map((item) => {
                const isActive = activeSection === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goTo(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      border: 'none', textAlign: 'left', cursor: 'pointer',
                      background: isActive ? GRADIENT_SOFT : 'transparent',
                      color: isActive ? THEME.primary : THEME.muted,
                      fontSize: 12, fontWeight: isActive ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = THEME.borderSoft }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon size={14} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && <ChevronRight size={12} />}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Content */}
          <main style={{ minWidth: 0 }}>
            {/* Tab position indicator + prev/next controls */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', marginBottom: 14,
              background: THEME.surface,
              border: `1px solid ${THEME.border}`,
              borderRadius: 12,
              boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
                color: THEME.faint, textTransform: 'uppercase',
              }}>
                {String(activeIndex + 1).padStart(2, '0')} <span style={{ color: THEME.border }}>/</span> {String(TOC.length).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, height: 4, borderRadius: 999, background: THEME.borderSoft, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${((activeIndex + 1) / TOC.length) * 100}%`,
                  background: GRADIENT_ACCENT, borderRadius: 999,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <button
                type="button"
                onClick={goPrev}
                disabled={activeIndex === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 8,
                  background: activeIndex === 0 ? THEME.borderSoft : THEME.surface,
                  color: activeIndex === 0 ? THEME.faint : THEME.ink,
                  border: `1px solid ${THEME.border}`,
                  fontSize: 12, fontWeight: 600,
                  cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <ArrowLeft size={12} /> Prev
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={activeIndex === TOC.length - 1}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 8,
                  background: activeIndex === TOC.length - 1 ? THEME.borderSoft : GRADIENT_ACCENT,
                  color: activeIndex === TOC.length - 1 ? THEME.faint : '#fff',
                  border: 'none',
                  fontSize: 12, fontWeight: 700,
                  cursor: activeIndex === TOC.length - 1 ? 'not-allowed' : 'pointer',
                  boxShadow: activeIndex === TOC.length - 1 ? 'none' : '0 4px 10px rgba(124,58,237,0.25)',
                }}
              >
                Next <ArrowLeft size={12} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>

            {/* Overview */}
            <SectionCard id="overview" active={activeSection === 'overview'} eyebrow="Introduction" title="What is P&ID Checker V2?"
              description="A modern extraction pipeline that recovers pipeline line tags — size · service · spec · serial — from real-world process drawings."
              icon={BookOpen}
            >
              <div style={{
                padding: 16, borderRadius: 12,
                background: GRADIENT_SOFT,
                border: `1px solid #ede9fe`,
                fontSize: 14, color: THEME.ink, lineHeight: 1.65,
              }}>
                Combines <strong>PDF text extraction</strong>, <strong>OCR</strong>, and optional
                <strong> vision-LLM assistance</strong> to recover the full tag record — even when
                tags are split across multiple annotations or the drawing quality is poor.
              </div>

              <div style={{
                display: 'grid', gap: 12, marginTop: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              }}>
                {[
                  { icon: Zap,       label: 'Fast',      body: 'Asynchronous jobs, non-blocking UI' },
                  { icon: Eye,       label: 'Accurate',  body: 'Legend-aware parsing + Vision fallback' },
                  { icon: Shield,    label: 'Private',   body: 'Per-user isolation, BYOK-friendly' },
                  { icon: Download,  label: 'Portable',  body: 'CSV export, JSON via API' },
                ].map((f) => {
                  const Icon = f.icon
                  return (
                    <div key={f.label} style={{
                      padding: 12, borderRadius: 10,
                      background: THEME.surface,
                      border: `1px solid ${THEME.border}`,
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: `${THEME.primary}12`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 8,
                      }}>
                        <Icon size={15} color={THEME.primary} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: THEME.ink }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: THEME.muted, marginTop: 2, lineHeight: 1.5 }}>{f.body}</div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Workflow */}
            <SectionCard id="workflow" active={activeSection === 'workflow'} eyebrow="How it works" title="End-to-end workflow"
              description="A five-step pipeline from PDF drop to CSV export. The reference diagram below shows the full data flow."
              icon={Workflow}
            >
              <figure style={{ margin: '0 0 22px' }}>
                <div style={{
                  border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 10,
                  background: THEME.surfaceSoft,
                  boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.02)',
                }}>
                  <img
                    src={workflowDiagram}
                    alt="P&ID Checker V2 workflow diagram"
                    style={{
                      width: '100%', height: 'auto', display: 'block',
                      borderRadius: 10, boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                    }}
                    loading="lazy"
                  />
                </div>
                <figcaption style={{
                  fontSize: 12, color: THEME.muted, marginTop: 10,
                  lineHeight: 1.55, fontStyle: 'italic',
                }}>
                  {WORKFLOW_DIAGRAM_CAPTION}
                </figcaption>
              </figure>

              {/* Timeline steps */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 19, top: 20, bottom: 20,
                  width: 2, background: `linear-gradient(180deg, ${THEME.primary}30, ${THEME.accent}30)`,
                  borderRadius: 2,
                }} />
                {WORKFLOW_STEPS.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <div key={s.title} style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr', gap: 16,
                      marginBottom: i === WORKFLOW_STEPS.length - 1 ? 0 : 14,
                      position: 'relative',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `linear-gradient(135deg, ${s.accent}, ${s.accent}dd)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 6px 14px ${s.accent}40`,
                        color: '#fff', fontWeight: 800, fontSize: 14,
                        position: 'relative', zIndex: 1,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{
                        padding: '10px 16px', borderRadius: 12,
                        background: THEME.surface,
                        border: `1px solid ${THEME.border}`,
                        transition: 'all 0.15s ease',
                      }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = s.accent
                          e.currentTarget.style.boxShadow = `0 4px 12px ${s.accent}20`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = THEME.border
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                        }}>
                          <Icon size={14} color={s.accent} />
                          <div style={{ fontSize: 14, fontWeight: 700, color: THEME.ink }}>
                            {s.title}
                          </div>
                        </div>
                        <div style={{ fontSize: 12.5, color: THEME.muted, lineHeight: 1.55 }}>
                          {s.body}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Inputs */}
            <SectionCard id="inputs" active={activeSection === 'inputs'} eyebrow="Prerequisites" title="Supported inputs"
              description="One required upload, four optional cross-check documents. All accept standard engineering formats."
              icon={Upload}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                {INPUT_ROWS.map((row) => {
                  const Icon = row.icon
                  return (
                    <div key={row.name} style={{
                      display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 14,
                      alignItems: 'center',
                      padding: '12px 14px', borderRadius: 12,
                      background: row.required ? '#fef3c710' : THEME.surface,
                      border: `1px solid ${row.required ? '#fde68a' : THEME.border}`,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: row.required ? '#fef3c7' : `${THEME.primary}10`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} color={row.required ? '#b45309' : THEME.primary} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.ink }}>
                          {row.name}
                        </div>
                        <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                          {row.detail}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                        padding: '4px 10px', borderRadius: 999,
                        textTransform: 'uppercase',
                        background: row.required ? '#fef3c7' : '#e0e7ff',
                        color: row.required ? '#92400e' : '#3730a3',
                        border: `1px solid ${row.required ? '#fde68a' : '#c7d2fe'}`,
                      }}>
                        {row.required ? 'Required' : 'Optional'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Legend fallback */}
            <SectionCard id="legend" active={activeSection === 'legend'} eyebrow="Resolution order" title="Legend fallback chain"
              description="The extractor walks this chain in order — the first available legend wins. The header pill on the extractor page always shows which layer is in effect."
              icon={Layers}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                {LEGEND_FALLBACK.map((row) => (
                  <div key={row.level} style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14,
                    padding: '14px 16px', borderRadius: 12,
                    background: THEME.surface,
                    border: `1px solid ${THEME.border}`,
                    borderLeft: `4px solid ${THEME.primary}`,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: GRADIENT_ACCENT,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: 14,
                    }}>
                      {row.level}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: THEME.ink, marginBottom: 2 }}>
                        {row.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: THEME.muted, lineHeight: 1.55 }}>
                        {row.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Output columns */}
            <SectionCard id="output" active={activeSection === 'output'} eyebrow="Export schema" title="Output columns (CSV)"
              description="Every extraction produces the same six-column schema. Missing values are emitted as empty strings — never null."
              icon={Table2}
            >
              <div style={{
                display: 'grid', gap: 10,
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              }}>
                {OUTPUT_COLUMNS.map((c, i) => (
                  <div key={c.name} style={{
                    padding: 14, borderRadius: 12,
                    background: THEME.surface,
                    border: `1px solid ${THEME.border}`,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      fontSize: 44, fontWeight: 900, color: `${THEME.primary}08`,
                      lineHeight: 1, padding: '4px 10px', pointerEvents: 'none',
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <code style={{
                      display: 'inline-block', padding: '4px 10px', borderRadius: 8,
                      background: '#0f172a', color: '#a5b4fc',
                      fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      marginBottom: 8,
                    }}>
                      {c.name}
                    </code>
                    <div style={{ fontSize: 12, color: THEME.muted, lineHeight: 1.55 }}>
                      {c.description}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Operational rules */}
            <SectionCard id="rules" active={activeSection === 'rules'} eyebrow="Guardrails" title="Operational rules"
              description="Non-negotiable behaviours that keep extractions safe, private, and auditable."
              icon={Shield}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                {RULES.map((r, i) => {
                  const Icon = r.icon
                  return (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '36px 1fr', gap: 14,
                      alignItems: 'center',
                      padding: '12px 14px', borderRadius: 12,
                      background: THEME.surface,
                      border: `1px solid ${THEME.border}`,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: '#dcfce7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} color={THEME.emerald} />
                      </div>
                      <div style={{ fontSize: 13, color: THEME.ink, lineHeight: 1.55 }}>
                        {r.body}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Tips */}
            <SectionCard id="tips" active={activeSection === 'tips'} eyebrow="Best practice" title="Tips & tricks"
              description="Small habits that consistently deliver higher-quality extractions."
              icon={Lightbulb}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                {TIPS.map((t, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12,
                    alignItems: 'flex-start',
                    padding: '12px 14px', borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 8,
                      background: THEME.amber,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: 12,
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
                      {t}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Footer CTA */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', borderRadius: 14,
              background: GRADIENT_ACCENT, color: '#fff',
              boxShadow: '0 10px 24px rgba(124,58,237,0.3)',
              marginTop: 8,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Sparkles size={18} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
                  Ready to extract?
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                  Upload a P&ID and watch the workflow above run end-to-end.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.PID_VERIFICATION)}
                  title={BACK_TO_V1_TITLE}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.15)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  {BACK_TO_V1_LABEL} <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(BACK_ROUTE)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 10,
                    background: '#fff', color: THEME.primary,
                    border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  Open Checker <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Responsive: collapse sidebar on narrow screens */}
      <style>{`
        @media (max-width: 900px) {
          .pid-docs-grid { grid-template-columns: 1fr !important; }
          .pid-docs-grid aside nav { position: static !important; }
        }
      `}</style>
    </div>
  )
}
