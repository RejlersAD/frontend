/**
 * SLD Checker — network view (step 5). Builds a left-to-right layered
 * graph from the checker topology endpoint, laid out with elkjs
 * (layered algorithm, columns per voltage level).
 *
 * Node card: tag · description · rating line · loading bar
 * (green <85% · amber 85–100% · red >100%) · 'est. fault ≈ n kA' in red
 * when above the rating · finding badges (E1, L2, D3, Q4 — the same
 * numbers as the finding list and the 3D view).
 * Edges are dashed for alternative/tie connections.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { EmptyState } from '../../Process/PidChecker/shared'

const NODE_W = 220
const NODE_H = 96

// Voltage-level column order (highest voltage on the left). Nodes with an
// unknown voltage fall back to their topology depth.
const voltageOf = n => {
  const v = n.voltage_kv ?? n.kv ?? n.voltage ?? null
  const num = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(num) ? num : null
}

function normNodes(topology) {
  const raw = Array.isArray(topology) ? topology : topology?.nodes || []
  return raw.map((n, i) => ({
    id: n.id ?? n.node_id ?? `n-${i}`,
    tag: n.tag ?? n.label ?? `Node ${i + 1}`,
    kind: n.kind ?? n.type ?? 'board',
    description: n.description ?? null,
    rating: n.rating ?? n.rating_a ?? null, // amps
    ratingText: n.rating_text ?? (n.rating_a ? `${n.rating_a} A` : (n.rating_kw ? `${n.rating_kw} kW` : null)),
    loadingPct: n.loading_pct ?? n.loading ?? null,
    faultKa: n.fault_ka ?? n.est_fault_ka ?? null,
    faultRatingKa: n.fault_rating_ka ?? n.fault_withstand_ka ?? null,
    voltage: voltageOf(n),
    kw: n.kw ?? n.load_kw ?? null,
    raw: n,
  }))
}

function normEdges(topology) {
  const raw = Array.isArray(topology) ? [] : topology?.edges || []
  return raw.map((e, i) => ({
    id: e.id ?? `e-${i}`,
    from: e.from ?? e.source,
    to: e.to ?? e.target,
    kind: e.kind ?? e.type ?? 'feed', // 'feed' | 'tie' | 'alternative'
  }))
}

/** Loading bar tone: green <85% · amber 85–100% · red >100%. */
function loadTone(p) {
  if (p == null) return null
  if (p > 100) return 'var(--rd-danger)'
  if (p >= 85) return 'var(--rd-warning)'
  return 'var(--rd-success)'
}

