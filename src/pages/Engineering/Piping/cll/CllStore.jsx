// ============================================================================
// CLL store — project-scoped. Every project keeps its own files (Process Line
// List LDT + stress-criticality criteria), the active CriteriaTable, upload
// history, review-item resolutions and per-line category overrides.
//
// Categories are CALCULATED per line (criticalityEngine.evaluateAll) from the
// project criteria grid — there is no per-line criticality file anymore.
//
// Projects carry a required `locationType` ('onshore' | 'offshore'):
//   onshore  → built-in AGPS-SP-PI-004 Rev 01 Table 2 attached at creation
//   offshore → no criteria; analysis blocked until a table is uploaded
//   null     → legacy project; opening it shows the blocking location modal
//
// Role stub (§1): the app has no role context yet — ROLE defaults to
// 'Engineer' and, for now, Engineer IS allowed to set/change the project
// location (spec allows Lead/Admin; marked here so the stub is easy to
// tighten once roles exist).
//
// Persistence: server-backed (apps/critical_line_list) with localStorage as
// offline cache/fallback; same sync strategy as before.
// ============================================================================
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { diffRevisions } from './cllFiles';
import { BUILTIN_ONSHORE, evaluateAll, buildReviewItems } from './criticalityEngine';
import cllApi from './cllApi';

// Role stub — see header comment. TODO(roles): wire to the real role context.
export const ROLE = 'Engineer';
export const CAN_SET_LOCATION = true; // Engineer treated as allowed for now

const CllCtx = createContext(null);
export const useCll = () => useContext(CllCtx);

const LS_KEY = 'radai.cll.v4';
const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || null;
    if (raw?.data) {
      for (const d of Object.values(raw.data)) {
        for (const k of Object.keys(d.files || {})) {
          if (d.files[k] && !Array.isArray(d.files[k].records ?? [])) delete d.files[k].records;
        }
        if (Array.isArray(d.history)) d.history = d.history.map(h => ({ ...h, detail: h.detail ?? null }));
      }
    }
    return raw;
  } catch { return null; }
};
const EMPTY_DATA = {
  files: { lineList: null, criteriaFile: null },
  criteria: null,
  criteriaHistory: [],
  history: [],
  resolved: {},
  overrides: {},
  lastRunAt: null,
  pendingReRun: false,
};

// localStorage quota is ~5 MB; strip heavy pieces progressively on save.
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

const fromServer = (sp) => ({
  id: `srv-${sp.id}`,
  serverId: sp.id,
  name: sp.name,
  unit: sp.unit,
  client: sp.client || '',
  description: sp.description || '',
  storage: sp.storage || 'database',
  locationType: sp.location_type ?? null,
  createdAt: sp.created_at,
  updatedAt: sp.updated_at,
  summary: sp.summary || null,
});

const toServer = (p) => ({
  name: p.name, unit: p.unit, client: p.client || '', description: p.description || '',
  storage: p.storage === 'local' ? 'database' : p.storage,
  location_type: p.locationType ?? null,
});

const DATA_SYNC_DEBOUNCE_MS = 1500;

