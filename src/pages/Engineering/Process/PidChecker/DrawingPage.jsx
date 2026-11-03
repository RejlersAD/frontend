/**
 * Screen 2 §3 — Single drawing (6 steps).
 *
 * Data sources (all real, nothing invented):
 *  - results payload: GET results/<doc>/  (PIDVDocumentSerializer — drawings[]
 *    with metadata { line_tags, tag_positions, red_annotations,
 *    continuation_refs, extraction_summary } + issues[] per drawing)
 *  - reference data:  GET projects/<id>/reference-data/
 *  - finding review:  PATCH findings/<id>/ (severity/status only — the
 *    backend has no comment field, so reject comments are kept in
 *    localStorage keyed by drawing id)
 *  - extraction confirmations and engineer point statuses that have no
 *    finding row: localStorage keyed by drawing id (documented in §5).
 *
 * Checklist: there is no checklist-definition endpoint in the v2 backend,
 * so step 4 renders the spec's honest empty state and checklist-derived
 * numbers show "—" everywhere (header pill, KPI tiles, gates).
 *
 * Deep links: ?step=1..6 · ?tab=<extraction tab> · ?finding=F<n> ·
 * ?by / ?result (checklist chip presets) · ?highlight=<tag>.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as svc from './pidChecker.service'
import { PageHeader, KpiTile, Pill, ReadabilityPill, Stepper, DrawingViewer, FindingDetailCard, EmptyState } from './shared'
import ScopeSwitch, { rememberLastSheet } from './shared/ScopeSwitch'
import { useDrawingImage } from './shared/DrawingViewer'
import './pidchecker.css'

// three.js is heavy — the 3D findings viewer loads only when the user
// switches to 3D (or the detail card opens its section view).
const Findings3DViewer = lazy(() => import('./threeD/Findings3DViewer'))

const STEPS = ['Drawings', 'Legend & checklist', 'Extraction review', 'Checklist', 'Findings', 'Report & sign-off']

// Spec §3 step 2: only legend sheets and the checklist — both compulsory.
// AI-PID-02 (125 points) is the default checklist for new projects.
const DEFAULT_CHECKLIST = 'AI-PID-02 · 125 points'

const REFERENCE_SLOTS = [
  { key: 'legend_pid', name: 'Legend sheets', unlocks: '1.1, 10.2, 12.6', format: 'PDF' },
  { key: 'checklist', name: 'Checklist', unlocks: 'All checklist points', format: 'Excel' },
]

const EXTRACTION_TABS = [
  { id: 'lines', label: 'Line numbers', col1: 'Fluid · Area', col2: 'Size · Sequence' },
  { id: 'instruments', label: 'Instruments', col1: 'Type', col2: 'Source' },
  { id: 'equipment', label: 'Equipment & special items', col1: 'Type', col2: 'Source' },
  { id: 'connectors', label: 'Off-page connectors', col1: 'Target', col2: 'Direction' },
  { id: 'notes', label: 'Notes & holds', col1: 'Kind', col2: 'Colour' },
]

// ── local persistence (documented backend-free store) ───────────────────
const lsKey = (drawingId, part) => `pidchk:drawing:${drawingId}:${part}`
function lsRead(drawingId, part) {
  try { return JSON.parse(localStorage.getItem(lsKey(drawingId, part)) || '{}') } catch { return {} }
}
function lsWrite(drawingId, part, value) {
  try { localStorage.setItem(lsKey(drawingId, part), JSON.stringify(value)) } catch { /* storage full/blocked */ }
}

// ── normalisers ─────────────────────────────────────────────────────────
const normStatus = s => String(s || 'open').toLowerCase()
const isOpen = f => normStatus(f.status) === 'open'
const isConfirmed = f => normStatus(f.status) === 'reviewed'
const isRejected = f => normStatus(f.status) === 'resolved'

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

/** API bboxes and tag positions are sent in PERCENT of the sheet (e.g.
 *  [58.59, 41.88, 64.76, 42.66]); the viewer wants fractions 0–1. Accept
 *  either (30 Oct 2026 — percent values were multiplied by 100 again and
 *  landed ~100× off the drawing). */
const pct = v => (typeof v === 'number' && Number.isFinite(v) ? (v > 1 ? v / 100 : v) : null)

/** Pull real 0..1 marker coordinates from a drawing's tag_positions for the
 *  tag(s) a finding mentions. Absolute PDF points cannot be normalised
 *  without page dimensions, so only fractional/percent coordinates are
 *  used — findings without usable coordinates get NO marker (spec §1).
 *  tag_positions carry x_pct / y_pct in percent; x / y in fractions. */
function locationsFor(f, tagPositions) {
  if (!tagPositions) return []
  const text = `${f.evidence || ''} ${f.issue_observed || ''}`
  const points = []
  for (const [tag, pos] of Object.entries(tagPositions)) {
    if (!tag || !text.includes(tag)) continue
    const candidates = []
    if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
      candidates.push(pos)
      if (Array.isArray(pos.all)) candidates.push(...pos.all)
    } else if (Array.isArray(pos)) {
      candidates.push(...pos)
    }
    for (const p of candidates) {
      if (!p || typeof p !== 'object') continue
      const x = pct(typeof p.x === 'number' ? p.x : p.x_pct)
      const y = pct(typeof p.y === 'number' ? p.y : p.y_pct)
      if (x != null && y != null && x >= 0 && x <= 1 && y >= 0 && y <= 1) points.push({ x, y })
    }
  }
  return points.slice(0, 4)
}

/** Centre of one bbox ([x0,y0,x1,y1] or {x0,y0,x1,y1}) as a 0..1 fraction. */
function bboxCentre(b) {
  const rect = Array.isArray(b) ? { x0: b[0], y0: b[1], x1: b[2], y1: b[3] } : b
  if (!rect || ![rect.x0, rect.y0, rect.x1, rect.y1].every(v => typeof v === 'number')) return null
  const x = pct((rect.x0 + rect.x1) / 2)
  const y = pct((rect.y0 + rect.y1) / 2)
  return x != null && y != null ? { x, y } : null
}

/** Normalise line-number tokens for display and comparison (spec A7):
 *  '1"-68- WG-147263- A2AP01- DA .' → '1"-68-WG-147263-A2AP01-DA'. */
