/**
 * 3D topology view of the three documents (step 4) — NOT a drawing or a
 * layout; every value comes from the comparison result only.
 *
 * Three stacked translucent planes top→bottom: SLD drawing (blue) ·
 * Equipment List (teal) · Load List (amber), each labelled with the
 * document number. Every board/transformer/generator tag gets ONE stable
 * x/z grid position (ordered by tag, boards first), the same on every
 * plane. Loads are pillars around their board, height ∝ √kW (kwList);
 * LL plane under boardList, SLD plane under boardSld when present;
 * board-mismatch loads are red with a red slanted line between the two
 * positions; not-on-SLD loads are grey and live on the LL plane only.
 * Green vertical line = same tag on two documents.
 *
 * Controls: Isometric / Top / Front / Fit · layer toggles · drag rotate,
 * wheel zoom. Status chips dim non-matching objects to 15%. Clicking an
 * object selects its row. Canvas carries an aria-label; the 2D alignment
 * view (one click away in the view switch) is the text alternative.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const PLANES = [
  { id: 'sld', label: 'SLD drawing', color: 0x5B9BFF, y: 14 },
  { id: 'el', label: 'Equipment List', color: 0x2BC4A8, y: 7 },
  { id: 'll', label: 'Load List', color: 0xF2B84B, y: 0 },
]
const PLANE_Y = Object.fromEntries(PLANES.map(p => [p.id, p.y]))

const COLORS = {
  sldMatched: 0x5B9BFF, sldOnly: 0xF2B84B,
  elMatched: 0x2BC4A8, elNotOnSld: 0x8a9bb3, elDemolition: 0x475569,
  loadOk: 0x2BC4A8, loadMismatch: 0xC2283A, loadNotOnSld: 0x8a9bb3,
  lineOk: 0x2BC4A8, lineDiff: 0xC2283A,
}

function labelSprite(text, color = '#e2e8f0') {
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(10,24,48,0.85)'
  ctx.fillRect(0, 0, 512, 64)
  ctx.fillStyle = color
  ctx.font = '700 28px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 12, 34)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sprite.scale.set(10, 1.25, 1)
  return sprite
}

/** Stable x/z grid positions: boards first (ordered by tag), then loads. */
function useLayout(alignment) {
  return useMemo(() => {
    const boards = alignment.rows.filter(r => r.group === 'board')
    const pos = new Map()
    const cols = Math.max(2, Math.ceil(Math.sqrt(Math.max(boards.length, 1))))
    boards.forEach((r, i) => {
      pos.set(r.tag, { x: (i % cols) * 7 - (cols - 1) * 3.5, z: Math.floor(i / cols) * 7 })
    })
    // Loads: pillar slots around their board (ring by index).
    const perBoard = new Map()
    const loadPos = new Map()
    for (const r of alignment.rows.filter(x => x.group === 'load')) {
      const b = r.board && pos.has(r.board) ? r.board : null
      const idx = (perBoard.get(b) ?? 0)
      perBoard.set(b, idx + 1)
      const base = b ? pos.get(b) : { x: (cols) * 7 - (cols - 1) * 3.5, z: (perBoard.size % 4) * 7 } // unboarded loads to the side
      const angle = (idx % 8) * (Math.PI / 4)
      const ring = 1.9 + Math.floor(idx / 8) * 1.4
      loadPos.set(r.tag, { x: base.x + Math.cos(angle) * ring, z: base.z + Math.sin(angle) * ring })
    }
    const width = cols * 7 + 8
    const depth = (Math.floor(boards.length / cols) + 2) * 7 + 6
    return { pos, loadPos, width, depth }
  }, [alignment])
}

