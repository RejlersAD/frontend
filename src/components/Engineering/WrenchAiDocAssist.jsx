/**
 * WrenchAiDocAssist — reusable "AI Document Assist (Wrench)" panel.
 * ==================================================================
 * Mirrors the panel used on /engineering/process/pid-verification but is
 * fully soft-coded so any engineering page can drop it in:
 *
 *   <WrenchAiDocAssist
 *      title="AI Document Assist"
 *      subtitle="Let RAD AI pick the right Valve MTO from Wrench DMS"
 *      defaultHint="valve mto material take off"
 *      acceptedExts={['pdf','xls','xlsx','csv']}
 *      onFileSelected={(file) => importFile(file)}
 *   />
 *
 * Backend contract (unchanged — re-uses existing endpoints):
 *   GET /wrench/sync/projects/
 *   GET /wrench/sync/pid-recommendations/
 *   GET /wrench/sync/document-download/?idoc_id=...&doc_no=...
 *
 * No core logic is touched in the host page; the panel calls onFileSelected
 * with a `File` instance built from the Wrench download blob and the host
 * page feeds that into its existing import flow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Sparkles, Brain, Loader, Download, AlertTriangle,
  ChevronDown, ChevronUp, FolderTree, X as XIcon,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api.config';

// ───── Soft-coded defaults (override any of these via props) ─────────────
const DEFAULTS = {
  endpointProjects:    '/wrench/sync/projects/',
  endpointRecommend:   '/wrench/sync/pid-recommendations/',
  endpointFolders:     '/wrench/sync/project-folders/',
  timeoutFoldersMs:    60000,
  foldersMinForSearch: 8,
  foldersListMaxH:     '180px',
  topN:                5,
  minHighlightScore:   80,
  acceptedExts:        ['pdf', 'xls', 'xlsx', 'csv'],
  // LocalStorage cache for the Wrench project list (shared across pages by key).
  lsKey:               'radai.wrench.projects.v1',
  lsTtlMs:             24 * 60 * 60 * 1000,   // hard expiry — 24 h
  lsFreshMs:           30 * 60 * 1000,        // background revalidate after 30 m
  minForSearch:        10,
  timeoutProjectsMs:   120000,
  timeoutRecommendMs:  60000,
  timeoutDownloadMs:   120000,
  brandGradient:       'linear-gradient(135deg,#6366f1,#a855f7)',
};

const _authHeader = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const _readLS = (lsKey, ttlMs) => {
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.projects)) return null;
    if (Date.now() - parsed.ts > ttlMs) return null;
    return parsed;
  } catch { return null; }
};

const _writeLS = (lsKey, payload) => {
  try {
    localStorage.setItem(lsKey, JSON.stringify({
      ts:       Date.now(),
      projects: payload?.projects || [],
      total:              payload?.total || 0,
      transmittal_count:  payload?.transmittal_count || 0,
      fetched_at_server:  payload?.fetched_at || null,
    }));
  } catch { /* ignore quota errors */ }
};

