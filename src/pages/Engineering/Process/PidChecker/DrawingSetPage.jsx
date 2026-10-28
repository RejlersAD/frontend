/**
 * Screen 3 §4 — Drawing set check (PFD + covering P&IDs).
 *
 * SET DERIVATION (documented, spec §4):
 *  The v2 backend has no set endpoint, so sets are derived client-side from
 *  the project drawings list (GET list/?project_id=):
 *   1. If any drawing carries a `set` field (normalizeDrawing.set), drawings
 *      are grouped by that value — the same grouping shown on the project
 *      workspace screen.
 *   2. Otherwise each drawing whose type is PFD opens a set named after its
 *      drawing number; a P&ID joins the set whose PFD number appears in the
 *      P&ID's drawing number or title. P&IDs that mention no PFD are grouped
 *      under "Ungrouped P&IDs"; if the project has no PFD at all there is a
 *      single "All drawings" set.
 *  The route param :setId is the URL-encoded set name (as linked from the
 *  workspace) or, as a fallback, a member drawing id.
 *
 * DATA SOURCES (all real, nothing invented):
 *  - per-document results: GET results/<doc>/ for every set member
 *    (drawings[] with metadata { line_tags, tag_positions, continuation_refs,
 *    instrument_tags, equipment_tags, … } + issues[] per drawing)
 *  - comparison rows: findings whose rule/category references a PFD↔P&ID
 *    comparison, or an explicit comparisons list in a results payload.
 *    Where neither exists the tab renders the honest empty state and the
 *    KPI tiles show "—".
 *  - continuity: metadata.continuation_refs of every member, matched against
 *    the other members of the set.
 *  - finding review: PATCH findings/<id>/ (status only — reject comments are
 *    kept in localStorage keyed by the finding's drawing id, same store as
 *    Screen 2 so the two screens agree).
 *
 * Finding id prefixes (spec §4 tab 3): X = PFD vs P&ID pair finding,
 * P = finding on the PFD, D = finding on a P&ID.
 *
 * Deep links: ?tab=cmp|con|find|ok · ?drawing=<docId> · ?finding=X1 ·
 * ?zoom=fit|200|300 · ?ffilter=<side-list chip>.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as svc from './pidChecker.service'
import { PageHeader, KpiTile, Pill, ReadabilityPill, DrawingViewer, FindingDetailCard, EmptyState } from './shared'
import './pidchecker.css'

const TABS = [
  { id: 'cmp', label: 'PFD vs P&ID' },
  { id: 'con', label: 'Continuity' },
  { id: 'find', label: 'Findings on drawings' },
  { id: 'ok', label: 'Checked, not flagged' },
]

// ── local persistence (same store as Screen 2) ──────────────────────────
const lsKey = (drawingId, part) => `pidchk:drawing:${drawingId}:${part}`
function lsRead(drawingId, part) {
  try { return JSON.parse(localStorage.getItem(lsKey(drawingId, part)) || '{}') } catch { return {} }
}
function lsWrite(drawingId, part, value) {
  try { localStorage.setItem(lsKey(drawingId, part), JSON.stringify(value)) } catch { /* storage full/blocked */ }
}

// ── finding helpers (mirrors Screen 2) ──────────────────────────────────
const normStatus = s => String(s || 'open').toLowerCase()
const isOpen = f => normStatus(f.status) === 'open'
const isConfirmed = f => normStatus(f.status) === 'reviewed'
const isRejected = f => normStatus(f.status) === 'resolved'
const isErrorSev = f => ['critical', 'major'].includes(String(f.severity).toLowerCase())

function findingLabel(f) {
  if (isConfirmed(f)) return 'Confirmed'
  if (isRejected(f)) return 'Rejected'
  return 'Open'
}

function markerStatus(f) {
  if (isConfirmed(f)) return 'confirmed'
  if (isRejected(f)) return 'rejected'
  if (isErrorSev(f)) return 'error'
  if (String(f.severity || '').toLowerCase() === 'minor') return 'minor'
  return 'query'
}

/** True when a finding's rule or category references a PFD↔P&ID comparison. */
function isComparisonFinding(issue = {}) {
  const text = `${issue.rule_id ?? ''} ${issue.category ?? ''}`.toLowerCase()
  return /pfd|compar|cross|consist/.test(text)
}

/** Real 0..1 marker coordinates only (same rule as Screen 2): findings
 *  without usable fractional coordinates get NO marker. */
