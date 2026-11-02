/**
 * All P&IDs — combined project review (spec B3).
 *
 * Data: GET projects/<id>/review/ (cached per project run server-side).
 * Sections: how the uploads were combined · 6 KPI tiles · connectivity map
 * (d3-force layout, d3-zoom pan/zoom) + inspector · findings by P&ID ·
 * cross-drawing findings · the four cross-drawing rule cards.
 *
 * RADAI rules: no gradients, no emoji, one primary per region, ≥ 11 px
 * text, no horizontal scroll, every icon button labelled.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
import * as svc from './pidChecker.service'
import { PageHeader, KpiTile, Pill, EmptyState } from './shared'
import ScopeSwitch from './shared/ScopeSwitch'
import './pidchecker.css'

// Unit colour = first two digits of the drawing number (solid token-safe palette).
const UNIT_COLORS = ['#3730a3', '#0284c7', '#059669', '#b45309', '#be185d', '#7c3aed', '#0f766e', '#a16207', '#4d7c0f', '#0369a1']
const unitOf = no => (String(no || '').slice(0, 2) || '—')
const unitColor = (unit, units) => UNIT_COLORS[units.indexOf(unit) % UNIT_COLORS.length]

export default function ProjectReviewPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [review, setReview] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null) // 'cross' | 'report'

  const load = useCallback(async () => {
    setError(null)
    try {
      const [proj, rev] = await Promise.all([svc.getProject(projectId), svc.getProjectReview(projectId)])
      setProject(proj)
      setReview(rev)
    } catch (err) {
      setError(err?.response?.data?.error || 'The project review could not be loaded.')
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const rerunCross = async () => {
    setBusy('cross')
    try {
      await svc.runCrossCheck(projectId)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || 'The cross checks could not be re-run.')
    } finally {
      setBusy(null)
    }
  }

  const exportReport = async () => {
    setBusy('report')
    try {
      await svc.downloadProjectReport(projectId)
    } catch {
      setError('The report export failed.')
    } finally {
      setBusy(null)
    }
  }

  // ── derived ───────────────────────────────────────────────────────────
  const sheets = useMemo(() => (review?.sheets || []).filter(s => !s.superseded), [review])
  const superseded = useMemo(() => (review?.sheets || []).filter(s => s.superseded), [review])
  const bySheetId = useMemo(() => {
    const m = {}
    for (const s of sheets) m[s.sheet_id] = s
    return m
  }, [sheets])
  const stats = review?.stats || {}
  const cross = review?.cross || []
  const links = review?.links || []
  const externalRefs = review?.external_refs || []
  const toConfirm = sheets.filter(s => !s.drawing_no_confirmed)
  const lineCross = cross.filter(c => c.code === 'XLINE-001')
  const connCross = cross.filter(c => c.code === 'XCON-001')

  const [selectedId, setSelectedId] = useState(null)
  const [highlightIds, setHighlightIds] = useState(null) // cross-finding focus
  const selected = selectedId != null ? bySheetId[selectedId] ?? null : null

  const sectionRefs = {
    map: useRef(null),
    bySheet: useRef(null),
    cross: useRef(null),
    rules: useRef(null),
  }
  const scrollTo = key => sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const header = (
    <PageHeader
      breadcrumb={[
        { label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' },
        { label: project?.name ?? '…', to: `/engineering/process/pid-verification/projects/${projectId}` },
        { label: 'All P&IDs' },
      ]}
      title="All P&IDs"
      subtitle={project ? `${project.name} · combined review across every sheet` : null}
      actions={(
        <>
          <ScopeSwitch projectId={projectId} sheetCount={sheets.length || null} active="all" />
          <button type="button" className="rd-btn rd-btn-secondary" onClick={rerunCross} disabled={busy === 'cross'}>
            {busy === 'cross' ? 'Re-running…' : 'Re-run cross checks'}
          </button>
          <button type="button" className="rd-btn rd-btn-primary" onClick={exportReport} disabled={busy === 'report'}>
            {busy === 'report' ? 'Preparing…' : 'Export project report (.xlsx)'}
          </button>
        </>
      )}
    />
  )

  if (error && !review) {
    return <div className="pc-page">{header}<p className="pc-error" role="alert">{error}</p></div>
  }
  if (!review) {
    return (
      <div className="pc-page">
        {header}
        <div className="pc-card pc-card-pad" style={{ marginBottom: '1rem' }}><div className="pc-skeleton" style={{ height: 96 }} /></div>
        <div className="pc-card pc-card-pad"><div className="pc-skeleton" style={{ height: 320 }} /></div>
      </div>
    )
  }

  const files = {}
  for (const s of review.sheets || []) {
    files[s.file_name] = (files[s.file_name] || 0) + 1
  }

  return (
    <div className="pc-page">
      {header}
      {error && <p className="pc-error" role="alert">{error}</p>}

      {/* 1 ── How the uploads were combined ─────────────────────────── */}
      <section className="pc-section" aria-label="How the uploads were combined">
        <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Pill label={`${Object.keys(files).length} file${Object.keys(files).length === 1 ? '' : 's'} → ${sheets.length} P&IDs`} tone="info" />
            <button
              type="button"
              className="rd-btn rd-btn-secondary rd-btn-sm"
              onClick={() => navigate(`/engineering/process/pid-verification/projects/${projectId}`)}
            >
              Add drawings
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div>
              <p className="pc-kpi-label">Files</p>
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {Object.entries(files).map(([name, n]) => (
                  <li key={name} style={{ fontSize: 'var(--rd-text-table)' }}>
                    <span className="pc-mono">{name}</span> · {n} sheet{n === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="pc-kpi-label">Drawing numbers read</p>
              <p style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
                {sheets.length - toConfirm.length} of {sheets.length}
                {toConfirm.length > 0 && (
                  <>
                    {' — to confirm: '}
                    {toConfirm.map(s => s.drawing_no || `p.${s.page_index + 1}`).join(', ')}
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="pc-kpi-label">Duplicates and superseded</p>
              <p style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
                {superseded.length === 0
                  ? 'None'
                  : superseded.map(s => `${s.drawing_no} → Rev ${s.superseded_by_rev ?? '?'}`).join(', ')}
              </p>
            </div>
            <div>
              <p className="pc-kpi-label">Cross-drawing checks</p>
              <p style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>
                Run on all {sheets.length} P&amp;IDs together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2 ── KPI tiles ─────────────────────────────────────────────── */}
      <div className="pc-kpi-grid-6" aria-label="Project summary">
        <KpiTile label="P&IDs" value={sheets.length} meta={`${Object.keys(files).length} file${Object.keys(files).length === 1 ? '' : 's'}`} onClick={() => scrollTo('map')} />
        <KpiTile label="Findings on sheets" value={stats.sheet_findings ?? '—'} meta="Per-sheet checks" onClick={() => scrollTo('bySheet')} />
        <KpiTile label="Cross-drawing findings" value={cross.length} meta={`${lineCross.length} line · ${connCross.length} connector`} danger={lineCross.length > 0} onClick={() => scrollTo('cross')} />
        <KpiTile label="Sheet-to-sheet links" value={links.length} meta={`${stats.links_both ?? 0} both ways · ${stats.links_one_way ?? 0} one way`} onClick={() => scrollTo('map')} />
        <KpiTile label="Lines on several sheets" value={stats.lines_multi ?? '—'} meta={`${stats.lines_conflict ?? 0} with different data`} danger={(stats.lines_conflict ?? 0) > 0} onClick={() => scrollTo('cross')} />
        <KpiTile label="Drawings not uploaded" value={externalRefs.length} meta="Listed for engineer" onClick={() => scrollTo('rules')} />
      </div>

      {/* 3 ── Connectivity map + inspector ──────────────────────────── */}
      <section className="pc-section" aria-label="Connectivity map" ref={sectionRefs.map}>
        <h2 className="pc-section-title">Connectivity map</h2>
        <div className="pc-split" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
          <ConnectivityMap
            sheets={sheets}
            links={links}
            selectedId={selectedId}
            onSelect={id => { setSelectedId(id); setHighlightIds(null) }}
            highlightIds={highlightIds}
          />
          <InspectorCard
            sheet={selected}
            links={links}
            cross={cross}
            bySheetId={bySheetId}
            onJump={id => { setSelectedId(id); setHighlightIds(null) }}
            onOpen={s => navigate(`/engineering/process/pid-verification/projects/${projectId}/drawings/${s.document_id}?sheet=${s.page_index + 1}&step=5`)}
          />
        </div>
      </section>

      {/* 4 ── Findings by P&ID ──────────────────────────────────────── */}
      <section className="pc-section" aria-label="Findings by P&ID" ref={sectionRefs.bySheet}>
        <FindingsBySheet
          sheets={sheets}
          selectedId={selectedId}
          onSelect={id => { setSelectedId(id); setHighlightIds(null); scrollTo('map') }}
        />
      </section>

      {/* 5 ── Cross-drawing findings ────────────────────────────────── */}
      <section className="pc-section" aria-label="Cross-drawing findings" ref={sectionRefs.cross}>
        <CrossFindingsList
          cross={cross}
          bySheetId={bySheetId}
          onFocus={ids => { setHighlightIds(ids); scrollTo('map') }}
          onShow={sheetsToOpen => sheetsToOpen.forEach(s => {
            const ring = s.bbox ? `&ring=${s.bbox.join(',')}` : ''
            navigate(`/engineering/process/pid-verification/projects/${projectId}/drawings/${s.document_id}?sheet=${s.page_index + 1}&step=4${ring}`)
          })}
        />
      </section>

      {/* 5b ── Checklist (all P&IDs, worst-of) ──────────────────────── */}
      <section className="pc-section" aria-label="Checklist across P&IDs">
        <ProjectChecklistSection projectId={projectId} onOpenSheet={(s) => navigate(`/engineering/process/pid-verification/projects/${projectId}/drawings/${s.document_id}?sheet=${s.page_index + 1}&step=4`)} />
      </section>

      {/* 6 ── Cross-drawing rules ───────────────────────────────────── */}
      <section className="pc-section" aria-label="Cross-drawing rules" ref={sectionRefs.rules}>
        <h2 className="pc-section-title">Cross-drawing rules</h2>
        <div className="pc-card-grid">
          <RuleCard
            code="XCON-001"
            title="Connectors must return"
            text="A connector to another uploaded sheet must have a connector back, with the same number, the same service and the opposite direction."
            count={connCross.length}
          />
          <RuleCard
            code="XLINE-001"
            title="Same line number, same data"
            text="A line number on several sheets keeps the same size, class and insulation — unless a spec break or reducer is shown at the boundary."
            count={lineCross.length}
          />
          <RuleCard
            code="Duplicates"
            title="One current revision per drawing"
            text="Uploading a newer revision supersedes the old sheet and carries its finding dispositions over. The same revision twice is a conflict."
            count={superseded.length}
          />
          <RuleCard
            code="Not uploaded"
            title="References to missing drawings"
            text="Connectors pointing at drawings that were never uploaded are listed for the engineer (checklist 1.11) — they never become findings."
            count={externalRefs.length}
          />
        </div>
      </section>
    </div>
  )
}

// ── connectivity map (d3-force layout + d3-zoom) ────────────────────────

function ConnectivityMap({ sheets, links, selectedId, onSelect, highlightIds }) {
  const svgRef = useRef(null)
  const zoomRef = useRef(null)
  const [showLabels, setShowLabels] = useState(true)
  const [unitFilter, setUnitFilter] = useState('All')

  const units = useMemo(() => [...new Set(sheets.map(s => unitOf(s.drawing_no)))].sort(), [sheets])

  // Deterministic layout: fixed grid start, 400 synchronous ticks.
  const layout = useMemo(() => {
    if (!sheets.length) return { nodes: [], edges: [], width: 800, height: 480 }
    const cols = Math.ceil(Math.sqrt(sheets.length))
    const nodes = sheets.map((s, i) => ({
      id: s.sheet_id, sheet: s,
      x: (i % cols) * 90 + 60, y: Math.floor(i / cols) * 80 + 60,
    }))
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    const edges = links
      .filter(l => byId[l.a.sheet_id] && byId[l.b.sheet_id])
      .map(l => ({ a: byId[l.a.sheet_id], b: byId[l.b.sheet_id], both: l.both }))
    const sim = forceSimulation(nodes)
      .force('link', forceLink(edges.map(e => ({ source: e.a.id, target: e.b.id }))).id(d => d.id).distance(90))
      .force('charge', forceManyBody().strength(-60))
      .force('collide', forceCollide().radius(d => 5 + Math.sqrt(d.sheet.findings || 0) * 1.6 + 14))
      .force('center', forceCenter(400, 240))
      .stop()
    for (let i = 0; i < 400; i++) sim.tick()
    const xs = nodes.map(n => n.x); const ys = nodes.map(n => n.y)
    const pad = 60
    const minX = Math.min(...xs) - pad; const minY = Math.min(...ys) - pad
    const w = Math.max(...xs) - minX + pad; const h = Math.max(...ys) - minY + pad
    nodes.forEach(n => { n.x -= minX; n.y -= minY })
    return { nodes, edges, width: w, height: h }
  }, [sheets, links])

  // pan / zoom
  useEffect(() => {
    if (!svgRef.current) return undefined
    const svg = select(svgRef.current)
    const g = svg.select('g.pan-layer')
    const z = d3zoom().scaleExtent([0.2, 4]).on('zoom', e => g.attr('transform', e.transform))
    zoomRef.current = z
    svg.call(z)
    return () => svg.on('.zoom', null)
  }, [layout])

  const fit = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    const svg = select(svgRef.current)
    const box = svgRef.current.getBoundingClientRect()
    const k = Math.min(box.width / layout.width, box.height / layout.height, 1.2) * 0.95
    const t = zoomIdentity
      .translate((box.width - layout.width * k) / 2, (box.height - layout.height * k) / 2)
      .scale(k)
    svg.transition().duration(400).call(zoomRef.current.transform, t)
  }, [layout])

  // Fit on first render and when the highlight set changes (fit to those).
  const didFit = useRef(false)
  useEffect(() => {
    if (!didFit.current && layout.nodes.length) { didFit.current = true; fit() }
    if (highlightIds?.length && svgRef.current && zoomRef.current) {
      const nodes = layout.nodes.filter(n => highlightIds.includes(n.id))
      if (!nodes.length) return
      const minX = Math.min(...nodes.map(n => n.x)); const maxX = Math.max(...nodes.map(n => n.x))
      const minY = Math.min(...nodes.map(n => n.y)); const maxY = Math.max(...nodes.map(n => n.y))
      const box = svgRef.current.getBoundingClientRect()
      const k = Math.min(box.width / Math.max(maxX - minX, 80), box.height / Math.max(maxY - minY, 80), 2) * 0.8
      const t = zoomIdentity
        .translate(box.width / 2 - ((minX + maxX) / 2) * k, box.height / 2 - ((minY + maxY) / 2) * k)
        .scale(k)
      select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, t)
    }
  }, [layout, highlightIds, fit])

  const faded = id => unitFilter !== 'All' && unitOf(bySheet(layout, id)?.drawing_no) !== unitFilter
  const hl = id => !highlightIds || highlightIds.includes(id)

  return (
    <div className="pc-card" style={{ minWidth: 0 }}>
      <div className="pc-card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="pc-chips" role="group" aria-label="Filter by unit">
          {['All', ...units].map(u => (
            <button
              key={u}
              type="button"
              className={`pc-chip${unitFilter === u ? ' pc-chip-active' : ''}`}
              style={{ minHeight: 30 }}
              aria-pressed={unitFilter === u}
              onClick={() => setUnitFilter(u)}
            >
              {u === 'All' ? 'All' : `Unit ${u}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', marginLeft: 'auto' }}>
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={fit}>Fit</button>
          <button
            type="button"
            className={`rd-btn rd-btn-sm ${showLabels ? 'rd-btn-secondary' : 'rd-btn-ghost'}`}
            aria-pressed={showLabels}
            onClick={() => setShowLabels(v => !v)}
          >
            Labels
          </button>
        </div>
      </div>
      {layout.nodes.length === 0 ? (
        <EmptyState title="No P&IDs to map yet.">The map appears once the first sheet has been read.</EmptyState>
      ) : (
        <>
          <svg
            ref={svgRef}
            role="img"
            aria-label="Connectivity map of the project's P&IDs"
            style={{ width: '100%', height: 480, display: 'block', background: 'var(--rd-surface-subtle)', touchAction: 'none' }}
          >
            <g className="pan-layer">
              {layout.edges.map((e, i) => {
                const involved = selectedId != null && (e.a.id === selectedId || e.b.id === selectedId)
                const dim = (selectedId != null && !involved) || !hl(e.a.id) || !hl(e.b.id)
                return (
                  <line
                    key={i}
                    x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                    stroke={e.both ? '#94a3b8' : '#d97706'}
                    strokeWidth={involved ? 2.4 : 1.4}
                    strokeDasharray={e.both ? undefined : '5 4'}
                    opacity={dim ? 0.15 : 0.9}
                  />
                )
              })}
              {layout.nodes.map(n => {
                const r = 5 + Math.sqrt(n.sheet.findings || 0) * 1.6
                const isSel = n.id === selectedId
                const dim = faded(n.id) || !hl(n.id)
                return (
                  <g key={n.id} opacity={dim ? 0.25 : 1}>
                    {n.sheet.cross > 0 && (
                      <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke="#dc2626" strokeWidth={2} />
                    )}
                    <circle
                      cx={n.x} cy={n.y} r={r}
                      fill={unitColor(unitOf(n.sheet.drawing_no), units)}
                      stroke={isSel ? '#0A5EF5' : '#fff'}
                      strokeWidth={isSel ? 3 : 1.5}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelect(n.id)}
                    >
                      <title>{`${n.sheet.drawing_no ?? '—'} — ${n.sheet.findings ?? 0} findings`}</title>
                    </circle>
                    {showLabels && (
                      <text
                        x={n.x} y={n.y + r + 12}
                        textAnchor="middle"
                        style={{ fontSize: 11, fill: 'var(--rd-text-muted)', pointerEvents: 'none', fontFamily: 'var(--rd-font-mono, monospace)' }}
                      >
                        {n.sheet.drawing_no ?? `p.${n.sheet.page_index + 1}`}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--rd-border-soft)', fontSize: 'var(--rd-text-caption)' }}>
            <span><span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px solid #94a3b8', verticalAlign: 'middle', marginRight: 6 }} />Linked both ways</span>
            <span><span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed #d97706', verticalAlign: 'middle', marginRight: 6 }} />One way</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #dc2626', borderRadius: '50%', verticalAlign: 'middle', marginRight: 6 }} />Cross-drawing findings</span>
            <span className="pc-faint">Drag to pan · wheel to zoom · size = findings</span>
          </div>
        </>
      )}
    </div>
  )
}

function bySheet(layout, id) {
  const n = layout.nodes.find(x => x.id === id)
  return n ? n.sheet : null
}

// ── inspector card ──────────────────────────────────────────────────────

function InspectorCard({ sheet, links, cross, bySheetId, onJump, onOpen }) {
  if (!sheet) {
    return (
      <div className="pc-card pc-card-pad" style={{ minWidth: 0 }}>
        <EmptyState title="Select a P&ID on the map.">Its links and findings show here.</EmptyState>
      </div>
    )
  }
  const myLinks = links
    .filter(l => l.a.sheet_id === sheet.sheet_id || l.b.sheet_id === sheet.sheet_id)
    .map(l => {
      const other = l.a.sheet_id === sheet.sheet_id ? l.b : l.a
      return { ...other, both: l.both }
    })
  const myCross = cross.filter(c => (c.sheets || []).includes(sheet.sheet_id))
  return (
    <div className="pc-card pc-card-pad" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div>
        <h3 className="pc-card-title pc-mono" style={{ margin: 0 }}>{sheet.drawing_no ?? '—'}</h3>
        <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>{sheet.title ?? '—'}</p>
      </div>
      <dl className="pc-kv">
        <dt>Source</dt>
        <dd>{sheet.file_name} · page {sheet.page_index + 1} of {sheet.page_count}</dd>
        <dt>Findings</dt>
        <dd>{sheet.findings ?? 0} on sheet · {sheet.cross ?? 0} cross-drawing</dd>
        <dt>Revision</dt>
        <dd>{sheet.rev ?? '—'}</dd>
      </dl>
      {myLinks.length > 0 && (
        <div>
          <p className="pc-kpi-label">Linked P&IDs</p>
          <div className="pc-chips">
            {myLinks.map(l => (
              <button
                key={l.sheet_id}
                type="button"
                className="pc-chip"
                style={l.both ? { minHeight: 30 } : { minHeight: 30, borderColor: '#d97706', color: '#b45309' }}
                title={l.both ? 'Linked both ways' : 'One way'}
                onClick={() => onJump(l.sheet_id)}
              >
                {l.drawing_no}
              </button>
            ))}
          </div>
        </div>
      )}
      {myCross.length > 0 && (
        <div>
          <p className="pc-kpi-label">Cross-drawing findings</p>
          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
            {myCross.map(c => (
              <li key={c.id} style={{ fontSize: 'var(--rd-text-table)' }}>
                X{c.number} · {c.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => onOpen(sheet)}>
          Open P&amp;ID
        </button>
      </div>
    </div>
  )
}

// ── findings by P&ID ────────────────────────────────────────────────────

function FindingsBySheet({ sheets, selectedId, onSelect }) {
  const [chip, setChip] = useState('All')
  const rows = useMemo(() => {
    const list = chip === 'With cross' ? sheets.filter(s => (s.cross ?? 0) > 0) : sheets
    return [...list].sort((a, b) => (b.findings ?? 0) - (a.findings ?? 0))
  }, [sheets, chip])
  const maxFindings = Math.max(1, ...sheets.map(s => s.findings ?? 0))
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className="pc-section-title" style={{ margin: 0 }}>Findings by P&amp;ID</h2>
        <div className="pc-chips" role="group" aria-label="Filter sheets">
          {[['All', sheets.length], ['With cross', sheets.filter(s => (s.cross ?? 0) > 0).length]].map(([name, count]) => (
            <button key={name} type="button" className={`pc-chip${chip === name ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={chip === name} onClick={() => setChip(name)}>
              {name === 'With cross' ? 'With cross-drawing findings' : name}<span className="pc-chip-count">{count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="pc-card pc-table-wrap">
        {rows.length === 0 ? (
          <EmptyState title="No P&IDs match this filter.">Change the filter to see the other sheets.</EmptyState>
        ) : (
          <table className="pc-table">
            <thead>
              <tr><th>Drawing no.</th><th>Title</th><th>Cross</th><th style={{ minWidth: 140 }}>Findings</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr
                  key={s.sheet_id}
                  className={`pc-row-clickable${s.sheet_id === selectedId ? ' pc-flist-item-selected' : ''}`}
                  onClick={() => onSelect(s.sheet_id)}
                >
                  <td className="pc-mono">{s.drawing_no ?? '—'}</td>
                  <td>{s.title ?? '—'}</td>
                  <td>{(s.cross ?? 0) > 0 ? <Pill label={`${s.cross} X`} tone="warning" /> : '—'}</td>
                  <td>
                    <div className="pc-progress" role="img" aria-label={`${s.findings ?? 0} findings`}>
                      <span className={s.findings ? 'pc-progress-notok' : 'pc-progress-ok'} style={{ width: `${((s.findings ?? 0) / maxFindings) * 100}%` }} />
                    </div>
                  </td>
                  <td className="pc-mono">{s.findings ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── cross-drawing findings list ─────────────────────────────────────────

function CrossFindingsList({ cross, bySheetId, onFocus, onShow }) {
  const [chip, setChip] = useState('All')
  const rows = chip === 'Same line' ? cross.filter(c => c.code === 'XLINE-001')
    : chip === 'Connectors' ? cross.filter(c => c.code === 'XCON-001')
    : cross

  const lineNo = c => {
    const m = /([0-9]+["″]?(?:-[A-Z0-9]+)+)/.exec(c.detail || '')
    return m ? m[1] : null
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 className="pc-section-title" style={{ margin: 0 }}>Cross-drawing findings</h2>
        <div className="pc-chips" role="group" aria-label="Filter cross-drawing findings">
          {[['All', cross.length], ['Same line', cross.filter(c => c.code === 'XLINE-001').length], ['Connectors', cross.filter(c => c.code === 'XCON-001').length]].map(([name, count]) => (
            <button key={name} type="button" className={`pc-chip${chip === name ? ' pc-chip-active' : ''}`} style={{ minHeight: 30 }} aria-pressed={chip === name} onClick={() => setChip(name)}>
              {name}<span className="pc-chip-count">{count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="pc-card">
        {rows.length === 0 ? (
          <EmptyState title="No cross-drawing findings.">The sheets agree with each other.</EmptyState>
        ) : (
          rows.map(c => {
            const sheetObjs = (c.sheets || []).map(id => bySheetId[id]).filter(Boolean)
            return (
              <div
                key={c.id}
                className="pc-flist-item"
                style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                role="button"
                tabIndex={0}
                onClick={() => onFocus(c.sheets || [])}
                onKeyDown={e => { if (e.key === 'Enter') onFocus(c.sheets || []) }}
              >
                <Pill label={`X${c.number}`} tone={c.kind === 'error' ? 'danger' : c.kind === 'minor' ? 'neutral' : 'warning'} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block' }}>
                    {lineNo(c) && <span className="pc-mono" style={{ marginRight: '0.375rem' }}>{lineNo(c)}</span>}
                    {c.title}
                  </span>
                  <span className="pc-muted" style={{ display: 'block', fontSize: 'var(--rd-text-caption)' }}>{c.detail}</span>
                  <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
                    {sheetObjs.map(s => s.drawing_no).join(' ↔ ')}
                  </span>
                </span>
                <button
                  type="button"
                  className="rd-btn rd-btn-ghost rd-btn-sm"
                  onClick={e => {
                    e.stopPropagation()
                    const targets = (c.evidence || [])
                      .map(ev2 => {
                        const s = bySheetId[ev2.sheet_id]
                        return s ? { ...s, bbox: ev2.bbox } : null
                      })
                      .filter(Boolean)
                    if (targets.length) onShow(targets)
                  }}
                >
                  Show on drawing
                </button>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

// ── checklist across all P&IDs (worst-of per item, spec §3.4) ──────────

const PC_RESULT_TONES = { OK: 'success', 'Non-Conformance': 'danger', Query: 'warning', 'Not Verifiable': 'neutral' }

function ProjectChecklistSection({ projectId, onOpenSheet }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expandedNo, setExpandedNo] = useState(null)
  const [error, setError] = useState(null)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !data && !loading) {
      setLoading(true)
      try {
        setData(await svc.getProjectChecklist(projectId))
      } catch {
        setError('The combined checklist could not be loaded.')
      } finally {
        setLoading(false)
      }
    }
  }

  const download = async () => {
    setBusy(true)
    try {
      await svc.downloadProjectChecklistReport(projectId)
    } catch {
      setError('The checklist report could not be generated.')
    } finally {
      setBusy(false)
    }
  }

  const m = data?.summary?.matrix

  return (
    <div className="pc-card">
      <button
        type="button"
        className="pc-card-header"
        style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
        onClick={toggle}
        aria-expanded={open}
      >
        <h2 className="pc-card-title">Checklist — all P&amp;IDs</h2>
        <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>
          {m
            ? `${m['Non-Conformance']?.total ?? 0} Non-Conformance · ${m.Query?.total ?? 0} Query · worst result over all sheets`
            : 'AI-PID-02 · worst result over all sheets'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={download} disabled={busy}>
              {busy ? 'Preparing…' : 'Download checklist report (.xlsx, all P&IDs)'}
            </button>
          </div>
          {error && <p className="pc-error" role="alert">{error}</p>}
          {loading && <div className="pc-skeleton" style={{ height: 96 }} />}
          {data && (
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr><th>No.</th><th>Check point</th><th>Mode</th><th>Severity</th><th>Worst result</th><th /></tr>
                </thead>
                <tbody>
                  {data.items.map(it => (
                    <FragmentRow
                      key={it.no}
                      item={it}
                      expanded={expandedNo === it.no}
                      onToggle={() => setExpandedNo(expandedNo === it.no ? null : it.no)}
                      onOpenSheet={onOpenSheet}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FragmentRow({ item, expanded, onToggle, onOpenSheet }) {
  const result = item.applicability === 'Y' ? item.ai_result : null
  return (
    <>
      <tr className="pc-row-clickable" onClick={onToggle}>
        <td className="pc-mono">{item.no}</td>
        <td>{item.check_point}</td>
        <td><Pill label={item.mode} tone={item.mode === 'Engineer-Led' ? 'neutral' : 'info'} /></td>
        <td><Pill label={item.severity} tone={{ Critical: 'danger', Major: 'warning', Minor: 'neutral' }[item.severity] ?? 'neutral'} /></td>
        <td>{result ? <Pill label={result} tone={PC_RESULT_TONES[result] ?? 'neutral'} /> : <span className="pc-faint">—</span>}</td>
        <td className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>on {item.sheets.length} P&ID{item.sheets.length === 1 ? '' : 's'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--rd-surface-subtle)' }}>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <tbody>
                  {item.sheets.map(s => (
                    <tr key={s.sheet_id} className="pc-row-clickable" onClick={() => onOpenSheet(s)}>
                      <td className="pc-mono">{s.drawing_no}</td>
                      <td>{s.applicability !== 'Y' ? 'N/A' : (s.ai_result ?? '—')}</td>
                      <td className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>open step 4 →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── rule card ───────────────────────────────────────────────────────────

function RuleCard({ code, title, text, count }) {
  return (
    <div className="pc-card pc-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span className="pc-mono" style={{ fontWeight: 600 }}>{code}</span>
        <Pill label={String(count)} tone={count > 0 ? 'warning' : 'success'} />
      </div>
      <h3 className="pc-card-title">{title}</h3>
      <p className="pc-muted" style={{ margin: 0, fontSize: 'var(--rd-text-table)' }}>{text}</p>
    </div>
  )
}
