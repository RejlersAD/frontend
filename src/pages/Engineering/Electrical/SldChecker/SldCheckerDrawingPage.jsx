/**
 * SLD Checker — single SLD file (6 steps). Mirrors the P&ID checker
 * DrawingPage: shared Stepper, deep links ?sheet=&step=&finding=&view=,
 * KPI tiles computed from the same lists the tables render, skeletons
 * until data resolves, and honest empty states — nothing is invented.
 *
 * Steps:
 *  1 Drawings & lists   (core staged upload slots + coming optional slots)
 *  2 Legend & checklist (legend, checklist slot, check limits, BYOK drawer)
 *  3 Extraction review  (checker extraction endpoint, 7 tabs, PATCH nodes)
 *  4 Checklist          (AI-SLD-01 · 54 points)
 *  5 Findings           (2D drawing | Network | 3D levels)
 *  6 Report & sign-off  (gate: every Critical / Engineer-Led item verified)
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as svc from './sldChecker.service'
import { PageHeader, KpiTile, Pill, Stepper, DrawingViewer, FindingDetailCard, Drawer, EmptyState } from '../../Process/PidChecker/shared'
import { Stage1Files, Stage2Engine, Stage3Legend } from '../SLDComparison'
import { SldScopeSwitch } from './SldCheckerWorkspacePage'
import NetworkView from './NetworkView'
import '../../Process/PidChecker/pidchecker.css'
import './sldchecker.css'

// three.js is heavy — the 3D levels view loads only when selected.
const Levels3DView = lazy(() => import('./Levels3DView'))

const BASE = '/engineering/electrical/sld'
const STEPS = ['Drawings & lists', 'Legend & checklist', 'Extraction review', 'Checklist', 'Findings', 'Report & sign-off']
const CHECKLIST_LABEL = 'AI-SLD-01 · 54 points'

// Optional input slots — the core upload accepts only sld/equipment/load
// (KIND_CHOICES in the backend), so these stay disabled until the checker
// backend adds them. Never route them through sldService.uploadFile.
const OPTIONAL_SLOTS = [
  { kind: 'cable_schedule', label: 'Cable schedule' },
  { kind: 'relay_settings', label: 'Relay settings' },
  { kind: 'sc_study', label: 'SC study' },
  { kind: 'load_study', label: 'Load study' },
]

const EXTRACTION_TABS = [
  { id: 'sources', label: 'Sources & transformers' },
  { id: 'boards', label: 'Boards & buses' },
  { id: 'feeders', label: 'Feeders' },
  { id: 'motors', label: 'Motors & loads' },
  { id: 'subpanels', label: 'Sub-panels' },
  { id: 'cables', label: 'Cables' },
  { id: 'interfaces', label: 'Interfaces' },
]

const CONFIG_FIELDS = [
  { key: 'dol_kw_gen', label: 'DOL limit — generator boards (kW)', def: 37 },
  { key: 'dol_kw_other', label: 'DOL limit — other boards (kW)', def: 75 },
  { key: 'spare_pct', label: 'Spare ways (%)', def: 20 },
  { key: 'load_amber', label: 'Loading amber (%)', def: 85 },
  { key: 'load_red', label: 'Loading red (%)', def: 100 },
  { key: 'xd_pct_default', label: 'Default X″d (%)', def: 15 },
  { key: 'pf', label: 'Power factor', def: 0.85 },
  { key: 'eff', label: 'Motor efficiency', def: 0.95 },
  { key: 'conf_min', label: 'Minimum AI confidence', def: 0.8 },
]

const FAMILY_OF = { E: 'Engineering', L: 'Load List', D: 'Drafting', Q: 'Equipment' }
const FAMILY_CHIPS = ['All', 'Engineering', 'Load List', 'Drafting', 'Equipment', 'Critical']

// ── normalisers ─────────────────────────────────────────────────────────

const normStatus = s => String(s || 'open').toLowerCase()
const isOpen = f => !['reviewed', 'resolved', 'confirmed', 'rejected'].includes(normStatus(f.status))
const isConfirmed = f => ['reviewed', 'confirmed'].includes(normStatus(f.status))
const isRejected = f => ['resolved', 'rejected'].includes(normStatus(f.status))

function findingLabel(f) {
  if (isConfirmed(f)) return 'Confirmed'
  if (isRejected(f)) return 'Rejected'
  return 'Open'
}

function markerStatus(f) {
  if (isConfirmed(f)) return 'confirmed'
  if (isRejected(f)) return 'rejected'
  const sev = String(f.severity || '').toLowerCase()
  if (sev === 'critical' || sev === 'major') return 'error'
  if (sev === 'minor') return 'minor'
  return 'query'
}

/** API bboxes are sent in PERCENT of the sheet; the viewer wants fractions
 *  0–1. Accept either — never multiply a percent value by 100 again. */
const pct = v => (typeof v === 'number' && Number.isFinite(v) ? (v > 1 ? v / 100 : v) : null)

/** Centre of one bbox ([x0,y0,x1,y1] or {x0,y0,x1,y1}) as a 0..1 fraction. */
function bboxCentre(b) {
  const rect = Array.isArray(b) ? { x0: b[0], y0: b[1], x1: b[2], y1: b[3] } : b
  if (!rect || ![rect.x0, rect.y0, rect.x1, rect.y1].every(v => typeof v === 'number')) return null
  const x = pct((rect.x0 + rect.x1) / 2)
  const y = pct((rect.y0 + rect.y1) / 2)
  return x != null && y != null ? { x, y } : null
}

function normalizeFinding(raw = {}, i = 0) {
  const id = raw.id ?? raw.finding_id ?? `f-${i}`
  const label = raw.label ?? raw.display_id ?? raw.number ?? null
  const familyLetter = String(label || '').charAt(0).toUpperCase()
  let locations = []
  if (Array.isArray(raw.locations) && raw.locations.length > 0) {
    locations = raw.locations.map(bboxCentre).filter(Boolean)
  }
  if (locations.length === 0) {
    const centre = bboxCentre(raw.bbox)
    if (centre) locations = [centre]
  }
  return {
    id,
    label: label ?? `F${i + 1}`,
    title: raw.title ?? raw.issue ?? 'Finding',
    family: raw.family ?? FAMILY_OF[familyLetter] ?? 'Engineering',
    severity: raw.severity ?? 'minor',
    status: raw.status ?? 'open',
    found: raw.found ?? raw.evidence ?? null,
    estimate: raw.estimate ?? raw.expected ?? null,
    basis: raw.basis ?? raw.action ?? raw.action_required ?? null,
    checklist: raw.checklist ?? raw.checklist_item ?? raw.rule_id ?? null,
    sheet: raw.sheet ?? raw.page ?? null,
    sheetId: raw.sheet_id ?? null,
    nodeId: raw.node_id ?? raw.node ?? null,
    locations,
    bbox: raw.bbox ?? null,
    raw,
  }
}