function locationsFor(issue, tagPositions) {
  if (!tagPositions) return []
  const text = `${issue.evidence || ''} ${issue.issue_observed || ''}`
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

function normalizeFinding(issue, drawing, doc) {
  const pair = isComparisonFinding(issue)
  const prefix = pair ? 'X' : doc?.type === 'PFD' ? 'P' : 'D'
  const number = issue.sl_no ?? issue.id
  return {
    id: issue.id,
    number,
    displayId: `${prefix}${number}`,
    prefix,
    isPair: pair,
    docId: doc?.id ?? null,
    docType: doc?.type ?? null,
    docNo: doc?.drawingNo ?? null,
    title: issue.issue_observed ?? 'Finding',
    status: issue.status,
    severity: issue.severity,
    category: issue.category,
    ruleId: issue.rule_id,
    found: issue.evidence ?? null,
    expected: issue.expected ?? null,
    pfdValue: issue.pfd_value ?? (pair ? issue.expected ?? null : null),
    pidValue: issue.pid_value ?? (pair ? issue.evidence ?? null : null),
    basis: issue.action_required ?? null,
    checklist: issue.rule_id ?? null,
    pageIndex: drawing?.page_index ?? 0,
    locations: locationsFor(issue, drawing?.metadata?.tag_positions),
    raw: issue,
  }
}

// ── set derivation ──────────────────────────────────────────────────────
function deriveSets(drawings) {
  const docs = drawings || []
  const withSet = docs.filter(d => d.set)
  if (withSet.length > 0) {
    const bySet = new Map()
    for (const d of withSet) {
      if (!bySet.has(d.set)) bySet.set(d.set, [])
      bySet.get(d.set).push(d)
    }
    return [...bySet.entries()].map(([name, members]) => ({ name, members }))
  }
  const pfds = docs.filter(d => d.type === 'PFD')
  if (pfds.length === 0) {
    return docs.length > 0 ? [{ name: 'All drawings', members: docs }] : []
  }
  const sets = pfds.map(pfd => ({ name: pfd.drawingNo ?? pfd.title, pfd, members: [pfd] }))
  const ungrouped = []
  for (const d of docs.filter(x => x.type !== 'PFD')) {
    const hay = `${d.drawingNo ?? ''} ${d.title ?? ''}`
    const hit = sets.find(s => s.name && hay.includes(s.name))
    if (hit) hit.members.push(d)
    else ungrouped.push(d)
  }
  if (ungrouped.length > 0) sets.push({ name: 'Ungrouped P&IDs', members: ungrouped })
  return sets
}

// ── comparison rows ─────────────────────────────────────────────────────
/** Explicit comparison lists in a results payload, if the backend provides
 *  them; otherwise null. */
function explicitComparisons(resultsList) {
  for (const res of resultsList) {
    const list = res?.comparisons ?? res?.pfd_pid_comparison ?? res?.pfd_comparison
    if (Array.isArray(list) && list.length > 0) {
      return list.map((row, i) => ({
        key: `cmp-${i}`,
        item: row.item ?? row.label ?? row.equipment ?? null,
        coveringPid: row.pid_drawing ?? row.drawing ?? null,
        pfdValue: row.pfd_value ?? row.pfd ?? null,
        pfdOcr: Boolean(row.pfd_ocr),
        pidValue: row.pid_value ?? row.pid ?? null,
        result: row.result ?? row.status ?? null,
        finding: null,
      }))
    }
  }
  return null
}

/** Comparison rows derived from pair (X) findings. Groups by equipment item
 *  when the finding carries one. */
function comparisonsFromFindings(findings) {
  const pairs = findings.filter(f => f.isPair)
  if (pairs.length === 0) return null
  const groups = new Map()
  for (const f of pairs) {
    const item = f.raw.item ?? f.raw.equipment ?? f.raw.equipment_tag ?? null
    const key = item ?? f.category ?? 'Set-wide checks'
    if (!groups.has(key)) groups.set(key, { item: key, coveringPid: f.docType === 'P&ID' ? f.docNo : null, rows: [] })
    groups.get(key).rows.push({
      key: `f-${f.id}`,
      item: f.title,
      pfdValue: f.pfdValue,
      pfdOcr: false,
      pidValue: f.pidValue ?? f.found,
      result: isRejected(f) ? 'Not checked' : isConfirmed(f) ? 'Agrees' : isErrorSev(f) ? 'Differs' : 'Not checked',
      finding: f,
    })
  }
  return [...groups.values()]
}

// ── continuity rows ─────────────────────────────────────────────────────
function continuityRows(members, resultsByDoc) {
  const rows = []
  const refsByDoc = new Map()
  for (const m of members) {
    const res = resultsByDoc[m.id]
    const refs = (res?.drawings || []).flatMap(d => (d.metadata?.continuation_refs || []))
    refsByDoc.set(m.id, refs)
  }
  for (const m of members) {
    for (const [i, ref] of (refsByDoc.get(m.id) || []).entries()) {
      const connector = ref.connector ?? ref.tag ?? ref.label ?? null
      const pointsTo = ref.target ?? ref.points_to ?? ref.to_drawing ?? null
      const line = ref.line ?? ref.line_number ?? ref.signal ?? null
      const targetDoc = members.find(x => x.id !== m.id && pointsTo
        && (String(x.drawingNo ?? '') === String(pointsTo) || String(x.title ?? '').includes(String(pointsTo))))
      let otherEnd = null
      let result
      if (!targetDoc) {
        result = 'Waiting for drawing'
      } else {
        const back = (refsByDoc.get(targetDoc.id) || []).find(r => {
          const rc = r.connector ?? r.tag ?? r.label
          const rl = r.line ?? r.line_number ?? r.signal
          return (connector && rc === connector) || (line && rl === line)
        })
        if (!back) {
          result = 'Conflict'
        } else {
          const bl = back.line ?? back.line_number ?? back.signal
          const differs = connector && bl && line && String(bl) !== String(line)
          otherEnd = back.connector ?? back.tag ?? back.label ?? '—'
          result = differs ? 'Conflict' : 'Matches both ends'
        }
      }
      rows.push({
        key: `${m.id}-${i}`,
        from: m.drawingNo ?? m.title,
        connector,
        pointsTo,
        otherEnd,
        line,
        result,
      })
    }
  }
  return rows
}

// ═══════════════════════════════════════════════════════════════════════

export default function DrawingSetPage() {
  const { projectId, setId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'cmp'
  const patchParams = useCallback(extra => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) next.delete(k); else next.set(k, v)
    }
    setSearchParams(next)
  }, [searchParams, setSearchParams])
  const setTab = t => patchParams({ tab: t === 'cmp' ? null : t, finding: null })

  const [project, setProject] = useState(null)
  const [drawings, setDrawings] = useState(null)
  const [resultsByDoc, setResultsByDoc] = useState({})
  const [error, setError] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [rejectComments, setRejectComments] = useState({}) // findingId -> comment

  const load = useCallback(async () => {
    setError(null)
    try {
      const [proj, docs] = await Promise.all([
        svc.getProject(projectId),
        svc.listDrawings(projectId).catch(() => []),
      ])
      setProject(proj)
      setDrawings(docs)
    } catch (err) {
      setError(err?.response?.data?.error || 'The project could not be loaded.')
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const sets = useMemo(() => deriveSets(drawings), [drawings])
  const currentSet = useMemo(() => {
    if (sets.length === 0) return null
    return sets.find(s => encodeURIComponent(s.name) === setId)
      ?? sets.find(s => s.members.some(m => String(m.id) === String(setId)))
      ?? (sets.length === 1 ? sets[0] : null)
  }, [sets, setId])

  const members = useMemo(() => currentSet?.members ?? [], [currentSet])
  const pfd = useMemo(() => members.find(m => m.type === 'PFD') ?? null, [members])

  // Fetch results for every set member (per-document endpoint).
  useEffect(() => {
    if (members.length === 0) return undefined
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(members.map(async m => {
        try {
          const data = await svc.getResults(m.id)
          return [m.id, data]
        } catch {
          return [m.id, null]
        }
      }))
      if (!cancelled) setResultsByDoc(Object.fromEntries(entries))
    })()
    return () => { cancelled = true }
  }, [members])

  // Reject comments for all member drawings (shared store with Screen 2).
  useEffect(() => {
    const merged = {}
    for (const m of members) Object.assign(merged, lsRead(m.id, 'reject-comments'))
    setRejectComments(merged)
  }, [members])

  // ── derived lists (single source of truth, spec §5) ──────────────────
  const findings = useMemo(() => members.flatMap(m => {
    const res = resultsByDoc[m.id]
    return (res?.drawings || []).flatMap(d => (d.issues || []).map(issue => normalizeFinding(issue, d, m)))
  }), [members, resultsByDoc])
  const openFindings = useMemo(() => findings.filter(isOpen), [findings])
  const errorCount = openFindings.filter(isErrorSev).length
  const minorCount = openFindings.filter(f => String(f.severity).toLowerCase() === 'minor').length
  const queryCount = openFindings.length - errorCount - minorCount

  const resultsList = useMemo(() => members.map(m => resultsByDoc[m.id]).filter(Boolean), [members, resultsByDoc])
  const cmpGroups = useMemo(
    () => explicitComparisons(resultsList) ?? comparisonsFromFindings(findings),
    [resultsList, findings],
  )
  const cmpRows = useMemo(() => (cmpGroups || []).flatMap(g => g.rows), [cmpGroups])
  const cmpCounts = useMemo(() => ({
    agree: cmpRows.filter(r => /agree|match|ok/i.test(String(r.result ?? ''))).length,
    differ: cmpRows.filter(r => /differ|conflict|not ok/i.test(String(r.result ?? ''))).length,
    notChecked: cmpRows.filter(r => !r.result || /not checked|waiting|unknown/i.test(String(r.result))).length,
  }), [cmpRows])

  const conRows = useMemo(() => continuityRows(members, resultsByDoc), [members, resultsByDoc])
  const conCounts = useMemo(() => ({
    matched: conRows.filter(r => r.result === 'Matches both ends').length,
    conflict: conRows.filter(r => r.result === 'Conflict').length,
    waiting: conRows.filter(r => r.result === 'Waiting for drawing').length,
  }), [conRows])
  const missingDrawings = useMemo(() => [...new Set(conRows.filter(r => r.result === 'Waiting for drawing' && r.pointsTo).map(r => String(r.pointsTo)))], [conRows])

  // Instrument functions: only computed when the extraction detail actually
  // carries function info; otherwise the tile honestly shows "—".
  const instrumentFns = useMemo(() => {
    let found = 0
    let sawFunctionData = false
    for (const res of resultsList) {
      for (const d of res?.drawings || []) {
        for (const t of d.metadata?.instrument_tags || d.metadata?.instruments || []) {
          if (t && typeof t === 'object' && ('function' in t || 'function_description' in t)) {
            sawFunctionData = true
            if (t.function || t.function_description) found += 1
          }
        }
      }
    }
    if (!sawFunctionData) return null
    const missing = openFindings.filter(f => /function/i.test(`${f.ruleId ?? ''} ${f.title}`)).length
    return { found, missing }
  }, [resultsList, openFindings])

  const readTotals = useMemo(() => {
    const lines = members.reduce((n, d) => n + (d.lineNumbers ?? 0), 0)
    const tags = members.reduce((n, d) => n + (d.tags ?? 0), 0)
    return { lines, tags, known: members.some(d => d.lineNumbers != null || d.tags != null) }
  }, [members])

  const coveredEquipment = useMemo(() => {
    const pfdRes = pfd ? resultsByDoc[pfd.id] : null
    const tags = (pfdRes?.drawings || []).flatMap(d => (d.metadata?.equipment_tags || d.metadata?.equipment || []))
      .map(t => (typeof t === 'string' ? t : t?.tag ?? t?.equipment_tag))
      .filter(Boolean)
    return [...new Set(tags)]
  }, [pfd, resultsByDoc])

  const anyOcr = members.some(m => m.readability === 'ocr' || m.readability === 'unreadable')

  // ── actions ───────────────────────────────────────────────────────────
  const patchFindingLocal = (docId, findingId, patch) => {
    setResultsByDoc(prev => {
      const res = prev[docId]
      if (!res) return prev
      return {
        ...prev,
        [docId]: {
          ...res,
          drawings: (res.drawings || []).map(d => ({
            ...d,
            issues: (d.issues || []).map(i => (i.id === findingId ? { ...i, ...patch } : i)),
          })),
        },
      }
    })
  }

  const confirmFinding = async finding => {
    try {
      await svc.patchFinding(finding.id, { status: 'reviewed' })
      patchFindingLocal(finding.docId, finding.id, { status: 'reviewed' })
    } catch {
      setActionMessage('The finding could not be confirmed. Please retry.')
    }
  }

  const rejectFinding = async (finding, comment) => {
    try {
      await svc.patchFinding(finding.id, { status: 'resolved' })
      patchFindingLocal(finding.docId, finding.id, { status: 'resolved' })
      // No comment field on the findings endpoint — kept locally (same store
      // as Screen 2).
      const next = { ...rejectComments, [finding.id]: comment }
      setRejectComments(next)
      lsWrite(finding.docId, 'reject-comments', { ...lsRead(finding.docId, 'reject-comments'), [finding.id]: comment })
    } catch {
      setActionMessage('The finding could not be rejected. Please retry.')
    }
  }

  const reopenFinding = async finding => {
    try {
      await svc.patchFinding(finding.id, { status: 'open' })
      patchFindingLocal(finding.docId, finding.id, { status: 'open' })
      setActionMessage(`Finding ${finding.displayId} reopened.`)
    } catch {
      setActionMessage('The finding could not be reopened. Please retry.')
    }
  }

  // No set-level export exists in the v2 backend; the set report reuses the
  // per-document workbook of the set's PFD. Without a PFD there is nothing
  // real to export, so the button is disabled with an honest note.
  const exportSetReport = async () => {
    if (!pfd) return
    setExporting(true)
    try {
      await svc.downloadExport(pfd.id, 'excel')
    } catch (err) {
      setActionMessage(err?.response?.data?.error || 'The set report export failed.')
    } finally {
      setExporting(false)
    }
  }

  // ── header ────────────────────────────────────────────────────────────
  const projectBase = `/engineering/process/pid-verification/projects/${projectId}`
  const pidCount = members.filter(m => m.type !== 'PFD').length
  const firstPid = members.find(m => m.type === 'P&ID')

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'Engineering' },
        { label: '1.1 Process' },
        { label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' },
        { label: project?.name ?? '…', to: projectBase },
        { label: currentSet?.name ?? '…' },
      ]}
      title="Drawing set check"
      pill={<Pill label={`${pfd ? 1 : 0} PFD + ${pidCount} P&ID${pidCount === 1 ? '' : 's'}`} tone="neutral" />}
      subtitle={currentSet
        ? `PFD ${pfd?.drawingNo ?? '—'}${coveredEquipment.length > 0 ? ` · covers ${coveredEquipment.slice(0, 6).join(', ')}${coveredEquipment.length > 6 ? ` +${coveredEquipment.length - 6} more` : ''}` : ''}`
        : null}
      actions={(
        <>
          <button
            type="button"
            className="rd-btn rd-btn-secondary"
            onClick={() => firstPid && navigate(`${projectBase}/drawings/${firstPid.id}`)}
            disabled={!firstPid}
            title={firstPid ? 'Open the set’s first P&ID in the single-drawing view' : 'No P&ID in this set yet'}
          >
            Single-drawing view
          </button>
          <button
            type="button"
            className="rd-btn rd-btn-secondary"
            onClick={() => navigate(projectBase)}
            title="Drawings are added from the project workspace drop zone"
          >
            Add drawings to set
          </button>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            onClick={exportSetReport}
            disabled={!pfd || exporting}
            title={pfd ? 'Exports the workbook of the set’s PFD document' : 'Set workbook available after the backend adds a set export'}
          >
            {exporting ? 'Exporting…' : 'Export set report (.xlsx)'}
          </button>
        </>
      )}
    />
  )

  if (error && !drawings) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }

  if (drawings && !currentSet) {
    return (
      <div className="pc-page">
        {header}
        <div className="pc-card">
          <EmptyState title="This drawing set could not be found.">
            Sets are derived from the project drawings. Open a set from the project workspace.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className="pc-page">
      {header}

      {actionMessage && (
        <p className="pc-note pc-note-warning" role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <span>{actionMessage}</span>
          <button type="button" className="pc-icon-btn" style={{ minWidth: 30, minHeight: 30 }} aria-label="Dismiss message" onClick={() => setActionMessage(null)}>×</button>
        </p>
      )}

      {/* Set selector — hidden when the project has a single set (spec §4). */}
      {sets.length > 1 && (
        <section className="pc-section" aria-label="Drawing sets">
          <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <h2 className="pc-card-title">Drawing sets</h2>
            <div className="pc-chips" role="group" aria-label="Choose drawing set">
              {sets.map(s => {
                const setPfd = s.members.find(m => m.type === 'PFD')
                const openCount = s.members.reduce((n, m) => n + (m.findingsOpen ?? 0), 0)
                const active = currentSet && s.name === currentSet.name
                return (
                  <button
                    key={s.name}
                    type="button"
                    className={`pc-chip${active ? ' pc-chip-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => navigate(`${projectBase}/sets/${encodeURIComponent(s.name)}`)}
                  >
                    <span className="pc-mono">{setPfd?.drawingNo ?? '—'}</span>
                    {s.name}
                    <span className="pc-chip-count">{openCount} finding{openCount === 1 ? '' : 's'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <KpiRow
        members={members}
        pfd={pfd}
        pidCount={pidCount}
        cmpRows={cmpRows}
        cmpCounts={cmpCounts}
        instrumentFns={instrumentFns}
        conRows={conRows}
        conCounts={conCounts}
        openFindings={openFindings}
        errorCount={errorCount}
        queryCount={queryCount}
        minorCount={minorCount}
        readTotals={readTotals}
        goToTab={setTab}
      />

      {anyOcr && (
        <div className="pc-banner pc-banner-warning" role="status">
          <div>
            <p className="pc-banner-title">Some documents in this set were read by OCR</p>
            <p>
              {members.filter(m => m.readability === 'ocr' || m.readability === 'unreadable').map(m => m.drawingNo ?? m.title).join(', ')}
              {' '}— values from these sheets can be misread. Confirm flagged values against the drawing.
            </p>
          </div>
        </div>
      )}

      <DocumentsTable members={members} findings={findings} projectBase={projectBase} pfdId={pfd?.id} />

      <TabsBar tab={tab} onChange={setTab} counts={{ cmp: cmpRows.length, con: conRows.length, find: findings.length, ok: null }} />

      {tab === 'cmp' && (
        <TabCompare
          groups={cmpGroups}
          counts={cmpCounts}
          filter={searchParams.get('cfilter') || 'All'}
          onFilter={f => patchParams({ cfilter: f === 'All' ? null : f })}
          goToFinding={f => patchParams({ tab: 'find', finding: f.displayId })}
        />
      )}
      {tab === 'con' && <TabContinuity rows={conRows} counts={conCounts} missingDrawings={missingDrawings} />}
      {tab === 'find' && (
        <TabFindings
          members={members}
          findings={findings}
          resultsByDoc={resultsByDoc}
          searchParams={searchParams}
          patchParams={patchParams}
          onConfirm={confirmFinding}
          onReject={rejectFinding}
          rejectComments={rejectComments}
        />
      )}
      {tab === 'ok' && (
        <TabCheckedOk
          findings={findings}
          rejectComments={rejectComments}
          onReopen={reopenFinding}
        />
      )}
    </div>
  )
}

// ── KPI tiles ───────────────────────────────────────────────────────────

function KpiRow({ members, pfd, pidCount, cmpRows, cmpCounts, instrumentFns, conRows, conCounts, openFindings, errorCount, queryCount, minorCount, readTotals, goToTab }) {
  const hasCmp = cmpRows.length > 0
  const hasCon = conRows.length > 0
  return (
    <div className="pc-kpi-grid-6" aria-label="Set summary">
      <KpiTile
        label="Documents"
        value={members.length}
        meta={`${pfd ? 1 : 0} PFD · ${pidCount} P&ID${pidCount === 1 ? '' : 's'}`}
      />
      <KpiTile
        label="PFD vs P&ID values"
        value={hasCmp ? `${cmpCounts.agree} agree · ${cmpCounts.differ} differ` : '—'}
        meta={hasCmp ? `${cmpCounts.notChecked} not checked` : 'Available after comparison runs'}
        danger={cmpCounts.differ > 0}
        onClick={() => goToTab('cmp')}
      />
      <KpiTile
        label="Instrument functions"
        value={instrumentFns ? `${instrumentFns.found} found · ${instrumentFns.missing} missing` : '—'}
        meta={instrumentFns ? 'From instrument extraction detail' : 'Available after comparison runs'}
        danger={Boolean(instrumentFns?.missing)}
        onClick={() => goToTab('cmp')}
      />
      <KpiTile
        label="Connectors"
        value={hasCon ? `${conCounts.matched} matched · ${conCounts.conflict} conflict` : '—'}
        meta={hasCon ? `${conCounts.waiting} waiting for a drawing` : 'No off-page connectors read yet'}
        danger={conCounts.conflict > 0}
        onClick={() => goToTab('con')}
      />
      <KpiTile
        label="Findings open"
        value={openFindings.length}
        meta={`${errorCount} errors · ${queryCount} queries · ${minorCount} minor`}
        danger={openFindings.length > 0}
        onClick={() => goToTab('find')}
      />
      <KpiTile
        label="Read from drawings"
        value={readTotals.known ? `${readTotals.lines} lines · ${readTotals.tags} tags` : '—'}
        meta="Lines · instrument tags across the set"
      />
    </div>
  )
}

// ── documents table ─────────────────────────────────────────────────────

function DocumentsTable({ members, findings, projectBase, pfdId }) {
  return (
    <section className="pc-section" aria-label="Documents in this set">
      <h2 className="pc-section-title">Documents in this set</h2>
      <div className="pc-card pc-table-wrap">
        {members.length === 0 ? (
          <EmptyState title="No documents in this set yet.">Add drawings from the project workspace.</EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr>
                <th>Type</th><th>Number</th><th>Title</th><th>Rev. / date</th><th>How it was read</th>
                <th>Counts</th><th>Findings</th><th>Open on drawing</th>
              </tr>
            </thead>
            <tbody>
              {members.map(d => {
                const docFindings = findings.filter(f => String(f.docId) === String(d.id))
                const openCount = docFindings.filter(isOpen).length
                const isPfd = d.type === 'PFD' && String(d.id) === String(pfdId)
                const readNote = d.charactersRead != null ? `${d.charactersRead} characters read` : 'Read detail not stored'
                return (
                  <tr key={d.id}>
                    <td><Pill label={d.type ?? '—'} tone={d.type === 'PFD' ? 'info' : 'neutral'} /></td>
                    <td className="pc-mono">{d.drawingNo ?? '—'}</td>
                    <td>{d.title}</td>
                    <td className="pc-mono">
                      {d.rev ?? '—'}
                      {d.raw?.revision_date || d.raw?.date ? ` · ${d.raw.revision_date ?? d.raw.date}` : ''}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.125rem' }}>
                        <ReadabilityPill readability={d.readability} />
                        <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>{readNote}</span>
                      </span>
                    </td>
                    <td className="pc-mono">
                      {d.lineNumbers ?? '—'} lines · {d.tags ?? '—'} tags
                    </td>
                    <td><Pill label={`${openCount} open`} tone={openCount > 0 ? 'warning' : 'success'} title={`${docFindings.length} raised on this document`} /></td>
                    <td>
                      {isPfd ? (
                        <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>This page (PFD)</span>
                      ) : (
                        <Link className="rd-btn rd-btn-ghost rd-btn-sm" to={`${projectBase}/drawings/${d.id}`}>
                          Open on drawing
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// ── tabs bar (arrow-key navigable, spec §5) ─────────────────────────────

function TabsBar({ tab, onChange, counts }) {
  const listRef = useRef(null)
  const onKeyDown = (event, index) => {
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    if (next !== null) {
      event.preventDefault()
      listRef.current?.querySelectorAll('.pc-tab')?.[next]?.focus()
      onChange(TABS[next].id)
    }
  }
  return (
    <div className="pc-tabs" role="tablist" ref={listRef} aria-label="Drawing set views">
      {TABS.map((t, i) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === tab}
          className={`pc-tab${t.id === tab ? ' pc-tab-active' : ''}`}
          onClick={() => onChange(t.id)}
          onKeyDown={e => onKeyDown(e, i)}
        >
          {t.label}
          {counts[t.id] != null && <span className="pc-tab-count">{counts[t.id]}</span>}
        </button>
      ))}
    </div>
  )
}

// ── tab 1: PFD vs P&ID ──────────────────────────────────────────────────

const CMP_FILTERS = ['All', 'Differences', 'Agrees', 'Not checked']

function TabCompare({ groups, counts, filter, onFilter, goToFinding }) {
  const matchFilter = row => {
    if (filter === 'Differences') return /differ|conflict|not ok/i.test(String(row.result ?? ''))
    if (filter === 'Agrees') return /agree|match|ok/i.test(String(row.result ?? '')) && !/not ok/i.test(String(row.result ?? ''))
    if (filter === 'Not checked') return !row.result || /not checked|waiting|unknown/i.test(String(row.result))
    return true
  }
  const chipCounts = {
    All: counts.agree + counts.differ + counts.notChecked,
    Differences: counts.differ,
    Agrees: counts.agree,
    'Not checked': counts.notChecked,
  }
  return (
    <section className="pc-section" aria-label="PFD vs P&ID comparison">
      <div className="pc-chips" role="group" aria-label="Filter comparison rows">
        {CMP_FILTERS.map(name => (
          <button
            key={name}
            type="button"
            className={`pc-chip${filter === name ? ' pc-chip-active' : ''}`}
            aria-pressed={filter === name}
            onClick={() => onFilter(name)}
          >
            {name}<span className="pc-chip-count">{chipCounts[name]}</span>
          </button>
        ))}
      </div>

      {!groups || groups.length === 0 ? (
        <div className="pc-card">
          <EmptyState title="No PFD vs P&ID comparison has run for this set yet.">
            Available after comparison runs — the backend has not returned comparison
            data or comparison findings for these documents.
          </EmptyState>
        </div>
      ) : (
        groups.map(group => {
          const rows = group.rows.filter(matchFilter)
          if (rows.length === 0) return null
          return (
            <div key={group.item} className="pc-card pc-table-wrap" style={{ marginBottom: '0.75rem' }}>
              <div className="pc-card-header">
                <h3 className="pc-card-title">{group.item}</h3>
                {group.coveringPid && <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>Covered by P&ID <span className="pc-mono">{group.coveringPid}</span></span>}
              </div>
              <table className="pc-table">
                <thead>
                  <tr><th>Item</th><th>PFD (OCR)</th><th>P&amp;ID</th><th>Result</th><th>Finding</th></tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.key}>
                      <td>{row.item ?? '—'}</td>
                      <td className="pc-mono">{row.pfdValue ?? '—'}{row.pfdOcr ? ' ' : ''}{row.pfdOcr && <Pill label="OCR" tone="warning" />}</td>
                      <td className="pc-mono">{row.pidValue ?? '—'}</td>
                      <td><Pill label={row.result ?? 'Not checked'} /></td>
                      <td>
                        {row.finding ? (
                          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => goToFinding(row.finding)}>
                            Finding {row.finding.displayId}
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </section>
  )
}

// ── tab 2: continuity ───────────────────────────────────────────────────

function TabContinuity({ rows, counts, missingDrawings }) {
  return (
    <section className="pc-section" aria-label="Continuity">
      {missingDrawings.length > 0 && (
        <p className="pc-note pc-note-warning" role="status" style={{ margin: 0 }}>
          {missingDrawings.length} drawing{missingDrawings.length === 1 ? '' : 's'} referenced but not in this set:{' '}
          <span className="pc-mono">{missingDrawings.join(', ')}</span> — add them from the project workspace to complete the continuity check.
        </p>
      )}
      <div className="pc-card pc-table-wrap">
        {rows.length === 0 ? (
          <EmptyState title="No off-page connectors have been read on these drawings yet.">
            Continuity appears after the check run extracts continuation references
            (off-page connectors) from the set’s drawings.
          </EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th>From</th><th>Connector</th><th>Points to</th><th>Other end</th><th>Line / signal</th><th>Result</th></tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <td className="pc-mono">{row.from}</td>
                  <td className="pc-mono">{row.connector ?? '—'}</td>
                  <td className="pc-mono">{row.pointsTo ?? '—'}</td>
                  <td className="pc-mono">{row.otherEnd ?? '—'}</td>
                  <td className="pc-mono">{row.line ?? '—'}</td>
                  <td><Pill label={row.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > 0 && (
        <p className="pc-help">
          {counts.matched} matched both ends · {counts.conflict} conflict{counts.conflict === 1 ? '' : 's'} · {counts.waiting} waiting for a drawing.
        </p>
      )}
    </section>
  )
}

// ── tab 3: findings on drawings ─────────────────────────────────────────

const FIND_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'pair', label: 'PFD vs P&ID' },
  { id: 'pfd', label: 'On PFD' },
  { id: 'pid', label: 'On P&IDs' },
]

function TabFindings({ members, findings, resultsByDoc, searchParams, patchParams, onConfirm, onReject, rejectComments }) {
  const listRef = useRef(null)
  const detailRef = useRef(null)

  const drawingParam = searchParams.get('drawing')
  const selectedDoc = members.find(m => String(m.id) === String(drawingParam)) ?? members[0] ?? null
  const ffilter = searchParams.get('ffilter') || 'all'
  const findingParam = searchParams.get('finding')
  const zoom = ['fit', '200', '300'].includes(searchParams.get('zoom')) ? searchParams.get('zoom') : 'fit'

  const docFindings = useMemo(
    () => findings.filter(f => String(f.docId) === String(selectedDoc?.id)),
    [findings, selectedDoc],
  )

  // Pair findings appear on BOTH drawings (two markers, same number) — when
  // viewing any drawing, pair findings from the whole set are shown with
  // locations computed against that drawing's tag positions.
  const visibleFindings = useMemo(() => {
    if (!selectedDoc) return []
    const pairs = findings.filter(f => f.isPair && String(f.docId) !== String(selectedDoc.id))
    const res = resultsByDoc[selectedDoc.id]
    const tagPositions = (res?.drawings || []).reduce((acc, d) => Object.assign(acc, d.metadata?.tag_positions || {}), {})
    const pairsHere = pairs.map(f => ({ ...f, locations: locationsFor(f.raw, tagPositions) }))
    return [...docFindings, ...pairsHere]
  }, [selectedDoc, docFindings, findings, resultsByDoc])

  const filtered = useMemo(() => {
    if (ffilter === 'pair') return visibleFindings.filter(f => f.isPair)
    if (ffilter === 'pfd') return visibleFindings.filter(f => f.prefix === 'P')
    if (ffilter === 'pid') return visibleFindings.filter(f => f.prefix === 'D')
    return visibleFindings
  }, [visibleFindings, ffilter])

  const selected = useMemo(() => {
    if (findingParam) {
      const wanted = findingParam.toUpperCase()
      const hit = filtered.find(f => f.displayId.toUpperCase() === wanted) || visibleFindings.find(f => f.displayId.toUpperCase() === wanted)
      if (hit) return hit
    }
    return filtered[0] ?? null
  }, [filtered, visibleFindings, findingParam])

  const selectFinding = f => patchParams({ finding: f ? f.displayId : null })

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
      // Reject needs a comment: R moves focus to the detail card's
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

  const markers = visibleFindings.map(f => ({ id: f.id, number: f.number, displayId: f.displayId, status: markerStatus(f), locations: f.locations }))

  const chipCounts = {
    all: visibleFindings.length,
    pair: visibleFindings.filter(f => f.isPair).length,
    pfd: visibleFindings.filter(f => f.prefix === 'P').length,
    pid: visibleFindings.filter(f => f.prefix === 'D').length,
  }

  // "Show on PFD / Show on P&ID": switch the selected drawing chip.
  const showOn = kind => {
    const target = kind === 'pfd'
      ? members.find(m => m.type === 'PFD')
      : members.find(m => m.type === 'P&ID' && (selected?.isPair || String(m.id) === String(selected?.docId))) ?? members.find(m => m.type === 'P&ID')
    if (target) patchParams({ drawing: String(target.id) })
  }

  if (members.length === 0) {
    return (
      <div className="pc-card">
        <EmptyState title="No drawings in this set yet.">Add drawings from the project workspace.</EmptyState>
      </div>
    )
  }

  return (
    <section className="pc-section" aria-label="Findings on drawings">
      <div className="pc-chips" role="group" aria-label="Choose drawing">
        {members.map(m => {
          const count = findings.filter(f => String(f.docId) === String(m.id)).length + findings.filter(f => f.isPair && String(f.docId) !== String(m.id)).length
          const active = String(m.id) === String(selectedDoc?.id)
          return (
            <button
              key={m.id}
              type="button"
              className={`pc-chip${active ? ' pc-chip-active' : ''}`}
              aria-pressed={active}
              onClick={() => patchParams({ drawing: String(m.id), finding: null })}
            >
              <span className="pc-mono">{m.drawingNo ?? m.title}</span>
              <span className="pc-chip-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="pc-split">
        <DrawingViewer
          imageUrl={selectedDoc ? svc.drawingImageUrl(selectedDoc.id, selected?.pageIndex ?? 0) : null}
          findings={markers}
          selectedId={selected?.id ?? null}
          onSelect={id => selectFinding(visibleFindings.find(f => f.id === id))}
          zoom={zoom}
          onZoomChange={z => patchParams({ zoom: z === 'fit' ? null : z })}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <div className="pc-card">
            <div className="pc-card-header">
              <h2 className="pc-card-title">Findings</h2>
              <div className="pc-chips" role="group" aria-label="Filter findings">
                {FIND_CHIPS.map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`pc-chip${ffilter === chip.id ? ' pc-chip-active' : ''}`}
                    style={{ minHeight: 30 }}
                    aria-pressed={ffilter === chip.id}
                    onClick={() => patchParams({ ffilter: chip.id === 'all' ? null : chip.id, finding: null })}
                  >
                    {chip.label}<span className="pc-chip-count">{chipCounts[chip.id]}</span>
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <EmptyState title={visibleFindings.length === 0 ? 'No findings were raised on this drawing.' : 'No findings match this filter.'}>
                {visibleFindings.length === 0 ? 'Findings appear here after the check run finishes.' : 'Change the filter to see the other findings.'}
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
                    key={`${f.prefix}-${f.id}`}
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
                isPair={selected.isPair}
                onConfirm={() => onConfirm(selected)}
                onReject={comment => onReject(selected, comment)}
                onNext={filtered.length > 1 ? nextFinding : null}
                onShowDrawing={selected.isPair ? showOn : null}
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

// ── tab 4: checked, not flagged ─────────────────────────────────────────

function TabCheckedOk({ findings, rejectComments, onReopen }) {
  // Real rows: findings that were reviewed and rejected (resolved) or raised
  // as minor. Everything else has no backend representation — honest empty
  // state rather than invented "looks OK" rows.
  const rows = findings.filter(f => isRejected(f) || String(f.severity).toLowerCase() === 'minor')
  return (
    <section className="pc-section" aria-label="Checked, not flagged">
      <div className="pc-card pc-table-wrap">
        {rows.length === 0 ? (
          <EmptyState title="Nothing has been checked and deliberately not flagged yet.">
            Items appear here when a finding is rejected as “not an error” or a
            check is confirmed as OK. Available after the check run and review.
          </EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th>Looks like</th><th>Why it is not an error</th><th>Rule applied</th><th>Reopen as finding</th></tr>
            </thead>
            <tbody>
              {rows.map(f => (
                <tr key={`${f.prefix}-${f.id}`}>
                  <td>
                    <span className="pc-flist-num" style={{ minWidth: 'auto', marginRight: '0.375rem' }}>{f.displayId}</span>
                    {f.title}
                  </td>
                  <td>{rejectComments[f.id] ?? f.basis ?? '—'}</td>
                  <td className="pc-mono">{f.ruleId ?? '—'}</td>
                  <td>
                    {f.id != null ? (
                      <button
                        type="button"
                        className="rd-btn rd-btn-secondary rd-btn-sm"
                        onClick={() => onReopen(f)}
                        disabled={isOpen(f)}
                        title={isOpen(f) ? 'This finding is already open' : 'Reopen as a finding'}
                      >
                        {isOpen(f) ? 'Already open' : 'Reopen as finding'}
                      </button>
                    ) : (
                      <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" disabled title="Reopen is available once this row maps to a real finding">
                        Reopen as finding
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
