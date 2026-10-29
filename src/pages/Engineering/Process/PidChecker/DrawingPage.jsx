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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as svc from './pidChecker.service'
import { PageHeader, KpiTile, Pill, ReadabilityPill, Stepper, DrawingViewer, FindingDetailCard, EmptyState } from './shared'
import './pidchecker.css'

const STEPS = ['Drawings', 'Reference documents', 'Extraction review', 'Checklist', 'Findings', 'Report & sign-off']

const REFERENCE_SLOTS = [
  { key: 'legend_pid', name: 'Legend P&ID', unlocks: 'Symbol and abbreviation checks', format: 'PDF' },
  { key: 'line_list', name: 'Line list', unlocks: 'Line number, size and service checks', format: 'Excel' },
  { key: 'instrument_index', name: 'Instrument index', unlocks: 'Instrument tag and function checks', format: 'Excel' },
  { key: 'equipment_list', name: 'Equipment list', unlocks: 'Equipment numbering and rating checks', format: 'Excel' },
  { key: 'piping_class_index', name: 'Piping class index', unlocks: 'Piping class checks', format: 'Excel' },
  { key: 'document_register', name: 'Document register', unlocks: 'Revision and document status checks', format: 'Excel / PDF' },
  { key: 'adnoc_dgs', name: 'ADNOC DGS', unlocks: 'Client standard checks', format: 'PDF' },
  { key: 'cause_effect', name: 'Cause & effect', unlocks: 'Trip and alarm cross-checks', format: 'Excel' },
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

/** Pull real 0..1 marker coordinates from a drawing's tag_positions for the
 *  tag(s) a finding mentions. Absolute PDF points cannot be normalised
 *  without page dimensions, so only fractional coordinates are used —
 *  findings without usable coordinates get NO marker (spec §1). */
function locationsFor(f, tagPositions) {
  if (!tagPositions) return []
  const text = `${f.evidence || ''} ${f.issue_observed || ''}`
  const points = []
  for (const [tag, pos] of Object.entries(tagPositions)) {
    if (!tag || !text.includes(tag)) continue
    const candidates = []
    if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
      if (typeof pos.x === 'number' && typeof pos.y === 'number') candidates.push(pos)
      if (Array.isArray(pos.all)) candidates.push(...pos.all.filter(p => typeof p?.x === 'number' && typeof p?.y === 'number'))
    } else if (Array.isArray(pos)) {
      candidates.push(...pos.filter(p => typeof p?.x === 'number' && typeof p?.y === 'number'))
    }
    for (const p of candidates) {
      if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) points.push({ x: p.x, y: p.y })
    }
  }
  return points.slice(0, 4)
}