const LINE_TOKEN_RE = /(\d+(?:\.\d+)?")\s*-\s*([A-Z0-9]{1,4})\s*-\s*([A-Z0-9]{1,4})\s*-\s*(\d{3,6})\s*-\s*([A-Z0-9]{2,8})\s*-\s*([A-Z0-9]{1,4})\s*\.?/g
const cleanLineText = t => String(t || '').replace(LINE_TOKEN_RE, (_m, a, b, c, d, e, f) => [a, b, c, d, e, f].join('-'))

function normalizeFinding(issue, drawing) {
  // Prefer the finding's own locations (one bbox per affected item, spec
  // §3); then its single bbox; then tag positions.
  let locations = []
  if (Array.isArray(issue.locations) && issue.locations.length > 0) {
    locations = issue.locations.map(bboxCentre).filter(Boolean)
  }
  if (locations.length === 0) {
    const centre = bboxCentre(issue.bbox)
    if (centre) locations = [centre]
  }
  if (locations.length === 0) {
    locations = locationsFor(issue, drawing?.metadata?.tag_positions)
  }
  return {
    id: issue.id,
    number: issue.sl_no ?? issue.id,
    // Checklist-serial label from the backend ('9.1', '9.1-2'…); falls back
    // to F<sl_no> for findings with no checklist mapping or old caches.
    displayId: issue.display_id ?? `F${issue.sl_no ?? issue.id}`,
    title: cleanLineText(issue.issue_observed ?? 'Finding'),
    status: issue.status,
    severity: issue.severity,
    category: issue.category,
    ruleId: issue.rule_id,
    found: cleanLineText(issue.evidence) || null,
    expected: null,
    basis: issue.action_required ?? null,
    // Checklist serial(s) the finding maps to (AI-PID-02 item numbers via
    // report_meta.checklist_items); the rule code stays in ruleId.
    checklist: (issue.report && Array.isArray(issue.report.checklist_items) && issue.report.checklist_items.length
      ? issue.report.checklist_items.join(' / ')
      : null) ?? issue.rule_id ?? null,
    pageIndex: drawing?.page_index ?? 0,
    locations,
    bbox: issue.bbox ?? null, // percent, as sent by the API (pc-ring takes percent)
    entityId: issue.entity_id ?? null,
    raw: issue,
  }
}

/** Defensive row shaping for extraction lists — the backend persists only
 *  some extraction detail in drawing.metadata; rows render real fields and
 *  "—" for anything missing. */
function extractionRows(tabId, metadata) {
  const meta = metadata || {}
  const value = (item, keys) => keys.map(k => item?.[k]).find(v => v != null && v !== '') ?? null
  if (tabId === 'lines') {
    return (meta.line_tags || []).map((t, i) => ({
      key: `ln-${i}`,
      value: value(t, ['line_number', 'tag', 'designation', 'full_tag'])
        ?? ([t.size, t.fluid_code, t.area_code, t.sequence_no].filter(Boolean).join('-') || null),
      col1: [t.fluid_code, t.area_code].filter(Boolean).join(' · ') || null,
      col2: [t.size, t.sequence_no].filter(Boolean).join(' · ') || null,
      note: t.cloud_truncation_detected ? 'Cloud-truncated' : (t.multi_angle ? 'Matches drawing' : 'Matches drawing'),
      tag: value(t, ['line_number', 'tag']) ?? null,
    }))
  }
  if (tabId === 'instruments') {
    const list = meta.instrument_tags || meta.instruments || []
    return list.map((t, i) => ({
      key: `in-${i}`,
      value: value(t, ['tag', 'instrument_tag']) ?? (typeof t === 'string' ? t : null),
      col1: value(t, ['type', 'prefix']),
      col2: value(t, ['source', 'page']) != null ? String(value(t, ['source', 'page'])) : null,
      note: 'Matches drawing',
      tag: value(t, ['tag', 'instrument_tag']) ?? (typeof t === 'string' ? t : null),
    }))
  }
  if (tabId === 'equipment') {
    const list = meta.equipment_tags || meta.equipment || []
    return list.map((t, i) => ({
      key: `eq-${i}`,
      value: value(t, ['tag', 'equipment_tag']) ?? (typeof t === 'string' ? t : null),
      col1: value(t, ['type']),
      col2: value(t, ['source', 'page']) != null ? String(value(t, ['source', 'page'])) : null,
      note: 'Matches drawing',
      tag: value(t, ['tag', 'equipment_tag']) ?? (typeof t === 'string' ? t : null),
    }))
  }
  if (tabId === 'connectors') {
    return (meta.continuation_refs || []).map((t, i) => ({
      key: `cn-${i}`,
      value: value(t, ['connector', 'ref', 'tag', 'label']) ?? (typeof t === 'string' ? t : null),
      col1: value(t, ['target', 'points_to', 'to_drawing']),
      col2: value(t, ['direction', 'type']),
      note: 'Matches drawing',
      tag: null,
    }))
  }
  if (tabId === 'notes') {
    const rows = []
    for (const [i, a] of (meta.red_annotations || []).entries()) {
      const kind = a?.kind ?? a?.type ?? null
      rows.push({
        key: `nt-${i}`,
        value: a?.text ?? a?.label ?? (typeof a === 'string' ? a : null),
        col1: kind,
        col2: 'Red annotation',
        note: kind && String(kind).toLowerCase().includes('hold') ? 'Hold' : 'Query',
        tag: null,
      })
    }
    return rows
  }
  return []
}

// ═══════════════════════════════════════════════════════════════════════

export default function DrawingPage() {
  const { projectId, drawingId } = useParams()
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

  // Sheet selector (bug: all 76 sheets' markers were drawn on sheet 1).
  // 1-based in the URL (&sheet=1), 0-based internally.
  const selectedPage = Math.max(0, (Number(searchParams.get('sheet')) || 1) - 1)
  const setSelectedPage = idx => patchParams({ sheet: String(idx + 1) })

  const [project, setProject] = useState(null)
  const [results, setResults] = useState(null)
  const [resultsPage, setResultsPage] = useState(null) // sheet the loaded results belong to
  const [processing, setProcessing] = useState(null) // status message when 202
  const [projectDrawings, setProjectDrawings] = useState([])
  const [references, setReferences] = useState(null)
  const [listsLoaded, setListsLoaded] = useState(false) // project + list + refs resolved
  const [unlocked, setUnlocked] = useState({}) // data_type -> true after upload this session
  const [error, setError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [exporting, setExporting] = useState(null)
  const [extractionCounts, setExtractionCounts] = useState(null) // { confirmed, total } from step 3 API
  const [checklistSummary, setChecklistSummary] = useState(null) // { ok, query, engineer_review, not_applicable, not_checked, total }

  // Combined project review (links + cross findings) — drives the "All
  // P&IDs" scope switch, the cross-drawing KPI and the findings-step
  // cross context. Fetched once per project; cached server-side.
  const [reviewData, setReviewData] = useState(null)
  useEffect(() => {
    let alive = true
    svc.getProjectReview(projectId)
      .then(data => { if (alive) setReviewData(data) })
      .catch(() => {}) // cross context is additive — the sheet view works without it
    return () => { alive = false }
  }, [projectId])

  // backend-free stores (documented above)
  const [confirmedTabs, setConfirmedTabs] = useState(() => lsRead(drawingId, 'extraction-confirmed'))
  const [rejectComments, setRejectComments] = useState(() => lsRead(drawingId, 'reject-comments'))

  const load = useCallback(async () => {
    setError(null)
    try {
      const [proj, docs, refs] = await Promise.all([
        svc.getProject(projectId),
        svc.listDrawings(projectId).catch(() => []),
        svc.listReferenceData(projectId).catch(() => []),
      ])
      setProject(proj)
      setProjectDrawings(docs)
      setReferences(refs)
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    } finally {
      setListsLoaded(true)
    }
    try {
      const data = await svc.getResults(drawingId, selectedPage + 1)
      setResults(data)
      setResultsPage(selectedPage)
      setProcessing(null)
    } catch (err) {
      if (err?.response?.status === 202) {
        setProcessing(err.response.data?.status || 'processing')
      } else {
        setError(err?.response?.data?.error || 'The drawing results could not be loaded.')
      }
    }
  }, [projectId, drawingId, selectedPage])

  useEffect(() => { load() }, [load])

  // Poll while the backend is still processing.
  useEffect(() => {
    if (!processing) return undefined
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [processing, load])

  // ── derived lists (single source of truth, spec §5) ──────────────────
  const currentDoc = useMemo(
    () => projectDrawings.find(d => String(d.id) === String(drawingId)) || null,
    [projectDrawings, drawingId],
  )

  // ── run state (spec §2): one state per document drives every step ─────
  const runState = useMemo(() => {
    if (processing) return 'running'
    if (results) return 'checked'
    const s = String(currentDoc?.status || '').toLowerCase()
    if (s === 'completed') return 'checked'
    if (['processing', 'running', 'queued'].includes(s)) return 'running'
    if (['failed', 'error'].includes(s)) return 'failed'
    return 'not-run' // 'uploaded' or unknown
  }, [processing, results, currentDoc])

  // "Not started": still 'uploaded' 30 s after the last update.
  const notStarted = useMemo(() => {
    if (runState !== 'not-run') return false
    const ts = currentDoc?.updatedAt ? new Date(currentDoc.updatedAt).getTime() : null
    return ts ? Date.now() - ts > 30 * 1000 : true
  }, [runState, currentDoc])

  // Poll every 5 s while queued/processing (spec §2), on top of the
  // slower processing poll above.
  useEffect(() => {
    if (runState !== 'running') return undefined
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [runState, load])

  const drawings = useMemo(() => results?.drawings || [], [results])

  // Clamp the URL sheet into range once the sheet list is known.
  const currentPage = Math.min(selectedPage, Math.max(drawings.length - 1, 0))
  const currentDrawing = useMemo(
    () => drawings.find(d => d.page_index === currentPage) ?? drawings[0] ?? null,
    [drawings, currentPage],
  )

  // True while the loaded results belong to another sheet (or none yet) —
  // drives the "Loading results…" skeletons instead of a false "0 findings".
  const pageDataLoading = !results || resultsPage !== currentPage

  // Per-sheet: the extraction tabs, KPIs, markers and 3D model only ever
  // show the selected sheet (30 Oct 2026 — the merged view drew all 76
  // sheets' 746 markers on sheet 1).
  const mergedMetadata = useMemo(() => currentDrawing?.metadata || {}, [currentDrawing])

  const findings = useMemo(
    () => drawings
      .filter(d => (d.page_index ?? 0) === currentPage)
      // Only checklist-mapped findings are shown (2 Nov 2026 alignment) —
      // in_checklist is absent on old payloads, so filter only on explicit false.
      .flatMap(d => (d.issues || []).filter(issue => issue.in_checklist !== false).map(issue => normalizeFinding(issue, d))),
    [drawings, currentPage],
  )

  // Sheet selector data: "Sheet 1 of 76 · 13-PP-152-20070-P2" — the
  // drawing number comes from each sheet's own title block.
  const sheetList = useMemo(
    () => drawings.map(d => ({
      pageIndex: d.page_index ?? 0,
      number: d.metadata?.title_block?.drawing_number ?? d.title ?? null,
    })),
    [drawings],
  )

  // The current sheet's project-wide identity (spec B4).
  const currentSheet = useMemo(
    () => (reviewData?.sheets || []).find(
      s => String(s.document_id) === String(drawingId) && s.page_index === currentPage,
    ) ?? null,
    [reviewData, drawingId, currentPage],
  )
  const crossForSheet = useMemo(
    () => (reviewData?.cross || []).filter(c => currentSheet && (c.sheets || []).includes(currentSheet.sheet_id)),
    [reviewData, currentSheet],
  )
  const linkedSheets = useMemo(() => {
    if (!currentSheet || !reviewData) return []
    const byId = {}
    for (const s of reviewData.sheets || []) byId[s.sheet_id] = s
    return (reviewData.links || [])
      .filter(l => l.a.sheet_id === currentSheet.sheet_id || l.b.sheet_id === currentSheet.sheet_id)
      .map(l => {
        const other = l.a.sheet_id === currentSheet.sheet_id ? l.b : l.a
        const s = byId[other.sheet_id]
        return s ? { ...s, both: l.both } : null
      })
      .filter(Boolean)
  }, [reviewData, currentSheet])

  // "This P&ID" in the scope switch returns here.
  useEffect(() => {
    rememberLastSheet(projectId, drawingId, currentPage + 1)
  }, [projectId, drawingId, currentPage])
  const openFindings = useMemo(() => findings.filter(isOpen), [findings])
  const errorFindings = useMemo(() => findings.filter(f => ['critical', 'major'].includes(String(f.severity).toLowerCase())), [findings])
  const queryFindings = useMemo(() => findings.filter(f => !['critical', 'major'].includes(String(f.severity).toLowerCase())), [findings])

  const referencesByType = useMemo(() => {
    const map = {}
    for (const r of references || []) {
      const t = r.data_type ?? r.type
      if (t && !map[t]) map[t] = r
    }
    return map
  }, [references])
  // Checklist is provided by the default PRO-001 Rev A unless a client
  // checklist replaced it; legend sheets must be uploaded. Both compulsory.
  const checklistLabel = referencesByType.checklist?.file_name ?? referencesByType.checklist?.filename ?? DEFAULT_CHECKLIST
  const missingRefs = useMemo(
    () => REFERENCE_SLOTS.filter(s => s.key !== 'checklist' && !referencesByType[s.key] && !unlocked[s.key]),
    [referencesByType, unlocked],
  )
  const inputsMissing = missingRefs.length > 0 // drawings exist by definition on this page

  const extractionData = useMemo(() => {
    const out = {}
    for (const tab of EXTRACTION_TABS) out[tab.id] = extractionRows(tab.id, mergedMetadata)
    return out
  }, [mergedMetadata])
  const tabsWithData = useMemo(() => EXTRACTION_TABS.filter(t => extractionData[t.id].length > 0), [extractionData])
  const confirmedCount = useMemo(
    () => tabsWithData.filter(t => confirmedTabs[t.id]).length,
    [tabsWithData, confirmedTabs],
  )

  const checklistConfigured = false // no checklist-definition endpoint exists in the v2 backend

  const gates = useMemo(() => ([
    {
      id: 'inputs',
      label: 'Drawings, legend sheets and checklist provided',
      ok: !inputsMissing,
      missing: inputsMissing ? `Add the ${missingRefs.map(s => s.name.toLowerCase()).join(' and ')}` : null,
    },
    {
      id: 'findings',
      label: 'Findings dispositioned',
      ok: results != null && openFindings.length === 0,
      missing: openFindings.length > 0 ? `${openFindings.length} finding${openFindings.length === 1 ? '' : 's'} still open` : null,
    },
    {
      id: 'documents',
      label: 'Nothing waiting on documents',
      ok: references != null && missingRefs.length === 0,
      missing: missingRefs.length > 0
        ? `${missingRefs.length} reference document${missingRefs.length === 1 ? '' : 's'} missing: ${missingRefs.map(s => s.name).join(', ')}`
        : null,
    },
    {
      id: 'engineer',
      label: 'Critical and engineer-led points verified; 13.3 agreed',
      ok: checklistSummary ? checklistSummary.criticalPending === 0 && checklistSummary.item133Agree === true : false,
      missing: checklistSummary
        ? [
          checklistSummary.criticalPending > 0 ? `${checklistSummary.criticalPending} critical/engineer-led point${checklistSummary.criticalPending === 1 ? '' : 's'} without verification` : null,
          checklistSummary.item133Agree ? null : 'Item 13.3 not agreed',
        ].filter(Boolean).join(' · ') || null
        : 'Checklist results are not loaded yet',
    },
    {
      id: 'extraction',
      label: 'Extraction confirmed',
      ok: extractionCounts
        ? extractionCounts.total > 0 && extractionCounts.confirmed === extractionCounts.total
        : tabsWithData.length > 0 && confirmedCount === tabsWithData.length,
      missing: extractionCounts
        ? `${extractionCounts.confirmed} / ${extractionCounts.total} extraction items confirmed`
        : tabsWithData.length === 0
          ? 'No extraction detail to confirm'
          : `${confirmedCount} / ${tabsWithData.length} extraction tabs confirmed`,
    },
  ]), [results, openFindings, references, missingRefs, inputsMissing, confirmedCount, tabsWithData, checklistConfigured, extractionCounts, checklistSummary])
  const allGatesGreen = gates.every(g => g.ok)

  // ── actions ───────────────────────────────────────────────────────────
  const patchFindingLocal = (findingId, patch) => {
    setResults(prev => {
      if (!prev) return prev
      return {
        ...prev,
        drawings: prev.drawings.map(d => ({
          ...d,
          issues: (d.issues || []).map(i => (i.id === findingId ? { ...i, ...patch } : i)),
        })),
      }
    })
  }

  const confirmFinding = async finding => {
    try {
      await svc.patchFinding(finding.id, { status: 'reviewed' })
      patchFindingLocal(finding.id, { status: 'reviewed' })
    } catch {
      setActionMessage('The finding could not be confirmed. Please retry.')
    }
  }

  const rejectFinding = async (finding, comment) => {
    try {
      await svc.patchFinding(finding.id, { status: 'resolved' })
      patchFindingLocal(finding.id, { status: 'resolved' })
      // No comment field on the findings endpoint — kept locally.
      const next = { ...rejectComments, [finding.id]: comment }
      setRejectComments(next)
      lsWrite(drawingId, 'reject-comments', next)
    } catch {
      setActionMessage('The finding could not be rejected. Please retry.')
    }
  }

  const confirmTab = tabId => {
    const next = { ...confirmedTabs, [tabId]: true }
    setConfirmedTabs(next)
    lsWrite(drawingId, 'extraction-confirmed', next)
  }

  const uploadReference = async (slotKey, file) => {
    if (!file) return
    try {
      await svc.uploadReferenceData(projectId, slotKey, file)
      // Client-side unlock: dependent checklist points move from
      // "Not checked — document not provided" to "Ready — re-run checks"
      // without a page reload (spec §3 step 2).
      setUnlocked(prev => ({ ...prev, [slotKey]: true }))
      setReferences(await svc.listReferenceData(projectId))
      setActionMessage(`${REFERENCE_SLOTS.find(s => s.key === slotKey)?.name ?? 'Document'} uploaded — dependent checks are ready. Re-run checks to apply them.`)
    } catch (err) {
      setActionMessage(err?.response?.data?.error || 'The upload failed. Please retry.')
    }
  }

  const rerun = async () => {
    try {
      await svc.reprocess(drawingId)
      setActionMessage('Re-run started. This page refreshes when the run finishes.')
      setProcessing('processing')
    } catch (err) {
      setActionMessage(err?.response?.data?.error || 'The re-run could not be started.')
    }
  }

  const exportFile = async kind => {
    setExporting(kind)
    try {
      await svc.downloadExport(drawingId, kind)
    } catch (err) {
      setActionMessage(err?.response?.data?.error || `The ${kind === 'excel' ? 'report' : 'drawing'} export failed.`)
    } finally {
      setExporting(null)
    }
  }

  // ── header / stepper ──────────────────────────────────────────────────
  const projectBase = `/engineering/process/pid-verification/projects/${projectId}`
  const lastRun = results?.updated_at ? new Date(results.updated_at).toLocaleString() : null

  // A2 (30 Oct 2026): the header belongs to the SELECTED sheet — number,
  // revision and title come from that sheet's own title block.
  const sheetTb = useMemo(
    () => drawings.find(d => (d.page_index ?? 0) === currentPage)?.metadata?.title_block ?? null,
    [drawings, currentPage],
  )
  const drawingNo = sheetTb?.drawing_number ?? currentDoc?.drawingNo ?? null
  const sheetRev = sheetTb?.revision ?? currentDoc?.rev ?? null
  const sheetTitle = sheetTb?.title ?? currentDoc?.title ?? null

  const stepStates = useMemo(() => {
    const extractionTotal = tabsWithData.length
    return [
      { state: results ? 'done' : 'todo', statusText: currentDoc ? `1 drawing · ${currentDoc.readability === 'ocr' ? 'OCR' : currentDoc.readability === 'unreadable' ? 'not readable' : 'vector PDF'}` : '—' },
      { state: missingRefs.length > 0 ? 'warning' : 'done', statusText: references ? (missingRefs.length > 0 ? 'Legend sheets missing' : 'Both provided') : '—' },
      { state: extractionCounts
          ? (extractionCounts.total > 0 && extractionCounts.confirmed === extractionCounts.total ? 'done' : 'warning')
          : extractionTotal > 0 && confirmedCount === extractionTotal ? 'done' : extractionTotal > 0 ? 'warning' : 'todo',
        statusText: extractionCounts ? `${extractionCounts.confirmed} / ${extractionCounts.total} confirmed` : extractionTotal > 0 ? `${confirmedCount} / ${extractionTotal} confirmed` : 'No extraction detail' },
      { state: checklistSummary ? (checklistSummary.criticalPending > 0 ? 'warning' : 'done') : 'todo',
        statusText: checklistSummary ? `${checklistSummary.withResult} / ${checklistSummary.total} with a result` : '— / 125 with a result' },
      { state: runState !== 'checked' ? 'todo' : openFindings.length > 0 ? 'warning' : findings.length > 0 ? 'done' : 'todo', statusText: runState === 'checked' ? `${openFindings.length} open` : 'Not run' },
      { state: allGatesGreen ? 'done' : 'warning', statusText: allGatesGreen ? 'Ready' : 'Blocked' },
    ]
  }, [results, currentDoc, missingRefs, references, tabsWithData, confirmedCount, openFindings, findings, allGatesGreen, checklistConfigured, runState, extractionCounts, checklistSummary])

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'Engineering' },
        { label: '1.1 Process' },
        { label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' },
        { label: project?.name ?? '…', to: projectBase },
        { label: drawingNo ?? results?.file_name ?? '…' },
      ]}
      title={currentDoc?.type === 'PFD' ? 'PFD Checker' : 'P&ID Checker'}
      pill={<Pill label={`Checklist ${checklistLabel}`} tone="neutral" title="Checklist in effect for this project" />}
      subtitle={project
        ? `${project.name} · ${project.client ?? 'Client not set'} · ${drawingNo ?? '—'}${sheetRev ? ` Rev ${sheetRev}` : ''}${sheetTitle ? ` · ${sheetTitle}` : ''}`
        : null}
      actions={(
        <>
          <ScopeSwitch
            projectId={projectId}
            drawingNo={sheetList[currentPage]?.number ?? drawingNo}
            sheetCount={reviewData?.stats?.sheets ?? (sheetList.length || null)}
            active="one"
          />
          <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Last run {lastRun ?? '—'} · rules —
          </span>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => navigate(projectBase)}>
            Drawing sets
          </button>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={rerun} disabled={Boolean(processing) || inputsMissing} title={inputsMissing ? 'Checks cannot run — drawings, legend sheets and checklist are all compulsory' : undefined}>
            Re-run checks
          </button>
          <button type="button" className="rd-btn rd-btn-primary" onClick={() => setStep(5)}>
            Report &amp; sign-off
          </button>
        </>
      )}
    />
  )

  if (error && !results) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }

  // A1 (30 Oct 2026): until the project, the drawings list, the references
  // and this sheet's results have all resolved, show skeletons — never an
  // input or worker alarm based on half-loaded state.
  const booted = Boolean(
    project
    && listsLoaded
    && (results || processing || error),
  )
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

      {inputsMissing && (
        <div className="pc-banner pc-banner-danger" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ margin: 0 }}>
            Checks cannot run. Add the {missingRefs.map(s => s.name.toLowerCase()).join(' and ')} — drawings, legend sheets and checklist are all compulsory.
          </p>
          <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => setStep(1)}>
            Add missing input
          </button>
        </div>
      )}

      {processing && (
        <p className="pc-note pc-note-warning" role="status">
          This drawing is being read (status: {processing}). The page refreshes automatically when the run finishes.
        </p>
      )}
      {actionMessage && (
        <p className="pc-note pc-note-warning" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <span>{actionMessage}</span>
          <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Dismiss message" onClick={() => setActionMessage(null)}>×</button>
        </p>
      )}

      {notStarted && (
        <div className="pc-banner pc-banner-warning" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ margin: 0 }}>Not started — the check worker may be down.</p>
          <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={rerun}>Start checks</button>
        </div>
      )}

      <KpiRow
        findings={findings}
        openFindings={openFindings}
        missingRefs={missingRefs}
        checklistConfigured={checklistConfigured}
        checklistSummary={checklistSummary}
        runState={runState}
        resultsLoading={pageDataLoading}
        crossCount={crossForSheet.length}
        goToCrossFindings={() => setStep(4, { fkind: 'cross' })}
        goToChecklist={preset => setStep(3, preset)}
      />

      {step === 0 && (
        <StepDrawings
          currentDoc={currentDoc}
          projectDrawings={projectDrawings}
          projectId={projectId}
          onUploaded={load}
          checklistConfigured={checklistConfigured}
          checklistSummary={checklistSummary}
        />
      )}
      {step === 1 && (
        <StepReferences
          missingRefs={missingRefs}
          referencesByType={referencesByType}
          unlocked={unlocked}
          onUpload={uploadReference}
          checklistLabel={checklistLabel}
        />
      )}
      {step === 2 && (
        <StepExtraction
          drawingId={drawingId}
          page={currentPage}
          runState={runState}
          readability={currentDoc?.readability ?? null}
          onRunChecks={rerun}
          activeTab={searchParams.get('tab') || 'lines'}
          onTabChange={t => patchParams({ tab: t === 'lines' ? null : t })}
          onConfirmedChange={(confirmed, total) => setExtractionCounts({ confirmed, total })}
          onShowOnDrawing={item => {
            if (item.bbox) setStep(4, { ring: [item.bbox.x0, item.bbox.y0, item.bbox.x1, item.bbox.y1].join(',') })
            else setActionMessage('No coordinates on the drawing for this value yet.')
          }}
        />
      )}
      {step === 3 && (
        <StepChecklist
          drawingId={drawingId}
          page={currentPage}
          searchParams={searchParams}
          patchParams={patchParams}
          inputsMissing={inputsMissing}
          runState={runState}
          onSummary={setChecklistSummary}
          onAddInput={() => setStep(1)}
          onShowFinding={fid => setStep(4, { finding: `F${fid}` })}
        />
      )}
      {step === 4 && (
        <StepFindings
          drawingId={drawingId}
          findings={findings}
          errorCount={errorFindings.length}
          queryCount={queryFindings.length}
          openCount={openFindings.length}
          searchParams={searchParams}
          patchParams={patchParams}
          onConfirm={confirmFinding}
          onReject={rejectFinding}
          rejectComments={rejectComments}
          runState={runState}
          runStartedAt={currentDoc?.updatedAt ?? null}
          onRunChecks={rerun}
          resultsLoading={pageDataLoading}
          sheets={sheetList}
          selectedPage={currentPage}
          onPageChange={setSelectedPage}
          crossFindings={crossForSheet}
          linkedSheets={linkedSheets}
          projectId={projectId}
        />
      )}
      {step === 5 && (
        <StepReport
          gates={gates}
          allGatesGreen={allGatesGreen}
          findings={findings}
          exporting={exporting}
          onExport={exportFile}
          resultsReady={Boolean(results)}
          drawingId={drawingId}
          currentDoc={currentDoc}
          onSubmit={() => setActionMessage('Sign-off submission is available after the backend sign-off workflow endpoint is connected.')}
        />
      )}
    </div>
  )
}