export default function NetworkView({ topology, findings = [], selectedId = null, onSelect, toggles = { loading: true, fault: true, findings: true, loads: true } }) {
  const nodes = useMemo(() => normNodes(topology), [topology])
  const edges = useMemo(() => normEdges(topology), [topology])
  const [layout, setLayout] = useState(null) // { positions: {id:{x,y}}, edges:[{id,points}], width, height }
  const [fitTick, setFitTick] = useState(0)
  const containerRef = useRef(null)

  // Finding badges per node — same E/L/D/Q labels as everywhere.
  const badgesByNode = useMemo(() => {
    const map = {}
    for (const f of findings) {
      const nid = f.nodeId ?? f.raw?.node_id ?? null
      if (nid == null) continue
      if (!map[nid]) map[nid] = []
      map[nid].push(f)
    }
    return map
  }, [findings])

  useEffect(() => {
    if (nodes.length === 0) { setLayout(null); return undefined }
    let alive = true
    const elk = new ELK()
    // Assign a column (layer) per voltage level: highest voltage left.
    const voltages = [...new Set(nodes.map(n => n.voltage).filter(v => v != null))].sort((a, b) => b - a)
    const layerOf = n => (n.voltage != null ? voltages.indexOf(n.voltage) : voltages.length)
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '24',
        'elk.layered.spacing.nodeNodeBetweenLayers': '72',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      },
      children: nodes.map(n => ({
        id: String(n.id),
        width: NODE_W,
        height: NODE_H,
        layoutOptions: { 'elk.layered.layering.layerConstraint': 'FIRST' },
        // elk has no per-node layer pinning without partitions; the column
        // is applied post-layout below by overriding x per voltage layer.
        _layer: layerOf(n),
      })),
      edges: edges
        .filter(e => e.from != null && e.to != null)
        .map(e => ({ id: String(e.id), sources: [String(e.from)], targets: [String(e.to)] })),
    }
    elk.layout(graph)
      .then(res => {
        if (!alive) return
        const positions = {}
        const layerX = {}
        for (const child of res.children || []) {
          const layer = child._layer ?? 0
          if (layerX[layer] == null) layerX[layer] = layer * (NODE_W + 96)
          positions[child.id] = { x: layerX[layer], y: child.y ?? 0 }
        }
        const maxY = Math.max(0, ...Object.values(positions).map(p => p.y)) + NODE_H + 48
        const width = (Math.max(0, ...Object.values(layerX)) || 0) + NODE_W + 48
        // Straight edges between node centres (right edge → left edge).
        const laidEdges = edges.map(e => {
          const a = positions[String(e.from)]
          const b = positions[String(e.to)]
          if (!a || !b) return null
          return {
            id: e.id,
            kind: e.kind,
            points: [
              [a.x + NODE_W, a.y + NODE_H / 2],
              [b.x, b.y + NODE_H / 2],
            ],
          }
        }).filter(Boolean)
        setLayout({ positions, edges: laidEdges, width, height: maxY })
      })
      .catch(() => { if (alive) setLayout(null) })
    return () => { alive = false }
  }, [nodes, edges])

  if (!topology) {
    return (
      <div className="pc-card" style={{ padding: '1rem' }}>
        <div className="pc-skeleton" style={{ height: 320 }} />
      </div>
    )
  }
  if (nodes.length === 0) {
    return (
      <div className="pc-card">
        <EmptyState title="The network view is not available yet.">
          Available after the checker backend is connected and the topology has been saved for this analysis.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="pc-viewer">
      <div className="pc-viewer-toolbar" role="toolbar" aria-label="Network view">
        <button type="button" className="pc-chip" style={{ minHeight: 30 }} onClick={() => setFitTick(t => t + 1)}>
          Fit
        </button>
        <span className="pc-faint" style={{ marginLeft: 'auto', fontSize: 'var(--rd-text-caption)' }}>
          {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} connection{edges.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="pc-viewer-canvas sc-nw-canvas" ref={containerRef}>
        {!layout ? (
          <div style={{ padding: '1rem', width: '100%' }}><div className="pc-skeleton" style={{ height: 320 }} /></div>
        ) : (
          <FitBox key={fitTick} width={layout.width} height={layout.height} containerRef={containerRef}>
            <svg className="sc-nw-edges" width={layout.width} height={layout.height} aria-hidden="true">
              {layout.edges.map(e => (
                <line
                  key={e.id}
                  x1={e.points[0][0]} y1={e.points[0][1]}
                  x2={e.points[1][0]} y2={e.points[1][1]}
                  className={`sc-nw-edge${e.kind === 'tie' || e.kind === 'alternative' ? ' sc-nw-edge-tie' : ''}`}
                />
              ))}
            </svg>
            {nodes.map(n => {
              const pos = layout.positions[String(n.id)]
              if (!pos) return null
              const badges = badgesByNode[n.id] || []
              const overFault = n.faultKa != null && n.faultRatingKa != null && n.faultKa > n.faultRatingKa
              const selected = selectedId != null && badges.some(f => f.id === selectedId)
              return (
                <div
                  key={n.id}
                  className={`sc-nw-node${selected ? ' sc-nw-node-selected' : ''}`}
                  style={{ left: pos.x, top: pos.y, width: NODE_W, minHeight: NODE_H }}
                >
                  <div className="sc-nw-node-head">
                    <span className="pc-mono" style={{ fontWeight: 700 }}>{n.tag}</span>
                    {n.voltage != null && <span className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)' }}>{n.voltage} kV</span>}
                  </div>
                  {n.description && <p className="sc-nw-desc">{n.description}</p>}
                  {n.ratingText && <p className="sc-nw-rating">{n.ratingText}</p>}
                  {toggles.loading && n.loadingPct != null && (
                    <div className="sc-nw-loadbar" role="img" aria-label={`Loading ${Math.round(n.loadingPct)}%`}>
                      <span style={{ width: `${Math.min(100, n.loadingPct)}%`, background: loadTone(n.loadingPct) }} />
                      <em>{Math.round(n.loadingPct)}%</em>
                    </div>
                  )}
                  {toggles.loads && n.kw != null && n.loadingPct == null && (
                    <p className="sc-nw-rating">{n.kw} kW</p>
                  )}
                  {toggles.fault && n.faultKa != null && (
                    <p className={`sc-nw-fault${overFault ? ' sc-nw-fault-over' : ''}`}>
                      est. fault ≈ {n.faultKa} kA{n.faultRatingKa != null ? ` / ${n.faultRatingKa} kA` : ''}
                    </p>
                  )}
                  {toggles.findings && badges.length > 0 && (
                    <div className="sc-nw-badges">
                      {badges.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          className={`sc-nw-badge${f.id === selectedId ? ' sc-nw-badge-selected' : ''}`}
                          onClick={() => onSelect?.(f.id)}
                          aria-label={`Finding ${f.label}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </FitBox>
        )}
      </div>
      <p className="sc-nw-footer">Fault levels are estimates · confirm with SC study</p>
    </div>
  )
}

/** Scales the fixed-size layout to the container width ("Fit"). */
function FitBox({ width, height, containerRef, children }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !width) return undefined
    const update = () => setScale(Math.min(1.25, Math.max(0.35, (el.clientWidth - 24) / width)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, width])
  return (
    <div style={{ width: width * scale, height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
