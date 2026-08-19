/**
 * Pump Hydraulic — History Panel (slide-over)
 * ===========================================
 * A right-side drawer that lists snapshots grouped by project. Lets the
 * user load, re-download, or delete any past document.
 *
 * Soft-coded:
 *   • Pulls metadata fields from `HISTORY_META_FIELDS` — extending
 *     metadata is a one-line change in the history config.
 *   • Source-badge palette is module-level — no inline magic.
 *   • Uses the existing exporter for the "Download" action so the
 *     user gets the same .xlsx artifact for any snapshot.
 *
 * No backend calls — pure client-side state.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  X, History as HistoryIcon, Download, Upload, Trash2, FolderOpen,
  Sparkles, User, Save as SaveIcon, Search, AlertCircle, Cloud, HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  listProjects, listSnapshots, loadSnapshot, deleteSnapshot, deleteProject,
  HISTORY_EVENT, SNAPSHOT_SOURCES, HISTORY_META_FIELDS,
} from '../../config/pumpHydraulicHistory';
import {
  cloudListSnapshots, cloudListProjects, isCloudAvailable,
} from '../../config/pumpHydraulicHistoryCloud';
import exportPumpHydraulicWorkbook from '../../config/pumpHydraulicExporter';
import { STORAGE_KEY as FORM_STORAGE_KEY } from '../../config/pumpHydraulicTemplate.config';
import { REFRESH_EVENT } from '../../config/pumpHydraulicAIMapper';

// ─── Soft-coded UI constants ─────────────────────────────────────────────
const SOURCE_BADGES = {
  [SNAPSHOT_SOURCES.AI_EXTRACTION]: { label: 'AI Extracted', icon: Sparkles, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  [SNAPSHOT_SOURCES.MANUAL]:        { label: 'Manual Save',  icon: User,     color: 'bg-blue-100 text-blue-800 border-blue-200'   },
  [SNAPSHOT_SOURCES.AUTO]:          { label: 'Auto Save',    icon: SaveIcon, color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
};

// ──────────────────────────────────────────────────────────────────────────
const PumpHydraulicHistoryPanel = ({ open, onClose, onAfterLoad }) => {
  const [tick, setTick]               = useState(0); // re-render trigger
  const [activeProject, setActive]    = useState(null); // null = "All projects"
  const [filter, setFilter]           = useState('');
  const [confirm, setConfirm]         = useState(null); // { type, id|key }
  // Cloud mode — when ON, the panel shows snapshots from the Postgres
  // (Railway) backend instead of localStorage. Soft-coded default: cloud
  // when authenticated, local otherwise.
  const cloudOk = isCloudAvailable();
  const [mode, setMode]               = useState(cloudOk ? 'cloud' : 'local');
  const [cloudSnapshots, setCloudSnapshots] = useState([]);
  const [cloudProjects,  setCloudProjects]  = useState([]);
  const [cloudLoading,   setCloudLoading]   = useState(false);
  const [cloudError,     setCloudError]     = useState('');

  // Refresh whenever history mutates anywhere in the app.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(HISTORY_EVENT, bump);
    const onStorage = (e) => { if (e.key === FORM_STORAGE_KEY || e.key === null) bump(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(HISTORY_EVENT, bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Cloud fetch — runs on open / mode toggle / project change / tick.
  useEffect(() => {
    if (!open || mode !== 'cloud') return;
    let cancelled = false;
    setCloudLoading(true);
    setCloudError('');
    Promise.all([
      cloudListSnapshots(activeProject ? { projectKey: activeProject } : {}),
      cloudListProjects(),
    ])
      .then(([snaps, projs]) => {
        if (cancelled) return;
        setCloudSnapshots(snaps);
        setCloudProjects(projs);
      })
      .catch((err) => {
        if (cancelled) return;
        setCloudError(err?.response?.data?.detail || err?.message || 'Cloud fetch failed');
      })
      .finally(() => { if (!cancelled) setCloudLoading(false); });
    return () => { cancelled = true; };
  }, [open, mode, activeProject, tick]);

  const projects  = useMemo(
    () => (mode === 'cloud' ? cloudProjects : listProjects()),
    [mode, cloudProjects, tick],
  );
  const snapshots = useMemo(
    () => (mode === 'cloud'
      ? cloudSnapshots
      : listSnapshots(activeProject ? { projectKey: activeProject } : {})),
    [mode, cloudSnapshots, tick, activeProject],
  );

  const filtered = useMemo(() => {
    if (!filter.trim()) return snapshots;
    const q = filter.trim().toLowerCase();
    return snapshots.filter((s) => {
      if ((s.label || '').toLowerCase().includes(q))      return true;
      if ((s.projectKey || '').toLowerCase().includes(q)) return true;
      for (const { key } of HISTORY_META_FIELDS) {
        if (String(s.meta?.[key] ?? '').toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [snapshots, filter]);

  if (!open) return null;

  const handleLoad = (id) => {
    if (mode === 'cloud') {
      const snap = cloudSnapshots.find((s) => s.id === id);
      if (!snap) return;
      try {
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(snap.formState || {}));
        window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: { source: 'cloud', id } }));
        window.dispatchEvent(new StorageEvent('storage', { key: FORM_STORAGE_KEY }));
      } catch { /* no-op */ }
      onAfterLoad?.(id);
      onClose?.();
      return;
    }
    if (loadSnapshot(id)) {
      onAfterLoad?.(id);
      onClose?.();
    }
  };

  const handleDownload = (snap) => {
    // Temporarily swap form state, export, then restore current state.
    const current = localStorage.getItem(FORM_STORAGE_KEY);
    try {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(snap.formState || {}));
      const safeName = (snap.meta?.pump_tag_no || snap.meta?.job_no || snap.projectKey || 'Pump_Hydraulic')
        .replace(/[\\/*?:[\]\s]+/g, '_');
      exportPumpHydraulicWorkbook(`${safeName}_${snap.id}.xlsx`);
    } finally {
      if (current !== null) localStorage.setItem(FORM_STORAGE_KEY, current);
      else localStorage.removeItem(FORM_STORAGE_KEY);
    }
  };

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.type === 'snapshot') deleteSnapshot(confirm.id);
    else if (confirm.type === 'project') deleteProject(confirm.key);
    setConfirm(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close history"
        onClick={onClose}
        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
      />
      {/* Drawer */}
      <aside className="w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5" />
            <h2 className="text-lg font-bold">Document History</h2>
            <span className="text-xs opacity-80 ml-2">Per-project snapshot archive</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Cloud / Local toggle */}
            <div className="inline-flex bg-white/15 rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => cloudOk && setMode('cloud')}
                disabled={!cloudOk}
                className={`px-2.5 py-1.5 inline-flex items-center gap-1 transition-colors ${
                  mode === 'cloud' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/15 disabled:opacity-50'
                }`}
                title={cloudOk ? 'Show snapshots stored in the cloud database' : 'Sign in to enable cloud sync'}
              >
                <Cloud className="w-3.5 h-3.5" /> Cloud
              </button>
              <button
                onClick={() => setMode('local')}
                className={`px-2.5 py-1.5 inline-flex items-center gap-1 transition-colors ${
                  mode === 'local' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/15'
                }`}
                title="Show snapshots stored on this device"
              >
                <HardDrive className="w-3.5 h-3.5" /> Local
              </button>
            </div>
            {mode === 'cloud' && (
              <button
                onClick={() => setTick((n) => n + 1)}
                className="p-1.5 hover:bg-white/15 rounded transition-colors"
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${cloudLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/15 rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mode === 'cloud' && cloudError && (
          <div className="px-5 py-2 text-xs bg-rose-50 border-b border-rose-200 text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> {cloudError}
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by project, pump tag, label, calc no…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Project sidebar */}
          <div className="w-60 border-r border-slate-200 overflow-y-auto bg-slate-50">
            <button
              onClick={() => setActive(null)}
              className={`w-full text-left px-4 py-3 text-sm border-b border-slate-200 transition-colors ${
                activeProject === null ? 'bg-blue-50 text-blue-800 font-semibold' : 'hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                All Projects
                <span className="ml-auto text-xs bg-slate-200 text-slate-700 rounded-full px-2 py-0.5">
                  {snapshots.length || projects.reduce((n, p) => n + p.count, 0)}
                </span>
              </div>
            </button>
            {projects.length === 0 && (
              <div className="px-4 py-6 text-xs text-slate-500 italic text-center">
                No projects yet. Save a snapshot to get started.
              </div>
            )}
            {projects.map((p) => (
              <button
                key={p.projectKey}
                onClick={() => setActive(p.projectKey)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-slate-200 transition-colors group ${
                  activeProject === p.projectKey ? 'bg-blue-50 text-blue-800 font-semibold' : 'hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1" title={p.projectKey}>{p.projectKey}</span>
                  <span className="text-xs bg-slate-200 text-slate-700 rounded-full px-2 py-0.5">
                    {p.count}
                  </span>
                </div>
                {p.meta?.client_name && (
                  <div className="text-[11px] text-slate-500 mt-1 truncate pl-6">
                    {p.meta.client_name}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Snapshot list */}
          <div className="flex-1 overflow-y-auto">
            {activeProject && (
              <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700 truncate">
                  Project: <span className="text-blue-700">{activeProject}</span>
                </div>
                <button
                  onClick={() => setConfirm({ type: 'project', key: activeProject })}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete project
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <HistoryIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                {filter ? 'No snapshots match your search.' : 'No snapshots yet for this view.'}
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {filtered.map((s) => {
                  const badge = SOURCE_BADGES[s.source] || SOURCE_BADGES[SNAPSHOT_SOURCES.MANUAL];
                  const Badge = badge.icon;
                  return (
                    <li key={s.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border rounded-full ${badge.color}`}>
                              <Badge className="w-3 h-3" /> {badge.label}
                            </span>
                            <span className="text-xs text-slate-500">{formatTime(s.savedAt)}</span>
                          </div>
                          <div className="mt-1.5 text-sm font-semibold text-slate-900 truncate">
                            {s.label || s.meta?.pump_tag_no || s.projectKey}
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-600">
                            {HISTORY_META_FIELDS.map(({ key, label }) => {
                              const v = s.meta?.[key];
                              if (!v) return null;
                              return (
                                <div key={key} className="truncate">
                                  <span className="text-slate-400">{label}:</span>{' '}
                                  <span className="text-slate-700">{v}</span>
                                </div>
                              );
                            })}
                          </div>
                          {s.context?.total ? (
                            <div className="mt-1 text-[11px] text-amber-700">
                              {s.context.total} pump(s){s.context.drawing_ref ? ` from ${s.context.drawing_ref}` : ''}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleLoad(s.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                            title="Restore this snapshot into the active form"
                          >
                            <Upload className="w-3.5 h-3.5" /> Load
                          </button>
                          <button
                            onClick={() => handleDownload(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                            title="Download the .xlsx for this snapshot"
                          >
                            <Download className="w-3.5 h-3.5" /> Excel
                          </button>
                          <button
                            onClick={() => setConfirm({ type: 'snapshot', id: s.id })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Confirm dialog */}
        {confirm && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center p-6">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">Confirm deletion</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {confirm.type === 'project'
                      ? `Delete every snapshot for "${confirm.key}"? This cannot be undone.`
                      : 'Delete this snapshot? This cannot be undone.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={doConfirm}
                  className="px-3 py-1.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default PumpHydraulicHistoryPanel;