// ── KPI tiles ───────────────────────────────────────────────────────────

function KpiRow({ findings, openFindings, missingRefs, checklistConfigured, checklistSummary = null, runState = 'checked', resultsLoading = false, crossCount = null, goToChecklist, goToCrossFindings = null }) {
  const checked = runState === 'checked' && !resultsLoading
  const runMeta = resultsLoading ? 'Loading results…' : { running: 'Running…', failed: 'Run failed', 'not-run': 'Not run' }[runState]
  const scored = checklistSummary != null
  const matrixTotal = r => (scored ? checklistSummary.matrix?.[r]?.total ?? 0 : '—')
  return (
    <div className="pc-kpi-grid-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }} aria-label="Drawing summary">
      <KpiTile
        label="Check points"
        value={scored ? checklistSummary.total : 125}
        meta={scored
          ? `Automated ${checklistSummary.by_mode?.Automated ?? 0} · AI-Assisted ${checklistSummary.by_mode?.['AI-Assisted'] ?? 0} · Engineer-Led ${checklistSummary.by_mode?.['Engineer-Led'] ?? 0}`
          : 'AI-PID-02 (default) · Automated / AI-Assisted / Engineer-Led split after the first run'}
        onClick={() => goToChecklist({})}
      />
      <KpiTile label="Findings open" value={checked ? openFindings.length : '—'} danger={checked && openFindings.length > 0} meta={checked ? `${findings.length} raised on this sheet` : runMeta} onClick={() => goToChecklist({})} />
      <KpiTile label="Cross-drawing findings" value={crossCount != null ? crossCount : '—'} danger={Boolean(crossCount)} meta="X-checks involving this sheet" onClick={goToCrossFindings} />
      <KpiTile label="Non-Conformance" value={matrixTotal('Non-Conformance')} danger={scored && matrixTotal('Non-Conformance') > 0} meta={scored ? 'Check points failing' : runMeta ?? 'Available once the checklist is evaluated'} onClick={() => goToChecklist({ cresult: 'Non-Conformance' })} />
      <KpiTile label="Query" value={matrixTotal('Query')} meta={scored ? 'Needs an answer' : runMeta ?? 'Available once the checklist is evaluated'} onClick={() => goToChecklist({ cresult: 'Query' })} />
      <KpiTile label="Not Verifiable" value={matrixTotal('Not Verifiable')} meta={missingRefs.length > 0 ? `${missingRefs.map(s => s.name.toLowerCase()).join(' and ')} missing` : scored ? 'Missing or unreadable inputs' : 'All three compulsory inputs provided'} onClick={() => goToChecklist({ cresult: 'Not Verifiable' })} />
      <KpiTile label="OK" value={matrixTotal('OK')} meta={scored ? 'Check points passing' : runMeta ?? 'Available once the checklist is evaluated'} onClick={() => goToChecklist({ cresult: 'OK' })} />
      <KpiTile label="Not applicable" value={scored ? checklistSummary.not_applicable : '—'} meta={scored ? 'Objects not on this sheet' : runMeta ?? 'Available once the checklist is evaluated'} onClick={() => goToChecklist({ needsme: null })} />
    </div>
  )
}