function normalizeFinding(issue, drawing) {
  return {
    id: issue.id,
    number: issue.sl_no ?? issue.id,
    title: issue.issue_observed ?? 'Finding',
    status: issue.status,
    severity: issue.severity,
    category: issue.category,
    ruleId: issue.rule_id,
    found: issue.evidence ?? null,
    expected: null,
    basis: issue.action_required ?? null,
    checklist: issue.rule_id ?? null,
    pageIndex: drawing?.page_index ?? 0,
    locations: locationsFor(issue, drawing?.metadata?.tag_positions),
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

  const [project, setProject] = useState(null)
  const [results, setResults] = useState(null)
  const [processing, setProcessing] = useState(null) // status message when 202
  const [projectDrawings, setProjectDrawings] = useState([])
  const [references, setReferences] = useState(null)
  const [unlocked, setUnlocked] = useState({}) // data_type -> true after upload this session
  const [error, setError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [exporting, setExporting] = useState(null)

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
    }
    try {
      const data = await svc.getResults(drawingId)
      setResults(data)
      setProcessing(null)
    } catch (err) {
      if (err?.response?.status === 202) {
        setProcessing(err.response.data?.status || 'processing')
      } else {
        setError(err?.response?.data?.error || 'The drawing results could not be loaded.')
      }
    }
  }, [projectId, drawingId])

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

  const drawings = useMemo(() => results?.drawings || [], [results])
  const mergedMetadata = useMemo(() => {
    const merged = {}
    for (const d of drawings) Object.assign(merged, d.metadata || {})
    return merged
  }, [drawings])

  const findings = useMemo(
    () => drawings.flatMap(d => (d.issues || []).map(issue => normalizeFinding(issue, d))),
    [drawings],
  )
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
  const missingRefs = useMemo(
    () => REFERENCE_SLOTS.filter(s => !referencesByType[s.key] && !unlocked[s.key]),
    [referencesByType, unlocked],
  )

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
      label: 'Engineer points signed',
      ok: checklistConfigured,
      missing: 'Checklist not configured — engineer points cannot be verified',
    },
    {
      id: 'extraction',
      label: 'Extraction confirmed',
      ok: tabsWithData.length > 0 && confirmedCount === tabsWithData.length,
      missing: tabsWithData.length === 0
        ? 'No extraction detail to confirm'
        : `${confirmedCount} / ${tabsWithData.length} extraction tabs confirmed`,
    },
  ]), [results, openFindings, references, missingRefs, confirmedCount, tabsWithData, checklistConfigured])
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

  const removeReference = async slotKey => {
    const record = referencesByType[slotKey]
    if (!record?.reference_id) return
    try {
      await svc.deleteReferenceData(record.reference_id)
      setReferences(await svc.listReferenceData(projectId))
    } catch {
      setActionMessage('The reference document could not be removed. Please retry.')
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
  const drawingNo = currentDoc?.drawingNo ?? null
  const lastRun = results?.updated_at ? new Date(results.updated_at).toLocaleString() : null

  const stepStates = useMemo(() => {
    const extractionTotal = tabsWithData.length
    return [
      { state: results ? 'done' : 'todo', statusText: currentDoc ? `1 drawing · ${currentDoc.readability === 'ocr' ? 'OCR' : currentDoc.readability === 'unreadable' ? 'not readable' : 'vector PDF'}` : '—' },
      { state: missingRefs.length > 0 ? 'warning' : 'done', statusText: references ? `${missingRefs.length} of ${REFERENCE_SLOTS.length} missing` : '—' },
      { state: extractionTotal > 0 && confirmedCount === extractionTotal ? 'done' : extractionTotal > 0 ? 'warning' : 'todo', statusText: extractionTotal > 0 ? `${confirmedCount} / ${extractionTotal} confirmed` : 'No extraction detail' },
      { state: 'todo', statusText: checklistConfigured ? undefined : 'Checklist not configured' },
      { state: openFindings.length > 0 ? 'warning' : findings.length > 0 ? 'done' : 'todo', statusText: `${openFindings.length} open` },
      { state: allGatesGreen ? 'done' : 'warning', statusText: allGatesGreen ? 'Ready' : 'Blocked' },
    ]
  }, [results, currentDoc, missingRefs, references, tabsWithData, confirmedCount, openFindings, findings, allGatesGreen, checklistConfigured])

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'Engineering' },
        { label: '1.1 Process' },
        { label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' },
        { label: project?.name ?? '…', to: projectBase },
        { label: drawingNo ?? results?.file_name ?? '…' },
      ]}
      title="P&ID Checker"
      pill={<Pill label="Checklist — · — points" tone="neutral" title="No project checklist is configured" />}
      subtitle={project
        ? `${project.name} · ${project.client ?? 'Client not set'} · ${drawingNo ?? '—'}${currentDoc?.rev ? ` Rev ${currentDoc.rev}` : ''}${results?.file_name ? ` · ${results.file_name}` : ''}`
        : null}
      actions={(
        <>
          <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Last run {lastRun ?? '—'} · rules —
          </span>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={() => navigate(projectBase)}>
            Drawing sets
          </button>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={rerun} disabled={Boolean(processing)}>
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

  return (
    <div className="pc-page">
      {header}

      <Stepper
        steps={STEPS.map((label, i) => ({ label, state: stepStates[i].state, statusText: stepStates[i].statusText }))}
        current={step}
        onSelect={i => setStep(i)}
      />

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

      <KpiRow
        findings={findings}
        openFindings={openFindings}
        missingRefs={missingRefs}
        checklistConfigured={checklistConfigured}
        goToChecklist={preset => setStep(3, preset)}
      />

      {step === 0 && (
        <StepDrawings
          currentDoc={currentDoc}
          projectDrawings={projectDrawings}
          projectId={projectId}
          onUploaded={load}
          checklistConfigured={checklistConfigured}
        />
      )}
      {step === 1 && (
        <StepReferences
          missingRefs={missingRefs}
          referencesByType={referencesByType}
          unlocked={unlocked}
          onUpload={uploadReference}
          onRemove={removeReference}
        />
      )}
      {step === 2 && (
        <StepExtraction
          tabs={EXTRACTION_TABS}
          data={extractionData}
          confirmedTabs={confirmedTabs}
          onConfirmTab={confirmTab}
          activeTab={searchParams.get('tab') || 'lines'}
          onTabChange={t => patchParams({ tab: t === 'lines' ? null : t })}
          onShowOnDrawing={row => {
            const pos = row.tag ? locationsFor({ evidence: row.tag, issue_observed: '' }, mergedMetadata.tag_positions) : []
            if (row.tag && pos.length > 0) setStep(4, { highlight: row.tag })
            else setActionMessage('No coordinates on the drawing for this value yet.')
          }}
        />
      )}
      {step === 3 && <StepChecklist searchParams={searchParams} patchParams={patchParams} />}
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
        />
      )}
    </div>
  )
}

