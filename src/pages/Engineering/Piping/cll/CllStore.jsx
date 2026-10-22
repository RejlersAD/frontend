// ============================================================================
// CLL store — project-scoped. Users create/select a project BEFORE accessing
// the Critical Line List; every project keeps its own files, upload history,
// resolutions and legends.
//
// Persistence: server-backed (apps/critical_line_list) with localStorage as
// offline cache/fallback. Projects carry a `storage` choice:
//   'database' | 's3'  → synced to the backend (payload in DB or S3)
//   'local'            → this browser only
// Server projects have `serverId`. Failed syncs mark the project `_unsynced`
// and are retried on the next save. All storage/network calls are wrapped in
// try/catch — a failed sync must never crash the app.
// ============================================================================
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { matchFiles, diffRevisions, buildDiscrepancies } from './cllFiles';
import { generateStressRecords, DEFAULT_LEGENDS } from './criticalityEngine';
import cllApi from './cllApi';

const CllCtx = createContext(null);
export const useCll = () => useContext(CllCtx);

const LS_KEY = 'radai.cll.v3';
const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || null;
    // Normalise: quota-trimmed payloads may have records/detail stripped.
    if (raw?.data) {
      for (const d of Object.values(raw.data)) {
        for (const k of Object.keys(d.files || {})) {
          if (d.files[k] && !Array.isArray(d.files[k].records)) d.files[k].records = [];
        }
        if (Array.isArray(d.history)) d.history = d.history.map(h => ({ ...h, detail: h.detail ?? null }));
      }
    }
    return raw;
  } catch { return null; }
};
const EMPTY_DATA = { files: { lineList: null, stress: null }, history: [], resolved: {}, legends: DEFAULT_LEGENDS, lastRunAt: null };

// localStorage quota is ~5 MB; a real Process Line List can exceed it.
// Try the full payload, then progressively strip diff details, then raw records.
const save = (state) => {
  const attempts = [
    state,
    {
      ...state,
      data: Object.fromEntries(Object.entries(state.data).map(([pid, d]) => [pid, {
        ...d,
        history: (d.history || []).map(h => ({ ...h, detail: null })),
      }])),
    },
    {
      ...state,
      data: Object.fromEntries(Object.entries(state.data).map(([pid, d]) => [pid, {
        ...d,
        files: Object.fromEntries(Object.entries(d.files || {}).map(([k, f]) => [k, f ? { ...f, records: [], recordsTrimmed: true } : f])),
        history: (d.history || []).map(h => ({ ...h, detail: null })),
      }])),
    },
  ];
  for (const candidate of attempts) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(candidate)); return; } catch { /* try slimmer */ }
  }
};

// Map a server project (snake_case) to the store's shape (camelCase + serverId).
const fromServer = (sp) => ({
  id: `srv-${sp.id}`,
  serverId: sp.id,
  name: sp.name,
  unit: sp.unit,
  client: sp.client || '',
  description: sp.description || '',
  storage: sp.storage || 'database',
  createdAt: sp.created_at,
  updatedAt: sp.updated_at,
  summary: sp.summary || null,
});

const toServer = (p) => ({
  name: p.name, unit: p.unit, client: p.client || '', description: p.description || '',
  storage: p.storage === 'local' ? 'database' : p.storage,
});

const DATA_SYNC_DEBOUNCE_MS = 1500;