// ── Step 1: Drawings ────────────────────────────────────────────────────

function StepDrawings({ currentDoc, projectDrawings, projectId, onUploaded, checklistConfigured, checklistSummary = null }) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const inputRef = useRef(null)

  const setMembers = useMemo(() => {
    if (!currentDoc?.set) return currentDoc ? [currentDoc] : []
    return projectDrawings.filter(d => d.set === currentDoc.set)
  }, [currentDoc, projectDrawings])

  const uploadFiles = async files => {
    const pdfs = [...files].filter(f => /\.pdf$/i.test(f.name))
    if (pdfs.length === 0 || uploading) return
    setUploading(true)
    setMessage(null)
    try {
      for (const file of pdfs) {
        await svc.uploadDrawing(projectId, file) // eslint-disable-line no-await-in-loop
      }
      setMessage(`${pdfs.length} file${pdfs.length === 1 ? '' : 's'} uploaded. Reading starts in the background.`)
      onUploaded?.()
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Upload failed. Please retry.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <section className="pc-section" aria-label="Drawing set">
        <h2 className="pc-section-title">Drawing set</h2>
        <div className="pc-card pc-table-wrap">
          {setMembers.length === 0 ? (
            <EmptyState title="This drawing is not in a set yet.">Sets appear once drawings have been read and grouped on the project screen.</EmptyState>
          ) : (
            <table className="pc-table">
              <thead>
                <tr><th>Drawing no.</th><th>Title</th><th>Type</th><th>Rev.</th><th>Readability</th><th>Checklist progress</th></tr>
              </thead>
              <tbody>
                {setMembers.map(d => (
                  <tr key={d.id} className={String(d.id) === String(currentDoc?.id) ? '' : 'pc-row-clickable'}>
                    <td className="pc-mono">{d.drawingNo ?? '—'}</td>
                    <td>{d.title}</td>
                    <td>{d.type ?? '—'}</td>
                    <td className="pc-mono">{d.rev ?? '—'}</td>
                    <td><ReadabilityPill readability={d.readability} /></td>
                    <td style={{ minWidth: 160 }}>
                      {/* AI-PID-02: share of the 125 check points with a result on this sheet. */}
                      <div className="pc-progress" role="img" aria-label={checklistSummary ? `Checklist progress: ${checklistSummary.withResult} of ${checklistSummary.total} with a result` : 'Checklist not evaluated yet'}>
                        <span className="pc-progress-ok" style={{ width: checklistSummary ? `${(checklistSummary.withResult / Math.max(checklistSummary.total, 1)) * 100}%` : 0 }} />
                        <span className="pc-progress-na" style={{ width: checklistSummary ? `${100 - (checklistSummary.withResult / Math.max(checklistSummary.total, 1)) * 100}%` : '100%' }} />
                      </div>
                      <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                        {checklistSummary ? `${checklistSummary.withResult} / ${checklistSummary.total} with a result` : 'Not evaluated yet'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="pc-section" aria-label="Add drawings">
        <h2 className="pc-section-title">Add drawings</h2>
        <div
          className={`pc-dropzone${dragActive ? ' pc-dropzone-active' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF drawings"
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); uploadFiles(e.dataTransfer.files) }}
        >
          <p className="pc-dropzone-title">{uploading ? 'Uploading…' : 'Drop PDF drawings here'}</p>
          <p className="pc-dropzone-help">Vector PDFs are read exactly; scans and outlined text are read by OCR.</p>
          <span className="rd-btn rd-btn-secondary rd-btn-sm">Browse files</span>
        </div>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { uploadFiles(e.target.files); e.target.value = '' }} />
        {message && <p className="pc-note pc-note-warning" style={{ margin: 0 }} role="status">{message}</p>}
        <p className="pc-help">
          Symbol and abbreviation meanings come from the project legend. <Link to="/engineering/legends">Open Legend Manager</Link>
        </p>
      </section>
    </>
  )
}

// ── Step 2: Legend & checklist (both compulsory, spec §3) ───────────────

function StepReferences({ missingRefs, referencesByType, unlocked, onUpload, checklistLabel }) {
  const m = missingRefs.length
  return (
    <section className="pc-section" aria-label="Legend and checklist">
      {m > 0 && (
        <div className="pc-banner pc-banner-danger" role="alert">
          <div>
            <p className="pc-banner-title">Checks cannot run — compulsory input missing</p>
            <p>Add the {missingRefs.map(s => s.name.toLowerCase()).join(' and ')}. Drawings, legend sheets and checklist are all compulsory; every checklist point shows “Not run — compulsory input missing” until then.</p>
          </div>
        </div>
      )}
      <div className="pc-card pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr><th>Input</th><th>Reference</th><th>Checks it unlocks</th><th>Format</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {REFERENCE_SLOTS.map(slot => (
              <ReferenceRow
                key={slot.key}
                slot={slot}
                record={referencesByType[slot.key]}
                defaultLabel={slot.key === 'checklist' ? checklistLabel : null}
                justUnlocked={Boolean(unlocked[slot.key])}
                onUpload={onUpload}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="pc-help">
        No line list, instrument index, equipment list or other registers are used. Provided inputs can be replaced, never removed.
      </p>
    </section>
  )
}

function ReferenceRow({ slot, record, defaultLabel, justUnlocked, onUpload }) {
  const inputRef = useRef(null)
  const uploaded = Boolean(record) || Boolean(defaultLabel)
  return (
    <tr>
      <td><span className="pc-required" aria-hidden="true">*</span> {slot.name}</td>
      <td className="pc-mono">{record?.file_name ?? record?.filename ?? defaultLabel ?? '—'}</td>
      <td className="pc-muted">{slot.unlocks}</td>
      <td>{slot.format}</td>
      <td>
        {uploaded
          ? <Pill label="Provided" tone="success" />
          : justUnlocked
            ? <Pill label="Ready — re-run checks" tone="info" />
            : <Pill label="Required — missing" tone="danger" />}
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`rd-btn rd-btn-sm ${uploaded ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
            onClick={() => inputRef.current?.click()}
          >
            {uploaded ? 'Replace' : 'Upload'}
          </button>
          <input ref={inputRef} type="file" hidden onChange={e => { onUpload(slot.key, e.target.files?.[0]); e.target.value = '' }} aria-label={`Upload ${slot.name}`} />
        </div>
      </td>
    </tr>
  )
}

// ── Step 3: Extraction review (spec §3.2) ───────────────────────────────
// Reads the extraction API (documents/<id>/extraction/). Falls back to the
// drawing metadata when the endpoint has nothing yet — never invents rows.

function StepExtraction({ drawingId, page = 0, runState = 'checked', readability = null, onRunChecks = null, onShowOnDrawing = null, activeTab, onTabChange, onConfirmedChange = null }) {
  const [items, setItems] = useState(null) // { lines: [], instruments: [], ... }
  const [apiAvailable, setApiAvailable] = useState(true)
  const [actionError, setActionError] = useState(null)
  const listRef = useRef(null)

  const tabs = EXTRACTION_TABS
  const tab = tabs.find(t => t.id === activeTab) ?? tabs[0]

  const load = useCallback(async () => {
    try {
      // Per-sheet fetch (?page= is 1-based) — a sheet loads in under 1 s
      // instead of pulling the whole 2.5 MB document extraction.
      const data = await svc.getExtraction(drawingId, null, page + 1)
      const grouped = {}
      for (const t of tabs) grouped[t.id] = []
      const rawItems = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : data?.items ?? {}
      if (Array.isArray(rawItems)) {
        for (const item of rawItems) {
          if (grouped[item.kind]) grouped[item.kind].push(item)
        }
      } else {
        // kind-grouped object: { lines: [...], instruments: [...], ... }
        for (const [kind, list] of Object.entries(rawItems)) {
          if (grouped[kind] && Array.isArray(list)) grouped[kind] = list
        }
      }
      setItems(grouped)
      setApiAvailable(true)
    } catch (err) {
      if (err?.response?.status === 404) setApiAvailable(false)
      else setActionError('The extraction could not be loaded. Please retry.')
    }
  }, [drawingId, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  // Sheet switch: clear the previous sheet's rows so the skeleton shows
  // instead of stale data (bug 6 — stale lists read as a wrong result).
  useEffect(() => { setItems(null) }, [page])

  const counts = useMemo(() => {
    const out = {}
    let confirmed = 0
    let total = 0
    for (const t of tabs) {
      const list = items?.[t.id] ?? []
      const conf = list.filter(i => i.confirmed).length
      out[t.id] = { total: list.length, confirmed: conf }
      confirmed += conf
      total += list.length
    }
    return { ...out, confirmed, total }
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

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
      await svc.patchExtractionItem(drawingId, item.id, patch)
      await load()
    } catch {
      setActionError('The change could not be saved. Please retry.')
    }
  }

  const confirmTab = async () => {
    const pending = (items?.[tab.id] ?? []).filter(i => !i.confirmed)
    for (const item of pending) {
      await svc.patchExtractionItem(drawingId, item.id, { confirmed: true }) // eslint-disable-line no-await-in-loop
    }
    await load()
  }

  const onKeyDown = (event, index) => {
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (next !== null) {
      event.preventDefault()
      listRef.current?.querySelectorAll('.pc-tab')?.[next]?.focus()
      onTabChange(tabs[next].id)
    }
  }

  // ── run states (spec §3.2) ────────────────────────────────────────────
  if (runState !== 'checked') {
    return (
      <section className="pc-section" aria-label="Extraction review">
        <div className="pc-card pc-card-pad" style={{ textAlign: 'center' }}>
          {runState === 'running' ? (
            <>
              <p className="pc-empty-title">Reading sheet…</p>
              <div className="pc-skeleton" style={{ height: 18, margin: '0.5rem 0' }} />
              <div className="pc-skeleton" style={{ height: 18, margin: '0.5rem 0' }} />
              <div className="pc-skeleton" style={{ height: 18, margin: '0.5rem 0' }} />
            </>
          ) : runState === 'failed' ? (
            <>
              <p className="pc-empty-title">The check run failed.</p>
              {onRunChecks && <button type="button" className="rd-btn rd-btn-primary" onClick={onRunChecks}>Retry</button>}
            </>
          ) : (
            <>
              <p className="pc-empty-title">Run checks to extract this drawing.</p>
              {onRunChecks && <button type="button" className="rd-btn rd-btn-primary" onClick={onRunChecks}>Run checks</button>}
            </>
          )}
        </div>
      </section>
    )
  }

  const rows = items?.[tab.id] ?? []
  const allConfirmed = rows.length > 0 && rows.every(i => i.confirmed)

  return (
    <section className="pc-section" aria-label="Extraction review">
      {readability === 'ocr' && (
        <div className="pc-banner pc-banner-warning" role="status">
          <p style={{ margin: 0 }}>Read by OCR — confirm every value.</p>
        </div>
      )}

      <div className="pc-card-header" style={{ padding: 0 }}>
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
          {items
            ? <>Read from the drawing: {tabs.map(t => `${counts[t.id].total} ${t.label.toLowerCase()}`).join(' · ')} — {counts.confirmed} of {counts.total} confirmed</>
            : 'Reading the extraction…'}
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
        {tabs.map((t, i) => {
          const c = counts[t.id]
          return (
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
              <span className={`pc-tab-count${c.total > 0 && c.confirmed === c.total ? ' pc-tab-count-confirmed' : ''}`}>
                {c.total > 0 ? (c.confirmed === c.total ? `${c.total} confirmed` : c.total) : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {actionError && <p className="pc-error" role="alert">{actionError}</p>}

      <div className="pc-card pc-table-wrap" role="tabpanel">
        {!apiAvailable ? (
          <EmptyState title={`No ${tab.label.toLowerCase()} detail is stored for this drawing.`}>
            Available after the run saves extraction detail. Re-run the check to populate this tab.
          </EmptyState>
        ) : items === null ? (
          <div style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${tab.label.toLowerCase()} were read from this drawing.`}>
            Nothing was extracted for this kind — the sheet may not contain any.
          </EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th aria-label="OK">OK</th><th>Value</th><th>{tab.col1}</th><th>{tab.col2}</th><th>Flag</th><th>Drawing</th></tr>
            </thead>
            <tbody>
              {rows.map(item => (
                <ExtractionRow
                  key={item.id}
                  item={item}
                  kind={tab.id}
                  onPatch={patchItem}
                  onShowOnDrawing={onShowOnDrawing}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function ExtractionRow({ item, kind, onPatch, onShowOnDrawing }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const p = item.parsed || {}
  const corrected = p.corrected_value != null && p.corrected_value !== item.text

  // Parsed columns per kind (spec §3.1). Missing fields render "—".
  let col1 = '—'
  let col2 = '—'
  if (kind === 'lines') {
    col1 = [p.system, p.fluid_code].filter(Boolean).join(' · ') || '—'
    col2 = [p.piping_class, p.insulation].filter(Boolean).join(' · ') || '—'
    if (Array.isArray(p.design_cases) && p.design_cases.length > 0) {
      col2 = `${col2 === '—' ? '' : `${col2} · `}${p.design_cases.length} design case${p.design_cases.length === 1 ? '' : 's'}`
    }
  } else if (kind === 'instruments') {
    col1 = p.function_letters ?? '—'
    col2 = p.loop ?? '—'
  } else if (kind === 'equipment') {
    col1 = p.code ?? '—'
    col2 = p.description ?? '—'
  } else if (kind === 'connectors') {
    col1 = p.drawing_no ?? '—'
    col2 = p.direction ?? '—'
  } else if (kind === 'notes') {
    col1 = p.number != null ? `Note ${p.number}` : '—'
    col2 = p.deleted ? 'Deleted' : '—'
  }

  const flagLabel = item.flag ?? 'Matches drawing'
  const flagTone = item.flag ? (item.finding_ids?.length ? 'danger' : 'warning') : 'success'

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== item.text) onPatch(item, { corrected_value: draft.trim() })
  }

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={Boolean(item.confirmed)}
          onChange={e => onPatch(item, { confirmed: e.target.checked })}
          aria-label={`Confirm ${item.text}`}
          style={{ width: 18, height: 18, accentColor: 'var(--rd-primary)' }}
        />
      </td>
      <td className="pc-mono" onClick={() => { setDraft(p.corrected_value ?? item.text); setEditing(true) }} style={{ cursor: 'text' }} title="Click to correct the value">
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
              aria-label={`Correct ${item.text}`}
            />
            <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={commit}>Save</button>
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </span>
        ) : (
          <>
            {corrected && <s className="pc-faint" style={{ marginRight: '0.375rem' }}>{item.text}</s>}
            {p.corrected_value ?? item.text}
          </>
        )}
      </td>
      <td>{col1}</td>
      <td>{col2}</td>
      <td>
        <Pill label={flagLabel} tone={flagTone} />
        {item.finding_ids?.length > 0 && (
          <span className="pc-faint" style={{ marginLeft: '0.375rem', fontSize: 'var(--rd-text-caption)' }}>
            {/* finding_nos carries the checklist-serial labels (e.g. '9.1-2')
                from the backend; fall back to ids for old payloads. */}
            {item.finding_ids.map((id, i) => {
              const lbl = item.finding_nos?.[i] ?? id
              return typeof lbl === 'number' ? `F${lbl}` : lbl
            }).join(' ')}
          </span>
        )}
      </td>
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

// ── Step 4: Checklist (AI-PID-02 — 125 points, spec §3.2) ───────────────

const CL_RESULT_TONES = { OK: 'success', 'Non-Conformance': 'danger', Query: 'warning', 'Not Verifiable': 'neutral' }
const CL_SEV_TONES = { Critical: 'danger', Major: 'warning', Minor: 'neutral' }
const CL_RESULTS = ['OK', 'Non-Conformance', 'Query', 'Not Verifiable']

function StepChecklist({ drawingId, page = 0, searchParams, patchParams, inputsMissing, runState = 'checked', onSummary = null, onAddInput = null, onShowFinding = null }) {
  const fResult = searchParams.get('cresult') || 'All'
  const fSeverity = searchParams.get('csev') || 'All'
  const fMode = searchParams.get('cmode') || 'All'
  const needsMe = searchParams.get('needsme') === '1'
  const q = (searchParams.get('q') || '').toLowerCase()

  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(null) // 'download' | 'import'
  const [message, setMessage] = useState(null)
  const [openSections, setOpenSections] = useState(null) // null = all open
  const [expanded, setExpanded] = useState(null) // item no
  const importRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setData(await svc.getChecklist(drawingId, page + 1))
      setLoadError(null)
    } catch (err) {
      setLoadError(err?.response?.status === 404 ? 'no-template' : 'error')
    }
  }, [drawingId, page])

  useEffect(() => { if (runState === 'checked' && !inputsMissing) load() }, [load, runState, inputsMissing])

  const items = useMemo(() => data?.items ?? [], [data])
  const summary = data?.summary ?? null

  const reportedRef = useRef(null)
  useEffect(() => {
    if (!summary) return
    const applicable = items.filter(i => i.applicability === 'Y')
    const criticalPending = applicable.filter(i =>
      (i.severity === 'Critical' || i.mode === 'Engineer-Led') && !i.engineer_verification,
    ).length
    const withResult = items.filter(i => i.applicability === 'Y' && i.ai_result).length
    const s = {
      ...summary,
      total: items.length,
      withResult,
      // step-6 gates (spec §3.3): every applicable Critical + Engineer-Led
      // item has J set; 13.3 is Agree.
      criticalPending,
      item133Agree: items.find(i => i.no === '13.3')?.engineer_verification === 'Agree',
    }
    const key = JSON.stringify(s)
    if (reportedRef.current !== key) {
      reportedRef.current = key
      onSummary?.(s)
    }
  }, [summary, items, onSummary])

  const patchItem = async (item, body) => {
    try {
      await svc.patchChecklistItem(drawingId, page + 1, item.no, body)
      await load()
    } catch {
      setMessage('The change could not be saved. Please retry.')
    }
  }

  const downloadReport = async () => {
    setBusy('download')
    try {
      await svc.downloadChecklistReport(drawingId, page + 1)
    } catch (err) {
      setMessage(err?.response?.data?.error || 'The report could not be generated.')
    } finally {
      setBusy(null)
    }
  }

  const importReport = async file => {
    if (!file) return
    setBusy('import')
    try {
      const res = await svc.importChecklistReport(drawingId, page + 1, file)
      setMessage(`${res.count} item${res.count === 1 ? '' : 's'} updated from the reviewed workbook.`)
      await load()
    } catch (err) {
      setMessage(err?.response?.data?.error || 'The import failed — is this the downloaded checklist report?')
    } finally {
      setBusy(null)
    }
  }

  const needsVerification = it =>
    it.applicability === 'Y' && (
      it.severity === 'Critical' || it.mode === 'Engineer-Led'
      || (['Non-Conformance', 'Query'].includes(it.ai_result) && !it.engineer_verification)
    )

  const visible = items.filter(it => {
    if (fResult !== 'All' && it.ai_result !== fResult) return false
    if (fSeverity !== 'All' && it.severity !== fSeverity) return false
    if (fMode !== 'All' && it.mode !== fMode) return false
    if (needsMe && !needsVerification(it)) return false
    if (q && !`${it.no} ${it.check_point} ${it.section_title}`.toLowerCase().includes(q)) return false
    return true
  })

  const sections = useMemo(() => {
    const groups = new Map()
    for (const it of visible) {
      const key = `${it.section} · ${it.section_title}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(it)
    }
    return [...groups.entries()]
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── run states ────────────────────────────────────────────────────────
  if (inputsMissing) {
    return (
      <section className="pc-section" aria-label="Checklist">
        <div className="pc-card">
          <EmptyState title="Not run — compulsory input missing.">
            Every check point is “Not run — compulsory input missing”. Add the missing input on the
            Legend &amp; checklist step; checks can then run without a page reload.
          </EmptyState>
        </div>
      </section>
    )
  }
  if (runState !== 'checked') {
    return (
      <section className="pc-section" aria-label="Checklist">
        <div className="pc-card">
          <EmptyState title="Check points are evaluated by the check run.">
            {runState === 'running' ? 'Running… this page refreshes when the run finishes.' : 'Run checks to evaluate the checklist.'}
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
          <EmptyState title={loadError === 'no-template' ? 'No checklist template is imported yet.' : 'The checklist could not be loaded.'}>
            {loadError === 'no-template'
              ? 'Run: python manage.py import_checklist_template AI_PID_Review_Checklist_02.xlsx --code AI-PID-02 --default'
              : 'Please retry.'}
          </EmptyState>
        </div>
      </section>
    )
  }

  const isOpen = key => openSections === null || openSections.has(key)
  const toggleSection = key => {
    const all = new Map()
    for (const it of items) {
      const k = `${it.section} · ${it.section_title}`
      all.set(k, true)
    }
    const next = openSections === null ? new Set(all.keys()) : new Set(openSections)
    if (next.has(key)) next.delete(key); else next.add(key)
    setOpenSections(next)
  }

  return (
    <section className="pc-section" aria-label="Checklist">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          className="pc-input"
          style={{ minWidth: 220 }}
          placeholder="Search check points"
          aria-label="Search check points"
          value={q}
          onChange={e => patchParams({ q: e.target.value || null })}
        />
        <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
          {data.template.code} v{data.template.version} · {items.length} points · {summary?.not_yet_reviewed ?? 0} not yet reviewed
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem' }}>
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => importRef.current?.click()} disabled={busy === 'import'}>
            {busy === 'import' ? 'Importing…' : 'Import reviewed checklist'}
          </button>
          <input
            ref={importRef} type="file" accept=".xlsx" hidden
            onChange={e => { importReport(e.target.files?.[0]); e.target.value = '' }}
            aria-label="Import reviewed checklist workbook"
          />
          <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={downloadReport} disabled={busy === 'download'}>
            {busy === 'download' ? 'Preparing…' : 'Download checklist report (.xlsx)'}
          </button>
        </span>
      </div>

      <div className="pc-chips" role="group" aria-label="Filter by result">
        {['All', ...CL_RESULTS].map(name => (
          <button key={name} type="button" className={`pc-chip${fResult === name ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={fResult === name} onClick={() => patchParams({ cresult: name === 'All' ? null : name })}>
            {name}
            <span className="pc-chip-count">{name === 'All' ? items.length : items.filter(i => i.ai_result === name).length}</span>
          </button>
        ))}
        <button type="button" className={`pc-chip${needsMe ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={needsMe} onClick={() => patchParams({ needsme: needsMe ? null : '1' })}>
          Needs my verification<span className="pc-chip-count">{items.filter(needsVerification).length}</span>
        </button>
      </div>
      <div className="pc-chips" role="group" aria-label="Filter by severity and mode">
        {['All', 'Critical', 'Major', 'Minor'].map(name => (
          <button key={name} type="button" className={`pc-chip${fSeverity === name ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={fSeverity === name} onClick={() => patchParams({ csev: name === 'All' ? null : name })}>
            {name}
          </button>
        ))}
        <span className="pc-faint" style={{ alignSelf: 'center' }}>|</span>
        {['All', 'Automated', 'AI-Assisted', 'Engineer-Led'].map(name => (
          <button key={name} type="button" className={`pc-chip${fMode === name ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={fMode === name} onClick={() => patchParams({ cmode: name === 'All' ? null : name })}>
            {name}
          </button>
        ))}
      </div>

      {message && (
        <p className="pc-note pc-note-warning" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <span>{message}</span>
          <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button>
        </p>
      )}

      <div className="pc-split" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1.2fr)' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sections.length === 0 ? (
            <div className="pc-card">
              <EmptyState title="No check points match these filters.">Change the filters or the search text.</EmptyState>
            </div>
          ) : (
            sections.map(([section, rows]) => {
              const counts = Object.fromEntries(CL_RESULTS.map(r => [r, rows.filter(i => i.ai_result === r && i.applicability === 'Y').length]))
              const naCount = rows.filter(i => i.applicability !== 'Y').length
              return (
                <div key={section} className="pc-card">
                  <button
                    type="button"
                    className="pc-card-header"
                    style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => toggleSection(section)}
                    aria-expanded={isOpen(section)}
                  >
                    <h2 className="pc-card-title">{section}</h2>
                    <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                      {counts['Non-Conformance'] > 0 && `${counts['Non-Conformance']} Non-Conformance · `}
                      {counts.Query > 0 && `${counts.Query} Query · `}
                      {counts.OK} OK{naCount > 0 && ` · ${naCount} N/A`}
                    </span>
                  </button>
                  {isOpen(section) && (
                    <div className="pc-table-wrap">
                      <table className="pc-table">
                        <thead>
                          <tr><th>No.</th><th>Check point</th><th>Mode</th><th>Severity</th><th>Applicability</th><th>AI Result</th><th>Engineer</th><th>Remarks</th><th /></tr>
                        </thead>
                        <tbody>
                          {rows.map(it => (
                            <ChecklistRow
                              key={it.no}
                              item={it}
                              expanded={expanded === it.no}
                              onToggle={() => setExpanded(expanded === it.no ? null : it.no)}
                              onPatch={patchItem}
                              onAddInput={onAddInput}
                              onShowFinding={onShowFinding}
                              subHeading={it.sub_heading}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Summary panel — the Summary-sheet matrix from the same list */}
        {summary && (
          <div className="pc-card" style={{ alignSelf: 'start', minWidth: 0 }}>
            <div className="pc-card-header"><h2 className="pc-card-title">Summary</h2></div>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr><th /><th>Critical</th><th>Major</th><th>Minor</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {CL_RESULTS.map(r => (
                    <tr key={r}>
                      <td>{r}</td>
                      {['Critical', 'Major', 'Minor'].map(s => <td key={s} className="pc-mono">{summary.matrix[r]?.[s] ?? 0}</td>)}
                      <td className="pc-mono">{summary.matrix[r]?.total ?? 0}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pc-muted">Not yet reviewed</td>
                    <td colSpan={3} />
                    <td className="pc-mono">{summary.not_yet_reviewed}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <dl className="pc-kv" style={{ padding: '0 1rem 0.75rem' }}>
              <dt>Mode</dt>
              <dd>Automated {summary.by_mode.Automated} · AI-Assisted {summary.by_mode['AI-Assisted']} · Engineer-Led {summary.by_mode['Engineer-Led']}</dd>
              <dt>Disagree</dt><dd className="pc-mono">{summary.disagree}</dd>
              <dt>Accuracy</dt><dd className="pc-mono">{summary.accuracy != null ? `${summary.accuracy}%` : '—'}</dd>
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}

function ChecklistRow({ item, expanded, onToggle, onPatch, onAddInput, onShowFinding, subHeading }) {
  const [draft, setDraft] = useState(item.remarks || '')
  useEffect(() => { setDraft(item.remarks || '') }, [item.remarks, item.no])
  const noResult = item.applicability !== 'Y' || !item.ai_result
  return (
    <>
      {subHeading && <tr className="pc-muted"><td colSpan={9} style={{ fontWeight: 600, fontSize: 'var(--rd-text-caption)' }}>{subHeading}</td></tr>}
      <tr>
        <td className="pc-mono">{item.no}</td>
        <td>
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" style={{ padding: 0, textAlign: 'left', minWidth: 0 }} onClick={onToggle} aria-expanded={expanded} aria-label={`Details for item ${item.no}`}>
            {item.check_point}
          </button>
        </td>
        <td><Pill label={item.mode} tone={item.mode === 'Engineer-Led' ? 'neutral' : 'info'} /></td>
        <td><Pill label={item.severity} tone={CL_SEV_TONES[item.severity] ?? 'neutral'} /></td>
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
          {item.applicability_by === 'ai' && <span className="pc-faint" style={{ marginLeft: '0.25rem', fontSize: 'var(--rd-text-caption)' }} title="AI suggestion — not yet confirmed">AI</span>}
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
          {item.finding_ids?.length > 0 && (
            <span style={{ display: 'inline-flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {/* Show the checklist-serial label used in the Findings list
                  (finding_labels, e.g. '9.1-2'); fall back to sl_no, then id. */}
              {item.finding_ids.map((fid, i) => {
                const label = item.finding_labels?.[i] ?? null
                const n = item.finding_nos?.[i] ?? fid
                return (
                  <button key={fid} type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onShowFinding?.(n)} aria-label={`Open finding ${label ?? `F${n}`}`}>
                    {label ?? `F${n}`}
                  </button>
                )
              })}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ background: 'var(--rd-surface-subtle)' }}>
            <dl className="pc-kv" style={{ gap: '0.5rem' }}>
              <dt>What AI shall do</dt><dd>{item.ai_task || '—'}</dd>
              <dt>Inputs</dt>
              <dd>
                {item.ref_inputs || '—'}
                {item.missing_inputs?.length > 0 && (
                  <>
                    {' — missing: '}
                    <span style={{ color: 'var(--rd-danger)' }}>{item.missing_inputs.join(', ')}</span>
                    {onAddInput && (
                      <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onAddInput}>Add</button>
                    )}
                  </>
                )}
              </dd>
              <dt>Evidence required</dt><dd>{item.evidence_required || '—'}</dd>
              <dt>AI evidence</dt><dd>{item.evidence || '—'}</dd>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Step 5: Findings ────────────────────────────────────────────────────

function StepFindings({ drawingId, findings, errorCount, queryCount, openCount, searchParams, patchParams, onConfirm, onReject, rejectComments, runState = 'checked', runStartedAt = null, onRunChecks = null, resultsLoading = false, sheets = [], selectedPage = 0, onPageChange = null, crossFindings = [], linkedSheets = [], projectId = null }) {
  const filter = searchParams.get('ffilter') || 'All'
  const fkind = searchParams.get('fkind') || 'sheet'
  const findingParam = searchParams.get('finding')
  const listRef = useRef(null)
  const detailRef = useRef(null)
  const navigate = useNavigate()


  const filtered = useMemo(() => {
    if (filter === 'Errors') return findings.filter(f => ['critical', 'major'].includes(String(f.severity).toLowerCase()))
    if (filter === 'Queries') return findings.filter(f => !['critical', 'major'].includes(String(f.severity).toLowerCase()))
    if (filter === 'Open') return findings.filter(isOpen)
    return findings
  }, [findings, filter])

  const selected = useMemo(() => {
    if (findingParam) {
      const num = Number(String(findingParam).replace(/^F/i, ''))
      const hit = filtered.find(f => f.number === num) || findings.find(f => f.number === num)
      if (hit) return hit
    }
    return filtered[0] ?? null
  }, [filtered, findings, findingParam])

  const selectFinding = f => patchParams({ finding: f ? `F${f.number}` : null })

  const onListKey = event => {
    if (filtered.length === 0) return
    const idx = selected ? filtered.findIndex(f => f.id === selected.id) : -1
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectFinding(filtered[Math.min(idx + 1, filtered.length - 1)])
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectFinding(filtered[Math.max(idx - 1, 0)])
    } else if (event.key.toLowerCase() === 'c' && selected) {
      event.preventDefault()
      onConfirm(selected)
    } else if (event.key.toLowerCase() === 'r' && selected) {
      event.preventDefault()
      // Reject needs a comment, so R moves focus to the detail card's
      // "Reject — not an error" button; Enter opens the comment field.
      const buttons = detailRef.current?.querySelectorAll('.pc-finding-actions .rd-btn')
      buttons?.[1]?.focus()
      buttons?.[1]?.click()
    }
  }

  const nextFinding = () => {
    const idx = selected ? filtered.findIndex(f => f.id === selected.id) : -1
    selectFinding(filtered[Math.min(idx + 1, filtered.length - 1)] ?? selected)
  }

  const markers = findings.map(f => ({ id: f.id, number: f.number, displayId: f.displayId, status: markerStatus(f), locations: f.locations }))
  const marked = markers.filter(m => m.locations.length > 0).length

  // ── 2D | 3D viewer (spec §4.1) ────────────────────────────────────────
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('pidchk:view-mode') === '3d' ? '3d' : '2d' } catch { return '2d' }
  })
  const [liftFrom2D, setLiftFrom2D] = useState(false)
  const chooseView = mode => {
    if (mode === '3d' && viewMode === '2d') setLiftFrom2D(true) // B6: play the lift once
    setViewMode(mode)
    try { localStorage.setItem('pidchk:view-mode', mode) } catch { /* storage blocked */ }
  }
  const [inspected, setInspected] = useState(null) // 3D click-to-inspect object
  // The scene JSON is fetched once per sheet here (cached server-side) to
  // drive the finding anchors in the detail card; the viewer wrapper
  // fetches it for its own render.
  const [scene3d, setScene3d] = useState(null)
  useEffect(() => {
    let alive = true
    setScene3d(null)
    setInspected(null)
    if (!drawingId || runState !== 'checked') return undefined
    svc.getScene3D(drawingId, selectedPage + 1)
      .then(scene => { if (alive && scene?.status === 'ok') setScene3d(scene) })
      .catch(() => {})
    return () => { alive = false }
  }, [drawingId, selectedPage, runState])

  const onViewIn3D = findingId => {
    chooseView('3d')
    selectFinding(findings.find(f => f.id === findingId))
  }

  // The 2D image and markers follow the SHEET selector, not the selected
  // finding (all shown findings belong to the selected sheet).
  const page = selectedPage
  const image = useDrawingImage(drawingId, page)
  const ring = useMemo(() => {
    const raw = searchParams.get('ring')
    if (!raw) return null
    const [x0, y0, x1, y1] = raw.split(',').map(Number)
    return [x0, y0, x1, y1].every(Number.isFinite) ? { x0, y0, x1, y1 } : null
  }, [searchParams])

  // Spec §2: never show "0 findings" for a drawing that has not run.
  if (runState !== 'checked') {
    return (
      <section className="pc-section" aria-label="Findings">
        <div className="pc-card pc-card-pad" style={{ textAlign: 'center' }}>
          {runState === 'running' && (
            <>
              <p className="pc-empty-title">Running… {runStartedAt ? `started ${new Date(runStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
              <div className="pc-progress" role="img" aria-label="Check run in progress" style={{ maxWidth: 320, margin: '0.75rem auto' }}>
                <span className="pc-progress-ok pc-progress-indeterminate" style={{ width: '40%' }} />
              </div>
              <p className="pc-empty-text">This page refreshes automatically when the run finishes.</p>
            </>
          )}
          {runState === 'failed' && (
            <>
              <p className="pc-empty-title">The check run failed.</p>
              <p className="pc-empty-text">The error is shown on the drawings table of the project workspace.</p>
              {onRunChecks && <button type="button" className="rd-btn rd-btn-primary" onClick={onRunChecks}>Retry</button>}
            </>
          )}
          {runState === 'not-run' && (
            <>
              <p className="pc-empty-title">Checks have not run yet.</p>
              <p className="pc-empty-text">Findings appear here after the check run finishes.</p>
              {onRunChecks && <button type="button" className="rd-btn rd-btn-primary" onClick={onRunChecks}>Run checks</button>}
            </>
          )}
        </div>
      </section>
    )
  }

  // Bug 6: while the results are in flight, show a skeleton — never
  // "Findings 0 / No findings were raised on this sheet".
  if (resultsLoading) {
    return (
      <section className="pc-section" aria-label="Findings">
        <div className="pc-card pc-card-pad" style={{ textAlign: 'center' }}>
          <p className="pc-empty-title">Loading results…</p>
          <div className="pc-skeleton" style={{ height: 18, margin: '0.5rem 0' }} />
          <div className="pc-skeleton" style={{ height: 18, margin: '0.5rem 0' }} />
          <div className="pc-skeleton" style={{ height: 18, margin: '0.5rem 0' }} />
        </div>
      </section>
    )
  }

  return (
    <section className="pc-section" aria-label="Findings">
      {findings.length > 0 && (
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
          {findings.length} finding{findings.length === 1 ? '' : 's'} raised on this sheet
          {' '}(F{Math.min(...findings.map(f => f.number))}–F{Math.max(...findings.map(f => f.number))}) — {openCount} still open.
          {marked < findings.length && ` ${findings.length - marked} finding${findings.length - marked === 1 ? '' : 's'} have no drawing coordinates yet.`}
        </p>
      )}
      <div className="pc-split">
        <div style={{ minWidth: 0 }}>
          {sheets.length > 1 && (
            <div className="pc-segbar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="rd-btn rd-btn-secondary rd-btn-sm"
                disabled={selectedPage <= 0}
                onClick={() => onPageChange?.(selectedPage - 1)}
                aria-label="Previous sheet"
              >
                ← Prev
              </button>
              <select
                className="pc-select"
                style={{ minHeight: 30, minWidth: 260 }}
                value={selectedPage}
                onChange={e => onPageChange?.(Number(e.target.value))}
                aria-label="Sheet"
              >
                {sheets.map(s => (
                  <option key={s.pageIndex} value={s.pageIndex}>
                    {`Sheet ${s.pageIndex + 1} of ${sheets.length}${s.number ? ` · ${s.number}` : ''}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rd-btn rd-btn-secondary rd-btn-sm"
                disabled={selectedPage >= sheets.length - 1}
                onClick={() => onPageChange?.(selectedPage + 1)}
                aria-label="Next sheet"
              >
                Next →
              </button>
              <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                Sheet {selectedPage + 1} of {sheets.length}{sheets[selectedPage]?.number ? ` · ${sheets[selectedPage].number}` : ''}
              </span>
            </div>
          )}
          {linkedSheets.length > 0 && (
            <div className="pc-segbar" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
              <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>Linked P&IDs:</span>
              {linkedSheets.map(s => (
                <button
                  key={s.sheet_id}
                  type="button"
                  className="pc-chip"
                  style={s.both ? { minHeight: 30 } : { minHeight: 30, borderColor: '#d97706', color: '#b45309' }}
                  title={s.both ? 'Linked both ways' : 'One way — no return connector'}
                  onClick={() => navigate(`/engineering/process/pid-verification/projects/${projectId}/drawings/${s.document_id}?sheet=${s.page_index + 1}`)}
                >
                  {s.drawing_no ?? `p.${s.page_index + 1}`}
                </button>
              ))}
            </div>
          )}
          <div className="pc-segbar">
            <div className="pc-seg" role="group" aria-label="Viewer mode">
              <button
                type="button"
                className={`pc-seg-btn${viewMode === '2d' ? ' pc-seg-btn-active' : ''}`}
                aria-pressed={viewMode === '2d'}
                onClick={() => chooseView('2d')}
              >
                2D
              </button>
              <button
                type="button"
                className={`pc-seg-btn${viewMode === '3d' ? ' pc-seg-btn-active' : ''}`}
                aria-pressed={viewMode === '3d'}
                onClick={() => chooseView('3d')}
              >
                3D
              </button>
            </div>
          </div>
          {viewMode === '2d' ? (
            <DrawingViewer
              imageUrl={image.url}
              imageLoading={image.loading}
              imageError={image.error}
              onImageRetry={image.retry}
              findings={markers}
              ring={ring}
              selectedId={selected?.id ?? null}
              onSelect={id => selectFinding(findings.find(f => f.id === id))}
              zoom={searchParams.get('zoom')}
              onZoomChange={z => patchParams({ zoom: z === 'fit' ? null : z })}
            />
          ) : (
            <Suspense fallback={(
              <div className="pc-viewer pc-3d">
                <div className="pc-3d-canvas" style={{ padding: '1rem' }}>
                  <div className="pc-skeleton" style={{ height: '100%' }} />
                </div>
              </div>
            )}>
              <Findings3DViewer
                documentId={drawingId}
                page={selectedPage}
                selectedFindingId={selected?.id ?? null}
                onSelectFinding={id => selectFinding(findings.find(f => f.id === id))}
                onSelectObject={setInspected}
                playLift={liftFrom2D}
              />
            </Suspense>
          )}
          {viewMode === '3d' && inspected && (
            <InspectorCard object={inspected} scene={scene3d} onClose={() => setInspected(null)} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <div className="pc-card">
            <div className="pc-card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 className="pc-card-title">Findings</h2>
              <div className="pc-seg" role="group" aria-label="Finding source">
                <button
                  type="button"
                  className={`pc-seg-btn${fkind === 'sheet' ? ' pc-seg-btn-active' : ''}`}
                  aria-pressed={fkind === 'sheet'}
                  onClick={() => patchParams({ fkind: null, finding: null })}
                >
                  Sheet
                </button>
                <button
                  type="button"
                  className={`pc-seg-btn${fkind === 'cross' ? ' pc-seg-btn-active' : ''}`}
                  aria-pressed={fkind === 'cross'}
                  onClick={() => patchParams({ fkind: 'cross', finding: null })}
                >
                  Cross-drawing{crossFindings.length > 0 ? ` (${crossFindings.length})` : ''}
                </button>
              </div>
              {fkind === 'sheet' && (
              <div className="pc-chips" role="group" aria-label="Filter findings">
                {[['All', findings.length], ['Errors', errorCount], ['Queries', queryCount], ['Open', openCount]].map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    className={`pc-chip${filter === name ? ' pc-chip-active' : ''}`}
                    style={{ minHeight: 30 }}
                    aria-pressed={filter === name}
                    onClick={() => patchParams({ ffilter: name === 'All' ? null : name })}
                  >
                    {name}<span className="pc-chip-count">{count}</span>
                  </button>
                ))}
              </div>
              )}
            </div>
            {fkind === 'cross' ? (
              crossFindings.length === 0 ? (
                <EmptyState title="No cross-drawing findings involve this sheet.">
                  Cross-drawing checks run across all P&IDs in the project — see All P&IDs.
                </EmptyState>
              ) : (
                <div className="pc-flist" role="listbox" aria-label="Cross-drawing findings on this sheet">
                  {crossFindings.map(c => {
                    const others = (c.sheets || [])
                      .map(id => linkedSheets.find(s => s.sheet_id === id))
                      .filter(Boolean)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected="false"
                        className="pc-flist-item"
                        onClick={() => {
                          const evOwn = (c.evidence || []).find(e => e.bbox)
                          if (evOwn?.bbox) patchParams({ ring: evOwn.bbox.join(',') })
                        }}
                      >
                        <span className="pc-flist-num">X{c.number}</span>
                        <span className="pc-flist-title">
                          {c.title}
                          <span className="pc-faint" style={{ display: 'block', fontSize: 'var(--rd-text-caption)' }}>
                            {others.length > 0 ? `↔ ${others.map(s => s.drawing_no).join(', ')} (Open)` : 'Across sheets'}
                          </span>
                        </span>
                        <Pill label={c.kind === 'error' ? 'Error' : 'Query'} tone={c.kind === 'error' ? 'danger' : 'warning'} />
                      </button>
                    )
                  })}
                </div>
              )
            ) : filtered.length === 0 ? (
              <EmptyState title={findings.length === 0 ? 'No findings were raised on this sheet.' : `No ${filter.toLowerCase()} findings.`}>
                {findings.length === 0 ? 'Findings appear here after the check run finishes.' : 'Change the filter to see the other findings.'}
              </EmptyState>
            ) : (
              <div
                className="pc-flist"
                role="listbox"
                aria-label="Findings list — arrow keys move, C confirms, R rejects"
                tabIndex={0}
                ref={listRef}
                onKeyDown={onListKey}
              >
                {filtered.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={selected?.id === f.id}
                    className={`pc-flist-item${selected?.id === f.id ? ' pc-flist-item-selected' : ''}`}
                    onClick={() => selectFinding(f)}
                  >
                    <span className="pc-flist-num">{f.displayId}</span>
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
                finding={{ ...selected, status: findingLabel(selected) }}
                scene3d={scene3d}
                onViewIn3D={onViewIn3D}
                onConfirm={() => onConfirm(selected)}
                onReject={comment => onReject(selected, comment)}
                onNext={filtered.length > 1 ? nextFinding : null}
              />
            </div>
          )}
          {selected && rejectComments[selected.id] && (
            <p className="pc-note" style={{ margin: 0, background: 'var(--rd-surface-subtle)' }}>
              Rejection comment (stored locally — the findings endpoint has no comment field): {rejectComments[selected.id]}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

// ── 3D inspector card (click-to-inspect, spec §2) ───────────────────────

function InspectorCard({ object, scene, onClose }) {
  if (!object?.data) return null
  const d = object.data
  const isLine = object.type === 'line'
  const isValve = object.type === 'valve'
  const valveLine = isValve && scene ? (scene.lines || []).find(l => l.id === d.line_id) : null
  return (
    <div className="pc-card pc-card-pad" style={{ marginTop: '0.75rem' }}>
      <div className="pc-card-header" style={{ padding: 0 }}>
        <h3 className="pc-card-title">
          {isLine ? (d.line_no || 'Line') : isValve ? 'Valve' : (d.tag || 'Equipment')}
        </h3>
        <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Close inspector" onClick={onClose}>×</button>
      </div>
      <dl className="pc-kv">
        {isLine && (
          <>
            <dt>Size</dt><dd>{d.size_in != null ? `${Math.round(d.size_in * 10) / 10}"` : '—'}</dd>
            <dt>Class</dt><dd>{d.cls ? `${d.cls}${d.cls_desc ? ` · ${d.cls_desc}` : ''}` : '—'}</dd>
            <dt>Insulation</dt><dd>{d.ins ? `${d.ins}${d.ins_desc ? ` · ${d.ins_desc}` : ''}` : '—'}</dd>
            <dt>Design cases</dt><dd>{d.cases?.length ? d.cases.join(' · ') : '—'}</dd>
            {d.new && (<><dt>Scope</dt><dd>New scope (red on the drawing)</dd></>)}
          </>
        )}
        {isValve && (
          <>
            <dt>On line</dt><dd className="pc-mono">{valveLine?.line_no ?? '—'}</dd>
            <dt>Size</dt><dd>{d.size_in != null ? `${Math.round(d.size_in * 10) / 10}"` : '—'}</dd>
          </>
        )}
        {object.type === 'equipment' && (
          <>
            <dt>Kind</dt><dd>{d.kind ?? '—'}</dd>
            {d.ghost && (<><dt>Presence</dt><dd>{d.note ?? 'Referenced, not drawn on this sheet'}</dd></>)}
          </>
        )}
      </dl>
    </div>
  )
}

// ── sign-off name field (writes C5/F5 via the review-meta endpoint) ─────

function ReviewNameField({ label, field, drawingId, initial }) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(null)
  useEffect(() => { setValue(initial) }, [initial])
  const save = async () => {
    if (value.trim() === initial) return
    try {
      await svc.patchReviewMeta(drawingId, { [field]: value.trim() })
      setSaved('Saved')
      setTimeout(() => setSaved(null), 3000)
    } catch {
      setSaved('Save failed')
    }
  }
  return (
    <label className="pc-field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
      <span className="pc-label">{label}</span>
      <input
        className="pc-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        aria-label={label}
      />
      {saved && <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>{saved}</span>}
    </label>
  )
}

// ── Step 6: Report & sign-off ───────────────────────────────────────────

function StepReport({ gates, allGatesGreen, findings, exporting, onExport, resultsReady, onSubmit, drawingId = null, currentDoc = null }) {
  const byCategory = useMemo(() => {
    const groups = new Map()
    for (const f of findings) {
      const key = f.category || 'other'
      if (!groups.has(key)) groups.set(key, { total: 0, open: 0, ok: 0, rejected: 0 })
      const g = groups.get(key)
      g.total += 1
      if (isOpen(f)) g.open += 1
      else if (isConfirmed(f)) g.ok += 1
      else if (isRejected(f)) g.rejected += 1
    }
    return [...groups.entries()]
  }, [findings])

  return (
    <section className="pc-section" aria-label="Report and sign-off">
      <div className="pc-split" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', minWidth: 0 }}>
          <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                title={allGatesGreen ? undefined : 'All five gates must be green before submitting'}
                onClick={onSubmit}
              >
                Submit for review
              </button>
            </div>
          </div>

          <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <h2 className="pc-card-title">Exports</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="rd-btn rd-btn-secondary" disabled={!resultsReady || exporting === 'excel'} onClick={() => onExport('excel')}>
                {exporting === 'excel' ? 'Preparing…' : 'Export check report (.xlsx)'}
              </button>
              <button type="button" className="rd-btn rd-btn-secondary" disabled={!resultsReady || exporting === 'pdf'} onClick={() => onExport('pdf')}>
                {exporting === 'pdf' ? 'Preparing…' : 'Marked-up drawing (.pdf)'}
              </button>
            </div>
            <p className="pc-help">
              The workbook lists one sheet per check group (summary plus per-category finding sheets, as generated by the backend export).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', minWidth: 0 }}>
          <div className="pc-card">
            <div className="pc-card-header"><h2 className="pc-card-title">Sign-off</h2></div>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead><tr><th>Role</th><th>Name</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {['Prepared', 'Checked', 'Approved'].map(role => (
                    <tr key={role}>
                      <td>{role}</td>
                      <td>—</td>
                      <td>—</td>
                      <td><Pill label="Not set" tone="neutral" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Written to C5 / F5 of the checklist report (spec §3.3). */}
            {drawingId && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', padding: '0 1rem 0.75rem' }}>
                <ReviewNameField label="Reviewed by" field="reviewed_by" drawingId={drawingId} initial={currentDoc?.reviewedBy ?? ''} />
                <ReviewNameField label="Approved by" field="approved_by" drawingId={drawingId} initial={currentDoc?.approvedBy ?? ''} />
              </div>
            )}
          </div>

          <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <h2 className="pc-card-title">Result by section</h2>
            {byCategory.length === 0 ? (
              <EmptyState title="No findings to group yet.">Bars appear here once the check run has raised or cleared findings.</EmptyState>
            ) : (
              <div className="pc-bars">
                {byCategory.map(([cat, g]) => {
                  const label = { tag: 'Tags', connectivity: 'Connectivity', valve: 'Valves & equipment', line_size: 'Line sizes', notes: 'Notes & HOLDs' }[cat] ?? cat
                  const pct = n => `${(g.total ? (n / g.total) * 100 : 0)}%`
                  return (
                    <div key={cat} className="pc-bar-row">
                      <span>{label}</span>
                      <div className="pc-bar-track" role="img" aria-label={`${label}: ${g.ok} confirmed, ${g.open} open, ${g.rejected} rejected of ${g.total}`}>
                        <span className="pc-progress-ok" style={{ width: pct(g.ok) }} />
                        <span className="pc-progress-notok" style={{ width: pct(g.open) }} />
                        <span className="pc-progress-na" style={{ width: pct(g.rejected) }} />
                      </div>
                      <span className="pc-muted">{g.ok} OK · {g.open} open · {g.rejected} N/A</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