// ── KPI tiles ───────────────────────────────────────────────────────────

function KpiRow({ findings, openFindings, missingRefs, checklistConfigured, goToChecklist }) {
  const engineerReview = findings.filter(f => isOpen(f)).length // open findings await engineer disposition
  return (
    <div className="pc-kpi-grid-6" aria-label="Drawing summary">
      <KpiTile
        label="Checklist points"
        value={checklistConfigured ? undefined : '—'}
        meta={checklistConfigured ? undefined : 'Automatic / Reference / Engineer — checklist not configured'}
        onClick={() => goToChecklist({})}
      />
      <KpiTile label="Findings open" value={openFindings.length} danger={openFindings.length > 0} meta={`${findings.length} raised on this sheet`} onClick={() => goToChecklist({ result: 'open' })} />
      <KpiTile label="OK" value={checklistConfigured ? undefined : '—'} meta={checklistConfigured ? undefined : 'Checklist not configured'} onClick={() => goToChecklist({ result: 'ok' })} />
      <KpiTile label="Not checked" value={missingRefs.length} meta={missingRefs.length > 0 ? `${missingRefs.length} reference document${missingRefs.length === 1 ? '' : 's'} missing` : 'All reference documents provided'} onClick={() => goToChecklist({ result: 'not-checked' })} />
      <KpiTile label="Engineer review" value={engineerReview} meta="Open findings awaiting disposition" onClick={() => goToChecklist({ by: 'engineer' })} />
      <KpiTile label="Not applicable" value={checklistConfigured ? undefined : '—'} meta={checklistConfigured ? undefined : 'Checklist not configured'} onClick={() => goToChecklist({ result: 'na' })} />
    </div>
  )
}

// ── Step 1: Drawings ────────────────────────────────────────────────────