function normSheet(s = {}, i = 0) {
  return {
    id: s.sheet_id ?? s.id ?? `sheet-${i}`,
    pageIndex: s.page_index ?? s.page ?? i,
    drawingNo: s.drawing_no ?? s.drawing_number ?? null,
    rev: s.rev ?? s.revision ?? null,
    title: s.title ?? null,
    status: s.status ?? null,
    raw: s,
  }
}

/** Authenticated sheet image hook (same pattern as useDrawingImage). */
function useSheetImage(sheetId) {
  const [state, setState] = useState({ url: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!sheetId) { setState({ url: null, loading: false, error: null }); return undefined }
    let alive = true
    let objUrl = null
    setState({ url: null, loading: true, error: null })
    svc.fetchSheetImage(sheetId)
      .then(url => {
        if (!alive) { URL.revokeObjectURL(url); return }
        objUrl = url
        setState({ url, loading: false, error: null })
      })
      .catch(err => {
        if (alive) setState({ url: null, loading: false, error: err?.response?.status ?? 'error' })
      })
    return () => {
      alive = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [sheetId, attempt])
  return { ...state, retry: () => setAttempt(a => a + 1) }
}

// ═══════════════════════════════════════════════════════════════════════

export default function SldCheckerDrawingPage() {
  const { projectId, fileId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const step = Math.min(6, Math.max(1, Number(searchParams.get('step')) || 1)) - 1
  const setStep = (index, extra = {}) => {
    const next = new URLSearchParams(searchParams)
    next.set('step', String(index + 1))
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) next.delete(k); else next.set(k, v)
    }
    setSearchParams(next, { replace: false })
  }
  const patchParams = extra => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) next.delete(k); else next.set(k, v)
    }
    setSearchParams(next)
  }

  const selectedPage = Math.max(0, (Number(searchParams.get('sheet')) || 1) - 1)
  const viewParam = searchParams.get('view') // d2 | nw | d3

  const [project, setProject] = useState(null)
  const [state, setState] = useState(null) // core staged state
  const [analysis, setAnalysis] = useState(null) // core analysis (headline)
  const [sheets, setSheets] = useState(null) // checker workspace rows for this file
  const [findings, setFindings] = useState(null) // checker findings (all families/sheets)
  const [topology, setTopology] = useState(null)
  const [checklistSummary, setChecklistSummary] = useState(null)
  const [extractionCounts, setExtractionCounts] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [rerunning, setRerunning] = useState(false)
  const [listsLoaded, setListsLoaded] = useState(false)

  const analysisId = state?.latest_analysis?.id ?? null

  const showToast = useCallback(text => {
    setToast(text)
    setTimeout(() => setToast(null), 6000)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    let st = null
    try {
      st = await svc.getState(projectId)
      setState(st)
      setProject({ project_id: projectId, project_name: st.project_name ?? st.name ?? `Project ${projectId}` })
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    } finally {
      setListsLoaded(true)
    }
    if (!st) return
    const aid = st?.latest_analysis?.id ?? null
    try {
      const data = await svc.workspace(projectId, fileId)
      setSheets((Array.isArray(data) ? data : data?.sheets || []).map(normSheet))
    } catch {
      setSheets([]) // checker backend not connected yet — honest empty states below
    }
    if (aid) {
      try { setAnalysis(await svc.getAnalysis(projectId, aid)) } catch { setAnalysis(null) }
      try {
        const fl = await svc.findings(aid)
        setFindings((Array.isArray(fl) ? fl : fl?.findings || fl?.results || []).map(normalizeFinding))
      } catch {
        setFindings([])
      }
      try { setTopology(await svc.topology(aid)) } catch { setTopology(null) }
    } else {
      setFindings([])
    }
  }, [projectId, fileId])

  useEffect(() => { load() }, [load])

  // ── derived lists (single source of truth) ────────────────────────────
  const byKind = useMemo(() => Object.fromEntries((state?.files || []).map(f => [f.kind, f])), [state])
  const hasSld = Boolean(byKind.sld)

  const currentPage = Math.min(selectedPage, Math.max((sheets || []).length - 1, 0))
  const currentSheet = (sheets || [])[currentPage] ?? null

  const headline = analysis?.headline ?? null
  const analysisReady = analysis?.status === 'completed'

  const sheetFindings = useMemo(
    () => (findings || []).filter(f => currentSheet == null || f.sheet == null || Number(f.sheet) === currentPage + 1 || (currentSheet.id && f.sheetId === currentSheet.id)),
    [findings, currentSheet, currentPage],
  )
  const openFindings = useMemo(() => sheetFindings.filter(isOpen), [sheetFindings])
  const criticalFindings = useMemo(() => sheetFindings.filter(f => ['critical', 'major'].includes(String(f.severity).toLowerCase())), [sheetFindings])

  const reRunChecks = async () => {
    if (rerunning) return
    setRerunning(true)
    try {
      const { analysisId: newId } = await svc.analyse(projectId)
      const poll = async () => {
        try {
          const a = await svc.getAnalysis(projectId, newId)
          if (a.status === 'completed') {
            try {
              await svc.run(newId)
              showToast('Analysis complete — checker rules started.')
            } catch {
              showToast('Analysis complete — the checker backend is not available yet.')
            }
            await load()
            return
          }
          if (a.status === 'failed') { showToast(a.error || 'Analysis failed.'); await load(); return }
        } catch { /* keep polling */ }
        setTimeout(poll, 4000)
      }
      poll()
      showToast('Checks started')
    } catch (err) {
      showToast(err?.response?.data?.error || 'The re-run could not be started.')
    } finally {
      setRerunning(false)
    }
  }

  const patchFindingLocal = (findingId, patch) => {
    setFindings(prev => (prev || []).map(f => (f.id === findingId ? { ...f, ...patch } : f)))
  }
  const confirmFinding = async finding => {
    try {
      await svc.patchFinding(finding.id, { status: 'reviewed' })
      patchFindingLocal(finding.id, { status: 'reviewed' })
    } catch {
      showToast('The finding could not be confirmed. Please retry.')
    }
  }
  const rejectFinding = async (finding, comment) => {
    try {
      await svc.patchFinding(finding.id, { status: 'resolved', comment })
      patchFindingLocal(finding.id, { status: 'resolved' })
    } catch {
      showToast('The finding could not be rejected. Please retry.')
    }
  }

  // ── gates (step 6): every Critical and Engineer-Led checklist item ────
  const gates = useMemo(() => ([
    {
      id: 'inputs',
      label: 'SLD drawing, Equipment List, Load List, legend and checklist provided',
      ok: Boolean(byKind.sld && byKind.equipment && byKind.load && state?.legend?.source),
      missing: 'Add the missing inputs on step 1 and 2',
    },
    {
      id: 'analysis',
      label: 'Analysis completed',
      ok: analysisReady,
      missing: analysis ? `Analysis ${analysis.status}` : 'Not analysed yet — run the checks',
    },
    {
      id: 'engineer',
      label: 'Every Critical and Engineer-Led checklist item verified',
      ok: checklistSummary ? checklistSummary.criticalPending === 0 : false,
      missing: checklistSummary
        ? `${checklistSummary.criticalPending} Critical/Engineer-Led point${checklistSummary.criticalPending === 1 ? '' : 's'} without verification`
        : 'Checklist results are not loaded yet',
    },
    {
      id: 'findings',
      label: 'Findings dispositioned',
      ok: findings != null && openFindings.length === 0,
      missing: openFindings.length > 0 ? `${openFindings.length} finding${openFindings.length === 1 ? '' : 's'} still open` : null,
    },
  ]), [byKind, state, analysis, analysisReady, checklistSummary, findings, openFindings])
  const allGatesGreen = gates.every(g => g.ok)

  // ── header / stepper ──────────────────────────────────────────────────
  const subtitle = currentSheet
    ? `${currentSheet.drawingNo ?? 'Drawing number to confirm'}${currentSheet.rev ? ` · Rev ${currentSheet.rev}` : ''}${currentSheet.title ? ` · ${currentSheet.title}` : ''}`
    : (byKind.sld?.summary?.drawing_no ?? null)

  const stepStates = useMemo(() => ([
    { state: state ? ((state.files || []).length >= 2 ? 'done' : 'warning') : 'todo', statusText: state ? `${(state.files || []).length} of 3 files` : '—' },
    { state: state ? (state.legend?.source ? 'done' : 'warning') : 'todo', statusText: state ? (state.legend?.source ? 'Legend active' : 'Legend missing') : '—' },
    { state: extractionCounts ? (extractionCounts.total > 0 && extractionCounts.confirmed === extractionCounts.total ? 'done' : 'warning') : 'todo', statusText: extractionCounts ? `${extractionCounts.confirmed} / ${extractionCounts.total} confirmed` : 'Not loaded' },
    { state: checklistSummary ? (checklistSummary.criticalPending > 0 ? 'warning' : 'done') : 'todo', statusText: checklistSummary ? `${checklistSummary.withResult} / ${checklistSummary.total} with a result` : `— / 54 with a result` },
    { state: findings == null ? 'todo' : openFindings.length > 0 ? 'warning' : sheetFindings.length > 0 ? 'done' : 'todo', statusText: findings != null ? `${openFindings.length} open` : '—' },
    { state: allGatesGreen ? 'done' : 'warning', statusText: allGatesGreen ? 'Ready' : 'Blocked' },
  ]), [state, extractionCounts, checklistSummary, findings, openFindings, sheetFindings, allGatesGreen])

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'Engineering' },
        { label: '1.4 Electrical' },
        { label: 'SLD Checker', to: BASE },
        { label: project?.project_name ?? '…', to: `${BASE}/projects/${projectId}` },
        { label: currentSheet?.drawingNo ?? byKind.sld?.summary?.drawing_no ?? '…' },
      ]}
      title="SLD Checker"
      pill={<Pill label={`Checklist ${CHECKLIST_LABEL}`} tone="neutral" title="Checklist in effect for this project" />}
      subtitle={subtitle}
      actions={(
        <>
          <SldScopeSwitch projectId={projectId} drawingNo={currentSheet?.drawingNo ?? byKind.sld?.summary?.drawing_no ?? null} sheetCount={(sheets || []).length || null} active="one" fileId={fileId} />
          <Link className="rd-btn rd-btn-secondary" to={`${BASE}/classic`}>Classic comparison</Link>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={reRunChecks} disabled={rerunning}>
            {rerunning ? 'Re-running…' : 'Re-run checks'}
          </button>
          <button type="button" className="rd-btn rd-btn-primary" onClick={() => setStep(5)}>
            Report &amp; sign-off
          </button>
        </>
      )}
    />
  )

  if (error && !state) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }

  // Until the workspace, the findings and the topology have all resolved,
  // show skeletons — never an input/worker alarm on half-loaded state.
  const booted = Boolean(listsLoaded && state && sheets !== null && findings !== null)
  if (!booted) {
    return (
      <div className="pc-page">
        {header}
        <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 72 }} /></div>
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 320 }} /></div>
      </div>
    )
  }

  return (
    <div className="pc-page">
      {header}

      <Stepper
        steps={STEPS.map((label, i) => ({ label, state: stepStates[i].state, statusText: stepStates[i].statusText }))}
        current={step}
        onSelect={i => setStep(i)}
      />

      {toast && (
        <p className="pc-note pc-note-warning" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <span>{toast}</span>
          <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Dismiss message" onClick={() => setToast(null)}>×</button>
        </p>
      )}

      <KpiRow
        headline={headline}
        findings={sheetFindings}
        openFindings={openFindings}
        criticalFindings={criticalFindings}
        findingsLoaded={findings !== null}
        analysisReady={analysisReady}
        goToFindings={family => setStep(4, { family: family === 'All' ? null : family })}
      />

      {step === 0 && (
        <StepDrawingsLists project={project} byKind={byKind} reload={load} setToast={showToast} />
      )}
      {step === 1 && (
        <StepLegendChecklist
          project={project}
          projectId={projectId}
          state={state}
          reload={load}
          hasSld={hasSld}
          analysisId={analysisId}
          setToast={showToast}
        />
      )}
      {step === 2 && (
        <StepExtraction
          analysisId={analysisId}
          analysisReady={analysisReady}
          activeTab={searchParams.get('tab') || EXTRACTION_TABS[0].id}
          onTabChange={t => patchParams({ tab: t === EXTRACTION_TABS[0].id ? null : t })}
          onConfirmedChange={(confirmed, total) => setExtractionCounts({ confirmed, total })}
          onRunChecks={reRunChecks}
          onShowOnDrawing={item => {
            if (item.bbox) {
              const c = bboxCentre(item.bbox)
              const rect = Array.isArray(item.bbox) ? item.bbox : [item.bbox.x0, item.bbox.y0, item.bbox.x1, item.bbox.y1]
              setStep(4, { view: 'd2', ring: rect.map(v => (typeof v === 'number' ? (v > 1 ? v : v * 100) : 0)).join(','), ...(c ? {} : {}) })
            } else {
              showToast('No coordinates on the drawing for this value yet.')
            }
          }}
        />
      )}
      {step === 3 && (
        <StepChecklist
          analysisId={analysisId}
          analysisReady={analysisReady}
          searchParams={searchParams}
          patchParams={patchParams}
          onSummary={setChecklistSummary}
          onRunChecks={reRunChecks}
          onShowFinding={label => setStep(4, { finding: label })}
        />
      )}
      {step === 4 && (
        <StepFindings
          sheets={sheets || []}
          currentPage={currentPage}
          onPageChange={idx => patchParams({ sheet: String(idx + 1) })}
          findings={findings || []}
          searchParams={searchParams}
          patchParams={patchParams}
          viewParam={viewParam}
          topology={topology}
          analysisReady={analysisReady}
          onRunChecks={reRunChecks}
          onConfirm={confirmFinding}
          onReject={rejectFinding}
        />
      )}
      {step === 5 && (
        <StepReport
          gates={gates}
          allGatesGreen={allGatesGreen}
          analysisId={analysisId}
          analysisReady={analysisReady}
          projectId={projectId}
          setToast={showToast}
        />
      )}
    </div>
  )
}

