/**
 * SLD Checker — 3D levels view (step 5). Reuses PidScene3D from the
 * process checker UNMODIFIED and feeds it a scene object shaped like the
 * P&ID one ({ lines, valves, equipment, connectors, findings, bounds })
 * synthesized from the checker topology:
 *
 *  - voltage planes → rack lines (horizontal 2-point paths, y > 5)
 *  - transformers   → cylinders (equipment kind 'column')
 *  - generators     → boxes (equipment kind 'generator')
 *  - boards         → boxes (equipment kind 'board')
 *  - loads          → pillars with height ∝ √kW
 *
 * Finding callouts use the SAME E/L/D/Q numbers as the finding list and
 * the network view (the viewer prefers f.label when present).
 *
 * NOTE: PidScene3D owns its materials; per-kind custom colours (e.g.
 * orange generators / blue boards) are not possible without forking it,
 * so kinds only change the SHAPE. The ESTIMATES badge is an overlay.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import PidScene3D from '../../Process/PidChecker/threeD/pid-scene3d.js'
import '../../Process/PidChecker/threeD/pid-scene3d.css'
import { EmptyState } from '../../Process/PidChecker/shared'

const voltageOf = n => {
  const v = n.voltage_kv ?? n.kv ?? n.voltage ?? null
  const num = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(num) ? num : null
}

/** Build the PidScene3D-shaped scene from the checker topology. */
function buildScene(topology, findings) {
  const rawNodes = Array.isArray(topology) ? topology : topology?.nodes || []
  if (rawNodes.length === 0) return null

  // Columns per voltage level (highest on the left), elevation per level.
  const nodes = rawNodes.map((n, i) => ({
    id: n.id ?? n.node_id ?? `n-${i}`,
    tag: n.tag ?? n.label ?? `Node ${i + 1}`,
    kind: String(n.kind ?? n.type ?? 'board').toLowerCase(),
    kw: n.kw ?? n.load_kw ?? null,
    voltage: voltageOf(n),
  }))
  const voltages = [...new Set(nodes.map(n => n.voltage).filter(v => v != null))].sort((a, b) => b - a)
  const levelOf = n => (n.voltage != null ? voltages.indexOf(n.voltage) : voltages.length)
  const levelCount = Math.max(1, voltages.length + (nodes.some(n => n.voltage == null) ? 1 : 0))
  const perLevel = new Map()

  const equipment = []
  const positions = {}
  for (const n of nodes) {
    const lvl = levelOf(n)
    const idx = perLevel.get(lvl) ?? 0
    perLevel.set(lvl, idx + 1)
    const x = lvl * 26
    const z = idx * 8
    const baseY = (levelCount - 1 - lvl) * 8 + 1.5 // highest voltage on top
    const isLoad = ['load', 'motor', 'feeder'].includes(n.kind)
    const isTransformer = ['transformer', 'trafo', 'tx'].includes(n.kind)
    const isGenerator = ['generator', 'gen', 'source', 'grid', 'utility'].includes(n.kind)
    let kind = 'board'
    let size = [5, 2.4, 1.6] // boards: switchboard box
    if (isTransformer) { kind = 'column'; size = [3.2, 5.5, 3.2] } // cylinder
    else if (isGenerator) { kind = 'generator'; size = [4, 2.6, 2.2] } // box
    else if (isLoad) {
      const h = n.kw != null ? Math.max(1, Math.min(9, Math.sqrt(Math.max(n.kw, 1)) / 4)) : 2 // height ∝ √kW
      kind = 'load'; size = [1.1, h, 1.1] // pillar
    }
    const center = [x, baseY + size[1] / 2, z]
    positions[n.id] = { center, topY: baseY + size[1], size }
    equipment.push({ id: n.id, tag: n.tag, kind, center, size })
  }

  // Voltage planes as rack lines (constant y > 5 → the viewer builds a rack).
  const lines = voltages.map((v, lvl) => {
    const y = (levelCount - 1 - lvl) * 8 + 8
    const span = Math.max(24, (perLevel.get(lvl) ?? 1) * 8 + 8)
    return {
      id: `plane-${lvl}`,
      line_no: `${v} kV level`,
      size_in: 3,
      service: 'utility',
      path: [[lvl * 26 - 10, y, -6], [lvl * 26 + span, y, -6]],
    }
  })

  // Finding callouts at their node's position — same E/L/D/Q labels.
  const sceneFindings = []
  findings.forEach((f, i) => {
    const nid = f.nodeId ?? f.raw?.node_id ?? null
    const pos = nid != null ? positions[nid] : null
    sceneFindings.push({
      id: f.id,
      n: i + 1,
      kind: String(f.severity || 'minor').toLowerCase() === 'critical' ? 'error' : 'query',
      title: f.title,
      label: f.label, // the viewer prefers f.label
      anchor: pos ? [pos.center[0], pos.topY + 1.2, pos.center[2]] : null,
      ref: nid,
    })
  })

  const xs = equipment.map(e => e.center[0])
  const zs = equipment.map(e => e.center[2])
  const ys = equipment.map(e => e.center[1] + e.size[1])
  const bounds = {
    min: [Math.min(...xs, 0) - 14, 0, Math.min(...zs, 0) - 10],
    max: [Math.max(...xs, 1) + 14, Math.max(...ys, 8) + 10, Math.max(...zs, 1) + 10],
  }

  return { lines, valves: [], equipment, connectors: [], findings: sceneFindings, bounds }
}