function StepDrawings({ currentDoc, projectDrawings, projectId, onUploaded, checklistConfigured }) {
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
                      {/* No checklist configured: every point is unknown → N/A (grey), honestly labelled. */}
                      <div className="pc-progress" role="img" aria-label={checklistConfigured ? 'Checklist progress' : 'Checklist not configured'}>
                        <span className="pc-progress-na" style={{ width: '100%' }} />
                      </div>
                      <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                        {checklistConfigured ? '' : 'Checklist not configured'}
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

// ── Step 2: Reference documents ─────────────────────────────────────────

function StepReferences({ missingRefs, referencesByType, unlocked, onUpload, onRemove }) {
  const m = missingRefs.length
  return (
    <section className="pc-section" aria-label="Reference documents">
      {m > 0 && (
        <div className="pc-banner pc-banner-warning" role="status">
          <div>
            <p className="pc-banner-title">Checklist points wait for {m} reference document{m === 1 ? '' : 's'}</p>
            <p>Points that need {missingRefs.map(s => s.name).join(', ')} stay at “Not checked — document not provided” until the file is uploaded.</p>
          </div>
        </div>
      )}
      <div className="pc-card pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr><th>Document</th><th>Reference</th><th>Checks it unlocks</th><th>Format</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {REFERENCE_SLOTS.map(slot => (
              <ReferenceRow
                key={slot.key}
                slot={slot}
                record={referencesByType[slot.key]}
                justUnlocked={Boolean(unlocked[slot.key])}
                onUpload={onUpload}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReferenceRow({ slot, record, justUnlocked, onUpload, onRemove }) {
  const inputRef = useRef(null)
  const uploaded = Boolean(record)
  return (
    <tr>
      <td>{slot.name}</td>
      <td className="pc-mono">{record?.file_name ?? record?.filename ?? '—'}</td>
      <td className="pc-muted">{slot.unlocks}</td>
      <td>{slot.format}</td>
      <td>
        {uploaded
          ? <Pill label="Uploaded" tone="success" />
          : justUnlocked
            ? <Pill label="Ready — re-run checks" tone="info" />
            : <Pill label="Missing" tone="warning" />}
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => inputRef.current?.click()}>
            {uploaded ? 'Replace' : 'Upload'}
          </button>
          {uploaded && (
            <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onRemove(slot.key)}>
              Remove
            </button>
          )}
          <input ref={inputRef} type="file" hidden onChange={e => { onUpload(slot.key, e.target.files?.[0]); e.target.value = '' }} aria-label={`Upload ${slot.name}`} />
        </div>
      </td>
    </tr>
  )
}

// ── Step 3: Extraction review ───────────────────────────────────────────
// Confirmations persist in localStorage (keyed by drawing id) — extraction
// rows are not findings, so the findings/<id>/ PATCH does not apply.

function StepExtraction({ tabs, data, confirmedTabs, onConfirmTab, activeTab, onTabChange, onShowOnDrawing }) {
  const listRef = useRef(null)
  const tab = tabs.find(t => t.id === activeTab) ?? tabs[0]
  const rows = data[tab.id] || []
  const confirmed = Boolean(confirmedTabs[tab.id])

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

  return (
    <section className="pc-section" aria-label="Extraction review">
      <div className="pc-tabs" role="tablist" ref={listRef}>
        {tabs.map((t, i) => (
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
            <span className="pc-tab-count">
              {data[t.id].length > 0 ? (confirmedTabs[t.id] ? 'confirmed' : data[t.id].length) : '—'}
            </span>
          </button>
        ))}
      </div>

      <div className="pc-card pc-table-wrap" role="tabpanel">
        {rows.length === 0 ? (
          <EmptyState title={`No ${tab.label.toLowerCase()} detail is stored for this drawing.`}>
            Available after the backend persists extraction detail for this tab. The run summary counts are shown on the drawings step.
          </EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th aria-label="OK">OK</th><th>Value</th><th>{tab.col1}</th><th>{tab.col2}</th><th>Check note</th><th>Drawing</th></tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <ExtractionRow key={row.key} row={row} confirmed={confirmed} onShowOnDrawing={onShowOnDrawing} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <div>
          <button
            type="button"
            className={`rd-btn ${confirmed ? 'rd-btn-secondary' : 'rd-btn-primary'}`}
            onClick={() => onConfirmTab(tab.id)}
            disabled={confirmed}
          >
            {confirmed ? 'This tab is confirmed' : 'Confirm this tab'}
          </button>
        </div>
      )}
    </section>
  )
}

function ExtractionRow({ row, confirmed, onShowOnDrawing }) {
  const [ok, setOk] = useState(confirmed)
  useEffect(() => { if (confirmed) setOk(true) }, [confirmed])
  const noteTone = /hold|truncat/i.test(row.note || '') ? 'warning' : 'success'
  return (
    <tr>
      <td>
        <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} aria-label={`OK for ${row.value ?? 'row'}`} style={{ width: 18, height: 18, accentColor: 'var(--rd-primary)' }} />
      </td>
      <td className="pc-mono">{row.value ?? '—'}</td>
      <td>{row.col1 ?? '—'}</td>
      <td>{row.col2 ?? '—'}</td>
      <td><Pill label={row.note || 'Matches drawing'} tone={row.note === 'Matches drawing' ? 'success' : noteTone} /></td>
      <td>
        <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onShowOnDrawing(row)}>
          Show on drawing
        </button>
      </td>
    </tr>
  )
}