// ── KPI tiles (7) — computed from the same lists the tables render ──────

function KpiRow({ headline, findings, openFindings, criticalFindings, findingsLoaded, analysisReady, goToFindings }) {
  const h = headline || {}
  const meta = !analysisReady ? 'Available after the analysis completes' : null
  return (
    <div className="pc-kpi-grid-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }} aria-label="SLD summary">
      <KpiTile label="Boards on SLD" value={analysisReady ? (h.boards ?? '—') : '—'} meta={analysisReady ? `+ ${h.transformers ?? 0} transformers · ${h.generators ?? 0} generators` : meta} />
      <KpiTile label="Findings open" value={findingsLoaded ? openFindings.length : '—'} danger={findingsLoaded && openFindings.length > 0} meta={findingsLoaded ? `${findings.length} raised on this sheet` : 'Loading findings…'} onClick={() => goToFindings('All')} />
      <KpiTile label="Critical" value={findingsLoaded ? criticalFindings.length : '—'} danger={findingsLoaded && criticalFindings.length > 0} meta={findingsLoaded ? 'Critical and major findings' : 'Loading findings…'} onClick={() => goToFindings('Critical')} />
      <KpiTile label="Load List conflicts" value={analysisReady ? `${h.loadConflicts ?? 0} of ${h.loadTotal ?? 0}` : '—'} danger={analysisReady && (h.loadConflicts ?? 0) > 0} meta={analysisReady ? 'Board, rating or tag' : meta} onClick={() => goToFindings('Load List')} />
      <KpiTile label="Equipment List" value={analysisReady ? `${h.matched ?? 0} of ${h.matchedTotal ?? 0}` : '—'} meta={analysisReady ? 'matched with the Equipment List' : meta} onClick={() => goToFindings('Equipment')} />
      <KpiTile label="Drafting" value={analysisReady ? (h.draftingTotal ?? '—') : '—'} meta={analysisReady ? `${h.draftingHigh ?? 0} high · ${h.draftingMedium ?? 0} medium` : meta} onClick={() => goToFindings('Drafting')} />
      <KpiTile label="Interfaces" value={analysisReady ? (h.interfaces ?? '—') : '—'} meta={analysisReady ? 'Other areas — not compared' : meta} />
    </div>
  )
}