const VIEWS = [['iso', 'Iso'], ['top', 'Top'], ['front', 'Front'], ['right', 'Right']]

export default function Levels3DView({ topology, findings = [], selectedId = null, onSelect }) {
  const host = useRef(null)
  const viewer = useRef(null)
  const scene = useMemo(() => buildScene(topology, findings), [topology, findings])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!scene || !host.current) return undefined
    let v = null
    try {
      v = new PidScene3D(host.current, scene, {
        THREE, OrbitControls,
        onSelect: s => {
          if (!s) return
          if (s.type === 'finding' || s.finding) onSelect?.(s.finding || s.id)
        },
      })
      v.setColorBy('class')
      viewer.current = v
    } catch (e) {
      setError(e?.message || String(e))
    }
    return () => { v?.dispose(); viewer.current = null }
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewer.current && selectedId != null) viewer.current.selectFinding(selectedId, true)
  }, [selectedId])

  if (!topology) {
    return <div className="pc-card" style={{ padding: '1rem' }}><div className="pc-skeleton" style={{ height: 320 }} /></div>
  }
  if (!scene) {
    return (
      <div className="pc-card">
        <EmptyState title="The 3D levels view is not available yet.">
          Available after the checker backend is connected and the topology has been saved for this analysis.
        </EmptyState>
      </div>
    )
  }
  if (error) {
    return (
      <div className="pc-card">
        <EmptyState title="The 3D view could not be built.">{error}</EmptyState>
      </div>
    )
  }

  const notShown = scene.findings.filter(f => !f.anchor)

  return (
    <div className="sc-3d-wrap">
      <div className="pc-viewer-toolbar" role="toolbar" aria-label="3D levels view">
        <div className="pc-seg" role="group" aria-label="Standard views">
          {VIEWS.map(([k, l]) => (
            <button key={k} type="button" className="pc-seg-btn" style={{ minHeight: 30 }} onClick={() => viewer.current?.setView(k)}>{l}</button>
          ))}
        </div>
        <button type="button" className="pc-chip" style={{ minHeight: 30 }} onClick={() => viewer.current?.fit()}>Fit</button>
        <span className="pc-faint" style={{ marginLeft: 'auto', fontSize: 'var(--rd-text-caption)' }}>
          {scene.equipment.length} items · {scene.findings.filter(f => f.anchor).length} of {scene.findings.length} findings located
        </span>
      </div>
      <div className="sc-3d-canvas" ref={host} />
      <span className="sc-3d-badge" role="note">ESTIMATES · CONFIRM WITH SC / LOAD STUDY</span>
      {notShown.length > 0 && (
        <p className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)', margin: '0.5rem 0 0' }}>
          Not located in 3D: {notShown.map(f => f.label).join(', ')}
        </p>
      )}
    </div>
  )
}
