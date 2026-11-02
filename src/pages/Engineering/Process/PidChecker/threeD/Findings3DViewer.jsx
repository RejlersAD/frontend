// Findings3DViewer.jsx — React wrapper for PidScene3D.
// Spec B (30 Oct 2026): studio-dark default, colour-by (Piping class /
// Service / Size / Finding), class legend (only classes present on the
// sheet), line labels off by default, callout cards with leader lines,
// 2D→3D lift animation, status bar with "n of m located" + the
// not-locatable list.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import PidScene3D from './pid-scene3d.js';            // the delivered viewer
import * as svc from '../pidChecker.service.js';
import './pid-scene3d.css';

const VIEWS = [['iso', 'Iso'], ['iso2', 'Iso NW'], ['top', 'Top'], ['front', 'Front'], ['right', 'Right']];
const LAYERS = [['rack', 'Pipe rack'], ['equipment', 'Equipment'], ['valves', 'Valves'], ['labels', 'Labels'], ['findings', 'Findings'], ['grid', 'Grid']];
const COLOR_BY = [['class', 'Piping class'], ['service', 'Service'], ['size', 'Size'], ['finding', 'Finding']];

const toHex = (n) => (typeof n === 'number' ? '#' + n.toString(16).padStart(6, '0') : n);

export default function Findings3DViewer({ documentId, page, selectedFindingId, onSelectFinding, onSelectObject, playLift = false }) {
  const host = useRef(null);
  const viewer = useRef(null);
  const didLift = useRef(false); // play the 2D→3D lift once per mount (B6)
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [proj, setProj] = useState('persp');
  const [theme, setTheme] = useState('studio'); // studio (dark) is the default
  const [colorBy, setColorBy] = useState('class');
  const [layers, setLayers] = useState(() => Object.fromEntries(LAYERS.map(([k]) => [k, true]))); // 'Labels' is a master toggle for all text labels
  const [classVisible, setClassVisible] = useState({});
  const [serviceVisible, setServiceVisible] = useState({});

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    svc.getScene3D(documentId, page)                  // GET /api/v2/pid-verification/documents/{id}/scene3d/?page=
      .then((scene) => {
        if (!alive) return;
        if (!scene || scene.status !== 'ok') { setState({ status: 'empty', reason: scene?.status || 'no_scene' }); return; }
        setState({ status: 'ready', scene });
      })
      .catch((e) => alive && setState({ status: 'error', message: e?.response?.data?.message || e?.message || String(e) }));
    return () => { alive = false; };
  }, [documentId, page, attempt]);

  useEffect(() => {
    if (state.status !== 'ready' || !host.current) return undefined;
    const v = new PidScene3D(host.current, state.scene, {
      THREE, OrbitControls,
      onSelect: (s) => {
        if (!s) return;
        if (s.type === 'finding' || s.finding) onSelectFinding?.(s.finding || s.id);
        else onSelectObject?.(s);
      },
    });
    v.setColorBy('class');
    viewer.current = v;
    if (playLift && !didLift.current) { didLift.current = true; v.playLift(); }
    return () => { v.dispose(); viewer.current = null; };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (viewer.current && selectedFindingId) viewer.current.selectFinding(selectedFindingId, true); }, [selectedFindingId]);

  if (state.status === 'loading') return <div className="p3d-empty">Building 3D for sheet {page + 1}…</div>;
  if (state.status === 'error') return <div className="p3d-empty">3D could not be built: {state.message}. <button type="button" onClick={() => setAttempt((a) => a + 1)}>Retry</button></div>;
  if (state.status === 'empty') return (
    <div className="p3d-empty">
      {state.reason === 'no_vector_geometry'
        ? 'This sheet has no vector geometry (scanned / OCR). 3D needs a vector PDF.'
        : state.reason === 'page_out_of_range'
          ? 'That sheet does not exist in this document.'
          : 'No pipe geometry was found on this sheet.'}
      <a href="/engineering/piping/pid-to-3d">Open in P&amp;ID to 3D</a>
    </div>
  );

  const v = viewer.current;
  const sc = state.scene;
  const located = sc.findings.filter((f) => f.anchor).length;
  const notShown = sc.findings.filter((f) => !f.anchor);
  // The class legend lists only the classes present on this sheet.
  const classesPresent = [...new Set(sc.lines.map((l) => (l.cls || '').toUpperCase() || 'UNKNOWN'))].sort();
  const classColor = (c) => (c === 'UNKNOWN' ? PidScene3D.CLASS_UNKNOWN : (PidScene3D.CLASS_COLORS[c] || PidScene3D.CLASS_UNKNOWN));
  return (
    <div className={'p3d-wrap' + (theme === 'studio' ? ' studio' : '')}>
      <div className="p3d-tb" role="toolbar" aria-label="3D view controls">
        <div className="seg" role="group" aria-label="Projection">
          <button type="button" className={proj === 'persp' ? 'on' : ''} onClick={() => { v?.setProjection('persp'); setProj('persp'); }}>Perspective</button>
          <button type="button" className={proj === 'iso' ? 'on' : ''} onClick={() => { v?.setProjection('iso'); setProj('iso'); }}>Isometric</button>
        </div>
        <div className="seg" role="group" aria-label="Standard views">{VIEWS.map(([k, l]) => <button key={k} type="button" onClick={() => v?.setView(k)}>{l}</button>)}</div>
        <div className="seg" role="group" aria-label="Theme">
          <button type="button" className={theme === 'studio' ? 'on' : ''} onClick={() => { v?.setTheme('studio'); setTheme('studio'); }}>Studio (dark)</button>
          <button type="button" className={theme === 'light' ? 'on' : ''} onClick={() => { v?.setTheme('light'); setTheme('light'); }}>Light</button>
        </div>
        <label className="rng">Colour by{' '}
          <select
            value={colorBy}
            onChange={(e) => { setColorBy(e.target.value); v?.setColorBy(e.target.value); }}
            aria-label="Colour pipes by"
            style={{ minHeight: 30 }}
          >
            {COLOR_BY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => v?.fit()}>Fit</button>
        <button type="button" className="btn ib" aria-label="Zoom out" onClick={() => v?.zoom(0.8)}>−</button>
        <button type="button" className="btn ib" aria-label="Zoom in" onClick={() => v?.zoom(1.25)}>+</button>
        <label className="rng">Section <input type="range" min="0" max="90" defaultValue="0" aria-label="Section cut" onChange={(e) => v?.setSection(+e.target.value / 100)} /></label>
        {LAYERS.map(([k, l]) => (
          <button key={k} type="button" className={'btn' + (layers[k] ? ' on' : '')} aria-pressed={layers[k]}
            onClick={() => { const on = !layers[k]; v?.setLayer(k, on); setLayers({ ...layers, [k]: on }); }}>{l}</button>
        ))}
      </div>
      <div className="p3d-view">
        <div ref={host} className="p3d" />
        <div className="p3d-help">Left-drag rotate · Right-drag pan · Wheel zoom · Double-click to focus</div>
        {colorBy === 'class' && classesPresent.length > 0 && (
          <div className="legend" aria-label="Piping class legend">
            {classesPresent.map((c) => (
              <button
                key={c}
                type="button"
                className={classVisible[c] === false ? 'off' : ''}
                aria-pressed={classVisible[c] !== false}
                onClick={() => { const on = classVisible[c] === false; v?.setClassVisible(c, on); setClassVisible({ ...classVisible, [c]: on }); }}
              >
                <i style={{ background: classColor(c) }} />{c}
              </button>
            ))}
          </div>
        )}
        {colorBy === 'service' && (
          <div className="legend" aria-label="Service legend">
            {Object.entries(PidScene3D.SERVICE).filter(([k]) => sc.lines.some((l) => l.service === k)).map(([k, s]) => (
              <button
                key={k}
                type="button"
                className={serviceVisible[k] === false ? 'off' : ''}
                aria-pressed={serviceVisible[k] !== false}
                onClick={() => { const on = serviceVisible[k] === false; v?.setService(k, on); setServiceVisible({ ...serviceVisible, [k]: on }); }}
              >
                <i style={{ background: toHex(s.color) }} />{s.label}
              </button>
            ))}
          </div>
        )}
        <div className="p3d-badge">PRELIMINARY — NOT FOR CONSTRUCTION</div>
      </div>
      <div className="p3d-status">
        <span><b>{sc.lines.length}</b> pipe runs</span>
        <span><b>{sc.equipment.length}</b> equipment{sc.equipment.some((e) => e.ghost) ? ' (referenced)' : ''}</span>
        <span><b>{sc.valves.length}</b> valves</span>
        <span><b>{located}</b> of <b>{sc.findings.length}</b> findings located in 3D{notShown.length > 0 ? ` · ${notShown.length} not locatable` : ''}</span>
        <span style={{ marginLeft: 'auto' }}>Layout from the P&amp;ID geometry · not to scale</span>
      </div>
      {notShown.length > 0 && (
        <div className="p3d-status" style={{ borderTop: 'none', paddingTop: 0 }}>
          <span>Not shown in 3D: {notShown.map((f) => `F${f.n}`).join(', ')}</span>
        </div>
      )}
    </div>
  );
}