// ── Step 1: Drawings & lists ────────────────────────────────────────────

function StepDrawingsLists({ project, byKind, reload, setToast }) {
  return (
    <>
      <section className="pc-section" aria-label="Drawings and lists">
        <Stage1Files project={project} byKind={byKind} reload={reload} setToast={setToast} locked={false} />
      </section>
      <section className="pc-section" aria-label="Optional inputs">
        <h2 className="pc-section-title">Optional inputs</h2>
        <div className="sc-slot-grid">
          {OPTIONAL_SLOTS.map(slot => (
            <div key={slot.kind} className="pc-card pc-card-pad" style={{ opacity: 0.65 }}>
              <div className="pc-slot-top">
                <h3 className="pc-card-title">{slot.label}</h3>
                <Pill label="Not available" tone="neutral" />
              </div>
              <p className="pc-slot-desc">Optional reference for deeper checks.</p>
              <div>
                <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" disabled title="Coming with the checker backend">
                  Upload
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

// ── Step 2: Legend & checklist (+ check limits, BYOK) ───────────────────

function StepLegendChecklist({ project, projectId, state, reload, hasSld, analysisId, setToast }) {
  const [showKeys, setShowKeys] = useState(false)
  const [config, setConfig] = useState(null) // null = loading, {} = values
  const [configError, setConfigError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    svc.getConfig(projectId)
      .then(data => { if (alive) setConfig({ ...Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.def])), ...(data || {}) }) })
      .catch(err => {
        if (!alive) return
        if (err?.response?.status === 404) setConfigError('not-available')
        else setConfigError('error')
        setConfig(Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.def])))
      })
    return () => { alive = false }
  }, [projectId])

  const saveConfig = async () => {
    setSaving(true)
    try {
      await svc.putConfig(projectId, config)
      setConfigError(null)
      setToast('Check limits saved. Re-run checks to apply them.')
    } catch (err) {
      setToast(err?.response?.data?.error || 'The check limits could not be saved — the checker backend is not available yet.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="pc-section" aria-label="Legend">
        <Stage3Legend project={project} state={state} reload={reload} locked={false} notNeeded={!hasSld} />
      </section>

      <section className="pc-section" aria-label="Checklist">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">Checklist</h2>
            <Pill label="Provided" tone="success" />
          </div>
          <div className="pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p className="pc-slot-desc" style={{ margin: 0 }}>
              The default checklist <span className="pc-mono">{CHECKLIST_LABEL}</span> applies to every SLD in this project.
            </p>
            <div>
              {analysisId ? (
                <Link className="rd-btn rd-btn-secondary rd-btn-sm" to={`?step=4`}>Open the checklist</Link>
              ) : (
                <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" disabled title="Available after the first analysis">Open the checklist</button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="pc-section" aria-label="Check limits">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">Check limits</h2>
            <Pill label={configError === 'not-available' ? 'Defaults — backend not connected' : 'Configured'} tone={configError === 'not-available' ? 'neutral' : 'success'} />
          </div>
          <div className="pc-card-pad">
            {config === null ? (
              <div className="pc-skeleton" style={{ height: 120 }} />
            ) : (
              <>
                <div className="sc-config-grid">
                  {CONFIG_FIELDS.map(f => (
                    <label key={f.key} className="pc-field" style={{ margin: 0 }}>
                      <span className="pc-label">{f.label}</span>
                      <input
                        className="pc-input"
                        type="number"
                        step="any"
                        value={config[f.key] ?? f.def}
                        onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                        aria-label={f.label}
                      />
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={saveConfig} disabled={saving}>
                    {saving ? 'Saving…' : 'Save limits'}
                  </button>
                  {configError === 'not-available' && (
                    <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                      Saving is available after the checker backend is connected; the defaults above are in effect.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="pc-section" aria-label="AI and keys">
        <div className="pc-card">
          <div className="pc-card-header">
            <h2 className="pc-card-title">AI &amp; keys</h2>
            <Pill label={state?.byok ? `Using your key ••••${state.byok.last4}` : 'Connect your key'} tone={state?.byok ? 'ai' : 'warning'} />
          </div>
          <div className="pc-card-pad">
            <p className="pc-slot-desc" style={{ margin: '0 0 0.625rem' }}>
              {state?.byok
                ? 'Your personal key reads the SLD. It is stored encrypted on the server and never shown again.'
                : 'No key is connected. The AI-assisted checks stay queries until you connect one — every other step works without it.'}
            </p>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setShowKeys(true)}>
              AI &amp; keys
            </button>
          </div>
        </div>
        <Drawer open={showKeys} onClose={() => setShowKeys(false)} title="AI & keys">
          <Stage2Engine state={state} reload={reload} locked={false} notNeeded={!hasSld} />
        </Drawer>
      </section>
    </>
  )
}

// ── Step 3: Extraction review ───────────────────────────────────────────

function StepExtraction({ analysisId, analysisReady, activeTab, onTabChange, onConfirmedChange, onRunChecks, onShowOnDrawing }) {
  const [items, setItems] = useState(null) // array of nodes for the active tab
  const [apiAvailable, setApiAvailable] = useState(true)
  const [actionError, setActionError] = useState(null)
  const listRef = useRef(null)

  const tab = EXTRACTION_TABS.find(t => t.id === activeTab) ?? EXTRACTION_TABS[0]

  const load = useCallback(async () => {
    if (!analysisId) return
    try {
      const data = await svc.extraction(analysisId, tab.id)
      const raw = Array.isArray(data) ? data : (data?.items || data?.nodes || data?.results || [])
      setItems(raw)
      setApiAvailable(true)
    } catch (err) {
      if (err?.response?.status === 404) setApiAvailable(false)
      else setActionError('The extraction could not be loaded. Please retry.')
      setItems([])
    }
  }, [analysisId, tab.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setItems(null) }, [tab.id]) // tab switch: skeleton, not stale rows

  const counts = useMemo(() => ({
    total: (items || []).length,
    confirmed: (items || []).filter(i => i.confirmed).length,
  }), [items])

  const reportedRef = useRef(null)
  useEffect(() => {
    const key = `${counts.confirmed}/${counts.total}`
    if (reportedRef.current !== key) {
      reportedRef.current = key
      onConfirmedChange?.(counts.confirmed, counts.total)
    }
  }, [counts, onConfirmedChange])

  const patchItem = async (item, patch) => {
    try {
      await svc.patchNode(item.id ?? item.node_id, patch)
      await load()
    } catch {
      setActionError('The change could not be saved. Please retry.')
    }
  }

  const confirmTab = async () => {
    const pending = (items || []).filter(i => !i.confirmed)
    for (const item of pending) {
      try { await svc.patchNode(item.id ?? item.node_id, { confirmed: true }) } catch { /* keep going */ } // eslint-disable-line no-await-in-loop
    }
    await load()
  }

  const onKeyDown = (event, index) => {
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % EXTRACTION_TABS.length
    if (event.key === 'ArrowLeft') next = (index - 1 + EXTRACTION_TABS.length) % EXTRACTION_TABS.length
    if (next !== null) {
      event.preventDefault()
      listRef.current?.querySelectorAll('.pc-tab')?.[next]?.focus()
      onTabChange(EXTRACTION_TABS[next].id)
    }
  }

  if (!analysisId || !analysisReady) {
    return (
      <section className="pc-section" aria-label="Extraction review">
        <div className="pc-card pc-card-pad" style={{ textAlign: 'center' }}>
          <p className="pc-empty-title">Run checks to extract this SLD.</p>
          <button type="button" className="rd-btn rd-btn-primary" onClick={onRunChecks}>Run checks</button>
        </div>
      </section>
    )
  }

  const rows = items || []
  const allConfirmed = rows.length > 0 && rows.every(i => i.confirmed)

  return (
    <section className="pc-section" aria-label="Extraction review">
      <div className="pc-card-header" style={{ padding: 0 }}>
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
          {items ? `${counts.confirmed} of ${counts.total} confirmed` : 'Reading the extraction…'}
        </p>
        <button
          type="button"
          className={`rd-btn ${allConfirmed ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
          disabled={rows.length === 0 || allConfirmed}
          onClick={confirmTab}
        >
          {allConfirmed ? 'This tab is confirmed' : 'Confirm this tab'}
        </button>
      </div>

      <div className="pc-tabs" role="tablist" ref={listRef}>
        {EXTRACTION_TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab.id}
            className={`pc-tab${t.id === tab.id ? ' pc-tab-active' : ''}`}
            onClick={() => onTabChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && <p className="pc-error" role="alert">{actionError}</p>}

      <div className="pc-card pc-table-wrap" role="tabpanel">
        {!apiAvailable ? (
          <EmptyState title="The extraction detail is not available yet.">
            Available after the checker backend is connected and the check run has saved extraction detail.
          </EmptyState>
        ) : items === null ? (
          <div style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${tab.label.toLowerCase()} were read from this SLD.`}>
            Nothing was extracted for this kind — the sheet may not contain any.
          </EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th aria-label="OK">OK</th><th>Tag</th><th>Key data</th><th>Fed from</th><th>Confidence</th><th>Source</th><th>Check</th><th>Drawing</th></tr>
            </thead>
            <tbody>
              {rows.map((item, i) => (
                <ExtractionRow key={item.id ?? item.node_id ?? i} item={item} onPatch={patchItem} onShowOnDrawing={onShowOnDrawing} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function ExtractionRow({ item, onPatch, onShowOnDrawing }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const keyData = item.key_data ?? item.data ?? item.summary ?? item.description ?? null
  const keyDataText = keyData == null ? '—' : typeof keyData === 'string' ? keyData : Object.entries(keyData).map(([k, v]) => `${k}: ${v}`).join(' · ')
  const confidence = item.confidence ?? null
  const checkLabel = item.check ?? item.check_label ?? (item.finding_ids?.length ? 'Finding raised' : 'Matches drawing')
  const checkTone = item.check_tone ?? (item.finding_ids?.length ? 'danger' : item.check ? 'warning' : 'success')

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== item.tag) onPatch(item, { corrected_value: draft.trim() })
  }

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={Boolean(item.confirmed)}
          onChange={e => onPatch(item, { confirmed: e.target.checked })}
          aria-label={`Confirm ${item.tag ?? 'row'}`}
          style={{ width: 18, height: 18, accentColor: 'var(--rd-primary)' }}
        />
      </td>
      <td className="pc-mono" onClick={() => { setDraft(item.corrected_value ?? item.tag ?? ''); setEditing(true) }} style={{ cursor: 'text' }} title="Click to correct the value">
        {editing ? (
          <span style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <input
              className="pc-input pc-mono"
              style={{ minHeight: 30, minWidth: 160 }}
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
              aria-label={`Correct ${item.tag ?? 'tag'}`}
            />
            <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={commit}>Save</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </span>
        ) : (
          item.corrected_value ?? item.tag ?? '—'
        )}
      </td>
      <td>{keyDataText}</td>
      <td className="pc-mono">{item.fed_from ?? item.fedFrom ?? '—'}</td>
      <td>{confidence != null ? confidence : '—'}</td>
      <td><Pill label={item.source === 'checker' ? 'checker' : 'core'} tone={item.source === 'checker' ? 'info' : 'neutral'} /></td>
      <td><Pill label={checkLabel} tone={checkTone} /></td>
      <td>
        {item.bbox && onShowOnDrawing ? (
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onShowOnDrawing(item)}>
            Show on drawing
          </button>
        ) : '—'}
      </td>
    </tr>
  )
}

// ── Step 4: Checklist (AI-SLD-01 · 54 points) ───────────────────────────

const CL_RESULT_TONES = { OK: 'success', 'Non-Conformance': 'danger', Query: 'warning', 'Not Verifiable': 'neutral' }
const CL_SEV_TONES = { Critical: 'danger', Major: 'warning', Minor: 'neutral' }

function StepChecklist({ analysisId, analysisReady, searchParams, patchParams, onSummary, onRunChecks, onShowFinding }) {
  const fResult = searchParams.get('cresult') || 'All'
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    if (!analysisId) return
    try {
      setData(await svc.getChecklist(analysisId))
      setLoadError(null)
    } catch (err) {
      setLoadError(err?.response?.status === 404 ? 'not-available' : 'error')
    }
  }, [analysisId])

  useEffect(() => { if (analysisReady) load() }, [load, analysisReady])

  const items = useMemo(() => data?.items ?? (Array.isArray(data) ? data : []), [data])

  const reportedRef = useRef(null)
  useEffect(() => {
    if (!data) return
    const applicable = items.filter(i => i.applicability === 'Y')
    const criticalPending = applicable.filter(i =>
      (i.severity === 'Critical' || i.mode === 'Engineer-Led') && !i.engineer_verification,
    ).length
    const withResult = items.filter(i => i.applicability === 'Y' && i.ai_result).length
    const s = { total: items.length, withResult, criticalPending }
    const key = JSON.stringify(s)
    if (reportedRef.current !== key) {
      reportedRef.current = key
      onSummary?.(s)
    }
  }, [data, items, onSummary])

  const patchItem = async (item, body) => {
    try {
      await svc.patchChecklistItem(analysisId, item.no, body)
      await load()
    } catch {
      setMessage('The change could not be saved. Please retry.')
    }
  }

  const visible = items.filter(it => fResult === 'All' || it.ai_result === fResult)

  if (!analysisId || !analysisReady) {
    return (
      <section className="pc-section" aria-label="Checklist">
        <div className="pc-card">
          <EmptyState title="Check points are evaluated by the check run.">
            Run checks to evaluate checklist AI-SLD-01.
          </EmptyState>
        </div>
      </section>
    )
  }
  if (data === null && !loadError) {
    return (
      <section className="pc-section" aria-label="Checklist">
        <div className="pc-card" style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 140 }} /></div>
      </section>
    )
  }
  if (loadError) {
    return (
      <section className="pc-section" aria-label="Checklist">
        <div className="pc-card">
          <EmptyState title={loadError === 'not-available' ? 'The checklist is not available yet.' : 'The checklist could not be loaded.'}>
            {loadError === 'not-available'
              ? 'Available after the checker backend is connected and the check run has evaluated checklist AI-SLD-01.'
              : 'Please retry.'}
          </EmptyState>
        </div>
      </section>
    )
  }

  const resultNames = ['All', ...new Set(items.map(i => i.ai_result).filter(Boolean))]

  return (
    <section className="pc-section" aria-label="Checklist">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
          {data?.template?.code ?? 'AI-SLD-01'} · {items.length} points
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="rd-btn rd-btn-primary rd-btn-sm"
            onClick={async () => {
              try { await svc.downloadChecklistReport(analysisId) } catch { setMessage('The report could not be generated yet.') }
            }}
          >
            Download checklist report (.xlsx)
          </button>
        </span>
      </div>

      <div className="pc-chips" role="group" aria-label="Filter by result">
        {resultNames.map(name => (
          <button key={name} type="button" className={`pc-chip${fResult === name ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={fResult === name} onClick={() => patchParams({ cresult: name === 'All' ? null : name })}>
            {name}
            <span className="pc-chip-count">{name === 'All' ? items.length : items.filter(i => i.ai_result === name).length}</span>
          </button>
        ))}
      </div>

      {message && (
        <p className="pc-note pc-note-warning" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <span>{message}</span>
          <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button>
        </p>
      )}

      <div className="pc-card pc-table-wrap">
        {visible.length === 0 ? (
          <EmptyState title="No check points match this filter.">Change the filter to see the other points.</EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th>No.</th><th>Check point</th><th>Mode</th><th>Severity</th><th>Applicability</th><th>AI Result</th><th>Engineer</th><th>Remarks</th><th /></tr>
            </thead>
            <tbody>
              {visible.map(it => (
                <ChecklistRow key={it.no} item={it} onPatch={patchItem} onShowFinding={onShowFinding} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function ChecklistRow({ item, onPatch, onShowFinding }) {
  const [draft, setDraft] = useState(item.remarks || '')
  useEffect(() => { setDraft(item.remarks || '') }, [item.remarks, item.no])
  const noResult = item.applicability !== 'Y' || !item.ai_result
  return (
    <tr>
      <td className="pc-mono">{item.no}</td>
      <td>{item.check_point}</td>
      <td><Pill label={item.mode ?? 'Automated'} tone={item.mode === 'Engineer-Led' ? 'neutral' : 'info'} /></td>
      <td><Pill label={item.severity ?? 'Minor'} tone={CL_SEV_TONES[item.severity] ?? 'neutral'} /></td>
      <td>
        <span className="pc-seg" role="group" aria-label={`Applicability for item ${item.no}`} style={{ verticalAlign: 'middle' }}>
          {['Y', 'N', 'NA'].map(v => (
            <button
              key={v}
              type="button"
              className={`pc-seg-btn${item.applicability === v ? ' pc-seg-btn-active' : ''}`}
              style={{ minHeight: 26, padding: '0 0.5rem' }}
              aria-pressed={item.applicability === v}
              onClick={() => onPatch(item, { applicability: v })}
            >
              {v}
            </button>
          ))}
        </span>
      </td>
      <td>{noResult ? '—' : <Pill label={item.ai_result} tone={CL_RESULT_TONES[item.ai_result] ?? 'neutral'} />}</td>
      <td>
        <select
          className="pc-select"
          style={{ minHeight: 30 }}
          value={item.engineer_verification ?? ''}
          onChange={e => onPatch(item, { engineer_verification: e.target.value })}
          aria-label={`Engineer verification for item ${item.no}`}
        >
          <option value="">—</option>
          <option value="Agree">Agree</option>
          <option value="Disagree">Disagree</option>
          <option value="Modified">Modified</option>
        </select>
      </td>
      <td>
        <input
          className="pc-input"
          style={{ minHeight: 30, minWidth: 140 }}
          value={draft}
          placeholder="—"
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (draft.trim() !== (item.remarks || '')) onPatch(item, { remarks: draft.trim() }) }}
          aria-label={`Remarks for item ${item.no}`}
        />
      </td>
      <td>
        {(item.finding_labels || item.finding_ids || []).length > 0 && (
          <span style={{ display: 'inline-flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {(item.finding_labels ?? item.finding_ids).map((lbl, i) => (
              <button key={`${lbl}-${i}`} type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onShowFinding?.(lbl)} aria-label={`Open finding ${lbl}`}>
                {lbl}
              </button>
            ))}
          </span>
        )}
      </td>
    </tr>
  )
}

// ── Step 5: Findings (2D | Network | 3D) ────────────────────────────────

function StepFindings({ sheets, currentPage, onPageChange, findings, searchParams, patchParams, viewParam, topology, analysisReady, onRunChecks, onConfirm, onReject }) {
  const view = ['d2', 'nw', 'd3'].includes(viewParam) ? viewParam : 'd2'
  const setView = v => patchParams({ view: v === 'd2' ? null : v })
  const familyFilter = searchParams.get('family') || 'All'
  const findingParam = searchParams.get('finding')
  const sheetScope = searchParams.get('scope') === 'both' ? 'both' : 'sheet'
  const [toggles, setToggles] = useState({ loading: true, fault: true, findings: true, loads: true })
  const detailRef = useRef(null)

  const currentSheet = sheets[currentPage] ?? null

  const scoped = useMemo(() => findings.filter(f => {
    if (sheetScope === 'both') return true
    if (currentSheet == null) return true
    return f.sheet == null || Number(f.sheet) === currentPage + 1 || (currentSheet.id && f.sheetId === currentSheet.id)
  }), [findings, sheetScope, currentSheet, currentPage])

  const filtered = useMemo(() => scoped.filter(f => {
    if (familyFilter === 'All') return true
    if (familyFilter === 'Critical') return ['critical', 'major'].includes(String(f.severity).toLowerCase())
    return f.family === familyFilter
  }), [scoped, familyFilter])

  const selected = useMemo(() => {
    if (findingParam) {
      const hit = filtered.find(f => f.label === findingParam) || findings.find(f => f.label === findingParam)
      if (hit) return hit
    }
    return filtered[0] ?? null
  }, [filtered, findings, findingParam])

  const selectFinding = f => patchParams({ finding: f ? f.label : null })

  const familyCounts = useMemo(() => {
    const counts = { All: scoped.length, Critical: 0 }
    for (const f of scoped) {
      counts[f.family] = (counts[f.family] ?? 0) + 1
      if (['critical', 'major'].includes(String(f.severity).toLowerCase())) counts.Critical += 1
    }
    return counts
  }, [scoped])

  // 2D markers: bbox is PERCENT of the sheet — never multiply by 100 again.
  const markers = filtered.map(f => ({ id: f.id, number: f.label, displayId: f.label, status: markerStatus(f), locations: f.locations }))
  const notLocated = filtered.filter(f => f.locations.length === 0)

  const image = useSheetImage(currentSheet?.id)
  const ring = useMemo(() => {
    const raw = searchParams.get('ring')
    if (!raw) return null
    const [x0, y0, x1, y1] = raw.split(',').map(Number)
    return [x0, y0, x1, y1].every(Number.isFinite) ? { x0, y0, x1, y1 } : null
  }, [searchParams])

  if (!analysisReady) {
    return (
      <section className="pc-section" aria-label="Findings">
        <div className="pc-card pc-card-pad" style={{ textAlign: 'center' }}>
          <p className="pc-empty-title">Checks have not run yet.</p>
          <p className="pc-empty-text">Findings appear here after the check run finishes.</p>
          <button type="button" className="rd-btn rd-btn-primary" onClick={onRunChecks}>Run checks</button>
        </div>
      </section>
    )
  }

  return (
    <section className="pc-section" aria-label="Findings">
      {/* toolbar */}
      <div className="pc-segbar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div className="pc-seg" role="group" aria-label="Viewer mode">
          {[['d2', '2D drawing'], ['nw', 'Network'], ['d3', '3D levels']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pc-seg-btn${view === id ? ' pc-seg-btn-active' : ''}`}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {sheets.length > 0 && (
          <select
            className="pc-select"
            style={{ minHeight: 30, minWidth: 220 }}
            value={sheetScope === 'both' ? 'both' : currentPage}
            onChange={e => {
              if (e.target.value === 'both') patchParams({ scope: 'both' })
              else { patchParams({ scope: null }); onPageChange(Number(e.target.value)) }
            }}
            aria-label="Sheet selector"
          >
            {sheets.map((s, i) => (
              <option key={s.id} value={i}>
                {`Sheet ${String(i + 1).padStart(3, '0')}${s.drawingNo ? ` · ${s.drawingNo}` : ''}`}
              </option>
            ))}
            {sheets.length > 1 && <option value="both">Both sheets</option>}
          </select>
        )}
        <div className="pc-chips" role="group" aria-label="Overlay toggles">
          {[['loading', 'Loading'], ['fault', 'Fault level'], ['findings', 'Findings'], ['loads', 'Loads']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`pc-chip${toggles[key] ? ' pc-chip-active' : ''}`}
              style={{ minHeight: 30 }}
              aria-pressed={toggles[key]}
              onClick={() => setToggles(prev => ({ ...prev, [key]: !prev[key] }))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pc-split">
        <div style={{ minWidth: 0 }}>
          {view === 'd2' && (
            <DrawingViewer
              imageUrl={image.url}
              imageLoading={image.loading}
              imageError={image.error}
              onImageRetry={image.retry}
              findings={markers}
              ring={ring}
              selectedId={selected?.id ?? null}
              onSelect={id => selectFinding(findings.find(f => f.id === id))}
            />
          )}
          {view === 'nw' && (
            <NetworkView
              topology={topology}
              findings={filtered}
              selectedId={selected?.id ?? null}
              onSelect={id => selectFinding(findings.find(f => f.id === id))}
              toggles={toggles}
            />
          )}
          {view === 'd3' && (
            <Suspense fallback={<div className="pc-skeleton" style={{ height: 420 }} />}>
              <Levels3DView
                topology={topology}
                findings={filtered}
                selectedId={selected?.id ?? null}
                onSelect={id => selectFinding(findings.find(f => f.id === id))}
              />
            </Suspense>
          )}
          {view === 'd2' && notLocated.length > 0 && (
            <p className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)', margin: '0.5rem 0 0' }}>
              Not located on the drawing: {notLocated.map(f => f.label).join(', ')}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <div className="pc-card">
            <div className="pc-card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 className="pc-card-title">Findings</h2>
              <div className="pc-chips" role="group" aria-label="Filter findings by family">
                {FAMILY_CHIPS.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={`pc-chip${familyFilter === name ? ' pc-chip-active' : ''}`}
                    style={{ minHeight: 30 }}
                    aria-pressed={familyFilter === name}
                    onClick={() => patchParams({ family: name === 'All' ? null : name, finding: null })}
                  >
                    {name}<span className="pc-chip-count">{familyCounts[name] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <EmptyState title={findings.length === 0 ? 'No findings were raised on this SLD.' : `No ${familyFilter} findings.`}>
                {findings.length === 0 ? 'Findings appear here after the check run finishes.' : 'Change the filter to see the other findings.'}
              </EmptyState>
            ) : (
              <div className="pc-flist" role="listbox" aria-label="Findings list" tabIndex={0}>
                {filtered.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={selected?.id === f.id}
                    className={`pc-flist-item${selected?.id === f.id ? ' pc-flist-item-selected' : ''}`}
                    onClick={() => selectFinding(f)}
                  >
                    <span className="pc-flist-num">{f.label}</span>
                    <span className="pc-flist-title">{f.title}</span>
                    <Pill label={findingLabel(f)} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div ref={detailRef}>
              <FindingDetailCard
                finding={{
                  ...selected,
                  displayId: selected.label,
                  status: findingLabel(selected),
                  expected: selected.estimate,
                  basis: selected.basis,
                }}
                onConfirm={() => onConfirm(selected)}
                onReject={comment => onReject(selected, comment)}
                onNext={filtered.length > 1 ? () => {
                  const idx = filtered.findIndex(f => f.id === selected.id)
                  selectFinding(filtered[Math.min(idx + 1, filtered.length - 1)] ?? selected)
                } : null}
              />
              {selected.locations.length > 0 && view !== 'd2' && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setView('d2')}>
                    Show on drawing
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Step 6: Report & sign-off ───────────────────────────────────────────

function StepReport({ gates, allGatesGreen, analysisId, analysisReady, projectId, setToast }) {
  const [busy, setBusy] = useState(null) // 'checklist' | 'workbook'

  const downloadChecklist = async () => {
    setBusy('checklist')
    try {
      await svc.downloadChecklistReport(analysisId)
    } catch {
      setToast('The checklist report could not be generated yet — the checker backend is not connected.')
    } finally {
      setBusy(null)
    }
  }

  const downloadWorkbook = async () => {
    setBusy('workbook')
    try {
      await svc.exportAnalysis(projectId, analysisId, 'workbook')
    } catch {
      setToast('The comparison workbook could not be exported.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="pc-section" aria-label="Report and sign-off">
      <div className="pc-split" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
        <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 className="pc-card-title">Submission</h2>
            <Pill label={allGatesGreen ? 'Ready to submit' : 'Draft'} tone={allGatesGreen ? 'success' : 'warning'} />
          </div>
          <div className="pc-gates">
            {gates.map(g => (
              <p key={g.id} className={`pc-note ${g.ok ? 'pc-note-success' : 'pc-note-warning'}`} style={{ margin: 0 }}>
                {g.ok ? `${g.label} — done.` : `${g.label} — ${g.missing}.`}
              </p>
            ))}
          </div>
          <div>
            <button
              type="button"
              className="rd-btn rd-btn-primary"
              disabled={!allGatesGreen}
              title={allGatesGreen ? undefined : 'Every gate must be green before submitting'}
              onClick={() => setToast('Sign-off submission is available after the backend sign-off workflow endpoint is connected.')}
            >
              Submit for review
            </button>
          </div>
        </div>

        <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', minWidth: 0 }}>
          <h2 className="pc-card-title">Downloads</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="rd-btn rd-btn-secondary" disabled={!analysisReady || busy === 'checklist'} onClick={downloadChecklist}>
              {busy === 'checklist' ? 'Preparing…' : 'Checklist report (AI-SLD-01 .xlsx)'}
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" disabled={!analysisReady || busy === 'workbook'} onClick={downloadWorkbook}>
              {busy === 'workbook' ? 'Preparing…' : 'Comparison workbook (.xlsx)'}
            </button>
            <button type="button" className="rd-btn rd-btn-secondary" disabled title="Available after the checker backend adds the marked-up PDF export">
              Marked-up drawing (.pdf)
            </button>
          </div>
          <p className="pc-help" style={{ margin: 0 }}>
            The checklist report carries every AI result and engineer verification for sign-off.
          </p>
        </div>
      </div>
    </section>
  )
}