// ── Step 4: Checklist ───────────────────────────────────────────────────

const CHECKED_BY = ['All', 'Automatic', 'Reference', 'Engineer']
const RESULTS = ['All', 'Not OK or query', 'Not checked', 'Engineer review', 'OK', 'N/A', 'Signed by engineer']

function StepChecklist({ searchParams, patchParams }) {
  const by = searchParams.get('by') || 'All'
  const result = searchParams.get('result') || 'All'
  const q = searchParams.get('q') || ''

  return (
    <section className="pc-section" aria-label="Checklist">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          className="pc-input"
          style={{ minWidth: 220 }}
          placeholder="Search checklist points"
          aria-label="Search checklist points"
          value={q}
          onChange={e => patchParams({ q: e.target.value || null })}
        />
      </div>
      <div className="pc-chips" role="group" aria-label="Checked by">
        {CHECKED_BY.map(name => (
          <button key={name} type="button" className={`pc-chip${by === name ? ' pc-chip-active' : ''}`} aria-pressed={by === name} onClick={() => patchParams({ by: name === 'All' ? null : name })}>
            {name}<span className="pc-chip-count">—</span>
          </button>
        ))}
      </div>
      <div className="pc-chips" role="group" aria-label="Result">
        {RESULTS.map(name => (
          <button key={name} type="button" className={`pc-chip${result === name ? ' pc-chip-active' : ''}`} aria-pressed={result === name} onClick={() => patchParams({ result: name === 'All' ? null : name })}>
            {name}<span className="pc-chip-count">—</span>
          </button>
        ))}
      </div>
      <div className="pc-card">
        <EmptyState title="Checklist available after the project checklist is configured.">
          The v2 backend has no checklist-definition endpoint yet, so there are no real checklist
          points to show. Upload and configure “Checklist -P&amp;ID.xls” on the project once the
          endpoint exists — counts here stay honest (“—”) until then.
        </EmptyState>
      </div>
    </section>
  )
}

// ── Step 5: Findings ────────────────────────────────────────────────────

function StepFindings({ drawingId, findings, errorCount, queryCount, openCount, searchParams, patchParams, onConfirm, onReject, rejectComments }) {
  const filter = searchParams.get('ffilter') || 'All'
  const findingParam = searchParams.get('finding')
  const listRef = useRef(null)
  const detailRef = useRef(null)

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

  const markers = findings.map(f => ({ id: f.id, number: f.number, status: markerStatus(f), locations: f.locations }))
  const marked = markers.filter(m => m.locations.length > 0).length

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
        <DrawingViewer
          imageUrl={svc.drawingImageUrl(drawingId, selected?.pageIndex ?? 0)}
          findings={markers}
          selectedId={selected?.id ?? null}
          onSelect={id => selectFinding(findings.find(f => f.id === id))}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <div className="pc-card">
            <div className="pc-card-header">
              <h2 className="pc-card-title">Findings</h2>
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
            </div>
            {filtered.length === 0 ? (
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
                    <span className="pc-flist-num">F{f.number}</span>
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

// ── Step 6: Report & sign-off ───────────────────────────────────────────

function StepReport({ gates, allGatesGreen, findings, exporting, onExport, resultsReady }) {
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
                title={allGatesGreen ? undefined : 'All four gates must be green before submitting'}
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
            <p className="pc-help" style={{ padding: '0 1rem 0.75rem', margin: 0 }}>
              Available after the backend stores sign-off names and dates.
            </p>
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
