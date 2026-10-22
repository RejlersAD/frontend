// ============================================================================
// CLL store — project-scoped. Users create/select a project BEFORE accessing
// the Critical Line List; every project keeps its own files, upload history,
// resolutions and legends (localStorage, keyed by project id).
// ============================================================================
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { matchFiles, diffRevisions, buildDiscrepancies } from './cllFiles';
import { generateStressRecords, DEFAULT_LEGENDS } from './criticalityEngine';

const CllCtx = createContext(null);
export const useCll = () => useContext(CllCtx);

const LS_KEY = 'radai.cll.v3';
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; } };
const EMPTY_DATA = { files: { lineList: null, stress: null }, history: [], resolved: {}, legends: DEFAULT_LEGENDS };

export function CllProvider({ children }) {
  const persisted = useMemo(load, []);
  const [projects, setProjects] = useState(persisted?.projects || []);
  const [activeId, setActiveId] = useState(persisted?.activeId || null);
  const [dataByProject, setDataByProject] = useState(persisted?.data || {});
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ projects, activeId, data: dataByProject }));
  }, [projects, activeId, dataByProject]);

  const activeProject = projects.find(p => p.id === activeId) || null;
  const data = (activeId && dataByProject[activeId]) || EMPTY_DATA;
  const { files, history, resolved, legends } = data;

  const patchData = (fn) => {
    if (!activeId) return;
    setDataByProject(prev => ({ ...prev, [activeId]: fn(prev[activeId] || EMPTY_DATA) }));
  };

  // --- project management ---
  const createProject = ({ name, unit, client, description }) => {
    const id = `prj-${Date.now()}`;
    setProjects(prev => [...prev, {
      id, name, unit, client, description,
      createdAt: new Date().toISOString(), createdBy: 'current.user',
    }]);
    setActiveId(id);
    return id;
  };
  const selectProject = (id) => { setActiveId(id); setUploadDrawerOpen(false); };
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

  /** Commit an uploaded/validated file (from the drawer) as a new revision. */
  const commitFile = (kind, fileInfo) => {
    patchData(prev => {
      const old = prev.files[kind];
      const revision = old ? old.revision + 1 : 1;
      const diff = old
        ? diffRevisions(old.records, fileInfo.records)
        : { added: fileInfo.records, removed: [], changed: [] };
      const entry = {
        at: new Date().toISOString(), by: 'current.user', kind,
        fileName: fileInfo.name, revision,
        added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length,
        detail: diff,
      };
      return {
        ...prev,
        files: { ...prev.files, [kind]: { ...fileInfo, revision } },
        history: [entry, ...prev.history],
      };
    });
  };

  const resolveDiscrepancy = (id, resolution) =>
    patchData(prev => ({
      ...prev,
      resolved: { ...prev.resolved, [id]: { ...resolution, at: new Date().toISOString(), by: 'current.user' } },
    }));

  const setLegends = (updater) =>
    patchData(prev => ({ ...prev, legends: typeof updater === 'function' ? updater(prev.legends) : updater }));

  const value = {
    projects, activeProject, createProject, selectProject, exitProject,
    files, match, discrepancies, history, resolved, legends, setLegends, generated,
    commitFile, resolveDiscrepancy,
    uploadDrawerOpen, setUploadDrawerOpen,
  };

  return <CllCtx.Provider value={value}>{children}</CllCtx.Provider>;
}