export default function ThreeDocs3D({ alignment, docs, analysisDate, statusFilter = 'All', selectedTag = null, onSelect }) {
  const host = useRef(null)
  const world = useRef(null)
  const [layers, setLayers] = useState({ sld: true, el: true, ll: true })
  const layout = useLayout(alignment)

  // Callout content from the same alignment rows.
  const callouts = useMemo(() => {
    const mismatch = alignment.rows.filter(r => r.status === 'board-mismatch')
    const matched = alignment.rows.filter(r => ['matched', 'agrees'].includes(r.status))
    const sldOnly = alignment.rows.filter(r => r.status === 'sld-only')
    const notOnSld = alignment.rows.filter(r => r.status === 'not-on-sld')
    const out = []
    if (mismatch.length > 0) {
      const tags = mismatch.map(r => r.tag.replace(/^285-/, '')).slice(0, 4).join(' · ')
      out.push(`${mismatch.length} Board mismatch · ${tags}`)
    }
    if (matched.length > 0) out.push(`${matched.length} Matched on SLD and Equipment List`)
    if (sldOnly.length > 0) out.push(`${sldOnly.length} On SLD only`)
    if (notOnSld.length > 0) out.push(`${notOnSld.length} Not on SLD`)
    if (selectedTag) {
      const sel = alignment.rows.find(r => r.tag === selectedTag)
      if (sel) out.unshift(`${sel.tag} · ${sel.statusLabel}`)
    }
    return out
  }, [alignment, selectedTag])

  useEffect(() => {
    if (!host.current) return undefined
    const el = host.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x06162B, 90, 240)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.09

    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x1a2740, 1.0))
    const sun = new THREE.DirectionalLight(0xffffff, 0.8)
    sun.position.set(30, 60, 25)
    scene.add(sun)

    const root = new THREE.Group()
    scene.add(root)
    const layerGroups = { sld: new THREE.Group(), el: new THREE.Group(), ll: new THREE.Group(), links: new THREE.Group() }
    Object.values(layerGroups).forEach(g => root.add(g))
    const pickables = []
    const rowMeshes = [] // { mesh, row, baseOpacity }

    // planes + labels
    for (const p of PLANES) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(layout.width, layout.depth),
        new THREE.MeshStandardMaterial({ color: p.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      )
      plane.rotation.x = -Math.PI / 2
      plane.position.y = PLANE_Y[p.id]
      layerGroups[p.id].add(plane)
      const label = labelSprite(`${p.label}${docs[p.id] ? ` · ${docs[p.id]}` : ''}`)
      label.position.set(-layout.width / 2 + 5, PLANE_Y[p.id] + 1.4, -layout.depth / 2 - 1)
      layerGroups[p.id].add(label)
    }

    const addBox = (row, planeId, color, { lower = false, pillar = false, height = null } = {}) => {
      const isBoard = row.group === 'board'
      const p = isBoard ? layout.pos.get(row.tag) : layout.loadPos.get(row.tag)
      if (!p) return null
      const h = height ?? (pillar ? Math.max(0.8, Math.min(7, Math.sqrt(Math.max(row.kw ?? 1, 1)) / 3.2)) : isBoard ? 1.6 : 1.1)
      const w = isBoard ? 2.6 : pillar ? 0.7 : 1.6
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, isBoard ? 1.8 : pillar ? 0.7 : 1.2),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 1, roughness: 0.55, metalness: 0.15 }),
      )
      mesh.position.set(p.x, PLANE_Y[planeId] + (lower ? h / 2 - 0.7 : h / 2), p.z)
      mesh.userData = { tag: row.tag }
      layerGroups[planeId].add(mesh)
      pickables.push(mesh)
      rowMeshes.push({ mesh, row, baseOpacity: 1 })
      return mesh
    }

    const meshesByTagPlane = new Map() // `${tag}|${plane}` -> mesh
    const track = (row, planeId, mesh) => { if (mesh) meshesByTagPlane.set(`${row.tag}|${planeId}`, mesh) }

    // objects per row
    for (const row of alignment.rows) {
      const isBoard = row.group === 'board'
      if (isBoard || row.group === 'load') {
        if (row.sld.present) {
          const color = row.status === 'board-mismatch' ? COLORS.loadMismatch
            : row.status === 'sld-only' ? COLORS.sldOnly
            : row.status === 'sld-demolition' ? COLORS.elDemolition
            : COLORS.sldMatched
          track(row, 'sld', addBox(row, 'sld', color, { pillar: !isBoard }))
        }
        if (row.el.present) {
          const color = row.el.tone === 'demolition' ? COLORS.elDemolition
            : row.el.tone === 'none' ? COLORS.elNotOnSld
            : COLORS.elMatched
          track(row, 'el', addBox(row, 'el', color, { lower: row.el.tone === 'demolition', pillar: !isBoard }))
        }
        if (row.ll.present && row.ll.tone !== 'none') {
          const color = row.status === 'board-mismatch' ? COLORS.loadMismatch
            : row.status === 'not-on-sld' ? COLORS.loadNotOnSld
            : COLORS.loadOk
          track(row, 'll', addBox(row, 'll', color, { pillar: !isBoard }))
        }
      } else {
        // interfaces / cables: single SLD marker
        if (row.sld.present) track(row, 'sld', addBox(row, 'sld', COLORS.sldOnly))
      }
    }

    // green vertical lines: same tag present on two document planes
    const addLine = (a, b, color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.position.x, a.position.y + 0.8, a.position.z),
        new THREE.Vector3(b.position.x, b.position.y + 0.8, b.position.z),
      ])
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }))
      layerGroups.links.add(line)
      return line
    }
    for (const row of alignment.rows) {
      const s = meshesByTagPlane.get(`${row.tag}|sld`)
      const e = meshesByTagPlane.get(`${row.tag}|el`)
      const l = meshesByTagPlane.get(`${row.tag}|ll`)
      if (s && e && ['matched', 'agrees'].includes(row.status)) addLine(s, e, COLORS.lineOk)
      if (e && l && ['matched', 'agrees', 'board-covered'].includes(row.status)) addLine(e, l, COLORS.lineOk)
      if (s && l && ['agrees'].includes(row.status)) addLine(s, l, COLORS.lineOk)
      // red slanted: same load under different boards (list vs SLD)
      if (row.status === 'board-mismatch' && s && l) addLine(s, l, COLORS.lineDiff)
    }

    // camera + fit
    const center = new THREE.Vector3(0, 7, 0)
    const span = Math.max(layout.width, layout.depth, 20)
    const setView = name => {
      const d = span * 1.35
      if (name === 'top') camera.position.set(0, d * 1.4, 0.01)
      else if (name === 'front') camera.position.set(0, 10, d)
      else camera.position.set(d * 0.75, d * 0.7, d * 0.75)
      controls.target.copy(center)
      controls.update()
    }
    setView('iso')

    const resize = () => {
      const wpx = el.clientWidth || 800
      const hpx = el.clientHeight || 480
      renderer.setSize(wpx, hpx, false)
      camera.aspect = wpx / hpx
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // picking
    const ray = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let down = null
    const onDown = e => { down = [e.clientX, e.clientY] }
    const onUp = e => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 4) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        ray.setFromCamera(mouse, camera)
        const hit = ray.intersectObjects(pickables, false)[0]
        if (hit) onSelect?.(hit.object.userData.tag)
      }
      down = null
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    let raf = 0
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera) }
    loop()

    world.current = { setView, layerGroups, rowMeshes, camera }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.dispose()
      el.removeChild(renderer.domElement)
      world.current = null
    }
  }, [alignment, layout]) // eslint-disable-line react-hooks/exhaustive-deps

  // layer toggles
  useEffect(() => {
    const w = world.current
    if (!w) return
    for (const p of PLANES) w.layerGroups[p.id].visible = layers[p.id]
  }, [layers])

  // status filter: dim the rest to 15%
  useEffect(() => {
    const w = world.current
    if (!w) return
    for (const { mesh, row, baseOpacity } of w.rowMeshes) {
      const on = statusFilter === 'All' || row.status === statusFilter
      mesh.material.opacity = on ? baseOpacity : 0.15
      mesh.material.transparent = true
    }
  }, [statusFilter])

  // selected tag highlight
  useEffect(() => {
    const w = world.current
    if (!w) return
    for (const { mesh, row } of w.rowMeshes) {
      mesh.material.emissive = new THREE.Color(row.tag === selectedTag ? 0x0A5EF5 : 0x000000)
      mesh.material.emissiveIntensity = row.tag === selectedTag ? 0.55 : 0
    }
  }, [selectedTag])

  return (
    <div style={{ position: 'relative' }}>
      <div className="pc-viewer-toolbar" role="toolbar" aria-label="3D view controls">
        <div className="pc-seg" role="group" aria-label="Standard views">
          {[['iso', 'Isometric'], ['top', 'Top'], ['front', 'Front']].map(([k, l]) => (
            <button key={k} type="button" className="pc-seg-btn" style={{ minHeight: 30 }} onClick={() => world.current?.setView(k)}>{l}</button>
          ))}
        </div>
        <button type="button" className="pc-chip" style={{ minHeight: 30 }} onClick={() => world.current?.setView('iso')}>Fit</button>
        <div className="pc-chips" role="group" aria-label="Layers" style={{ marginLeft: 'auto' }}>
          {PLANES.map(p => (
            <button
              key={p.id}
              type="button"
              className={`pc-chip${layers[p.id] ? ' pc-chip-active' : ''}`}
              style={{ minHeight: 30 }}
              aria-pressed={layers[p.id]}
              onClick={() => setLayers(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={host}
        style={{ height: 480, border: '1px solid var(--rd-border)', borderRadius: 'var(--rd-radius-panel)', overflow: 'hidden', background: '#06162B' }}
        role="img"
        aria-label="3D topology of the SLD drawing, the Equipment List and the Load List. Use the 2D alignment view for a text alternative."
      />
      <div className="sc-3d-callouts" aria-hidden="true">
        {callouts.map((c, i) => <span key={i} className="sc-3d-callout">{c}</span>)}
      </div>
      <p className="pc-faint" style={{ fontSize: 'var(--rd-text-caption)', margin: '0.5rem 0 0' }}>
        Analysis {analysisDate ?? '—'} · values from the comparison result only · layout not to scale
      </p>
    </div>
  )
}