export function CllProvider({ children }) {
  const persisted = useMemo(load, []);
  const [projects, setProjects] = useState(persisted?.projects || []);
  const [activeId, setActiveId] = useState(persisted?.activeId || null);
  const [dataByProject, setDataByProject] = useState(persisted?.data || {});
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  // Which file the upload drawer targets: 'processLineList' | 'stressCriteria'
  const [drawerFileKind, setDrawerFileKind] = useState('processLineList');
  const [toast, setToast] = useState(null);
  const showToast = (t) => {
    setToast({ ...t, id: Date.now() });
    setTimeout(() => setToast(cur => (cur && cur.title === t.title ? null : cur)), 5200);
  };

  const syncTimer = useRef(null);
  const retrying = useRef(new Set());
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

    const proj = projects.find(p => p.id === activeId);
    if (proj?.serverId && dataByProject[activeId]) {
      clearTimeout(syncTimer.current);
      const payload = dataByProject[activeId];
      const serverId = proj.serverId;
      const projId = proj.id;
      syncTimer.current = setTimeout(() => {
        cllApi.putProjectData(serverId, payload).catch(err => {
          if (err?.response?.status === 503) {
            showToast({
              title: 'S3 storage is not configured — saved locally',
              detail: 'The project data was kept in this browser instead.',
            });
            setProjects(prev => prev.map(p => p.id === projId ? { ...p, storage: 'local' } : p));
          }
        });
      }, DATA_SYNC_DEBOUNCE_MS);
    }
    return () => clearTimeout(syncTimer.current);
  }, [projects, activeId, dataByProject]);

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
  const data = (activeId && { ...EMPTY_DATA, ...dataByProject[activeId] }) || EMPTY_DATA;
  const { files, criteria, criteriaHistory, history, resolved, overrides, lastRunAt, pendingReRun } = data;

  const patchData = (fn) => {
    if (!activeId) return;
    setDataByProject(prev => ({ ...prev, [activeId]: fn({ ...EMPTY_DATA, ...prev[activeId] }) }));
  };

  // --- project management ---
  const createProject = ({ name, unit, client, description, storage = 'database', locationType }) => {
    const id = `prj-${Date.now()}`;
    setProjects(prev => [...prev, {
      id, name, unit, client, description, storage, locationType: locationType ?? null,
      createdAt: new Date().toISOString(), createdBy: 'current.user',
    }]);
    setActiveId(id);
    if (locationType === 'onshore') {
      // Built-in AGPS-SP-PI-004 Rev 01 Table 2 attached at project creation.
      const at = new Date().toISOString();
      setDataByProject(prev => ({
        ...prev,
        [id]: {
          ...EMPTY_DATA,
          criteria: BUILTIN_ONSHORE,
          criteriaHistory: [{ at, table: BUILTIN_ONSHORE, note: 'Built-in criteria attached' }],
          history: [
            { at, by: 'current.user', kind: 'location', title: 'Project location set to Onshore', detail: null },
            { at, by: 'system', kind: 'criteria', title: 'Built-in criteria attached', detail: 'Built-in · AGPS-SP-PI-004 Rev 01 · Table 2 (Onshore)' },
          ],
        },
      }));
    } else if (locationType === 'offshore') {
      setDataByProject(prev => ({
        ...prev,
        [id]: {
          ...EMPTY_DATA,
          history: [{ at: new Date().toISOString(), by: 'current.user', kind: 'location', title: 'Project location set to Offshore', detail: 'Criteria: upload the offshore criteria table' }],
        },
      }));
    }
    if (storage !== 'local') {
      cllApi.createProject(toServer({ name, unit, client, description, storage, locationType }))
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

  // --- project location (§1) ------------------------------------------------
  /** Set or change the project location. On change, the criteria for all
   *  lines is replaced (overrides kept) and the analysis becomes outdated. */
  const setLocationType = (locationType) => {
    if (!activeProject) return;
    const changing = !!activeProject.locationType && activeProject.locationType !== locationType;
    updateProject(activeProject.id, { locationType });
    patchData(prev => {
      const at = new Date().toISOString();
      const entries = [{
        at, by: 'current.user', kind: 'location',
        title: `Project location set to ${locationType === 'onshore' ? 'Onshore' : 'Offshore'}`,
        detail: changing ? 'Criteria replaced for all lines — overrides kept; re-run the analysis' : null,
      }];
      let nextCriteria = prev.criteria;
      let nextCriteriaHistory = prev.criteriaHistory || [];
      if (locationType === 'onshore' && (!prev.criteria || prev.criteria.locationType !== 'onshore' || changing)) {
        nextCriteria = BUILTIN_ONSHORE;
        nextCriteriaHistory = [...nextCriteriaHistory, { at, table: BUILTIN_ONSHORE, note: 'Built-in criteria attached' }];
        entries.push({ at, by: 'system', kind: 'criteria', title: 'Built-in criteria attached', detail: 'Built-in · AGPS-SP-PI-004 Rev 01 · Table 2 (Onshore)' });
      }
      if (locationType === 'offshore') {
        nextCriteria = prev.criteria?.locationType === 'offshore' ? prev.criteria : null;
      }
      return {
        ...prev,
        criteria: nextCriteria,
        criteriaHistory: nextCriteriaHistory,
        history: [...entries, ...prev.history],
        pendingReRun: changing ? true : prev.pendingReRun,
      };
    });
  };

  // --- evaluation (replaces matching) ----------------------------------------
  const evaluation = useMemo(() => {
    if (!files.lineList || !criteria) return null;
    return evaluateAll(files.lineList.records || [], criteria, overrides);
  }, [files.lineList, criteria, overrides]);

  const reviewItems = useMemo(
    () => buildReviewItems(evaluation?.evaluations || [], resolved, overrides),
    [evaluation, resolved, overrides]);

  // --- file commits -----------------------------------------------------------
  /** Commit the uploaded LDT as a new revision. */
  const commitLineList = (fileInfo, opts = { analysed: true }) => {
    patchData(prev => {
      const old = prev.files.lineList;
      const revision = old ? old.revision + 1 : 1;
      const diff = old && Array.isArray(old.records) && old.records.length
        ? diffRevisions(old.records, fileInfo.records)
        : { added: fileInfo.records, removed: [], changed: [] };
      const at = new Date().toISOString();
      const entry = {
        at, by: 'current.user', kind: 'lineList',
        fileName: fileInfo.name, revision,
        added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length,
        detail: {
          added: diff.added.slice(0, 200),
          removed: diff.removed.slice(0, 200),
          changed: diff.changed.slice(0, 200),
          truncated: diff.added.length > 200 || diff.removed.length > 200 || diff.changed.length > 200,
        },
      };
      return {
        ...prev,
        files: { ...prev.files, lineList: { ...fileInfo, revision } },
        history: [entry, ...prev.history],
        lastRunAt: opts.analysed === false ? prev.lastRunAt || null : at,
      };
    });
  };

  /** Commit an uploaded criteria table as a new revision (replaces the
   *  current criteria; history keeps both). */
  const commitCriteria = (fileInfo, table) => {
    patchData(prev => {
      const old = prev.files.criteriaFile;
      const revision = old ? old.revision + 1 : 1;
      const at = new Date().toISOString();
      const revTable = { ...table, source: table.source || 'upload' };
      return {
        ...prev,
        files: { ...prev.files, criteriaFile: { ...fileInfo, revision } },
        criteria: revTable,
        criteriaHistory: [...(prev.criteriaHistory || []), { at, table: revTable, note: `Uploaded ${fileInfo.name} (Rev ${revision})` }],
        history: [{
          at, by: 'current.user', kind: 'criteria',
          title: `Criteria table uploaded — ${table.standard || 'criteria'} Rev ${table.revision || '—'}`,
          detail: `${fileInfo.name} · replaces ${prev.criteria?.source === 'builtin' ? 'built-in table' : `Rev ${old?.revision ?? '—'}`}`,
        }, ...prev.history],
        lastRunAt: at,
        pendingReRun: false,
      };
    });
  };

  const markAnalysed = () =>
    patchData(prev => ({ ...prev, lastRunAt: new Date().toISOString(), pendingReRun: false }));

  const resolveItem = (id, resolution) =>
    patchData(prev => ({
      ...prev,
      resolved: { ...prev.resolved, [id]: { ...resolution, at: new Date().toISOString(), by: 'current.user' } },
    }));

  /** Engineer override to L1/L2/L3 (reason mandatory). Downgrade from a table
   *  L1 is marked pending Lead Stress Engineer approval (route marker). */
  const setOverride = (lineNumber, category, reason, approver) => {
    const ev = evaluation?.evaluations.find(e => e.lineNumber === lineNumber);
    const pendingApproval = !!(ev && ev.tableCategory === 'L1' && category !== 'L1' && !approver);
    patchData(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [lineNumber]: {
          lineNumber, category, reason,
          approver: approver || null,
          pendingApproval,
          at: new Date().toISOString(), by: 'current.user',
        },
      },
    }));
  };

  const clearOverride = (lineNumber) =>
    patchData(prev => {
      const { [lineNumber]: _o, ...rest } = prev.overrides;
      return { ...prev, overrides: rest };
    });

  const value = {
    projects, activeProject, createProject, updateProject, deleteProject, selectProject, exitProject,
    files, criteria, criteriaHistory, evaluation, reviewItems, history, resolved, overrides,
    commitLineList, commitCriteria, resolveItem, setOverride, clearOverride,
    setLocationType,
    lastRunAt, pendingReRun, markAnalysed,
    uploadDrawerOpen, setUploadDrawerOpen, drawerFileKind, setDrawerFileKind,
    toast, showToast,
    role: ROLE, canSetLocation: CAN_SET_LOCATION,
  };

  return <CllCtx.Provider value={value}>{children}</CllCtx.Provider>;
}