export function CllProvider({ children }) {
  const persisted = useMemo(load, []);
  const [projects, setProjects] = useState(persisted?.projects || []);
  const [activeId, setActiveId] = useState(persisted?.activeId || null);
  const [dataByProject, setDataByProject] = useState(persisted?.data || {});
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  // Which file the upload drawer is targeting ('processLineList' | 'stressCriticality')
  const [drawerFileKind, setDrawerFileKind] = useState('processLineList');
  // Top-right toast (upload feedback, etc.)
  const [toast, setToast] = useState(null);
  const showToast = (t) => {
    setToast({ ...t, id: Date.now() });
    setTimeout(() => setToast(cur => (cur && cur.title === t.title ? null : cur)), 5200);
  };

  const syncTimer = useRef(null);
  const retrying = useRef(new Set());
  // Latest state for async callbacks (avoids stale closures).
  const stateRef = useRef({ projects, activeId, dataByProject });
  stateRef.current = { projects, activeId, dataByProject };

  // --- initial hydration: merge server projects with purely-local ones ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await cllApi.listProjects();
        if (cancelled || !Array.isArray(list)) return;
        setProjects(prev => {
          const locals = prev.filter(p => !p.serverId);
          return [...locals, ...list.map(fromServer)];
        });
      } catch { /* offline — keep working from localStorage */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- persist locally + sync to server ---
  useEffect(() => {
    save({ projects, activeId, data: dataByProject });

    // Retry unsynced project headers (create/update/delete all collapse to an
    // upsert here; soft-deleted local-only leftovers need no server call).
    for (const p of projects) {
      if (!p._unsynced || p.storage === 'local' || retrying.current.has(p.id)) continue;
      retrying.current.add(p.id);
      const req = p.serverId
        ? cllApi.updateProject(p.serverId, toServer(p))
        : cllApi.createProject(toServer(p));
      req.then(sp => {
        setProjects(prev => prev.map(x => x.id === p.id
          ? { ...x, ...(!x.serverId ? fromServer(sp) : {}), _unsynced: false }
          : x));
        if (!p.serverId && sp?.id) remapProjectId(p.id, `srv-${sp.id}`);
      }).catch(() => { /* stays _unsynced; retried on next save */ })
        .finally(() => retrying.current.delete(p.id));
    }

    // Debounced payload sync for the active server project.
    const proj = projects.find(p => p.id === activeId);
    if (proj?.serverId && dataByProject[activeId]) {
      clearTimeout(syncTimer.current);
      const payload = dataByProject[activeId];
      const serverId = proj.serverId;
      const projId = proj.id;
      syncTimer.current = setTimeout(() => {
        cllApi.putProjectData(serverId, payload).catch(err => {
          if (err?.response?.status === 503) {
            // S3 not configured — inform and keep this project local-only.
            showToast({
              title: 'S3 storage is not configured — saved locally',
              detail: 'The project data was kept in this browser instead.',
            });
            setProjects(prev => prev.map(p => p.id === projId ? { ...p, storage: 'local' } : p));
          }
          /* other failures: localStorage copy already saved */
        });
      }, DATA_SYNC_DEBOUNCE_MS);
    }
    return () => clearTimeout(syncTimer.current);
  }, [projects, activeId, dataByProject]);

  // Re-key a project id everywhere (after a server id is assigned).
  const remapProjectId = (oldId, newId) => {
    if (oldId === newId) return;
    setProjects(prev => prev.map(p => p.id === oldId ? { ...p, id: newId } : p));
    setDataByProject(prev => {
      if (!(oldId in prev)) return prev;
      const { [oldId]: d, ...rest } = prev;
      return { ...rest, [newId]: d };
    });
    setActiveId(cur => (cur === oldId ? newId : cur));
  };

  const activeProject = projects.find(p => p.id === activeId) || null;
  const data = (activeId && dataByProject[activeId]) || EMPTY_DATA;
  const { files, history, resolved, legends, lastRunAt } = data;

  const patchData = (fn) => {
    if (!activeId) return;
    setDataByProject(prev => ({ ...prev, [activeId]: fn(prev[activeId] || EMPTY_DATA) }));
  };

  // --- project management ---
  const createProject = ({ name, unit, client, description, storage = 'database' }) => {
    const id = `prj-${Date.now()}`;
    setProjects(prev => [...prev, {
      id, name, unit, client, description, storage,
      createdAt: new Date().toISOString(), createdBy: 'current.user',
    }]);
    setActiveId(id);
    if (storage !== 'local') {
      cllApi.createProject(toServer({ name, unit, client, description, storage }))
        .then(sp => {
          setProjects(prev => prev.map(p => p.id === id ? fromServer(sp) : p));
          remapProjectId(id, `srv-${sp.id}`);
        })
        .catch(() => setProjects(prev => prev.map(p => p.id === id ? { ...p, _unsynced: true } : p)));
    }
    return id;
  };

  const updateProject = (id, fields) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...fields } : p)));
    const proj = stateRef.current.projects.find(p => p.id === id);
    if (proj?.serverId) {
      cllApi.updateProject(proj.serverId, toServer({ ...proj, ...fields }))
        .catch(() => setProjects(prev => prev.map(p => p.id === id ? { ...p, _unsynced: true } : p)));
    }
  };

  const deleteProject = (id) => {
    const proj = stateRef.current.projects.find(p => p.id === id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setDataByProject(prev => { const { [id]: _d, ...rest } = prev; return rest; });
    if (activeId === id) setActiveId(null);
    if (proj?.serverId) cllApi.deleteProject(proj.serverId).catch(() => {});
  };

  const selectProject = (id) => {
    setActiveId(id);
    setUploadDrawerOpen(false);
    const proj = projects.find(p => p.id === id);
    if (proj?.serverId) {
      cllApi.getProjectData(proj.serverId)
        .then(res => {
          if (res?.payload) {
            setDataByProject(prev => ({ ...prev, [id]: { ...EMPTY_DATA, ...res.payload } }));
          }
        })
        .catch(() => { /* offline — local cache stays */ });
    }
  };
  const exitProject = () => setActiveId(null);

  // --- RADAI auto-classification (Table 7.1 + Sec. 7.3) ---
  const generated = useMemo(
    () => (files.lineList ? generateStressRecords(files.lineList.records, legends) : []),
    [files.lineList, legends]);

  const generatedByKey = useMemo(
    () => new Map(generated.map(g => [String(g.line_number).trim().toUpperCase().replace(/["″']/g, '').replace(/[\s_.–—\/]+/g, '-').replace(/-+/g, '-'), g])),
    [generated]);

  const match = useMemo(() => {
    if (!files.lineList) return null;
    const CANON = ['L1', 'L2', 'L3', 'Non-critical'];
    const stressRecs = files.stress?.records || generated;
    const m = matchFiles(files.lineList.records, stressRecs);
    m.lines = m.lines.map(l => {
      const gen = generatedByKey.get(l._key);
      const fileCat = files.stress && CANON.includes(l.stress_category) ? l.stress_category : null;
      const genCat = gen?.stress_category || null;
      const effective = fileCat || genCat || 'Not assessed';
      return {
        ...l,
        stress_category: effective,
        file_category: fileCat,
        generated_category: genCat,
        category_source: fileCat ? 'file' : genCat ? 'generated' : 'none',
        category_mismatch: !!(fileCat && genCat && fileCat !== genCat),
        criteria_basis: l.criteria_basis || gen?.criteria_basis,
        analysis_method: l.analysis_method || gen?.analysis_method,
        responsible_engineer: l.responsible_engineer || gen?.responsible_engineer,
        _generated: gen?._generated || null,
      };
    });
    m.summary.categoryMismatches = m.lines.filter(l => l.category_mismatch).length;
    return m;
  }, [files, generated, generatedByKey]);

  const discrepancies = useMemo(() => buildDiscrepancies(match, resolved), [match, resolved]);

  /** Commit an uploaded/validated file (from the drawer) as a new revision.
   *  opts.analysed === false records a pending "analysis not run" history
   *  entry and leaves lastRunAt untouched (→ state becomes 'outdated'). */
  const commitFile = (kind, fileInfo, opts = { analysed: true }) => {
    patchData(prev => {
      const old = prev.files[kind];
      const revision = old ? old.revision + 1 : 1;
      const diff = old
        ? diffRevisions(old.records, fileInfo.records)
        : { added: fileInfo.records, removed: [], changed: [] };
      const at = new Date().toISOString();
      const entry = {
        at, by: 'current.user', kind,
        fileName: fileInfo.name, revision,
        added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length,
        detail: {
          added: diff.added.slice(0, 200),
          removed: diff.removed.slice(0, 200),
          changed: diff.changed.slice(0, 200),
          truncated: diff.added.length > 200 || diff.removed.length > 200 || diff.changed.length > 200,
        },
      };
      const extra = opts.analysed === false
        ? [{ at, by: 'current.user', kind: 'pending', fileName: fileInfo.name, revision,
             added: 0, removed: 0, changed: 0, detail: null, notAnalysed: true }]
        : [];
      return {
        ...prev,
        files: { ...prev.files, [kind]: { ...fileInfo, revision } },
        history: [...extra, entry, ...prev.history],
        lastRunAt: opts.analysed === false ? prev.lastRunAt || null : at,
      };
    });
  };

  /** Mark the analysis as (re)run now — clears the 'outdated' state. */
  const markAnalysed = () =>
    patchData(prev => ({ ...prev, lastRunAt: new Date().toISOString() }));

  const resolveDiscrepancy = (id, resolution) =>
    patchData(prev => ({
      ...prev,
      resolved: { ...prev.resolved, [id]: { ...resolution, at: new Date().toISOString(), by: 'current.user' } },
    }));

  const setLegends = (updater) =>
    patchData(prev => ({ ...prev, legends: typeof updater === 'function' ? updater(prev.legends) : updater }));

  const value = {
    projects, activeProject, createProject, updateProject, deleteProject, selectProject, exitProject,
    files, match, discrepancies, history, resolved, legends, setLegends, generated,
    commitFile, resolveDiscrepancy, lastRunAt, markAnalysed,
    uploadDrawerOpen, setUploadDrawerOpen, drawerFileKind, setDrawerFileKind,
    toast, showToast,
  };

  return <CllCtx.Provider value={value}>{children}</CllCtx.Provider>;
}