const WrenchAiDocAssist = ({
  // Display
  title       = 'AI Document Assist',
  subtitleTag = '(Wrench · optional)',
  subtitle    = 'Let RAD AI pick & recommend the right document for this project from Wrench DMS',
  defaultHint = '',
  hintPlaceholder = 'e.g. valve mto, gate valve, material take off',
  // Behaviour
  projectName  = '',
  initialOpen  = false,
  acceptedExts = DEFAULTS.acceptedExts,
  topN         = DEFAULTS.topN,
  // Callbacks
  onFileSelected,
  onError,
  // Overrides (rarely needed)
  endpointProjects  = DEFAULTS.endpointProjects,
  endpointRecommend = DEFAULTS.endpointRecommend,
  endpointFolders   = DEFAULTS.endpointFolders,
  lsKey             = DEFAULTS.lsKey,
}) => {
  const [open,         setOpen]         = useState(initialOpen);
  const [orderNo,      setOrderNo]      = useState('');
  const [hint,         setHint]         = useState(defaultHint);
  const [loading,      setLoading]      = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [result,       setResult]       = useState(null);
  const [fetchingDoc,  setFetchingDoc]  = useState(null);

  const [projects,         setProjects]         = useState([]);
  const [projectsLoading,  setProjectsLoading]  = useState(false);
  const [projectsSyncing,  setProjectsSyncing]  = useState(false);
  const [projectsError,    setProjectsError]    = useState('');
  const [projectsLoaded,   setProjectsLoaded]   = useState(false);
  const [projectFilter,    setProjectFilter]    = useState('');
  const [projectsFetched,  setProjectsFetched]  = useState(0);

  // ── Sub-folder picker state (additive, soft-coded) ────────────────
  const [folders,         setFolders]         = useState([]);   // [{path, segments, count, file_exts[]}]
  const [foldersOrderNo,  setFoldersOrderNo]  = useState('');
  const [foldersLoading,  setFoldersLoading]  = useState(false);
  const [foldersError,    setFoldersError]    = useState('');
  const [selectedFolders, setSelectedFolders] = useState([]);   // string[] of folder paths
  const [folderFilter,    setFolderFilter]    = useState('');

  const acceptList = useMemo(
    () => acceptedExts.map((e) => e.toLowerCase().replace(/^\./, '')),
    [acceptedExts],
  );

  // ── Load Wrench projects (cache-first) ────────────────────────────────
  const loadProjects = useCallback(async ({ force = false } = {}) => {
    let hadLocalSnapshot = false;
    if (!force && !projectsLoaded) {
      const snap = _readLS(lsKey, DEFAULTS.lsTtlMs);
      if (snap && snap.projects.length) {
        setProjects(snap.projects);
        setProjectsFetched(snap.ts);
        setProjectsLoaded(true);
        hadLocalSnapshot = true;
        if (Date.now() - snap.ts < DEFAULTS.lsFreshMs) return;
      }
    }
    if (projectsLoading || projectsSyncing) return;
    if (hadLocalSnapshot || projectsLoaded) setProjectsSyncing(true);
    else                                    setProjectsLoading(true);
    setProjectsError('');
    try {
      const res = await axios.get(`${API_BASE_URL}${endpointProjects}`, {
        params:  force ? { refresh: 1 } : {},
        headers: _authHeader(),
        timeout: DEFAULTS.timeoutProjectsMs,
      });
      const data = res.data || {};
      const list = Array.isArray(data.projects) ? data.projects : [];
      setProjects(list);
      setProjectsLoaded(true);
      setProjectsFetched(Date.now());
      _writeLS(lsKey, data);
    } catch (err) {
      setProjectsError(err?.response?.data?.detail || err?.message || 'Failed to load Wrench projects.');
    } finally {
      setProjectsLoading(false);
      setProjectsSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointProjects, lsKey, projectsLoaded, projectsLoading, projectsSyncing]);

  // Auto-load when the panel is opened for the first time.
  useEffect(() => {
    if (open && !projectsLoaded && !projectsLoading) loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Load sub-folders for the resolved project (cache by order_no) ──────
  const loadFolders = useCallback(async (ord, projName) => {
    const key = (ord || '').trim() || (projName || '').trim();
    if (!key) return;
    if (foldersLoading) return;
    if (foldersOrderNo === key && folders.length) return;   // already cached
    setFoldersLoading(true);
    setFoldersError('');
    try {
      const res = await axios.get(`${API_BASE_URL}${endpointFolders}`, {
        params: {
          ...(ord      ? { order_no:     ord }      : {}),
          ...(projName ? { project_name: projName } : {}),
        },
        headers: _authHeader(),
        timeout: DEFAULTS.timeoutFoldersMs,
      });
      const list = Array.isArray(res.data?.folders) ? res.data.folders : [];
      setFolders(list);
      setFoldersOrderNo(key);
      // Reset previous selections when project changes.
      setSelectedFolders([]);
    } catch (err) {
      setFolders([]);
      setFoldersError(err?.response?.data?.detail || err?.message || 'Failed to load sub-folders.');
    } finally {
      setFoldersLoading(false);
    }
  }, [endpointFolders, folders.length, foldersLoading, foldersOrderNo]);

  // Auto-fetch folders when the user picks an order_no, or when projectName
  // is provided (auto-resolved on the backend).
  useEffect(() => {
    if (!open) return;
    const ord  = (orderNo || '').trim();
    const proj = (projectName || '').trim();
    if (!ord && !proj) return;
    loadFolders(ord, proj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderNo, projectName]);

  const toggleFolder = useCallback((path) => {
    setSelectedFolders((prev) => prev.includes(path)
      ? prev.filter((p) => p !== path)
      : [...prev, path]);
  }, []);
  const clearFolders = useCallback(() => setSelectedFolders([]), []);

  // ── Ask the backend for ranked recommendations ────────────────────────
  const runRecommend = useCallback(async () => {
    const ord  = (orderNo    || '').trim();
    const proj = (projectName || '').trim();
    if (!ord && !proj) {
      setErrorMsg('Select a Project Number or open a RAD AI project first.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setResult(null);
    try {
      const res = await axios.get(`${API_BASE_URL}${endpointRecommend}`, {
        params: {
          ...(ord  ? { order_no:     ord  } : {}),
          ...(proj ? { project_name: proj } : {}),
          ...(hint ? { drawing_hint: hint } : {}),
          ...(selectedFolders.length ? { folders: selectedFolders.join(',') } : {}),
          top: topN,
        },
        headers: _authHeader(),
        timeout: DEFAULTS.timeoutRecommendMs,
      });
      setResult(res.data);
      if (!ord && res.data?.order_no) setOrderNo(res.data.order_no);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'AI assist failed.';
      setErrorMsg(msg);
      onError && onError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderNo, projectName, hint, topN, endpointRecommend, onError, selectedFolders]);

  // ── Fetch a recommended doc via the Wrench download proxy ─────────────
  const useRecommendedDoc = useCallback(async (rec) => {
    if (!rec?.download_url) return;
    setFetchingDoc(rec.doc_no);
    setErrorMsg('');
    try {
      const downloadPath = rec.download_url.startsWith('http')
        ? rec.download_url
        : `${API_BASE_URL.replace(/\/api\/v1$/, '')}${rec.download_url}`;
      const res = await axios.get(downloadPath, {
        headers: _authHeader(),
        responseType: 'blob',
        timeout: DEFAULTS.timeoutDownloadMs,
      });
      const ctype = res.headers?.['content-type'] || '';
      if (ctype.includes('application/json')) {
        const txt  = await res.data.text();
        const json = JSON.parse(txt);
        if (json?.download_url) {
          window.open(json.download_url, '_blank', 'noopener,noreferrer');
          setErrorMsg(`Opening Wrench document ${rec.doc_no} in a new tab — please save and upload manually.`);
          return;
        }
        throw new Error(json?.detail || 'Wrench did not return file bytes.');
      }
      const ext = (rec.file_ext || 'pdf').toLowerCase().replace(/^\./, '');
      if (acceptList.length && !acceptList.includes(ext)) {
        throw new Error(`File extension .${ext} is not accepted by this importer (allowed: ${acceptList.join(', ')}).`);
      }
      const fileName = `${rec.doc_no || 'wrench-document'}.${ext}`;
      const blobType = res.data.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream');
      const fileObj  = new File([res.data], fileName, { type: blobType });
      onFileSelected && onFileSelected(fileObj, rec);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to download document from Wrench.';
      setErrorMsg(msg);
      onError && onError(msg);
    } finally {
      setFetchingDoc(null);
    }
  }, [acceptList, onFileSelected, onError]);

  const projectsAge = useMemo(() => {
    if (!projectsFetched) return '';
    const m = Math.max(0, Math.round((Date.now() - projectsFetched) / 60000));
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }, [projectsFetched]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
      {/* Header / toggle */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none"
        style={{ background: open
          ? 'linear-gradient(135deg,#eef2ff,#f0f9ff)'
          : 'linear-gradient(135deg,#fafbff,#f7f8ff)' }}
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: DEFAULTS.brandGradient }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800 leading-tight">
            {title} <span className="text-xs font-normal text-slate-400">{subtitleTag}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <label className="inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={open}
            onChange={() => setOpen((v) => !v)}
          />
          <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-indigo-500 transition-colors relative">
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${open ? 'translate-x-5' : ''}`} />
          </div>
        </label>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 py-4 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Project picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Project Number</label>
                <div className="flex items-center gap-1.5">
                  {projectsSyncing && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500">
                      <Loader className="w-3 h-3 animate-spin" />syncing…
                    </span>
                  )}
                  {projectsFetched > 0 && !projectsLoading && (
                    <span className="text-[10px] text-slate-400" title={new Date(projectsFetched).toLocaleString()}>
                      {projectsAge}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => loadProjects({ force: true })}
                    disabled={projectsLoading || projectsSyncing}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    title="Force refresh from Wrench (bypass cache)"
                  >
                    {projectsLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
              </div>

              {projectsLoading && projects.length === 0 ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="h-7 bg-slate-100 rounded-lg" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ) : (
                <>
                  {projects.length >= DEFAULTS.minForSearch && (
                    <input
                      type="text"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      placeholder="Search project number or description…"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  )}
                  <select
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    disabled={projectsLoading}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50"
                  >
                    <option value="">
                      {projects.length
                        ? `— auto-resolve from project name (${projects.length} available) —`
                        : (projectsError ? '(failed to load — using project name)' : '(no projects loaded yet)')}
                    </option>
                    {projects
                      .filter((p) => !projectFilter || (p.label || '').toLowerCase().includes(projectFilter.toLowerCase()))
                      .map((p) => (
                        <option key={p.order_no} value={p.order_no}>{p.label}</option>
                      ))}
                  </select>
                  {projectsError && projects.length === 0 && (
                    <p className="text-[10px] text-red-500 mt-1 truncate" title={projectsError}>
                      {projectsError}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Hint */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Document hint (optional)</label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={hintPlaceholder}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* ── Sub-folders (multi-select, optional) ──────────────────── */}
          {(foldersLoading || folders.length > 0 || foldersError || foldersOrderNo) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
                  Sub-folders (optional, multi-select)
                  {foldersLoading && <Loader className="w-3 h-3 animate-spin text-indigo-400" />}
                </label>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  {folders.length > 0 && (
                    <span>
                      {selectedFolders.length
                        ? `${selectedFolders.length} of ${folders.length} selected`
                        : `${folders.length} folder${folders.length === 1 ? '' : 's'} available`}
                    </span>
                  )}
                  {selectedFolders.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFolders}
                      className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      <XIcon className="w-3 h-3" /> clear
                    </button>
                  )}
                </div>
              </div>

              {foldersError && folders.length === 0 ? (
                <p className="text-[10px] text-red-500 truncate" title={foldersError}>{foldersError}</p>
              ) : folders.length === 0 && !foldersLoading ? (
                <p className="text-[10px] text-slate-400 italic">
                  No sub-folders are indexed for this project — recommendations will scan the whole project.
                </p>
              ) : (
                <>
                  {folders.length >= DEFAULTS.foldersMinForSearch && (
                    <input
                      type="text"
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                      placeholder="Filter sub-folders…"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 mb-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  )}
                  <div
                    className="flex flex-wrap gap-1.5 overflow-y-auto pr-1"
                    style={{ maxHeight: DEFAULTS.foldersListMaxH }}
                  >
                    {folders
                      .filter((f) => !folderFilter
                        || f.path.toLowerCase().includes(folderFilter.toLowerCase()))
                      .map((f) => {
                        const checked = selectedFolders.includes(f.path);
                        return (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => toggleFolder(f.path)}
                            title={`${f.path}  ·  ${f.count} document${f.count === 1 ? '' : 's'}${
                              f.file_exts?.length ? `  ·  ${f.file_exts.join(', ')}` : ''
                            }`}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border transition ${
                              checked
                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                          >
                            <FolderTree className={`w-3 h-3 ${checked ? 'text-white' : 'text-indigo-400'}`} />
                            <span className="truncate max-w-[18rem]">{f.path}</span>
                            <span className={`px-1 rounded text-[9px] ${
                              checked ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>{f.count}</span>
                          </button>
                        );
                      })}
                  </div>
                  {selectedFolders.length > 0 && (
                    <p className="text-[10px] text-indigo-600 mt-1.5">
                      AI will scan only the selected sub-folder(s).
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={runRecommend}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: DEFAULTS.brandGradient }}
            >
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" />Asking AI…</>
                : <><Brain className="w-4 h-4" />Recommend documents</>}
            </button>
            {result?.order_no && (
              <span className="text-xs text-slate-500">
                Matched <span className="font-semibold text-slate-700">{result.order_no}</span>
                {result.matched_via && result.matched_via !== 'explicit' && (
                  <span className="ml-1 text-slate-400">· {result.matched_via}</span>
                )}
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{errorMsg}</p>
            </div>
          )}

          {result && !result.recommendations?.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              {result.note || 'No matching documents were found in Wrench for this project.'}
            </div>
          )}

          {result?.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Top {result.recommendations.length} of {result.total_scanned} document(s)
              </p>
              {result.recommendations.map((rec, idx) => {
                const isTop      = rec.score >= DEFAULTS.minHighlightScore;
                const isFetching = fetchingDoc === rec.doc_no;
                const ext        = (rec.file_ext || '').toLowerCase();
                const accepted   = !acceptList.length || acceptList.includes(ext);
                return (
                  <div
                    key={`${rec.doc_no}-${idx}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      isTop ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      isTop ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>{rec.score}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{rec.doc_no || '(no DOC_NO)'}</p>
                      {rec.doc_description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{rec.doc_description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {rec.discipline && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{rec.discipline}</span>
                        )}
                        {rec.revision && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">Rev {rec.revision}</span>
                        )}
                        {rec.file_ext && (
                          <span className={`px-1.5 py-0.5 rounded uppercase border ${
                            accepted ? 'bg-violet-50 text-violet-700 border-violet-100'
                                     : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>{rec.file_ext}</span>
                        )}
                        {rec.reasons?.slice(0, 2).map((r, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">{r}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => useRecommendedDoc(rec)}
                      disabled={isFetching || !rec.download_url || !accepted}
                      title={!accepted
                        ? `Extension .${ext} not accepted by this importer (allowed: ${acceptList.join(', ')})`
                        : undefined}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      {isFetching
                        ? <><Loader className="w-3.5 h-3.5 animate-spin" />Loading…</>
                        : <><Download className="w-3.5 h-3.5" />Use this</>}
                    </button>
                  </div>
                );
              })}
              <p className="text-[10px] text-slate-400 italic">
                Scores come from soft-coded heuristics (pattern + discipline + file-type + hint tokens).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WrenchAiDocAssist;
