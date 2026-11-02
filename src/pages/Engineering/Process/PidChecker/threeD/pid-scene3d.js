/*
 * PidScene3D — professional 3D viewer for the RADAI PFD & P&ID Checker.
 * Framework-free; needs THREE (r128+) and THREE.OrbitControls on window, or pass them in opts.
 *
 *   const v = new PidScene3D(container, scene, { onSelect, onHover, THREE, OrbitControls });
 *   v.selectFinding('F1'); v.setView('iso'|'top'|'front'|'right'|'iso2'); v.setProjection('persp'|'iso');
 *   v.fit(); v.setLayer('rack', false); v.setSection(0..1); v.dispose();
 *
 * Scene JSON (from GET /api/v2/pid-verification/documents/{id}/scene3d/?page=n):
 *   { lines:[{id,line_no,size_in,service,new,cls,cls_desc,ins,ins_desc,cases[],path:[[x,y,z]…]}],
 *     valves:[{id,pos,axis,size_in,line_id}], equipment:[{id,tag,kind,center,size,ghost,note}],
 *     connectors:[{id,label,ref,pos,dir}], findings:[{id,n,kind,title,anchor|null,ref}], bounds:{min,max} }
 * Units are metres, Y is up.
 */
(function (root) {
  const SERVICE = {
    steam:   { color: 0x0e7490, label: 'Steam, BFW, condensate' },
    process: { color: 0x4b5563, label: 'Process / hydrocarbon' },
    fuel:    { color: 0xa16207, label: 'Fuel gas, natural gas' },
    utility: { color: 0x8a9bb3, label: 'Air, chemicals' },
    h2:      { color: 0xbe185d, label: 'New H2 scope' }
  };
  const PIN = { error: '#C2283A', query: '#B86E00', minor: '#64748B', selected: '#0A5EF5' };

  // Piping-class palette (spec B2). New H2 scope always wins.
  const CLASS_COLORS = {
    A2AP08: '#E07B39', A2GP01: '#A9B6C8', A0JP15: '#14B8C4', A0JP85: '#5B9BFF',
    D2GP65: '#F2B84B', B2GP01: '#8C7BFF', D0JP15: '#2BC4A8', A2GP08: '#C084FC',
    A0JP08: '#60A5FA', A2AP01: '#F87171',
  };
  const CLASS_UNKNOWN = '#5F6F86';
  const NEW_SCOPE = '#E0457B';
  const SIZE_RAMP = ['#93C5FD', '#3B82F6', '#1D4ED8', '#7C3AED']; // <3 / 3–8 / 8–14 / >14 in
  const BLUEPRINT = '#9CC3FF';

  const THEMES = {
    studio: {
      fog: 0x06162B, gridCenter: 0x3A5478, gridLines: 0x1C3352, gridOpacity: 0.5,
      hemi: [0xdfe9ff, 0x1a2740, 1.0], sun: [0xffffff, 0.8, [30, 60, 25]], fill: [0x8cb4ff, 0.3, [-40, 20, -30]],
      ground: 0x0a1830, labelBg: 'rgba(6,22,43,.88)', labelBorder: 'rgba(90,130,190,.45)',
    },
    light: {
      fog: 0xf4f7fb, gridCenter: 0xc7d1dd, gridLines: 0xdbe2ea, gridOpacity: 1,
      hemi: [0xffffff, 0xc9d3df, 0.75], sun: [0xffffff, 0.85, [-40, 70, -30]], fill: [0xdbe7ff, 0.35, [50, 30, 60]],
      ground: 0xe9eef4, labelBg: 'rgba(255,255,255,.82)', labelBorder: 'rgba(203,213,225,.9)',
    },
  };

  class PidScene3D {
    constructor(container, scene, opts = {}) {
      this.T = opts.THREE || root.THREE;
      this.OC = opts.OrbitControls || (root.THREE && root.THREE.OrbitControls);
      this.el = container; this.data = scene; this.opts = opts;
      this.selected = null; this.hovered = null; this.layers = { rack: true, equipment: true, valves: true, labels: false, findings: true, grid: true };
      this.theme = 'studio'; this.colorBy = 'class'; this._lift = 0; // spec B1/B2/B6
      this.services = Object.fromEntries(Object.keys(SERVICE).map((k) => [k, true]));
      this.meshesByRef = {}; this.pick = []; this.clip = null;
      this._init(); this._build(); this.fit(false); this._loop();
    }

    // ---------- setup ----------
    _init() {
      const T = this.T, el = this.el;
      el.classList.add('p3d');
      this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.localClippingEnabled = true;
      this.renderer.setClearColor(0x000000, 0); // the CSS radial gradient shows through (studio)
      el.appendChild(this.renderer.domElement);
      this.overlay = document.createElement('div'); this.overlay.className = 'p3d-overlay'; el.appendChild(this.overlay);
      this.tip = document.createElement('div'); this.tip.className = 'p3d-tip'; this.tip.hidden = true; el.appendChild(this.tip);

      this.scene = new T.Scene();
      this.scene.fog = new T.Fog(0x06162B, 140, 320);
      this.persp = new T.PerspectiveCamera(38, 1, 0.1, 2000);
      this.ortho = new T.OrthographicCamera(-50, 50, 30, -30, -1000, 3000);
      this.camera = this.persp;
      this.controls = new this.OC(this.camera, this.renderer.domElement);
      this._tuneControls();

      const hemi = new T.HemisphereLight(0xdfe9ff, 0x1a2740, 1.0); this.scene.add(hemi); this.hemi = hemi;
      const sun = new T.DirectionalLight(0xffffff, 0.8); sun.position.set(30, 60, 25); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 250 });
      sun.shadow.bias = -0.0005; this.scene.add(sun); this.sun = sun;
      const fill = new T.DirectionalLight(0x8cb4ff, 0.3); fill.position.set(-40, 20, -30); this.scene.add(fill); this.fill = fill;

      this.root = new T.Group(); this.scene.add(this.root);
      this.ray = new T.Raycaster(); this.mouse = new T.Vector2();
      this._onResize = () => this._resize(); root.addEventListener('resize', this._onResize);
      this._ro = root.ResizeObserver ? new ResizeObserver(this._onResize) : null; if (this._ro) this._ro.observe(el);
      const cvs = this.renderer.domElement;
      cvs.addEventListener('pointermove', (e) => this._hover(e));
      cvs.addEventListener('pointerleave', () => { this._setHover(null); });
      let down = null;
      cvs.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
      cvs.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 4) this._click(e); down = null; });
      cvs.addEventListener('dblclick', (e) => { const h = this._hit(e); if (h) this.focusOn(h.point, 14); });
      this._resize();
    }
    _tuneControls() {
      const c = this.controls;
      c.enableDamping = true; c.dampingFactor = 0.09; c.screenSpacePanning = true;
      c.minDistance = 4; c.maxDistance = 400; c.maxPolarAngle = Math.PI * 0.495;
      c.zoomSpeed = 1.1; c.rotateSpeed = 0.7; c.panSpeed = 0.9;
      c.mouseButtons = { LEFT: this.T.MOUSE.ROTATE, MIDDLE: this.T.MOUSE.DOLLY, RIGHT: this.T.MOUSE.PAN };
    }
    _resize() {
      const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500;
      this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
      this.persp.aspect = w / h; this.persp.updateProjectionMatrix();
      const fh = this._orthoH || 60; this.ortho.left = -fh * w / h / 2; this.ortho.right = fh * w / h / 2; this.ortho.top = fh / 2; this.ortho.bottom = -fh / 2; this.ortho.updateProjectionMatrix();
    }

    // ---------- materials ----------
    _mat(color, o = {}) {
      const m = new this.T.MeshStandardMaterial(Object.assign({ color, metalness: 0.25, roughness: 0.5 }, o));
      m.clippingPlanes = this.clip ? [this.clip] : []; (this._mats = this._mats || []).push(m); return m;
    }

    // ---------- theme (spec B1) ----------
    setTheme(name) {
      if (!THEMES[name] || this.theme === name) return;
      this.theme = name;
      const t = THEMES[name];
      this.scene.fog.color.setHex(t.fog);
      if (this.grid) {
        this.grid.material.opacity = t.gridOpacity;
        this.grid.material.transparent = t.gridOpacity < 1;
      }
      if (this.groundMesh) this.groundMesh.material.color.setHex(t.ground);
      this.hemi.color.setHex(t.hemi[0]); this.hemi.groundColor.setHex(t.hemi[1]); this.hemi.intensity = t.hemi[2];
      this.sun.color.setHex(t.sun[0]); this.sun.intensity = t.sun[1]; this.sun.position.set(...t.sun[2]);
      this.fill.color.setHex(t.fill[0]); this.fill.intensity = t.fill[1]; this.fill.position.set(...t.fill[2]);
      this.el.classList.toggle('p3d-studio', name === 'studio');
    }

    // ---------- colour-by (spec B2) ----------
    _lineColor(l) {
      if (l.new) return NEW_SCOPE;
      if (this.colorBy === 'class') return CLASS_COLORS[(l.cls || '').toUpperCase()] || CLASS_UNKNOWN;
      if (this.colorBy === 'service') return (SERVICE[l.service] ? SERVICE[l.service].color : 0x4b5563);
      if (this.colorBy === 'size') {
        const s = l.size_in || 0;
        return SIZE_RAMP[s < 3 ? 0 : s <= 8 ? 1 : s <= 14 ? 2 : 3];
      }
      // 'finding'
      const f = this.data.findings.find((x) => x.ref === l.id);
      return f ? (PIN[f.kind] || PIN.query) : 0x5f6f86;
    }
    setColorBy(mode) {
      this.colorBy = mode;
      (this._lineMeshes || []).forEach((rec) => {
        const c = new this.T.Color(this._lineColor(rec.line));
        rec.meshes.forEach((m) => { if (m.material && m.material.color) m.material.color.copy(c); });
      });
    }
    setClassVisible(cls, on) {
      (this._lineMeshes || []).forEach((rec) => {
        if ((rec.line.cls || '').toUpperCase() === cls) rec.grp.visible = on;
      });
    }

    // ---------- build ----------
    _build() {
      const T = this.T, d = this.data, R = this.root;
      const b = d.bounds; this.center = new T.Vector3((b.min[0] + b.max[0]) / 2, 4, (b.min[2] + b.max[2]) / 2);
      this.span = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2], 20);
      const tm = THEMES[this.theme];
      // ground
      const g = new T.Mesh(new T.PlaneGeometry(this.span * 3, this.span * 3), new T.MeshStandardMaterial({ color: tm.ground, roughness: 1, metalness: 0 }));
      g.rotation.x = -Math.PI / 2; g.position.set(this.center.x, 0, this.center.z); g.receiveShadow = true; R.add(g);
      this.groundMesh = g;
      this.grid = new T.GridHelper(80, 40, tm.gridCenter, tm.gridLines);
      this.grid.material.transparent = true; this.grid.material.opacity = tm.gridOpacity;
      this.grid.position.set(this.center.x, 0.01, this.center.z); R.add(this.grid);
      this.el.classList.toggle('p3d-studio', this.theme === 'studio');
      this._rack(); this._pipes(); this._valves(); this._equipment(); this._connectors();
      this._labels = this._makeLabels(); this._pins = this._makePins();
    }
    _rack() {
      const T = this.T, hs = this.data.lines.filter((l) => l.path.length === 2 && Math.abs(l.path[0][1] - l.path[1][1]) < 0.01 && Math.abs(l.path[0][2] - l.path[1][2]) < 0.01 && l.path[0][1] > 5);
      if (!hs.length) return;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y = 0;
      hs.forEach((l) => l.path.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); y = Math.max(y, p[1]); }));
      const grp = new T.Group(); grp.userData.layer = 'rack'; const steel = this._mat(0x9aa7b6, { metalness: 0.55, roughness: 0.55 });
      const beamY = y - 0.65, zA = z0 - 1, zB = z1 + 1;
      for (let x = x0; x <= x1 + 0.1; x += 6) {
        [zA, zB].forEach((z) => { const c = new T.Mesh(new T.BoxGeometry(0.3, beamY, 0.3), steel); c.position.set(x, beamY / 2, z); c.castShadow = true; grp.add(c); });
        const bm = new T.Mesh(new T.BoxGeometry(0.3, 0.35, zB - zA), steel); bm.position.set(x, beamY, (zA + zB) / 2); bm.castShadow = true; grp.add(bm);
        const bm2 = bm.clone(); bm2.position.y = beamY * 0.55; grp.add(bm2);
      }
      [zA, zB].forEach((z) => { const s = new T.Mesh(new T.BoxGeometry(x1 - x0, 0.25, 0.25), steel); s.position.set((x0 + x1) / 2, beamY, z); grp.add(s); });
      this.rack = grp; this.root.add(grp);
    }
    _radius(sizeIn) { return Math.max(0.07, sizeIn * 0.0254 * 1.1); } // display scale (spec B2)
    _pipes() {
      const T = this.T;
      this._lineMeshes = [];
      this.data.lines.forEach((l) => {
        const grp = new T.Group(); grp.userData = { kind: 'line', ref: l.id, svc: l.service, data: l };
        const mat = this._mat(this._lineColor(l));
        const r = this._radius(l.size_in);
        const rec = { line: l, grp, meshes: [] };
        for (let i = 0; i < l.path.length - 1; i++) {
          const a = new T.Vector3(...l.path[i]), b = new T.Vector3(...l.path[i + 1]); const len = a.distanceTo(b); if (len < 0.01) continue;
          const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 20, 1), mat);
          m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          m.castShadow = true; m.receiveShadow = true; m.userData = grp.userData; grp.add(m); this.pick.push(m); rec.meshes.push(m);
        }
        l.path.forEach((p, i) => { // elbows / ends
          const s = new T.Mesh(new T.SphereGeometry(r * (i === 0 || i === l.path.length - 1 ? 1.0 : 1.12), 20, 14), mat);
          s.position.set(...p); s.castShadow = true; s.userData = grp.userData; grp.add(s); this.pick.push(s); rec.meshes.push(s);
        });
        this.root.add(grp); (this.meshesByRef[l.id] = this.meshesByRef[l.id] || []).push(grp);
        this._lineMeshes.push(rec);
      });
    }
    _valves() {
      const T = this.T, body = this._mat(0x334155, { metalness: 0.6, roughness: 0.35 }), wheel = this._mat(0xc2283a, { metalness: 0.3, roughness: 0.5 });
      this.valveGrp = new T.Group(); this.valveGrp.userData.layer = 'valves';
      this.data.valves.forEach((v) => {
        const g = new T.Group(); g.userData = { kind: 'valve', ref: v.id, data: v };
        const s = Math.max(0.28, this._radius(v.size_in) * 1.5);
        const c1 = new T.Mesh(new T.ConeGeometry(s, s * 1.3, 18), body); c1.position.y = s * 0.65; c1.rotation.z = Math.PI;
        const c2 = new T.Mesh(new T.ConeGeometry(s, s * 1.3, 18), body); c2.position.y = -s * 0.65;
        const stem = new T.Mesh(new T.CylinderGeometry(s * 0.12, s * 0.12, s * 1.6, 8), body); stem.rotation.z = Math.PI / 2; stem.position.x = s * 0.8;
        const hw = new T.Mesh(new T.TorusGeometry(s * 0.6, s * 0.09, 8, 24), wheel); hw.rotation.y = Math.PI / 2; hw.position.x = s * 1.6;
        [c1, c2, stem, hw].forEach((m) => { m.castShadow = true; m.userData = g.userData; g.add(m); this.pick.push(m); });
        g.position.set(...v.pos);
        if (v.axis === 'x') g.rotation.z = Math.PI / 2; else if (v.axis === 'z') g.rotation.x = Math.PI / 2;
        this.valveGrp.add(g); (this.meshesByRef[v.id] = this.meshesByRef[v.id] || []).push(g);
      });
      this.root.add(this.valveGrp);
    }
    _equipment() {
      const T = this.T; this.eqGrp = new T.Group(); this.eqGrp.userData.layer = 'equipment';
      this.data.equipment.forEach((e) => {
        const g = new T.Group(); g.userData = { kind: 'equipment', ref: e.id, data: e };
        const ghost = !!e.ghost;
        // Ghosts (referenced, not drawn): translucent solid + outline only.
        // Real equipment: solid light grey (spec B3).
        const col = ghost ? 0x8cb4ff : (e.kind === 'furnace' ? 0xc9d2de : 0xD6DEE8);
        const mat = this._mat(col, ghost
          ? { transparent: true, opacity: 0.18, depthWrite: false }
          : (e.kind === 'furnace' ? { transparent: true, opacity: 0.55, depthWrite: false, metalness: 0.15, roughness: 0.8 } : {}));
        const [sx, sy, sz] = e.size; let meshes = [];
        if (e.kind === 'exchanger') {
          const shell = new T.Mesh(new T.CylinderGeometry(sy / 2, sy / 2, sx, 28), mat); shell.rotation.z = Math.PI / 2; meshes.push(shell);
          [-1, 1].forEach((k) => { const h = new T.Mesh(new T.SphereGeometry(sy / 2, 24, 16), mat); h.scale.set(0.45, 1, 1); h.position.x = k * sx / 2; meshes.push(h);
            const sad = new T.Mesh(new T.BoxGeometry(0.3, sy * 0.6, sy * 0.9), mat); sad.position.set(k * sx * 0.3, -sy * 0.55, 0); meshes.push(sad); });
        } else if (e.kind === 'column') {
          const sh = new T.Mesh(new T.CylinderGeometry(sx / 2, sx / 2, sy, 28), mat); meshes.push(sh);
          const top = new T.Mesh(new T.SphereGeometry(sx / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); top.position.y = sy / 2; meshes.push(top);
        } else if (e.kind === 'pump') {
          const base = new T.Mesh(new T.BoxGeometry(sx, 0.25, sz), mat); base.position.y = -sy / 2 + 0.12; meshes.push(base);
          const cas = new T.Mesh(new T.CylinderGeometry(sy * 0.38, sy * 0.38, sz * 0.5, 22), mat); cas.rotation.x = Math.PI / 2; cas.position.set(-sx * 0.28, 0, 0); meshes.push(cas);
          const mot = new T.Mesh(new T.CylinderGeometry(sy * 0.3, sy * 0.3, sx * 0.5, 22), mat); mot.rotation.z = Math.PI / 2; mot.position.set(sx * 0.2, -0.05, 0); meshes.push(mot);
        } else {
          meshes.push(new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat));
          if (e.kind === 'furnace') { const roof = new T.Mesh(new T.BoxGeometry(sx * 0.3, 3, sz * 0.5), this._mat(0x9aa7b6)); roof.position.y = sy / 2 + 1.5; meshes.push(roof);
            const stack = new T.Mesh(new T.CylinderGeometry(0.9, 1.1, 10, 20), this._mat(0x9aa7b6)); stack.position.y = sy / 2 + 8; meshes.push(stack); }
        }
        meshes.forEach((m) => { m.castShadow = !ghost && e.kind !== 'furnace'; m.receiveShadow = true; m.userData = g.userData; g.add(m); this.pick.push(m);
          const edges = new T.LineSegments(
            new T.EdgesGeometry(m.geometry, 30),
            new T.LineBasicMaterial({ color: ghost ? 0x8cb4ff : 0x64748b, transparent: true, opacity: ghost ? 0.55 : 0.35 }),
          );
          edges.position.copy(m.position); edges.rotation.copy(m.rotation); edges.scale.copy(m.scale); g.add(edges); });
        g.position.set(...e.center); g.position.y = e.kind === 'furnace' ? sy / 2 : Math.max(e.center[1], sy / 2);
        this.eqGrp.add(g); (this.meshesByRef[e.id] = this.meshesByRef[e.id] || []).push(g);
      });
      this.root.add(this.eqGrp);
    }
    _connectors() {
      const T = this.T, mat = this._mat(0x1d5bea, { metalness: 0.2, roughness: 0.5 });
      this.data.connectors.forEach((c) => { const m = new T.Mesh(new T.ConeGeometry(0.45, 1.1, 18), mat); m.rotation.z = -Math.PI / 2; m.position.set(c.pos[0] - 0.8, c.pos[1], c.pos[2]); this.root.add(m); });
    }

    // ---------- labels & pins (screen-space, collision-aware) ----------
    _makeLabels() {
      const L = [];
      // Tag only — "referenced, not drawn on this sheet" stays in the
      // tooltip, never on the canvas (spec B3).
      this.data.equipment.forEach((e) => L.push({ text: e.tag, pos: [e.center[0], (e.kind === 'furnace' ? e.size[1] : Math.max(e.center[1], e.size[1] / 2) + e.size[1] / 2) + 1.2, e.center[2]], cls: 'eq' + (e.ghost ? ' ghost' : ''), pri: 1 }));
      this.data.connectors.forEach((c) => L.push({ text: c.label + '  ←  ' + c.ref, pos: [c.pos[0] - 1.6, c.pos[1], c.pos[2]], cls: 'conn', pri: 2, alignRight: true }));
      this.data.lines.forEach((l) => { if (l.line_no && !/^Unlabelled/.test(l.line_no) && l.path.length) { const a = l.path[0], b = l.path[l.path.length - 1]; const mid = l.path.length === 3 ? l.path[1] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        L.push({ text: l.line_no, pos: [mid[0], mid[1] + this._radius(l.size_in) + 0.5, mid[2]], cls: 'line' + (l.new ? ' new' : ''), pri: 3, ref: l.id, size: l.size_in || 0 }); } });
      L.forEach((x) => { x.el = document.createElement('div'); x.el.className = 'p3d-lbl ' + x.cls; x.el.textContent = x.text; this.overlay.appendChild(x.el); });
      return L;
    }
    _makePins() {
      // Finding callouts (spec B5): ring + dot at the anchor, a 2 px leader
      // to a card — number chip (red error / amber query), title, kind·rule.
      return this.data.findings.filter((f) => f.anchor).map((f) => {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'p3d-callout';
        el.setAttribute('aria-label', 'Finding F' + f.n + ': ' + (f.title || ''));
        const chipCol = f.kind === 'error' ? PIN.error : f.kind === 'minor' ? PIN.minor : PIN.query;
        const kindLabel = f.kind === 'error' ? 'Error' : f.kind === 'minor' ? 'Minor' : 'Query';
        el.innerHTML = '';
        const chip = document.createElement('span'); chip.className = 'p3d-chipnum'; chip.style.background = chipCol; chip.textContent = 'F' + f.n;
        const txt = document.createElement('span'); txt.className = 'p3d-callout-text';
        const t1 = document.createElement('span'); t1.className = 'p3d-callout-title'; t1.textContent = f.title || '';
        const t2 = document.createElement('span'); t2.className = 'p3d-callout-sub'; t2.textContent = kindLabel + (f.rule ? ' · ' + f.rule : '');
        txt.appendChild(t1); txt.appendChild(t2);
        el.appendChild(chip); el.appendChild(txt);
        el.addEventListener('click', (e) => { e.stopPropagation(); this.selectFinding(f.id, true); this.opts.onSelect && this.opts.onSelect({ type: 'finding', id: f.id }); });
        const lead = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); lead.setAttribute('class', 'p3d-lead');
        lead.innerHTML = '<line/><circle r="7" class="ring"/><circle class="dot" r="2.2"/>';
        this.overlay.appendChild(lead); this.overlay.appendChild(el);
        return { f, el, lead };
      });
    }
    _project(p) {
      const v = new this.T.Vector3(...p).project(this.camera); const w = this.el.clientWidth, h = this.el.clientHeight;
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, vis: v.z < 1 && v.z > -1 };
    }
    _layout() {
      const w = this.el.clientWidth, h = this.el.clientHeight, occ = [];
      const hit = (r) => occ.some((o) => r[0] < o[0] + o[2] && r[0] + r[2] > o[0] && r[1] < o[1] + o[3] && r[1] + r[3] > o[1]);
      const OFF = [[44, -48], [-44, -48], [58, 0], [-58, 0], [44, 48], [-44, 48], [80, -84], [-80, -84]];
      const CARD_W = 190, CARD_H = 46;
      this._pins.forEach((p) => {
        const show = this.layers.findings; const s = this._project(p.f.anchor);
        if (!show || !s.vis) { p.el.hidden = true; p.lead.style.display = 'none'; return; }
        let best = OFF[0]; for (const d of OFF) { const x = s.x + d[0], y = s.y + d[1]; if (x < 18 || x > w - 18 || y < 18 || y > h - 18) continue; if (!hit([x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H])) { best = d; break; } }
        let px = s.x + best[0], py = s.y + best[1];
        // Flip the card back inside the canvas when it would leave it.
        px = Math.max(CARD_W / 2 + 4, Math.min(w - CARD_W / 2 - 4, px));
        py = Math.max(CARD_H / 2 + 4, Math.min(h - CARD_H / 2 - 4, py));
        occ.push([px - CARD_W / 2, py - CARD_H / 2, CARD_W, CARD_H]);
        const sel = this.selected === p.f.id; const col = sel ? PIN.selected : (PIN[p.f.kind] || PIN.query);
        p.el.hidden = false;
        p.el.style.left = (px - CARD_W / 2) + 'px'; p.el.style.top = (py - CARD_H / 2) + 'px';
        p.el.classList.toggle('sel', sel);
        p.el.style.opacity = this.selected == null || sel ? '' : '0.25';
        const ang = Math.atan2(py - s.y, px - s.x);
        p.lead.style.display = ''; p.lead.style.left = '0px'; p.lead.style.top = '0px'; p.lead.setAttribute('width', w); p.lead.setAttribute('height', h);
        const [ln, ring, dot] = p.lead.children;
        ln.setAttribute('x1', s.x + Math.cos(ang) * 8); ln.setAttribute('y1', s.y + Math.sin(ang) * 8);
        ln.setAttribute('x2', px - Math.cos(ang) * (CARD_W / 2)); ln.setAttribute('y2', py - Math.sin(ang) * (CARD_H / 2));
        ln.setAttribute('stroke', sel ? PIN.selected : '#0B1B3A'); ln.setAttribute('stroke-width', 2);
        ring.setAttribute('cx', s.x); ring.setAttribute('cy', s.y); ring.setAttribute('fill', 'rgba(255,255,255,.85)'); ring.setAttribute('stroke', col); ring.setAttribute('stroke-width', 2.2);
        ring.setAttribute('class', 'ring' + (sel ? ' pulse' : ''));
        dot.setAttribute('cx', s.x); dot.setAttribute('cy', s.y); dot.setAttribute('fill', col);
      });
      // Labels: equipment tags + finding callouts are always on; line
      // labels are opt-in, collision-avoided, capped at 25 (priority:
      // selected line first, then larger size — spec B4).
      const MAX_LINE_LABELS = 25;
      let lineShown = 0;
      const order = this._labels.slice().sort((a, b) => {
        if (a.pri !== b.pri) return a.pri - b.pri;
        const aSel = a.ref && (this._selRefs || []).includes(a.ref) ? 1 : 0;
        const bSel = b.ref && (this._selRefs || []).includes(b.ref) ? 1 : 0;
        if (aSel !== bSel) return bSel - aSel;
        return (b.size || 0) - (a.size || 0);
      });
      order.forEach((l) => {
        const isLine = l.pri === 3;
        if (isLine && !this.layers.labels) { l.el.hidden = true; return; }
        if (!this.layers.labels && l.cls !== 'eq' && l.cls !== 'eq ghost' && !isLine) { l.el.hidden = true; return; }
        if (l.ref && this.layers.labels && this.selected && !(this._selRefs || []).includes(l.ref) && isLine && !this._showAllLineLabels) { l.el.hidden = true; return; }
        const s = this._project(l.pos); if (!s.vis) { l.el.hidden = true; return; }
        const tw = l.text.length * 6.3 + 10, th = 18; const x = l.alignRight ? s.x - tw : s.x - tw / 2, y = s.y - th / 2;
        if (x < 2 || y < 2 || x + tw > w - 2 || y + th > h - 2 || hit([x, y, tw, th])) { l.el.hidden = true; return; }
        if (isLine) {
          if (lineShown >= MAX_LINE_LABELS) { l.el.hidden = true; return; }
          lineShown += 1;
        }
        occ.push([x, y, tw, th]); l.el.hidden = false; l.el.style.left = x + 'px'; l.el.style.top = y + 'px';
      });
    }

    // ---------- interaction ----------
    _hit(e) {
      const r = this.renderer.domElement.getBoundingClientRect(); this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.camera);
      const vis = this.pick.filter((m) => { let o = m; while (o) { if (o.visible === false) return false; o = o.parent; } return true; });
      const hits = this.ray.intersectObjects(vis, false).filter((h) => !this.clip || this.clip.distanceToPoint(h.point) >= 0);
      return hits[0] || null;
    }
    _hover(e) {
      const h = this._hit(e); this._setHover(h ? h.object.userData : null);
      if (h) { const d = h.object.userData; const r = this.el.getBoundingClientRect(); this.tip.hidden = false; this.tip.innerHTML = this._tipHtml(d);
        let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if (x + 300 > r.width) x -= 320; if (y + 140 > r.height) y -= 150; this.tip.style.left = x + 'px'; this.tip.style.top = y + 'px';
        this.renderer.domElement.style.cursor = 'pointer'; } else { this.tip.hidden = true; this.renderer.domElement.style.cursor = ''; }
    }
    _tipHtml(d) {
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      if (d.kind === 'line') { const l = d.data; return `<b>${esc(l.line_no)}</b><span>${esc(SERVICE[l.service] ? SERVICE[l.service].label : '')}${l.size_in ? ' · ' + (Math.round(l.size_in * 10) / 10) + '"' : ''}</span>${l.cls_desc ? `<span>${esc(l.cls)} · ${esc(l.cls_desc)}</span>` : ''}${l.cases && l.cases.length ? `<span>${esc(l.cases.join(' · '))}</span>` : ''}`; }
      if (d.kind === 'valve') return `<b>Valve</b><span>On ${esc((this.data.lines.find((l) => l.id === d.data.line_id) || {}).line_no || '')}</span>`;
      if (d.kind === 'equipment') return `<b>${esc(d.data.tag)}</b><span>${esc(d.data.kind)}${d.data.ghost ? ' · ' + esc(d.data.note || 'not on this sheet') : ''}</span>`;
      return '';
    }
    _setHover(ud) {
      const ref = ud ? ud.ref : null; if (ref === this.hovered) return;
      if (this.hovered) this._tint(this.hovered, null); this.hovered = ref;
      if (ref && !(this._selRefs || []).includes(ref)) this._tint(ref, 0x2a5bd7, 0.35);
      this.opts.onHover && this.opts.onHover(ud ? { kind: ud.kind, id: ref } : null);
    }
    _tint(ref, color, k = 0.6) {
      (this.meshesByRef[ref] || []).forEach((g) => g.traverse((m) => { if (!m.isMesh) return;
        if (!m.userData._mat) { m.userData._mat = m.material; m.material = m.material.clone(); m.material.clippingPlanes = m.userData._mat.clippingPlanes; }
        if (color == null) { m.material.dispose(); m.material = m.userData._mat; delete m.userData._mat; return; }
        m.material.emissive = new this.T.Color(color); m.material.emissiveIntensity = k; }));
    }
    _click(e) {
      const h = this._hit(e); const ud = h ? h.object.userData : null;
      if (!ud) { this.select(null); this.opts.onSelect && this.opts.onSelect(null); return; }
      const f = this.data.findings.find((x) => x.ref === ud.ref);
      this.select(ud.ref, f ? f.id : null);
      this.opts.onSelect && this.opts.onSelect({ type: ud.kind, id: ud.ref, finding: f ? f.id : null, data: ud.data });
    }
    select(ref, findingId = null) {
      (this._selRefs || []).forEach((r) => this._tint(r, null)); this._selRefs = ref ? [ref] : []; this.selected = findingId;
      if (ref) this._tint(ref, 0x0a5ef5, 0.75);
    }
    selectFinding(id, fly = true) {
      const f = this.data.findings.find((x) => x.id === id); if (!f) return;
      this.select(f.ref || null, f.id);
      if (fly && f.anchor) this.focusOn(new this.T.Vector3(...f.anchor), 22);
    }
    focusOn(p, dist = 18) {
      const T = this.T, target = p.clone ? p.clone() : new T.Vector3(...p);
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this._anim(target, target.clone().add(dir.multiplyScalar(dist)), this.camera.isOrthographicCamera ? 28 : null);
    }

    // ---------- views ----------
    setView(name) {
      const T = this.T, c = this.center.clone(), D = this.span * 1.55;
      const dirs = { iso: [1, 0.85, 1], iso2: [-1, 0.85, 1], top: [0, 1, 0.0001], front: [0, 0.18, 1], right: [1, 0.18, 0], back: [0, 0.3, -1] };
      const d = new T.Vector3(...(dirs[name] || dirs.iso)).normalize();
      this._anim(c, c.clone().add(d.multiplyScalar(D)), this.span * 1.0);
    }
    setProjection(kind) {
      const T = this.T, from = this.camera, to = kind === 'iso' ? this.ortho : this.persp; if (from === to) return;
      to.position.copy(from.position); to.up.set(0, 1, 0);
      if (to.isOrthographicCamera) { const dist = from.position.distanceTo(this.controls.target); this._orthoH = 2 * dist * Math.tan(T.MathUtils.degToRad(this.persp.fov / 2)); this.ortho.zoom = 1; }
      this.camera = to; const tgt = this.controls.target.clone(); this.controls.dispose();
      this.controls = new this.OC(this.camera, this.renderer.domElement); this._tuneControls(); this.controls.target.copy(tgt); this._resize(); this.controls.update();
      if (kind === 'iso') this.setView('iso');
    }
    fit(animate = true) {
      const c = this.center.clone(), d = new this.T.Vector3(1, 0.85, 1).normalize().multiplyScalar(this.span * 1.55);
      if (animate) this._anim(c, c.clone().add(d), this.span * 1.0); else { this.controls.target.copy(c); this.camera.position.copy(c.clone().add(d)); this._orthoH = this.span * 1.0; this._resize(); this.controls.update(); }
    }
    zoom(k) { if (this.camera.isOrthographicCamera) { this.camera.zoom = Math.min(20, Math.max(0.2, this.camera.zoom * k)); this.camera.updateProjectionMatrix(); } else { const t = this.controls.target, p = this.camera.position; p.copy(t.clone().add(p.clone().sub(t).multiplyScalar(1 / k))); } }
    _anim(target, pos, orthoH) {
      const t0 = performance.now(), dur = 650, sT = this.controls.target.clone(), sP = this.camera.position.clone(), sH = this._orthoH || orthoH || 60, sZ = this.camera.zoom || 1;
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      this._tween = (now) => { const k = Math.min(1, (now - t0) / dur), e = ease(k);
        this.controls.target.lerpVectors(sT, target, e); this.camera.position.lerpVectors(sP, pos, e);
        if (this.camera.isOrthographicCamera && orthoH) { this._orthoH = sH + (orthoH - sH) * e; this.camera.zoom = sZ + (1 - sZ) * e; this._resize(); }
        if (k >= 1) this._tween = null; };
    }

    // ---------- layers & section ----------
    setLayer(name, on) {
      this.layers[name] = on;
      if (name === 'rack' && this.rack) this.rack.visible = on;
      if (name === 'equipment') this.eqGrp.visible = on;
      if (name === 'valves') this.valveGrp.visible = on;
      if (name === 'grid') this.grid.visible = on;
    }
    setService(svc, on) { this.services[svc] = on; this.root.children.forEach((g) => { if (g.userData && g.userData.kind === 'line' && g.userData.svc === svc) g.visible = on; }); }
    setSection(f) { // 0 = off, 0..1 cuts from +X side
      const b = this.data.bounds; if (!f) { this.clip = null; } else { const x = b.max[0] - (b.max[0] - b.min[0]) * f; this.clip = new this.T.Plane(new this.T.Vector3(-1, 0, 0), x); }
      (this._mats || []).forEach((m) => { m.clippingPlanes = this.clip ? [this.clip] : []; m.needsUpdate = true; });
      this.root.traverse((o) => { if (o.isMesh && o.userData._mat) { o.material.clippingPlanes = this.clip ? [this.clip] : []; o.material.needsUpdate = true; } });
    }
    azimuth() { const v = this.camera.position.clone().sub(this.controls.target); return Math.atan2(v.x, v.z); }

    // 2D → 3D lift (spec B6): flat → full height, top view → isometric,
    // blueprint blue → class colours, 1.2 s. Skipped for reduced motion.
    playLift() {
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const T = this.T, grp = this.root;
      const mats = (this._mats || []).filter((m) => m.color);
      const targets = mats.map((m) => m.color.clone());
      const blue = new T.Color(BLUEPRINT);
      grp.scale.y = 0.002;
      const endT = this.controls.target.clone();
      const startT = endT.clone();
      const startP = this.center.clone().add(new T.Vector3(0, this.span * 1.8, 0.001));
      const endP = this.center.clone().add(new T.Vector3(1, 0.85, 1).normalize().multiplyScalar(this.span * 1.55));
      const t0 = performance.now(), dur = 1200;
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      this._tween = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = ease(k);
        grp.scale.y = 0.002 + 0.998 * e;
        this.controls.target.lerpVectors(startT, endT, e);
        this.camera.position.lerpVectors(startP, endP, e);
        mats.forEach((m, i) => m.color.copy(blue).lerp(targets[i], e));
        if (k >= 1) this._tween = null;
      };
    }

    // ---------- loop ----------
    _loop() {
      const tick = (now) => { this._raf = requestAnimationFrame(tick); if (this._tween) this._tween(now); this.controls.update(); this.renderer.render(this.scene, this.camera); this._layout();
        if (this.opts.onFrame) this.opts.onFrame(this); };
      this._raf = requestAnimationFrame(tick);
    }
    dispose() { cancelAnimationFrame(this._raf); root.removeEventListener('resize', this._onResize); if (this._ro) this._ro.disconnect(); this.controls.dispose(); this.renderer.dispose(); this.el.innerHTML = ''; }
  }
  PidScene3D.SERVICE = SERVICE;
  PidScene3D.CLASS_COLORS = CLASS_COLORS;
  PidScene3D.CLASS_UNKNOWN = CLASS_UNKNOWN;
  PidScene3D.NEW_SCOPE = NEW_SCOPE;
  PidScene3D.SIZE_RAMP = SIZE_RAMP;
  root.PidScene3D = PidScene3D;
})(typeof window !== 'undefined' ? window : globalThis);

export default (typeof window !== 'undefined' ? window : globalThis).PidScene3D;
