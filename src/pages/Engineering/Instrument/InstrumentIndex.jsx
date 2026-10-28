/**
 * INSTRUMENT INDEX — P&ID Instrument Extraction
 *
 * Route: /engineering/instrument/index
 *
 * UI/UX-only rewrite aligned with the RADAI design system (radai-tokens.css
 * --rd-* tokens + .rd-* component classes) and the ValveMTO/SLDComparison
 * page idioms: project list view + workspace view (breadcrumb, title, pills,
 * tabs), a "Set up extraction" card with a 4-stage locked stepper, a
 * readiness row, and a results register with search / chips / views / export.
 *
 * PRESERVED BEHAVIOUR (unchanged vs. previous implementation):
 * - useInstrumentProjects() local-first project storage (localStorage)
 * - Draft auto-save per project via IndexedDB (iiIdb / II_AUTOSAVE) and the
 *   in-memory II_SESSION_CACHE; uploaded PDF + stage inputs survive reload
 * - BYOK: key never persisted, sent only with the analyze request; Test key
 *   POST /pid/instrument-index/test-key/; cost estimate via estimateByokCost
 *   + loadPdfLibrary page counting (pages x 4 zoomed tiles per page)
 * - handleExtract flow: same FormData field names, POST
 *   /pid/instrument-index/analyze/, 202 + upload_id polling on
 *   /pid/instrument-index/status/<id>/, transient-network retry, timeouts
 * - Excel export: handleDownloadExcel via result.excel_url AND
 *   handleDownloadClientExcel fallback via getInstrumentTemplate — same
 *   two-sheet content (Instrument Index + Summary)
 * - Cross-links: Line List, IO List, Legend Manager, ICT request routes
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  FolderPlusIcon,
  FolderIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  KeyIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  TableCellsIcon,
  ChartBarIcon,
  Squares2X2Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { BYOK_COST_CONFIG, estimateByokCost } from '../../../config/byokCost.config';
import { loadPdfLibrary } from '../../../components/Common/pdfDocumentLibrary';
import { getApiBaseUrl } from '../../../config/environment.config';
import { STORAGE_KEYS } from '../../../config/app.config';
import apiClient from '../../../services/api.service';
import {
  useInstrumentProjects,
  INSTRUMENT_PROJECT_CATEGORIES,
  PROJECT_FORM_LIMITS,
  getInstrumentTemplate,
} from './InstrumentProjectManager';
import LegendSheetsModal from '../Process/components/LegendSheetsModal';

// ─── Type scale (only these sizes — per design spec) ────────────────────────
const FS = { title: 26, section: 15, body: 13, caption: 12, micro: 11.5 };

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = getApiBaseUrl();
// Upload timeout — multi-page P&IDs can take a long time per sheet.
// Soft-coded (env-tunable). Must stay <= Vite proxy `proxyTimeout` and <=
// Gunicorn worker timeout / the Celery task soft limit. Default: 55 min.
const UPLOAD_TIMEOUT_MS = Number(
  import.meta.env?.VITE_INSTRUMENT_INDEX_UPLOAD_TIMEOUT_MS
) || 3_300_000;

// ─── Network resilience (soft-coded) ─────────────────────────────────────────
// The upstream proxy occasionally drops long-running HTTPS connections
// (ERR_CONNECTION_RESET / "Failed to fetch"). Retry ONLY transient network
// errors (never HTTP 4xx/5xx).
const NETWORK_RETRY_CONFIG = {
  maxRetries:     2,
  backoffBaseMs:  4000,
  backoffFactor:  2,
  transientMarkers: [
    'failed to fetch',
    'network error',
    'load failed',
    'connection reset',
    'econnreset',
    'err_connection',
    'err_network',
  ],
};
const isTransientNetworkError = (err) => {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  const msg = (err.message || '').toLowerCase();
  return NETWORK_RETRY_CONFIG.transientMarkers.some(m => msg.includes(m));
};
const CONN_RESET_HELP_MSG =
  'Connection was reset by the upstream proxy. This usually clears on its own — ' +
  'we retried automatically. If it keeps failing, try splitting the PDF into smaller files (≤ 10 pages).';

// ─── Cross-links (unchanged targets) ─────────────────────────────────────────
const LINE_LIST_PATH = '/engineering/process/line-list';
const IO_LIST_PATH   = '/engineering/instrument/datasheet/io-list';
const LEGEND_MANAGER_ROUTE =
  '/engineering/legends?section=instrument_index&returnTo=/engineering/instrument/index&from=Instrument%20Index';
const ICT_ROUTE = '/my-enquiries';

// ─── Legend section + endpoint. Same request as listLegends('instrument_index')
//     in services/pidCheckerV2API, but issued with `silentTimeout` so the global
//     axios interceptor never raises a generic "Server error" toast — the page
//     shows ONE named toast per failed call instead (spec requirement #1).
const LEGEND_SECTION = 'instrument_index';
const LEGENDS_ENDPOINT = '/pid-checker-v2/legends/';

// ─── Category colours (data palette — unchanged from previous version) ──────
const CATEGORY_COLOURS = {
  'Flow':                  { bg: '#DDEEFF', text: '#1A3A6B' },
  'Pressure':              { bg: '#FFE4CC', text: '#7A2E00' },
  'Temperature':           { bg: '#FFE4E4', text: '#7A1010' },
  'Level':                 { bg: '#E4F4E4', text: '#1A5C1A' },
  'Differential Pressure': { bg: '#FFF9CC', text: '#665500' },
  'Analysis':              { bg: '#E8E4FF', text: '#3A1A8C' },
  'Safety':                { bg: '#FFCCCC', text: '#8C0000' },
  'Shutdown & ESD':        { bg: '#FFD9D9', text: '#660000' },
  'Control Valves':        { bg: '#CCFFEE', text: '#005533' },
  'Motor & Solenoid':      { bg: '#E0E0FF', text: '#220066' },
  'Position':              { bg: '#FFFACC', text: '#554400' },
  'Restriction':           { bg: '#DDEEDD', text: '#224422' },
  'Special':               { bg: '#F0F0F0', text: '#333333' },
};
const DEFAULT_COLOUR = { bg: '#F5F5F5', text: '#333333' };
const categoryStyle = (cat) => CATEGORY_COLOURS[cat] || DEFAULT_COLOUR;

// ─── In-memory session cache (unchanged semantics) ───────────────────────────
// Keeps stage inputs alive across in-app route navigation (Legend Manager
// round-trip). Module-scope only — cleared on full browser reload.
// The BYOK API key itself is NEVER cached.
const II_SESSION_CACHE = {
  enabled: true,
  projectId: null,
  pidFile: null,
  legendFile: null,
  drawingNumber: '',
  drawingTitle: '',
  revision: '0',
  projectName: '',
  skippedStages: {},
  confirmedStages: {},           // explicit Confirm/Continue/Save clicks (additive, UI-only)
  legendMode: '',                // '' | 'use' | 'skip' (additive, UI-only)
  pidPageCount: null,            // additive, UI-only display field
  byokChoice: '',                // submit-gate choice — the API key is NEVER cached
};

// ─── IndexedDB auto-save (per-project draft) — unchanged ────────────────────
// SECURITY: the BYOK API key is NEVER persisted (see `excludeKeys`).
const II_AUTOSAVE = {
  enabled:      true,
  dbName:       'radai_instrument_index',
  storeName:    'session_drafts',
  debounceMs:   500,
  excludeKeys:  ['byokApiKey'],
};

const iiIdb = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(II_AUTOSAVE.dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(II_AUTOSAVE.storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(II_AUTOSAVE.storeName, 'readwrite');
      tx.objectStore(II_AUTOSAVE.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(II_AUTOSAVE.storeName, 'readonly')
        .objectStore(II_AUTOSAVE.storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
};

// ─── Results table (default template view) column registry ──────────────────
// Only fields the extraction already returns. Optional columns can be hidden
// via the Columns menu.
const RESULT_COLUMNS = [
  { key: 'category',            label: 'Category',         optional: false },
  { key: 'instrument_type',     label: 'Instrument type',  optional: true },
  { key: 'service_description', label: 'Service',          optional: true },
  { key: 'loop_number',         label: 'Loop',             optional: true },
  { key: 'line_equipment',      label: 'Line / equipment', optional: true },
  { key: 'system',              label: 'System',           optional: true },
  { key: 'legend_status',       label: 'Legend',           optional: true },
  { key: 'confidence',          label: 'Confidence',       optional: true },
];

const LOW_CONFIDENCE_THRESHOLD = 0.7;

// ─── Small presentation helpers ──────────────────────────────────────────────
const Pill = ({ tone = 'rd-pill-neutral', children, title }) => (
  <span className={`rd-pill ${tone}`} title={title}>{children}</span>
);

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Named, per-call error toast (spec #1) — never a generic "Server error".
// A stable toastId dedupes repeat failures: only ONE toast per call is ever
// visible (a retry failure re-creates it after the user dismissed/retried).
function showNamedErrorToast({ title, body, onRetry, toastId }) {
  const opts = { autoClose: false, ...(toastId ? { toastId } : {}) };
  const dismissThis = () => (toastId ? toast.dismiss(toastId) : toast.dismiss());
  toast.error(
    <div>
      <p style={{ fontWeight: 700, fontSize: FS.body, margin: 0 }}>{title}</p>
      <p style={{ fontSize: FS.caption, marginTop: 4 }}>{body}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {onRetry && (
          <button
            type="button"
            className="rd-btn rd-btn-secondary rd-btn-sm"
            onClick={() => { dismissThis(); onRetry(); }}
          >
            Retry
          </button>
        )}
        <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={dismissThis}>
          Dismiss
        </button>
      </div>
    </div>,
    opts,
  );
}

// ─── Delete-project confirm modal ────────────────────────────────────────────
function ConfirmDeleteModal({ project, onCancel, onConfirm }) {
  if (!project) return null;
  return (
    <>
      <div className="rd-modal-backdrop" onClick={onCancel} />
      <div className="rd-card" role="dialog" aria-modal="true" aria-label={`Delete ${project.name}?`}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 62, width: 420, maxWidth: '92vw', padding: '1.25rem',
        }}>
        <h3 style={{ fontSize: FS.section, fontWeight: 600, margin: 0 }}>Delete {project.name}?</h3>
        <p className="rd-text-muted" style={{ fontSize: FS.body, margin: '0.5rem 0 1.25rem' }}>
          Its drafts and extractions are removed.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="rd-btn rd-btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="rd-btn rd-btn-primary"
            style={{ background: 'var(--rd-danger)' }}
            onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </>
  );
}

// ─── Quick-create modal (single name + category; same upsert semantics) ─────
function QuickCreateModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(INSTRUMENT_PROJECT_CATEGORIES[0].id);
  const [err, setErr] = useState(null);
  useEffect(() => { if (open) { setName(''); setCategoryId(INSTRUMENT_PROJECT_CATEGORIES[0].id); setErr(null); } }, [open]);
  if (!open) return null;
  const submit = (e) => {
    e?.preventDefault?.();
    const n = name.trim();
    if (!n) { setErr('Enter a project name to continue.'); return; }
    if (n.length > PROJECT_FORM_LIMITS.nameMax) { setErr(`Name must be ${PROJECT_FORM_LIMITS.nameMax} characters or less.`); return; }
    onCreate({ name: n, category: categoryId });
  };
  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <form onSubmit={submit} className="rd-card" role="dialog" aria-modal="true" aria-label="New project"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 62, width: 480, maxWidth: '92vw', padding: '1.25rem',
        }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: FS.section, fontWeight: 600, margin: 0 }}>New project</h3>
            <p className="rd-text-muted" style={{ fontSize: FS.caption, marginTop: 2 }}>
              Name it now — code, client &amp; metadata can be added later via Edit.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rd-btn rd-btn-ghost rd-btn-sm" aria-label="Close">
            <XMarkIcon width={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
            Project name
            <input
              autoFocus
              type="text"
              value={name}
              maxLength={PROJECT_FORM_LIMITS.nameMax}
              onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
              placeholder="e.g. SAHIL Phase 3 — Pig Receiver"
              className="rd-input"
              style={{ marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="rd-select" style={{ marginTop: 4 }}>
              {INSTRUMENT_PROJECT_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}{c.short ? ` — ${c.short}` : ''}</option>
              ))}
            </select>
          </label>
          {err && <div className="rd-banner rd-banner-danger" style={{ fontSize: FS.caption }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className="rd-btn rd-btn-secondary">Cancel</button>
          <button type="submit" className="rd-btn rd-btn-primary">
            <FolderPlusIcon width={16} /> New project
          </button>
        </div>
      </form>
    </>
  );
}

// ─── Edit project modal (name + description; same upsert semantics) ─────────
function EditProjectModal({ project, onClose, onSave }) {
  const [name, setName] = useState(project?.name || '');
  const [desc, setDesc] = useState(project?.description || '');
  useEffect(() => { setName(project?.name || ''); setDesc(project?.description || ''); }, [project]);
  if (!project) return null;
  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-card" role="dialog" aria-modal="true" aria-label="Edit project"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 62, width: 440, maxWidth: '92vw', padding: '1.25rem',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: FS.section, fontWeight: 600, margin: 0 }}>Edit project</h3>
          <button type="button" onClick={onClose} className="rd-btn rd-btn-ghost rd-btn-sm" aria-label="Close">
            <XMarkIcon width={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
            Project name
            <input type="text" value={name} maxLength={PROJECT_FORM_LIMITS.nameMax}
              onChange={e => setName(e.target.value)} className="rd-input" style={{ marginTop: 4 }} />
          </label>
          <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
            Description
            <textarea rows={3} value={desc} maxLength={PROJECT_FORM_LIMITS.descriptionMax}
              onChange={e => setDesc(e.target.value)} className="rd-input"
              style={{ marginTop: 4, padding: '0.5rem 0.75rem', resize: 'vertical' }} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className="rd-btn rd-btn-secondary">Cancel</button>
          <button type="button" onClick={() => onSave({ name: name.trim() || project.name, description: desc })}
            className="rd-btn rd-btn-primary">Save</button>
        </div>
      </div>
    </>
  );
}

// ─── Edit-Row Modal (same save semantics as before) ─────────────────────────
function EditInstrumentModal({ open, draft, fields, onChange, onClose, onSave }) {
  if (!open || !draft || !Array.isArray(fields) || fields.length === 0) return null;

  const groups = [];
  const seen = new Map();
  fields.forEach(f => {
    const g = f.group || 'Fields';
    if (!seen.has(g)) { seen.set(g, groups.length); groups.push({ name: g, items: [] }); }
    groups[seen.get(g)].items.push(f);
  });

  const setField = (key, value) => onChange({ ...draft, [key]: value });
  const tag = draft.tag_number || '(new)';

  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-card" role="dialog" aria-modal="true" aria-label={`Edit ${tag}`}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 62, width: 720, maxWidth: '94vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
        <div className="rd-card-header">
          <span>Edit instrument · <span className="rd-mono">{tag}</span></span>
          <button onClick={onClose} title="Close" className="rd-btn rd-btn-ghost rd-btn-sm">
            <XMarkIcon width={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'grid', gap: '1rem' }}>
          {groups.map(grp => (
            <fieldset key={grp.name} style={{ border: '1px solid var(--rd-border-soft)', borderRadius: 'var(--rd-radius-control)', padding: '0.75rem 1rem' }}>
              <legend style={{ padding: '0 0.375rem', fontSize: FS.micro, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--rd-text-muted)' }}>
                {grp.name}
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.625rem' }}>
                {grp.items.map(f => {
                  const v = draft[f.key] ?? '';
                  return (
                    <label key={f.key} style={{ fontSize: FS.micro, fontWeight: 600, color: 'var(--rd-text-muted)' }}>
                      {f.label}
                      {f.type === 'textarea' ? (
                        <textarea rows={2} value={v} onChange={e => setField(f.key, e.target.value)}
                          className="rd-input" style={{ marginTop: 2, padding: '0.375rem 0.625rem', resize: 'vertical' }}
                          placeholder={f.hint || ''} />
                      ) : f.type === 'select' ? (
                        <select value={v} onChange={e => setField(f.key, e.target.value)}
                          className="rd-select" style={{ marginTop: 2, minHeight: 32 }}>
                          {(f.options || ['']).map(opt => (
                            <option key={opt} value={opt}>{opt === '' ? '— (blank) —' : opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input type={f.type === 'number' ? 'number' : 'text'} value={v}
                          onChange={e => setField(f.key, e.target.value)} className="rd-input"
                          style={{ marginTop: 2, minHeight: 32 }} placeholder={f.hint || ''} />
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--rd-border-soft)' }}>
          <button onClick={onClose} className="rd-btn rd-btn-secondary rd-btn-sm">Cancel</button>
          <button onClick={onSave} className="rd-btn rd-btn-primary rd-btn-sm">Save changes</button>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const InstrumentIndex = () => {
  const navigate = useNavigate();

  // ── Project management (local-first; unchanged) ─────────────────────
  const {
    projects, activeProject, setActiveId,
    upsertProject, deleteProject,
  } = useInstrumentProjects();

  // ── Legend strip (in-page silent fetch + named toast on failure) ────
  const [legendModalOpen, setLegendModalOpen] = useState(false);
  const [activeLegend, setActiveLegend]       = useState(null);
  const [legendLoading, setLegendLoading]     = useState(false);
  // Guards against duplicate mount invocations / StrictMode double-effect.
  const legendInFlightRef = useRef(false);

  const loadLegend = useCallback(async () => {
    if (legendInFlightRef.current) return;   // one fetch at a time
    legendInFlightRef.current = true;
    setLegendLoading(true);
    try {
      const res = await apiClient.get(LEGENDS_ENDPOINT, {
        params: { section: LEGEND_SECTION },
        silentTimeout: true,   // suppress the global generic toast
      });
      const rows = res?.data;
      const active = (Array.isArray(rows) ? rows : []).find(l => l && l.is_active) || null;
      setActiveLegend(active);
    } catch (_) {
      setActiveLegend(null);
      showNamedErrorToast({
        title: 'Legend could not be loaded',
        body: 'The project legend service did not respond. Built-in defaults are used; extraction is not blocked.',
        onRetry: loadLegend,
        toastId: 'instrument-index-legend-load',   // dedupes — one toast max
      });
    } finally {
      legendInFlightRef.current = false;
      setLegendLoading(false);
    }
  }, []);
  // Fetch once on mount; refetch when the Legend modal closes (legend may
  // have changed) — not on every render or modal open.
  const legendModalWasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = legendModalWasOpenRef.current;
    legendModalWasOpenRef.current = legendModalOpen;
    if (legendModalOpen) return;                 // opening — no fetch
    if (!wasOpen) loadLegend();                  // mount (in-flight ref dedupes StrictMode)
    else loadLegend();                           // modal just closed — refresh
  }, [legendModalOpen, loadLegend]);
  // Refetch on a genuine project switch (not on mount — covered above).
  const legendProjectRef = useRef(activeProject?.id);
  useEffect(() => {
    if (legendProjectRef.current === activeProject?.id) return;
    legendProjectRef.current = activeProject?.id;
    loadLegend();
  }, [activeProject?.id, loadLegend]);

  // Upload state — hydrated from II_SESSION_CACHE (unchanged semantics).
  const [pidFile, setPidFile]             = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.pidFile : null);
  const [legendFile, setLegendFile]       = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.legendFile : null);
  const [drawingNumber, setDrawingNumber] = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.drawingNumber : '');
  const [drawingTitle, setDrawingTitle]   = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.drawingTitle : '');
  const [revision, setRevision]           = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.revision : '0');
  const [projectName, setProjectName]     = useState(II_SESSION_CACHE.enabled ? II_SESSION_CACHE.projectName : '');
  const [legendMode, setLegendMode]       = useState(II_SESSION_CACHE.enabled ? (II_SESSION_CACHE.legendMode || '') : '');

  // BYOK — key lives in component state only; never persisted.
  const [byokProvider, setByokProvider]   = useState('claude');
  const [byokApiKey, setByokApiKey]       = useState('');
  const [byokModel, setByokModel]         = useState('');
  const [byokTesting, setByokTesting]     = useState(false);
  const [byokTestResult, setByokTestResult] = useState(null);   // { valid, message, elapsedS }
  const [byokTestedAt, setByokTestedAt]   = useState(null);

  const handleByokTest = async () => {
    if (!byokApiKey.trim()) { setByokTestResult({ valid: false, message: 'Enter an API key first.' }); return; }
    setByokTesting(true); setByokTestResult(null);
    const t0 = Date.now();
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const resp = await fetch(`${API_BASE}/pid/instrument-index/test-key/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ provider: byokProvider, api_key: byokApiKey.trim(), model: byokModel || undefined }),
      });
      const data = await resp.json().catch(() => ({}));
      const elapsedS = Math.max(1, Math.round((Date.now() - t0) / 1000));
      if (data.valid) {
        setByokTestResult({ valid: true, message: `Key valid · ${elapsedS} s`, elapsedS });
        setByokTestedAt(new Date().toISOString());
        setByokChoice('byok');
      } else {
        // Classify the failure into one of the named notes — never a bare
        // "Test failed". Backend message wins when it matches a category;
        // otherwise classify by HTTP status.
        const raw = String(data.message || '');
        const low = raw.toLowerCase();
        let message;
        if (low.includes('credit') || low.includes('quota') || low.includes('billing') || low.includes('insufficient')) {
          message = 'No credits on this key — add credits or use another key';
        } else if (
          [400, 401, 403].includes(resp.status) ||
          low.includes('invalid') || low.includes('reject') || low.includes('auth') ||
          low.includes('unauthorized') || low.includes('forbidden') || low.includes('api key')
        ) {
          message = 'Key rejected by provider — check the key and try again';
        } else if (resp.status >= 500) {
          // 5xx with no usable provider message
          message = 'Provider not reachable — try again';
        } else {
          message = raw && raw !== 'Test failed' ? raw : 'Provider not reachable — try again';
        }
        setByokTestResult({ valid: false, message, elapsedS });
      }
    } catch (e) {
      setByokTestResult({ valid: false, message: 'Provider not reachable — try again' });
    } finally {
      setByokTesting(false);
    }
  };

  // ── Stage gating (same unlock/skip semantics as before) ─────────────
  const [skippedStages, setSkippedStages] = useState(
    II_SESSION_CACHE.enabled ? II_SESSION_CACHE.skippedStages : {}
  );
  const skipStage = (id) => setSkippedStages(prev => ({ ...prev, [id]: true }));
  // Stages complete ONLY by explicit user action (Confirm / Continue / Save /
  // Skip) — never implicitly by a field being pre-filled (spec §4).
  const [confirmedStages, setConfirmedStages] = useState(
    II_SESSION_CACHE.enabled ? (II_SESSION_CACHE.confirmedStages || {}) : {}
  );
  const confirmStage = (id) => setConfirmedStages(prev => ({ ...prev, [id]: true }));

  const [byokChoice, setByokChoice] = useState(
    II_SESSION_CACHE.enabled ? (II_SESSION_CACHE.byokChoice || '') : ''
  );

  const stageDone = {
    1: Boolean(pidFile) && Boolean(confirmedStages.upload),
    2: Boolean(legendFile) || Boolean(skippedStages.legend) || Boolean(confirmedStages.legend),
    3: Boolean(confirmedStages.metadata) || Boolean(skippedStages.metadata),
    // byokOnly gate: a TESTED key is required to extract (unchanged behaviour)
    4: Boolean(byokApiKey.trim()) && byokTestResult?.valid === true,
  };
  const stageUnlocked = {
    1: true,
    2: stageDone[1],
    3: stageDone[1] && stageDone[2],
    4: stageDone[1] && stageDone[2] && stageDone[3],
  };
  const completedCount = [1, 2, 3, 4].filter(n => stageDone[n]).length;

  // Active (open) stage body — only one visible at a time.
  const [openStage, setOpenStage] = useState(1);
  const s1d = stageDone[1], s2d = stageDone[2], s3d = stageDone[3], s4d = stageDone[4];
  useEffect(() => {
    setOpenStage(cur => {
      const unlocked = { 1: true, 2: s1d, 3: s1d && s2d, 4: s1d && s2d && s3d };
      const done = { 1: s1d, 2: s2d, 3: s3d, 4: s4d };
      if (cur >= 1 && cur <= 4 && unlocked[cur] && !done[cur]) return cur;
      const firstIncomplete = [1, 2, 3, 4].find(n => !done[n]);
      return firstIncomplete || 4;
    });
  }, [s1d, s2d, s3d, s4d]);

  // ── Auto-save: hydration + debounced persistence (unchanged) ────────
  const hydratedProjectRef = useRef(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  useEffect(() => {
    const pid = activeProject?.id;
    if (!II_AUTOSAVE.enabled || !pid || hydratedProjectRef.current === pid) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await iiIdb.get(pid);
        if (cancelled) return;
        if (draft) {
          Object.assign(II_SESSION_CACHE, { ...draft, projectId: pid });
          if (draft.pidFile)       setPidFile(draft.pidFile);
          if (draft.legendFile)    setLegendFile(draft.legendFile);
          if (draft.drawingNumber) setDrawingNumber(draft.drawingNumber);
          if (draft.drawingTitle)  setDrawingTitle(draft.drawingTitle);
          if (draft.revision)      setRevision(draft.revision);
          if (draft.skippedStages) setSkippedStages(draft.skippedStages);
          if (draft.confirmedStages) setConfirmedStages(draft.confirmedStages);
          if (draft.legendMode)    setLegendMode(draft.legendMode);
          if (draft.pidPageCount)  setPidPageCount(draft.pidPageCount);
          if (draft.byokChoice)    setByokChoice(draft.byokChoice);
          if (draft.savedAt)       setDraftSavedAt(draft.savedAt);
        }
      } catch (_) { /* IDB unavailable — in-memory cache still works */ }
      hydratedProjectRef.current = pid;
    })();
    return () => { cancelled = true; };
  }, [activeProject?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── BYOK cost estimate (unchanged) ──────────────────────────────────
  const [pidPageCount, setPidPageCount] = useState(
    II_SESSION_CACHE.enabled ? (II_SESSION_CACHE.pidPageCount || null) : null
  );
  useEffect(() => {
    let cancelled = false;
    setPidPageCount(null);
    if (!BYOK_COST_CONFIG.enabled || !pidFile) return undefined;
    (async () => {
      try {
        const lib = await loadPdfLibrary();
        const buf = await pidFile.arrayBuffer();
        const doc = await lib.getDocument({ data: buf }).promise;
        if (!cancelled) setPidPageCount(doc.numPages || null);
        doc.destroy?.();
      } catch (_) { /* estimate hidden — extraction unaffected */ }
    })();
    return () => { cancelled = true; };
  }, [pidFile]);
  const byokCostEstimate = estimateByokCost(
    pidPageCount, BYOK_COST_CONFIG.tokensPerPage.instrumentIndex, byokProvider
  );

  // Write-through: in-memory cache (sync) + IndexedDB (debounced).
  useEffect(() => {
    if (II_SESSION_CACHE.enabled) {
      Object.assign(II_SESSION_CACHE, {
        pidFile, legendFile, drawingNumber, drawingTitle, revision, projectName,
        skippedStages, confirmedStages, legendMode, pidPageCount, byokChoice,
        projectId: activeProject?.id || null,
      });
    }
    if (!II_AUTOSAVE.enabled) return;
    const pid = activeProject?.id;
    if (!pid || hydratedProjectRef.current !== pid) return;  // wait for hydration
    const t = setTimeout(() => {
      const draft = {
        pidFile, legendFile, drawingNumber, drawingTitle, revision, projectName,
        skippedStages, confirmedStages, legendMode, pidPageCount, byokChoice,
        savedAt: new Date().toISOString(),
        // NOTE: II_AUTOSAVE.excludeKeys (byokApiKey) intentionally omitted —
        // secrets are never persisted.
      };
      iiIdb.put(pid, draft)
        .then(() => setDraftSavedAt(draft.savedAt))
        .catch(() => { /* non-fatal — in-memory cache still protects navigation */ });
    }, II_AUTOSAVE.debounceMs);
    return () => clearTimeout(t);
  }, [pidFile, legendFile, drawingNumber, drawingTitle, revision, projectName, skippedStages, confirmedStages, legendMode, pidPageCount, byokChoice, activeProject?.id]);

  // Processing state
  const [isProcessing, setIsProcessing]     = useState(false);
  const [progress, setProgress]             = useState(0);
  const [statusMessage, setStatusMessage]   = useState('');

  // Results state
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  // Table filtering / view state
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchInput, setSearchInput]       = useState('');
  const [filterText, setFilterText]         = useState('');
  const [reviewOnly, setReviewOnly]         = useState(false);
  const [tablePage, setTablePage]           = useState(1);
  const [tablePageSize, setTablePageSize]   = useState(25);
  const [activeTab, setActiveTab]           = useState('new');      // 'new' | 'results'
  const [resultView, setResultView]         = useState('table');    // 'table' | 'categories' | 'isa'
  const [hiddenCols, setHiddenCols]         = useState(() => new Set());
  const [colsMenuOpen, setColsMenuOpen]     = useState(false);
  const [selectedRows, setSelectedRows]     = useState(() => new Set());
  const [editedRows, setEditedRows]         = useState(() => new Set());

  // Edit-row modal state — { idx, draft } when open.
  const [editingRow, setEditingRow] = useState(null);

  // Apply the draft back to result.instruments[idx] (immutable update —
  // unchanged save semantics) and flag the row as edited until export.
  const handleSaveEditedRow = useCallback(() => {
    if (!editingRow) return;
    const { idx, draft } = editingRow;
    setResult(prev => {
      if (!prev || !Array.isArray(prev.instruments)) return prev;
      const next = prev.instruments.map((inst, j) => (j === idx ? { ...inst, ...draft } : inst));
      return { ...prev, instruments: next };
    });
    setEditedRows(prev => new Set(prev).add(idx));
    setEditingRow(null);
  }, [editingRow]);

  const fileInputRef = useRef(null);

  // 200 ms debounce for the results search (front-end only, Table view).
  useEffect(() => {
    const t = setTimeout(() => { setFilterText(searchInput); setTablePage(1); }, 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Per-project reset (unchanged semantics) ─────────────────────────
  useEffect(() => {
    // Hydration guard: session cache for THIS project — keep restored state.
    if (
      II_SESSION_CACHE.enabled &&
      II_SESSION_CACHE.projectId &&
      II_SESSION_CACHE.projectId === activeProject?.id
    ) {
      return;
    }
    const RESETTERS = [
      () => setPidFile(null),
      () => setLegendFile(null),
      () => setDrawingNumber(''),
      () => setDrawingTitle(''),
      () => setRevision('0'),
      () => setLegendMode(''),
      () => setConfirmedStages({}),
      () => setPidPageCount(null),
      () => setResult(null),
      () => setError(null),
      () => setSelectedRows(new Set()),
      () => setEditedRows(new Set()),
      () => setEditingRow(null),
      () => setProgress(0),
      () => setStatusMessage(''),
      () => setFilterCategory('All'),
      () => setFilterText(''),
      () => setSearchInput(''),
      () => setReviewOnly(false),
      () => setResultView('table'),
      () => setActiveTab('new'),
      () => setOpenStage(1),
      () => setByokApiKey(''),
      () => setByokTestResult(null),
      () => setByokTestedAt(null),
      () => setByokChoice(''),
    ];
    RESETTERS.forEach(fn => { try { fn(); } catch (_) { /* no-op */ } });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (activeProject && activeProject.name) setProjectName(activeProject.name);
    else setProjectName('');
  }, [activeProject?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Progress crawl while extracting (visual only; real status text
  //    comes from the polled status endpoint) ──────────────────────────
  const PROGRESS_PRIMARY_CAP = 91;
  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => {
      setProgress(p => (p >= PROGRESS_PRIMARY_CAP ? p : p + (PROGRESS_PRIMARY_CAP - p) * 0.035));
    }, 1800);
    return () => clearInterval(id);
  }, [isProcessing]);

  // ── File selection (unchanged) ──────────────────────────────────────
  const handleFileSelect = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    setPidFile(file);
    setConfirmedStages(prev => ({ ...prev, upload: false }));  // re-confirm after (re)select
    setError(null);
    setResult(null);
    if (!drawingNumber) setDrawingNumber(file.name.replace(/\.pdf$/i, ''));
  };

  const handleDrop = e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      setPidFile(file);
      setConfirmedStages(prev => ({ ...prev, upload: false }));
      setError(null);
      setResult(null);
      if (!drawingNumber) setDrawingNumber(file.name.replace(/\.pdf$/i, ''));
    } else {
      setError('Only PDF files are accepted.');
    }
  };

  const removePidFile = () => {
    setPidFile(null);
    setConfirmedStages(prev => ({ ...prev, upload: false }));
    setDrawingNumber('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Extract (unchanged flow) ────────────────────────────────────────
  const handleExtract = async () => {
    if (!pidFile) { setError('Please upload a P&ID (PDF) first.'); return; }
    if (!activeProject) {
      setError('Please select or create an active project first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatusMessage('Uploading P&ID…');

    const formData = new FormData();
    formData.append('pid_file', pidFile);
    if (legendFile) formData.append('legend_file', legendFile);
    formData.append('drawing_number', drawingNumber || pidFile.name.replace(/\.pdf$/i, ''));
    formData.append('drawing_title', drawingTitle);
    formData.append('revision', revision);
    formData.append('project_name', projectName || activeProject.name);
    // Project context (sent for backend awareness; ignored if unused)
    formData.append('project_id', activeProject.id);
    formData.append('project_code', activeProject.code || '');
    formData.append('project_category', activeProject.category);
    formData.append('project_client', activeProject.client || '');
    formData.append('project_unit', activeProject.unit || '');
    // BYOK — sent with the request only, never stored.
    if (byokApiKey.trim()) {
      formData.append('provider', byokProvider);
      formData.append('api_key', byokApiKey.trim());
      if (byokModel.trim()) formData.append('model', byokModel.trim());
    }

    const token  = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const url    = `${API_BASE}/pid/instrument-index/analyze/`;
    const ctrl   = new AbortController();
    const abort  = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);

    // Soft-coded fetch-with-retry — only retries transient network errors
    // (ERR_CONNECTION_RESET / "Failed to fetch"); never retries on HTTP errors.
    const doFetch = () => fetch(url, {
      method:  'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    formData,
      signal:  ctrl.signal,
    });

    try {
      setStatusMessage('AI scanning P&ID for all instrument tags…');

      let resp;
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          resp = await doFetch();
          break; // success (HTTP-level errors are handled below)
        } catch (netErr) {
          if (attempt < NETWORK_RETRY_CONFIG.maxRetries && isTransientNetworkError(netErr)) {
            attempt += 1;
            const delay = NETWORK_RETRY_CONFIG.backoffBaseMs *
                          Math.pow(NETWORK_RETRY_CONFIG.backoffFactor, attempt - 1);
            setStatusMessage(`Network blip detected — auto-retrying (${attempt}/${NETWORK_RETRY_CONFIG.maxRetries}) in ${Math.round(delay/1000)} s…`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw netErr;
        }
      }
      clearTimeout(abort);

      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try { const j = await resp.json(); detail = j.error || j.detail || detail; } catch (_) { /* keep HTTP status detail */ }
        throw new Error(detail);
      }

      const data = await resp.json();

      // ── Async path — the backend queues extraction (202 + upload_id)
      // and the real result must be POLLED from the status endpoint.
      if (data?.upload_id && !data.instruments) {
        const statusUrl = `${API_BASE}/pid/instrument-index/status/${data.upload_id}/`;
        const deadline  = Date.now() + UPLOAD_TIMEOUT_MS;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (Date.now() > deadline) {
            throw new Error(`Extraction timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 60000)} min on this browser. The server job may still finish — wait a minute and re-run with BYOK (your own key is much faster), or split the PDF into single-sheet files.`);
          }
          await new Promise(r => setTimeout(r, 4000));
          let st;
          try {
            const sResp = await fetch(statusUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!sResp.ok) continue; // transient — keep polling
            st = await sResp.json();
          } catch (_) {
            continue; // network blip — keep polling until deadline
          }
          if (st?.status === 'failed') {
            throw new Error(st.error || 'Extraction failed on the server.');
          }
          if (st?.status === 'completed' || st?.instruments) {
            setProgress(100);
            setStatusMessage('Extraction complete!');
            setResult(st);
            return; // finally block still runs (setIsProcessing(false))
          }
          if (typeof st?.progress === 'number') setProgress(st.progress);
          if (st?.message) setStatusMessage(st.message);
        }
      }

      setProgress(100);
      setStatusMessage('Extraction complete!');
      setResult(data);
    } catch (err) {
      clearTimeout(abort);
      let msg;
      if (err.name === 'AbortError') {
        msg = `Upload timed out after ${Math.round(UPLOAD_TIMEOUT_MS / 60000)} min on this browser. The server job may still finish — re-run with BYOK (your own key is much faster), or split the PDF into single-sheet files.`;
      } else if (isTransientNetworkError(err)) {
        msg = CONN_RESET_HELP_MSG;
      } else {
        msg = err.message || 'Extraction failed — please try again.';
      }
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Derived results data ─────────────────────────────────────────────
  const legendStatusOf = (inst) => {
    const note = inst.notes || '';
    if (note.toLowerCase().includes('legend')) return 'verified';
    return activeLegend ? 'not-in-legend' : 'no-legend';
  };
  const isLowConfidence = (inst) =>
    typeof inst.confidence === 'number' && inst.confidence < LOW_CONFIDENCE_THRESHOLD;
  const needsReviewRow = (inst) =>
    (Array.isArray(inst.warnings) && inst.warnings.length > 0) ||
    isLowConfidence(inst) ||
    legendStatusOf(inst) === 'not-in-legend';

  const allInstruments = result?.instruments || [];
  const notInLegendCount = useMemo(
    () => allInstruments.filter(i => legendStatusOf(i) === 'not-in-legend').length,
    [result, activeLegend]);  // eslint-disable-line react-hooks/exhaustive-deps
  const lowConfidenceCount = useMemo(
    () => allInstruments.filter(isLowConfidence).length,
    [result]);  // eslint-disable-line react-hooks/exhaustive-deps
  const verifiedCount = useMemo(
    () => allInstruments.filter(i => legendStatusOf(i) === 'verified').length,
    [result, activeLegend]);  // eslint-disable-line react-hooks/exhaustive-deps
  const loopCount = useMemo(
    () => new Set(allInstruments.map(i => i.loop_number).filter(Boolean)).size,
    [result]);  // eslint-disable-line react-hooks/exhaustive-deps
  const needsReviewCount = useMemo(
    () => allInstruments.filter(needsReviewRow).length,
    [result, activeLegend]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Toast + tab switch when a fresh extraction lands.
  useEffect(() => {
    if (result && Array.isArray(result.instruments)) {
      setActiveTab('results');
      setSelectedRows(new Set());
      setEditedRows(new Set());
      toast.success(`Extraction complete · ${result.total ?? result.instruments.length} tags · ${needsReviewCount} to review`);
    }
  }, [result]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Excel download via backend URL (unchanged) ───────────────────────
  const handleDownloadExcel = () => {
    if (!result?.excel_url) return;
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    // Build absolute URL
    const base = API_BASE.replace(/\/api\/v1\/?$/, '');
    const fullUrl = `${base}${result.excel_url}`;
    const a = document.createElement('a');
    a.href = fullUrl;
    if (token) {
      // For authenticated downloads attach token as query param (backend allows it)
      a.href += (fullUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
    }
    a.download = `instrument_index_${(drawingNumber || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Client-side Excel fallback (browser XLSX) — unchanged content ────
  // Template-driven: the active project's category selects the template
  // (ADNOC Gas → 25-col manual sheet layout; default → legacy 15-col view).
  const handleDownloadClientExcel = () => {
    if (!result?.instruments?.length) return;
    const tpl = getInstrumentTemplate(activeProject?.category);
    const ctx = { project: activeProject || {}, result };

    // Honor row selection: if any rows are selected, export those only;
    // otherwise export everything in the result.
    const sourceList = selectedRows.size > 0
      ? result.instruments.filter((_, i) => selectedRows.has(i))
      : result.instruments;

    // Resolve a metaRow cell value via dotted "scope.key" lookup
    const _resolveMeta = (key) => {
      if (!key) return '';
      const [scope, ...rest] = key.split('.');
      const path = rest.join('.');
      const root = scope === 'project' ? ctx.project
                 : scope === 'result'  ? ctx.result
                 : ctx;
      return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), root) ?? '';
    };

    // Prepend "SL No." auto-column so exported Excel mirrors the on-screen view
    let _slCounter = 0;
    const SL_COL = {
      key: '__sl_no__', header: 'SL No.', width: 6, align: 'center',
      accessor: () => (++_slCounter),
    };
    const xCols = [SL_COL, ...tpl.columns];
    const COL_COUNT = xCols.length;

    const wsData = [];

    // 1) Title row
    wsData.push([tpl.sheetTitle.toUpperCase(), ...Array(COL_COUNT - 1).fill('')]);
    // 2) Metadata rows
    (tpl.metaRows || []).forEach(row => {
      const line = [];
      row.forEach(cell => {
        line.push(`${cell.label}: ${_resolveMeta(cell.key)}`);
        const span = (cell.span || 1) - 1;
        for (let s = 0; s < span; s++) line.push('');
      });
      while (line.length < COL_COUNT) line.push('');
      wsData.push(line);
    });
    wsData.push(Array(COL_COUNT).fill('')); // spacer

    // 3) Optional grouped header strip (extend with empty cell over SL No)
    if (tpl.groupHeader && tpl.groupHeader.length) {
      const groupRow = [''];
      tpl.groupHeader.forEach(g => {
        groupRow.push(g.label || '');
        for (let s = 1; s < (g.span || 1); s++) groupRow.push('');
      });
      while (groupRow.length < COL_COUNT) groupRow.push('');
      wsData.push(groupRow);
    }

    // 4) Column header row(s)
    wsData.push(xCols.map(c => (c.header || '').replace(/\n/g, ' ')));

    // 5) Body rows — with optional equipment grouping
    const groupedRows = [];
    if (tpl.groupBy) {
      const groups = new Map();
      const ungrouped = [];
      sourceList.forEach(i => {
        const key = tpl.groupBy(i);
        if (!key) { ungrouped.push(i); return; }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
      });
      const dash = tpl.emptyDash || '-';
      // Each group gets a section banner row (label in col 1, blanks elsewhere)
      groups.forEach((items, key) => {
        const label = (tpl.groupHeaderLabel ? tpl.groupHeaderLabel(key, items) : key) || key;
        const banner = [label, ...Array(COL_COUNT - 1).fill('')];
        groupedRows.push(banner);
        items.forEach((inst, gIdx) =>
          groupedRows.push(xCols.map(c => {
            try { const v = c.accessor(inst, { idx: gIdx, ctx }); return v == null || v === '' ? dash : v; }
            catch (_) { return dash; }
          }))
        );
      });
      ungrouped.forEach((inst, gIdx) =>
        groupedRows.push(xCols.map(c => {
          try { const v = c.accessor(inst, { idx: gIdx, ctx }); return v == null || v === '' ? dash : v; }
          catch (_) { return dash; }
        }))
      );
    } else {
      const dash = tpl.emptyDash || '—';
      sourceList.forEach((inst, idx) =>
        groupedRows.push(xCols.map(c => {
          try { const v = c.accessor(inst, { idx, ctx }); return v == null || v === '' ? dash : v; }
          catch (_) { return dash; }
        }))
      );
    }
    wsData.push(...groupedRows);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = xCols.map(c => ({ wch: Math.max(6, Math.min(c.width || 14, 50)) }));

    // Summary sheet (kept generic — independent of template)
    const summaryData = [
      ['Category', 'Count'],
      ...Object.entries(result.category_summary || {}).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ['TOTAL', result.total || 0],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 28 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws,  tpl.sheetTitle);
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
    XLSX.writeFile(wb, `instrument_index_${(drawingNumber || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
  };

  // Backend export preferred (excel_url); client fallback otherwise — both kept.
  const handleExport = () => {
    if (result?.excel_url) handleDownloadExcel();
    else handleDownloadClientExcel();
    setEditedRows(new Set());   // "Edited" tags clear on export
  };

  // ── Filtered instruments (front-end only, Table view) ────────────────
  const filteredInstruments = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return allInstruments.filter(inst => {
      const catOk = filterCategory === 'All' || inst.category === filterCategory;
      const reviewOk = !reviewOnly || needsReviewRow(inst);
      const textOk = !q ||
        (inst.tag_number         || '').toLowerCase().includes(q) ||
        (inst.instrument_type    || '').toLowerCase().includes(q) ||
        (inst.service_description|| '').toLowerCase().includes(q) ||
        (inst.loop_number        || '').toLowerCase().includes(q) ||
        (inst.line_number        || '').toLowerCase().includes(q) ||
        (inst.equipment_number   || '').toLowerCase().includes(q) ||
        (inst.system             || '').toLowerCase().includes(q);
      return catOk && reviewOk && textOk;
    });
  }, [result, filterCategory, filterText, reviewOnly, activeLegend]);  // eslint-disable-line react-hooks/exhaustive-deps

  const uniqueCategories = useMemo(
    () => (result ? ['All', ...new Set(allInstruments.map(i => i.category || 'Unknown'))] : ['All']),
    [result]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Project list: search + per-card draft info (read-only IDB lookups) ──
  const liveProjects = (projects || []).filter(p => !p.archived);
  const [projectSearch, setProjectSearch] = useState('');
  const [draftsById, setDraftsById] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(liveProjects.map(async p => {
        try { return [p.id, await iiIdb.get(p.id)]; } catch (_) { return [p.id, null]; }
      }));
      if (!cancelled) setDraftsById(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [projects]);  // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return liveProjects;
    return liveProjects.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.client || '').toLowerCase().includes(q)
    );
  }, [liveProjects, projectSearch]);

  const cardInfo = (p) => {
    const d = draftsById[p.id];
    if (!d || !d.pidFile) return { lastDrawing: '—', status: 'No drawing yet' };
    const done = [
      Boolean(d.pidFile) && Boolean(d.confirmedStages?.upload),
      Boolean(d.legendFile) || Boolean(d.skippedStages?.legend) || Boolean(d.confirmedStages?.legend),
      Boolean(d.confirmedStages?.metadata) || Boolean(d.skippedStages?.metadata),
      d.byokChoice === 'byok',
    ];
    const idx = done.findIndex(x => !x);
    const nextStage = idx === -1 ? 4 : idx + 1;
    return {
      lastDrawing: d.drawingNumber || d.pidFile.name || '—',
      status: `Draft · Stage ${nextStage} of 4`,
    };
  };

  // ── Create / edit / delete (unchanged semantics) ─────────────────────
  const [createOpen, setCreateOpen]         = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);

  const handleCreateInline = ({ name, category }) => {
    const id = `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    upsertProject({ id, name, category });
    setActiveId(id);
    setCreateOpen(false);
  };

  const projectLabel = activeProject
    ? `${activeProject.client ? `${activeProject.client} · ` : ''}${activeProject.name}`
    : '';

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 1 — Project list (no active project)
  // ═══════════════════════════════════════════════════════════════════════
  if (!activeProject) {
    return (
      <div className="rd-page">
        <header style={{ marginBottom: '1.25rem' }}>
          <nav className="rd-text-muted" style={{ fontSize: FS.caption }}>
            Engineering / 1.3 Instrument / Instrument Index
          </nav>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <div>
              <h1 style={{ fontSize: FS.title, fontWeight: 700, margin: 0 }}>Instrument Index</h1>
              <p className="rd-text-muted" style={{ fontSize: FS.body, margin: '0.25rem 0 0' }}>
                Extract every instrument tag from P&amp;ID drawings, categorised by ISA 5.1 and cross-checked against the project legend.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="rd-btn rd-btn-secondary" onClick={() => navigate(LINE_LIST_PATH)}>
                Line List <ArrowTopRightOnSquareIcon width={16} />
              </button>
              <button className="rd-btn rd-btn-secondary" onClick={() => navigate(IO_LIST_PATH)}>
                IO List <ArrowTopRightOnSquareIcon width={16} />
              </button>
              <button className="rd-btn rd-btn-primary" onClick={() => setCreateOpen(true)}>
                <FolderPlusIcon width={16} /> New project
              </button>
            </div>
          </div>
        </header>

        {/* Toolbar: search + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
            <MagnifyingGlassIcon width={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--rd-text-faint)' }} />
            <input
              type="text"
              className="rd-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search projects…"
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
            />
          </div>
          <span className="rd-text-muted" style={{ fontSize: FS.caption }}>
            {filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'}
          </span>
        </div>

        {liveProjects.length === 0 ? (
          <div className="rd-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <FolderIcon width={40} style={{ color: 'var(--rd-text-faint)', margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: FS.section, fontWeight: 600, margin: 0 }}>No projects yet</h3>
            <p className="rd-text-muted" style={{ fontSize: FS.body, margin: '0.375rem 0 1rem' }}>
              Create a project to start extracting instruments.
            </p>
            <button className="rd-btn rd-btn-primary" onClick={() => setCreateOpen(true)}>
              <FolderPlusIcon width={16} /> New project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rd-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="rd-text-muted" style={{ fontSize: FS.body }}>
              No projects match &quot;{projectSearch}&quot;
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {filteredProjects.map(p => {
              const info = cardInfo(p);
              return (
                <div key={p.id} className="rd-card" style={{ width: 320, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Pill>{(p.client || 'No client').toUpperCase()}</Pill>
                    <span className="rd-text-muted" style={{ fontSize: FS.micro }}>Created {fmtDate(p.created_at)}</span>
                  </div>
                  <h3 style={{ fontSize: FS.section, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={p.name}>
                    {p.name}
                  </h3>
                  <div style={{ fontSize: FS.caption, display: 'grid', gap: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="rd-text-muted">Last drawing</span>
                      <span className="rd-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={info.lastDrawing}>{info.lastDrawing}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="rd-text-muted">Status</span>
                      <span>{info.status}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--rd-border-soft)' }}>
                    <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setEditingProject(p)}>
                      <PencilSquareIcon width={16} /> Edit
                    </button>
                    <button className="rd-btn rd-btn-secondary rd-btn-sm"
                      style={{ color: 'var(--rd-danger)', borderColor: 'var(--rd-danger)' }}
                      onClick={() => setDeletingProject(p)}>
                      <TrashIcon width={16} /> Delete
                    </button>
                    <button className="rd-btn rd-btn-primary rd-btn-sm" style={{ marginLeft: 'auto' }}
                      onClick={() => setActiveId(p.id)}>
                      Open <ChevronRightIcon width={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <QuickCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateInline} />
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={({ name, description }) => {
            upsertProject({ ...editingProject, name, description });
            setEditingProject(null);
          }}
        />
        <ConfirmDeleteModal
          project={deletingProject}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => { deleteProject(deletingProject.id); setDeletingProject(null); }}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW 2 — Project workspace (a project is open)
  // ═══════════════════════════════════════════════════════════════════════

  const byokLast4 = byokApiKey.trim() ? byokApiKey.trim().slice(-4) : '';

  const stageDefs = [
    { n: 1, title: 'Upload P&ID drawing', required: true,
      subtitle: 'Drag and drop or browse. Single-page and multi-page PDFs are supported.',
      resultLine: pidFile && confirmedStages.upload ? `${pidFile.name}${pidPageCount ? ` · ${pidPageCount} pages` : ''}` : '' },
    { n: 2, title: 'Legend cross-check', required: false,
      subtitle: 'Extracted tags are verified against the project legend (and matching sheets in AWS S3 when available). Without one, built-in defaults are used.',
      resultLine: legendMode === 'skip' && stageDone[2] ? 'Skipped'
        : (legendMode === 'use' || legendFile) && stageDone[2]
          ? (activeLegend?.name || 'Built-in defaults') : '' },
    { n: 3, title: 'Drawing info', required: false,
      subtitle: 'Stamped on the exported workbook. Filled from the file name and the project; edit if needed.',
      resultLine: skippedStages.metadata && !confirmedStages.metadata ? 'Skipped'
        : confirmedStages.metadata && drawingNumber ? `${drawingNumber} · Rev ${revision}` : '' },
    { n: 4, title: 'RADAI AI Engine (BYOK)', required: true,
      subtitle: 'Each page is read by AI Vision on your own Claude or OpenAI key. The key is never stored and never shown again.',
      resultLine: byokTestResult?.valid && byokLast4 ? `Using your key ••••${byokLast4}` : '' },
  ];

  const extractTooltip = !stageDone[1] ? 'Complete Stage 1 first'
    : !stageDone[2] ? 'Complete Stage 2 first'
    : !stageDone[3] ? 'Complete Stage 3 first'
    : !stageDone[4] ? 'Complete Stage 4 first'
    : 'Extract the instrument index';

  const stageToast = (n) => {
    if (n < 4) toast.success(`Stage ${n} complete · Stage ${n + 1} unlocked`);
    else toast.success('Ready to extract');
  };

  const readinessItems = [
    { label: 'P&ID uploaded', ok: stageDone[1] },
    { label: 'Legend cross-checked or skipped', ok: stageDone[2] },
    { label: 'Drawing info filled or skipped', ok: stageDone[3] },
    { label: 'AI key tested', ok: stageDone[4] },
  ];

  return (
    <div className="rd-page">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header style={{ marginBottom: '1rem' }}>
        <nav className="rd-text-muted" style={{ fontSize: FS.caption }}>
          Engineering / 1.3 Instrument /{' '}
          <button type="button" onClick={() => setActiveId(null)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--rd-accent)', fontSize: FS.caption, fontFamily: 'inherit' }}>
            Instrument Index
          </button>
          {' / '}{activeProject.name}
        </nav>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: FS.title, fontWeight: 700, margin: 0 }}>Instrument Index</h1>
              <Pill>{projectLabel}</Pill>
              {result
                ? <Pill tone="rd-pill-success">Extracted{pidPageCount ? ` · ${pidPageCount} pages` : ''}</Pill>
                : <Pill>Draft</Pill>}
            </div>
            <p className="rd-text-muted" style={{ fontSize: FS.body, margin: '0.25rem 0 0' }}>
              Extract every instrument tag from the P&amp;ID, review it by category, and export the index.
            </p>
          </div>
          {II_AUTOSAVE.enabled && draftSavedAt && (
            <span className="rd-text-muted" style={{ fontSize: FS.caption, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title={`Your upload and drawing details are auto-saved on this device. Last saved: ${new Date(draftSavedAt).toLocaleString()}`}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rd-success)', display: 'inline-block' }} />
              Draft auto-saved · {fmtTime(draftSavedAt)}
            </span>
          )}
        </div>
      </header>

      {/* ── Tabs + cross-links ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderBottom: '1px solid var(--rd-border-soft)', marginBottom: '1rem' }}>
        <div>
          <button className={`rd-tab ${activeTab === 'new' ? 'rd-tab-active' : ''}`} onClick={() => setActiveTab('new')}>
            New extraction <Pill>{completedCount} of 4</Pill>
          </button>
          <button
            className={`rd-tab ${activeTab === 'results' ? 'rd-tab-active' : ''}`}
            onClick={() => result && setActiveTab('results')}
            disabled={!result}
            title={result ? 'Extraction results' : 'Run an extraction first'}
            style={{ opacity: result ? 1 : 0.5, cursor: result ? 'pointer' : 'not-allowed' }}>
            Results {result && needsReviewCount > 0 && <Pill tone="rd-pill-warning">{needsReviewCount} to review</Pill>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => navigate(LINE_LIST_PATH)}>
            Open Line List <ArrowTopRightOnSquareIcon width={16} />
          </button>
          <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => navigate(IO_LIST_PATH)}>
            Generate IO List <ArrowTopRightOnSquareIcon width={16} />
          </button>
        </div>
      </div>

      {/* ── Legend strip ────────────────────────────────────────────── */}
      <div className="rd-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <BookOpenIcon width={16} style={{ color: 'var(--rd-text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: FS.body, fontWeight: 600 }}>Project legend</span>
        {legendLoading
          ? <Pill>Loading legend…</Pill>
          : activeLegend
            ? <Pill tone="rd-pill-success">Using {activeLegend.name}</Pill>
            : <Pill>Using built-in defaults</Pill>}
        <span className="rd-text-muted" style={{ fontSize: FS.caption, flex: 1, minWidth: 220 }}>
          A legend saved to this project is inherited by Line List, Equipment List, Instrument Index and P&amp;ID QC.
        </span>
        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setLegendModalOpen(true)}>
          Manage legends
        </button>
      </div>

      {/* ── Extraction error (draft kept; retry) ────────────────────── */}
      {error && (
        <div className="rd-banner rd-banner-danger" style={{ marginBottom: '1rem', justifyContent: 'space-between' }}>
          <span>Extraction failed — {error} Your draft is kept.</span>
          <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={handleExtract}>Try again</button>
        </div>
      )}

      {/* ═══ TAB: New extraction ═══ */}
      {activeTab === 'new' && (
        <div className="rd-card">
          <div className="rd-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: FS.section }}>Set up extraction</span>
            <span className="rd-text-muted" style={{ fontSize: FS.caption, fontWeight: 400 }}>
              Complete each stage in order. A stage unlocks only when the previous one is complete. Your draft is auto-saved.
            </span>
          </div>
          <div className="rd-card-body" style={{ display: 'grid', gap: '0.5rem' }}>
            {stageDefs.map((s) => {
              const done = stageDone[s.n];
              const unlocked = stageUnlocked[s.n];
              const active = openStage === s.n && unlocked;
              return (
                <div key={s.n} style={{ border: '1px solid var(--rd-border-soft)', borderRadius: 'var(--rd-radius-control)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => unlocked && !isProcessing && setOpenStage(active ? 0 : s.n)}
                    disabled={!unlocked || isProcessing}
                    style={{
                      display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 1rem', border: 'none', cursor: unlocked ? 'pointer' : 'not-allowed',
                      background: active ? 'var(--rd-primary-soft)' : 'var(--rd-surface)',
                      color: 'var(--rd-text)', opacity: unlocked ? 1 : 0.65, fontFamily: 'inherit',
                    }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: FS.caption, fontWeight: 700,
                      background: done ? 'var(--rd-success)' : unlocked ? 'var(--rd-primary)' : 'var(--rd-surface-subtle)',
                      color: done || unlocked ? '#fff' : 'var(--rd-text-faint)',
                    }}>
                      {done ? <CheckCircleIcon width={16} /> : unlocked ? s.n : <LockClosedIcon width={13} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: FS.body }}>Stage {s.n} · {s.title}</strong>
                        {s.required ? <Pill tone="rd-pill-info">Required</Pill> : <Pill>Optional</Pill>}
                        {!unlocked
                          ? <Pill>Locked</Pill>
                          : done
                            ? <Pill tone="rd-pill-success">Complete</Pill>
                            : <Pill tone="rd-pill-warning">In progress</Pill>}
                      </span>
                      <span className="rd-text-muted" style={{ display: 'block', fontSize: FS.caption, marginTop: 2 }}>
                        {!unlocked ? `Complete Stage ${s.n - 1} to unlock` : (s.resultLine || s.subtitle)}
                      </span>
                    </span>
                  </button>

                  {/* ── Stage 1 body: P&ID upload ── */}
                  {active && s.n === 1 && (
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--rd-border-soft)' }}>
                      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} hidden />
                      {!pidFile ? (
                        <div
                          className="rd-dropzone"
                          onDrop={handleDrop}
                          onDragOver={e => e.preventDefault()}
                          onClick={() => fileInputRef.current?.click()}
                          style={{ padding: '2rem', textAlign: 'center', cursor: 'pointer' }}>
                          <CloudArrowUpIcon width={32} style={{ color: 'var(--rd-text-faint)', margin: '0 auto 0.5rem' }} />
                          <p style={{ fontSize: FS.body, fontWeight: 500, margin: 0 }}>Drag and drop the P&amp;ID PDF or click to browse</p>
                          <p className="rd-text-muted" style={{ fontSize: FS.caption, margin: '0.25rem 0 0' }}>PDF · up to 100 MB · single or multi-page</p>
                        </div>
                      ) : (
                        <div style={{ border: '1px dashed var(--rd-success)', borderRadius: 'var(--rd-radius-control)', background: 'var(--rd-success-soft)', padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <CheckCircleIcon width={20} style={{ color: 'var(--rd-success)', flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 220, fontSize: FS.body, display: 'grid', gap: 4 }}>
                              <div><span className="rd-text-muted">File: </span><strong>{pidFile.name}</strong> <span className="rd-text-muted">· {(pidFile.size / 1024 / 1024).toFixed(2)} MB</span></div>
                              <div><span className="rd-text-muted">Pages: </span>{pidPageCount ?? '—'}</div>
                              <div><span className="rd-text-muted">Drawing number: </span><span className="rd-mono">{drawingNumber || '—'}</span> <span className="rd-text-muted">· Rev {revision} (read from file name)</span></div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => fileInputRef.current?.click()}>Replace file</button>
                              <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm"
                                style={{ color: 'var(--rd-danger)', borderColor: 'var(--rd-danger)' }}
                                onClick={removePidFile}>Remove</button>
                            </div>
                          </div>
                          <div style={{ marginTop: '0.75rem' }}>
                            <button type="button" className="rd-btn rd-btn-primary"
                              onClick={() => { confirmStage('upload'); setOpenStage(2); stageToast(1); }}>
                              Confirm file and continue
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Stage 2 body: legend cross-check ── */}
                  {active && s.n === 2 && (
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--rd-border-soft)' }}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <button type="button" className="rd-btn rd-btn-secondary" onClick={() => navigate(LEGEND_MANAGER_ROUTE)}>
                          <BookOpenIcon width={16} /> Open Legend Manager
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {[
                          { id: 'use', title: 'Use project legend',
                            sub: legendLoading ? 'Loading legend…'
                              : activeLegend ? `Active legend: ${activeLegend.name}`
                              : 'No project legend — built-in defaults are used' },
                          { id: 'skip', title: 'Skip cross-check',
                            sub: 'Tags are extracted but not verified against a legend' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setLegendMode(opt.id)}
                            style={{
                              textAlign: 'left', padding: '0.75rem 1rem', cursor: 'pointer',
                              border: `1px solid ${legendMode === opt.id ? 'var(--rd-accent)' : 'var(--rd-border)'}`,
                              borderRadius: 'var(--rd-radius-control)',
                              background: legendMode === opt.id ? 'var(--rd-info-soft)' : 'var(--rd-surface)',
                              color: 'var(--rd-text)', fontFamily: 'inherit',
                            }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS.body, fontWeight: 600 }}>
                              <span style={{
                                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${legendMode === opt.id ? 'var(--rd-accent)' : 'var(--rd-border)'}`,
                                background: legendMode === opt.id ? 'var(--rd-accent)' : 'transparent',
                                display: 'inline-block',
                              }} />
                              {opt.title}
                            </span>
                            <span className="rd-text-muted" style={{ display: 'block', fontSize: FS.caption, marginTop: 4, marginLeft: 22 }}>{opt.sub}</span>
                          </button>
                        ))}
                      </div>
                      <p className="rd-text-muted" style={{ fontSize: FS.caption, margin: '0 0 0.75rem' }}>
                        Legend sheets are managed centrally in the Legend Manager. Need a legend set up?{' '}
                        <button type="button" onClick={() => navigate(ICT_ROUTE)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--rd-accent)', fontSize: FS.caption, fontFamily: 'inherit' }}>
                          Raise a request with ICT
                        </button>
                      </p>
                      <button type="button" className="rd-btn rd-btn-primary" disabled={!legendMode}
                        title={legendMode ? 'Continue' : 'Choose an option first'}
                        onClick={() => { if (legendMode === 'skip') skipStage('legend'); confirmStage('legend'); setOpenStage(3); stageToast(2); }}>
                        Continue
                      </button>
                    </div>
                  )}

                  {/* ── Stage 3 body: drawing info ── */}
                  {active && s.n === 3 && (
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--rd-border-soft)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          Drawing number
                          <input type="text" value={drawingNumber} onChange={e => setDrawingNumber(e.target.value)}
                            placeholder="P16093-14-01-08-1602" disabled={isProcessing}
                            className="rd-input" style={{ marginTop: 4 }} />
                        </label>
                        <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          Drawing title
                          <input type="text" value={drawingTitle} onChange={e => setDrawingTitle(e.target.value)}
                            placeholder="e.g. Fuel gas KO drum" disabled={isProcessing}
                            className="rd-input" style={{ marginTop: 4 }} />
                        </label>
                        <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          Revision
                          <input type="text" value={revision} onChange={e => setRevision(e.target.value)}
                            placeholder="0" disabled={isProcessing}
                            className="rd-input" style={{ marginTop: 4 }} />
                        </label>
                        <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          Project
                          <input type="text" value={projectLabel} readOnly disabled
                            title="From the active project"
                            className="rd-input"
                            style={{ marginTop: 4, background: 'var(--rd-surface-subtle)', color: 'var(--rd-text-muted)' }} />
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="rd-btn rd-btn-ghost"
                          onClick={() => { skipStage('metadata'); setOpenStage(4); stageToast(3); }}>
                          Skip
                        </button>
                        <button type="button" className="rd-btn rd-btn-primary"
                          onClick={() => { confirmStage('metadata'); setOpenStage(4); stageToast(3); }}>
                          Save and continue
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Stage 4 body: RADAI AI Engine (BYOK) — Required ── */}
                  {active && s.n === 4 && (
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--rd-border-soft)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          Provider
                          <select
                            value={byokProvider}
                            onChange={e => { setByokProvider(e.target.value); setByokModel(''); setByokTestResult(null); }}
                            disabled={isProcessing}
                            className="rd-select" style={{ marginTop: 4 }}>
                            <option value="claude">Claude (Anthropic)</option>
                            <option value="openai">OpenAI (GPT-4o)</option>
                          </select>
                        </label>
                        <div style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          API key *
                          <div style={{ display: 'flex', gap: '0.375rem', marginTop: 4 }}>
                            <input
                              type="password"
                              value={byokApiKey}
                              onChange={e => { setByokApiKey(e.target.value); setByokTestResult(null); }}
                              placeholder={byokProvider === 'claude' ? 'sk-ant-…' : 'sk-…'}
                              autoComplete="off"
                              disabled={isProcessing}
                              className="rd-input" style={{ flex: 1 }}
                            />
                            {/* Enabled as soon as provider + key are non-empty */}
                            <button
                              type="button"
                              onClick={handleByokTest}
                              disabled={isProcessing || byokTesting || !byokProvider || !byokApiKey.trim()}
                              className="rd-btn rd-btn-secondary"
                              title="Validate the key with one minimal provider call">
                              {byokTesting ? 'Testing…' : 'Test key'}
                            </button>
                          </div>
                          {byokTestResult && (
                            <p style={{
                              fontSize: FS.caption, margin: '0.375rem 0 0', fontWeight: 500,
                              color: byokTestResult.valid ? 'var(--rd-success)' : 'var(--rd-danger)',
                            }}>
                              {byokTestResult.valid
                                ? `Key valid · ${byokTestResult.elapsedS ?? 1} s`
                                : byokTestResult.message}
                            </p>
                          )}
                        </div>
                        <label style={{ fontSize: FS.caption, fontWeight: 600 }}>
                          Model
                          <select
                            value={byokModel}
                            onChange={e => { setByokModel(e.target.value); setByokTestResult(null); }}
                            disabled={isProcessing}
                            className="rd-select" style={{ marginTop: 4 }}>
                            {(byokProvider === 'claude'
                              ? [
                                  ['', 'Claude default (Opus 5)'],
                                  ['claude-sonnet-5', 'Claude Sonnet 5'],
                                  ['claude-opus-5', 'Claude Opus 5'],
                                  ['claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5'],
                                ]
                              : [
                                  ['', 'OpenAI default (gpt-4o)'],
                                  ['gpt-4o', 'GPT-4o'],
                                  ['gpt-4o-mini', 'GPT-4o mini (cheaper)'],
                                ]
                            ).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {/* Violet (primary) accents — AI affordances only */}
                      {byokTestResult?.valid && byokLast4 && (
                        <p style={{ margin: '0 0 0.5rem' }}>
                          <span className="rd-pill" style={{
                            color: 'var(--rd-primary)', background: 'var(--rd-primary-soft)',
                            borderColor: 'var(--rd-primary)',
                          }}>
                            <KeyIcon width={16} /> Using your key ••••{byokLast4}{byokTestedAt ? ` · tested ${fmtTime(byokTestedAt)}` : ''}
                          </span>
                        </p>
                      )}
                      {BYOK_COST_CONFIG.enabled && byokCostEstimate && (
                        <p style={{
                          fontSize: FS.caption, margin: '0 0 0.5rem', padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--rd-radius-control)',
                          color: 'var(--rd-primary)', background: 'var(--rd-primary-soft)',
                          border: '1px solid var(--rd-primary)',
                        }}>
                          Estimated cost for this drawing: about ${byokCostEstimate.cost.toFixed(2)} · about {byokCostEstimate.tokens.toLocaleString()} tokens
                          ({pidPageCount} page{pidPageCount === 1 ? '' : 's'} · 4 zoomed tiles per page).
                          Billed by the provider to your own key; the platform never bills you.
                        </p>
                      )}
                      <p className="rd-text-muted" style={{ fontSize: FS.caption, margin: '0 0 0.75rem' }}>
                        No key?{' '}
                        <button type="button" onClick={() => navigate(ICT_ROUTE)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--rd-accent)', fontSize: FS.caption, fontFamily: 'inherit' }}>
                          Raise a ticket with ICT
                        </button>
                        {' '}to get one issued.
                      </p>
                      {/* Continue enabled only after a passed test */}
                      <button type="button" className="rd-btn rd-btn-primary"
                        disabled={!stageDone[4]}
                        title={stageDone[4] ? 'Continue' : 'Test a valid API key first'}
                        onClick={() => { setByokChoice('byok'); stageToast(4); }}>
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Readiness row ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
              padding: '0.75rem 1rem', borderTop: '1px solid var(--rd-border-soft)', marginTop: '0.5rem',
            }}>
              <span style={{ fontSize: FS.caption, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--rd-text-muted)' }}>
                Readiness
              </span>
              {readinessItems.map(item => (
                <span key={item.label} className="rd-text-muted" style={{ fontSize: FS.caption, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {item.ok
                    ? <CheckCircleIcon width={14} style={{ color: 'var(--rd-success)' }} />
                    : <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--rd-border)', display: 'inline-block' }} />}
                  {item.label}
                </span>
              ))}
              <button
                type="button"
                className="rd-btn rd-btn-primary"
                style={{ marginLeft: 'auto' }}
                disabled={isProcessing || !(stageDone[1] && stageDone[2] && stageDone[3] && stageDone[4])}
                title={extractTooltip}
                onClick={handleExtract}>
                {isProcessing
                  ? (statusMessage || `Extracting${pidPageCount ? ` page 1 of ${pidPageCount}` : ''}…`)
                  : 'Extract instrument index'}
              </button>
            </div>
            {isProcessing && (
              <div style={{ padding: '0 1rem 1rem' }}>
                <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--rd-surface-subtle)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(5, progress)}%`, height: '100%', background: 'var(--rd-accent)', transition: 'width 0.7s' }} />
                </div>
                <p className="rd-text-muted" style={{ fontSize: FS.caption, marginTop: 6 }}>{statusMessage} · {Math.round(progress)}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Results ═══ */}
      {activeTab === 'results' && result && (() => {
        const tpl = getInstrumentTemplate(activeProject?.category);
        const useTpl = tpl.id !== 'default'; // ADNOC Gas (and future bespoke templates)

        const totalRows = filteredInstruments.length;
        const pageCount = Math.max(1, Math.ceil(totalRows / tablePageSize));
        const safePage  = Math.min(Math.max(1, tablePage), pageCount);
        const pagedInstruments = filteredInstruments.slice((safePage - 1) * tablePageSize, safePage * tablePageSize);

        // Selection helpers — selection operates on the full filtered set.
        const indexOfInst = (inst) => result.instruments.indexOf(inst);
        const visibleIdx  = filteredInstruments.map(indexOfInst);
        const allVisibleSelected = visibleIdx.length > 0 && visibleIdx.every(i => selectedRows.has(i));
        const someVisibleSelected = visibleIdx.some(i => selectedRows.has(i));
        const toggleRow = (i) => {
          const next = new Set(selectedRows);
          if (next.has(i)) next.delete(i); else next.add(i);
          setSelectedRows(next);
        };
        const toggleAllVisible = () => {
          const next = new Set(selectedRows);
          if (allVisibleSelected) visibleIdx.forEach(i => next.delete(i));
          else                    visibleIdx.forEach(i => next.add(i));
          setSelectedRows(next);
        };

        const visibleCols = RESULT_COLUMNS.filter(c => !hiddenCols.has(c.key));

        const lineEquip = (inst) =>
          [inst.line_number, inst.equipment_number].filter(Boolean).join(' · ') || '—';

        const legendPill = (inst) => {
          const st = legendStatusOf(inst);
          if (st === 'verified') return <Pill tone="rd-pill-success">Verified</Pill>;
          if (st === 'not-in-legend') return <Pill tone="rd-pill-warning">Not in legend</Pill>;
          return <Pill>No legend</Pill>;
        };

        const confidenceCell = (inst) => {
          if (typeof inst.confidence !== 'number') return '—';
          const v = inst.confidence.toFixed(2);
          return isLowConfidence(inst)
            ? <span style={{ color: 'var(--rd-warning)', fontWeight: 600 }}>Low {v}</span>
            : <span style={{ color: 'var(--rd-success)' }} className="rd-mono">{v}</span>;
        };

        const cellValue = (inst, key) => {
          if (key === 'legend_status') return legendPill(inst);
          if (key === 'confidence') return confidenceCell(inst);
          if (key === 'line_equipment') return lineEquip(inst);
          return inst[key] || '—';
        };

        return (
          <>
            {/* ── KPI tiles ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="rd-kpi rd-card">
                <div className="rd-kpi-value">{result.total ?? allInstruments.length}</div>
                <div className="rd-kpi-label">Instrument tags{pidPageCount ? ` · ${pidPageCount} pages · duplicates removed` : ' · duplicates removed'}</div>
              </div>
              <div className="rd-kpi rd-card">
                <div className="rd-kpi-value">{Object.keys(result.category_summary || {}).length}</div>
                <div className="rd-kpi-label">Categories · ISA 5.1 first letter</div>
              </div>
              <div className="rd-kpi rd-card">
                <div className="rd-kpi-value" style={{ color: verifiedCount ? 'var(--rd-success)' : undefined }}>{verifiedCount}</div>
                <div className="rd-kpi-label">Verified by legend · of {allInstruments.length}{activeLegend ? ` · ${activeLegend.name}` : ''}</div>
              </div>
              <div className="rd-kpi rd-card">
                <div className="rd-kpi-value" style={{ color: needsReviewCount ? 'var(--rd-warning)' : undefined }}>{needsReviewCount}</div>
                <div className="rd-kpi-label">Needs review · {notInLegendCount} not in legend · {lowConfidenceCount} low confidence</div>
              </div>
              <div className="rd-kpi rd-card">
                <div className="rd-kpi-value">{loopCount}</div>
                <div className="rd-kpi-label">Loops</div>
              </div>
            </div>

            {/* ── Review banner (hidden when 0) ── */}
            {needsReviewCount > 0 && (
              <div className="rd-banner rd-banner-warning" style={{ marginBottom: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>
                  <ExclamationTriangleIcon width={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  {needsReviewCount} tags need review before export — tags not found in the legend, or read with low confidence. Edit inline, then confirm.
                </span>
                <span style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pill tone="rd-pill-warning">Not in legend | {notInLegendCount}</Pill>
                  <Pill tone="rd-pill-warning">Low confidence | {lowConfidenceCount}</Pill>
                  <button type="button" className="rd-btn rd-btn-primary rd-btn-sm"
                    onClick={() => { setResultView('table'); setReviewOnly(true); setFilterCategory('All'); setTablePage(1); }}>
                    Review tags <ChevronRightIcon width={16} />
                  </button>
                </span>
              </div>
            )}

            {/* ── Empty results ── */}
            {allInstruments.length === 0 && (
              <div className="rd-card" style={{ padding: '3rem', textAlign: 'center', marginBottom: '1rem' }}>
                <MagnifyingGlassIcon width={40} style={{ color: 'var(--rd-text-faint)', margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: FS.section, fontWeight: 600, margin: 0 }}>No instrument tags found on this drawing</h3>
                <p className="rd-text-muted" style={{ fontSize: FS.body, marginTop: 6 }}>
                  Check the page orientation or try a higher-quality PDF.
                </p>
              </div>
            )}

            {allInstruments.length > 0 && (
              <div className="rd-card" style={{ marginBottom: '1rem' }}>
                <div className="rd-card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: FS.section }}>Instrument index</span>
                    <div className="rd-text-muted" style={{ fontSize: FS.caption, fontWeight: 400, marginTop: 2 }}>
                      {(drawingNumber || '—')} · Rev {revision} · categorised by ISA 5.1 · click a value to edit
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {/* View toggle */}
                    {[
                      { id: 'table',      label: 'Table',      icon: TableCellsIcon },
                      { id: 'categories', label: 'Categories', icon: ChartBarIcon },
                      { id: 'isa',        label: 'ISA matrix', icon: Squares2X2Icon },
                    ].map(v => (
                      <button key={v.id} type="button"
                        className={`rd-btn rd-btn-sm ${resultView === v.id ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                        onClick={() => setResultView(v.id)}>
                        <v.icon width={16} /> {v.label}
                      </button>
                    ))}
                    {/* Columns menu (Table view only) */}
                    <div style={{ position: 'relative' }}>
                      <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm"
                        onClick={() => setColsMenuOpen(v => !v)}>
                        Columns
                      </button>
                      {colsMenuOpen && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setColsMenuOpen(false)} />
                          <div className="rd-card" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 40, minWidth: 200, padding: 6 }}>
                            {RESULT_COLUMNS.filter(c => c.optional).map(c => (
                              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.375rem 0.5rem', fontSize: FS.caption, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!hiddenCols.has(c.key)}
                                  onChange={() => setHiddenCols(prev => {
                                    const next = new Set(prev);
                                    if (next.has(c.key)) next.delete(c.key); else next.add(c.key);
                                    return next;
                                  })}
                                />
                                {c.label}
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <button type="button" className="rd-btn rd-btn-primary rd-btn-sm" onClick={handleExport}
                      title={selectedRows.size > 0 ? `Export ${selectedRows.size} selected rows` : 'Export all rows'}>
                      <ArrowDownTrayIcon width={16} /> Export Excel
                    </button>
                  </div>
                </div>

                {/* ── TABLE VIEW ── */}
                {resultView === 'table' && (
                  <>
                    {/* Search + count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem 0', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', width: 340, maxWidth: '100%' }}>
                        <MagnifyingGlassIcon width={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--rd-text-faint)' }} />
                        <input
                          type="text"
                          className="rd-input"
                          style={{ paddingLeft: 32, minHeight: 36 }}
                          placeholder="Search tag, service, loop, line or equipment…"
                          value={searchInput}
                          onChange={e => setSearchInput(e.target.value)}
                        />
                      </div>
                      <span className="rd-text-muted" style={{ fontSize: FS.caption }}>
                        {filteredInstruments.length} of {allInstruments.length} tags
                      </span>
                      {searchInput && (
                        <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm"
                          onClick={() => { setSearchInput(''); setFilterText(''); }}>
                          Clear search
                        </button>
                      )}
                      {reviewOnly && (
                        <Pill tone="rd-pill-warning">
                          Review filter on
                          <button type="button" onClick={() => setReviewOnly(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex' }}
                            title="Clear review filter">
                            <XMarkIcon width={14} />
                          </button>
                        </Pill>
                      )}
                    </div>

                    {/* Category chips */}
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', padding: '0.625rem 1.25rem 0.875rem' }}>
                      {uniqueCategories.map(cat => {
                        const count = cat === 'All' ? allInstruments.length
                          : allInstruments.filter(i => (i.category || 'Unknown') === cat).length;
                        const active = filterCategory === cat;
                        const style = cat === 'All' ? null : categoryStyle(cat);
                        return (
                          <button key={cat} type="button"
                            onClick={() => { setFilterCategory(cat); setTablePage(1); }}
                            className="rd-pill"
                            style={{
                              cursor: 'pointer', fontFamily: 'inherit',
                              background: active ? (style ? style.bg : 'var(--rd-primary-soft)') : 'var(--rd-surface)',
                              color: active ? (style ? style.text : 'var(--rd-primary)') : 'var(--rd-text-muted)',
                              borderColor: active ? (style ? style.text : 'var(--rd-primary)') : 'var(--rd-border)',
                            }}>
                            {style && <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.text, display: 'inline-block' }} />}
                            {cat} · {count}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="rd-table">
                        <thead>
                          <tr>
                            <th style={{ width: 32 }}>
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                                onChange={toggleAllVisible}
                                title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                              />
                            </th>
                            <th>Tag</th>
                            {visibleCols.map(c => <th key={c.key}>{c.label}</th>)}
                            <th style={{ width: 56, textAlign: 'center' }}>Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedInstruments.length === 0 ? (
                            <tr>
                              <td colSpan={visibleCols.length + 3} style={{ textAlign: 'center', padding: '2.5rem' }}>
                                <span className="rd-text-muted" style={{ fontSize: FS.body }}>
                                  {filterText ? <>No tags match &quot;{filterText}&quot;{' '}
                                    <button type="button" className="rd-btn rd-btn-ghost rd-btn-sm"
                                      onClick={() => { setSearchInput(''); setFilterText(''); }}>Clear search</button>
                                  </> : 'No instruments match the current filter.'}
                                </span>
                              </td>
                            </tr>
                          ) : (
                            pagedInstruments.map((inst, idx) => {
                              const realIdx = indexOfInst(inst);
                              const isSelected = selectedRows.has(realIdx);
                              const style = categoryStyle(inst.category);
                              const review = needsReviewRow(inst);
                              return (
                                <tr key={idx}
                                  style={review ? { background: 'var(--rd-warning-soft)' } : undefined}>
                                  <td>
                                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(realIdx)} />
                                  </td>
                                  <td>
                                    <span className="rd-mono" style={{ fontWeight: 700, color: style.text }}>
                                      {inst.tag_number || '—'}
                                    </span>
                                    {editedRows.has(realIdx) && (
                                      <span className="rd-pill rd-pill-info" style={{ marginLeft: 6, fontSize: FS.micro }}>Edited</span>
                                    )}
                                    {Array.isArray(inst.warnings) && inst.warnings.length > 0 && (
                                      <span title={inst.warnings.join(' · ')}
                                        className="rd-pill rd-pill-warning" style={{ marginLeft: 6, fontSize: FS.micro, cursor: 'help' }}>!</span>
                                    )}
                                  </td>
                                  {visibleCols.map(c => (
                                    <td key={c.key}>
                                      {c.key === 'category' ? (
                                        <span className="rd-pill" style={{ background: style.bg, color: style.text, borderColor: style.text }}>
                                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.text, display: 'inline-block' }} />
                                          {inst.category || '—'}
                                        </span>
                                      ) : cellValue(inst, c.key)}
                                    </td>
                                  ))}
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => setEditingRow({ idx: realIdx, draft: { ...inst } })}
                                      title="Edit this row"
                                      className="rd-btn rd-btn-ghost rd-btn-sm"
                                      style={{ minHeight: 28, padding: '0 0.375rem' }}>
                                      <PencilSquareIcon width={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pager */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1.25rem', borderTop: '1px solid var(--rd-border-soft)', fontSize: FS.caption, flexWrap: 'wrap' }}>
                      <span className="rd-text-muted tabular-nums">
                        {totalRows === 0 ? '0' : `${(safePage - 1) * tablePageSize + 1}–${Math.min(safePage * tablePageSize, totalRows)}`} of {totalRows}
                      </span>
                      {selectedRows.size > 0 && (
                        <span style={{ color: 'var(--rd-accent)', fontWeight: 600 }}>
                          · {selectedRows.size} selected
                        </span>
                      )}
                      {useTpl && <span className="rd-text-muted">· Template: {tpl.label}</span>}
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <label className="rd-text-muted">
                          Rows per page{' '}
                          <select value={tablePageSize}
                            onChange={e => { setTablePageSize(Number(e.target.value)); setTablePage(1); }}
                            className="rd-select" style={{ width: 'auto', minHeight: 28, display: 'inline-block', fontSize: FS.caption }}>
                            {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm"
                          style={{ minHeight: 28, padding: '0 0.5rem' }}
                          onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹</button>
                        <span className="rd-text-muted tabular-nums">{safePage} / {pageCount}</span>
                        <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm"
                          style={{ minHeight: 28, padding: '0 0.5rem' }}
                          onClick={() => setTablePage(p => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount}>›</button>
                      </span>
                    </div>
                  </>
                )}

                {/* ── CATEGORIES VIEW: horizontal bar list ── */}
                {resultView === 'categories' && (
                  <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.625rem' }}>
                    {Object.entries(result.category_summary || {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, cnt]) => {
                        const style = categoryStyle(cat);
                        const total = result.total || allInstruments.length || 1;
                        const pct = Math.max(2, (cnt / total) * 100);
                        return (
                          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: FS.body }}>
                            <span style={{ width: 160, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.text, display: 'inline-block', flexShrink: 0 }} />
                              {cat}
                            </span>
                            <span style={{ flex: 1, height: 14, borderRadius: 4, background: 'var(--rd-surface-subtle)', overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: style.bg, borderRight: `2px solid ${style.text}` }} />
                            </span>
                            <span className="rd-mono" style={{ width: 48, textAlign: 'right', fontWeight: 700 }}>{cnt}</span>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* ── ISA MATRIX VIEW (measured variable × function) ── */}
                {resultView === 'isa' && (() => {
                  // ISA 5.1 measured-variable first letters (rows)
                  const ISA_MEASURED = [
                    { letter: 'F', name: 'Flow' },
                    { letter: 'P', name: 'Pressure' },
                    { letter: 'T', name: 'Temperature' },
                    { letter: 'L', name: 'Level' },
                    { letter: 'A', name: 'Analysis' },
                    { letter: 'd', name: 'Differential Pressure' },
                    { letter: 'Z', name: 'Position / Actuator' },
                    { letter: 'S', name: 'Safety / Speed / Limit' },
                    { letter: 'W', name: 'Weight / Force' },
                    { letter: 'J', name: 'Power / Elect.' },
                    { letter: 'X', name: 'Unknown / Other' },
                  ];
                  // ISA 5.1 function suffix letters (columns)
                  const ISA_FUNCTIONS = [
                    { code: 'T',   label: 'Transmitter' },
                    { code: 'I',   label: 'Indicator' },
                    { code: 'IC',  label: 'Ind. Control.' },
                    { code: 'C',   label: 'Controller' },
                    { code: 'CV',  label: 'Ctrl. Valve' },
                    { code: 'V',   label: 'Valve' },
                    { code: 'S',   label: 'Switch' },
                    { code: 'SH',  label: 'Switch Hi' },
                    { code: 'SL',  label: 'Switch Lo' },
                    { code: 'SHH', label: 'Switch HiHi' },
                    { code: 'SLL', label: 'Switch LoLo' },
                    { code: 'AH',  label: 'Alarm Hi' },
                    { code: 'AL',  label: 'Alarm Lo' },
                    { code: 'E',   label: 'Element' },
                    { code: 'G',   label: 'Gauge' },
                    { code: 'R',   label: 'Recorder' },
                    { code: 'Y',   label: 'Relay/Comput.' },
                  ];

                  // Parse ISA first letter from a tag number (unchanged logic)
                  const parseTagMeasured = (tag) => {
                    if (!tag) return 'X';
                    const m = tag.match(/^([A-Za-z]{1,3})-?\d/);
                    if (!m) return 'X';
                    const prefix = m[1].toUpperCase();
                    if (prefix.startsWith('DP') || prefix.startsWith('d')) return 'd';
                    return prefix[0];
                  };
                  // Parse ISA function suffix (longest match first; unchanged logic)
                  const FUNC_PRIORITY = ['SHH','SLL','SH','SL','IC','CV','AH','AL','T','I','C','V','S','E','G','R','Y'];
                  const parseTagFn = (tag) => {
                    if (!tag) return null;
                    const m = tag.match(/^[A-Za-z]+/);
                    if (!m) return null;
                    const prefix = m[0].toUpperCase();
                    const letters = prefix.replace(/^[FLPTA-Z]/, '');
                    for (const fn of FUNC_PRIORITY) {
                      if (letters.endsWith(fn) || letters === fn) return fn;
                    }
                    return null;
                  };

                  const matrix = {};
                  for (const inst of allInstruments) {
                    const mv = parseTagMeasured(inst.tag_number);
                    const fn = parseTagFn(inst.tag_number) || '—';
                    if (!matrix[mv]) matrix[mv] = {};
                    if (!matrix[mv][fn]) matrix[mv][fn] = 0;
                    matrix[mv][fn] += 1;
                  }
                  const activeFns = ISA_FUNCTIONS.filter(f =>
                    ISA_MEASURED.some(mv => (matrix[mv.letter]?.[f.code] || 0) > 0)
                  );
                  const rowTotal = (mv) => activeFns.reduce((s, fn) => s + (matrix[mv]?.[fn.code] || 0), 0);
                  const grandTotal = allInstruments.length;

                  return (
                    <div style={{ overflowX: 'auto', padding: '0 1.25rem 1rem' }}>
                      <table className="rd-table">
                        <thead>
                          <tr>
                            <th>Measured variable</th>
                            {activeFns.map(fn => (
                              <th key={fn.code} style={{ textAlign: 'center' }} title={fn.label}>
                                <span className="rd-mono">{fn.code}</span>
                              </th>
                            ))}
                            <th style={{ textAlign: 'center' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ISA_MEASURED.map(mv => {
                            const total = rowTotal(mv.letter);
                            if (total === 0) return null;
                            return (
                              <tr key={mv.letter}>
                                <td>
                                  <span className="rd-mono" style={{ fontWeight: 700, marginRight: 6 }}>{mv.letter}</span>
                                  {mv.name}
                                </td>
                                {activeFns.map(fn => {
                                  const cnt = matrix[mv.letter]?.[fn.code] || 0;
                                  return (
                                    <td key={fn.code} style={{ textAlign: 'center' }}
                                      className={cnt > 0 ? 'rd-mono' : 'rd-text-muted'}>
                                      {cnt > 0 ? cnt : '—'}
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'center', fontWeight: 700 }} className="rd-mono">{total}</td>
                              </tr>
                            );
                          })}
                          <tr>
                            <td style={{ fontWeight: 700 }}>Total</td>
                            {activeFns.map(fn => {
                              const colTotal = ISA_MEASURED.reduce((s, mv) => s + (matrix[mv.letter]?.[fn.code] || 0), 0);
                              return (
                                <td key={fn.code} style={{ textAlign: 'center', fontWeight: 700 }} className="rd-mono">
                                  {colTotal > 0 ? colTotal : '—'}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'center', fontWeight: 700 }} className="rd-mono">{grandTotal}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Export strip ── */}
            {allInstruments.length > 0 && (
              <div className="rd-card" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: FS.caption, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--rd-text-muted)' }}>
                  Export
                </span>
                <span className="rd-text-muted" style={{ fontSize: FS.caption, flex: 1, minWidth: 240 }}>
                  Excel workbook with two sheets: Instrument Index (all tags, category colours) and Summary (category counts).
                </span>
                <button type="button" className="rd-btn rd-btn-secondary" onClick={() => navigate(IO_LIST_PATH)}>
                  Generate IO List <ArrowTopRightOnSquareIcon width={16} />
                </button>
                <button type="button" className="rd-btn rd-btn-primary" onClick={handleExport}>
                  <ArrowDownTrayIcon width={16} /> Export Excel
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* ── Edit Instrument Row Modal ─────────────────────────────────── */}
      <EditInstrumentModal
        open={!!editingRow}
        draft={editingRow?.draft}
        fields={(getInstrumentTemplate(activeProject?.category)?.editableFields) || []}
        onChange={(next) => setEditingRow(prev => prev ? { ...prev, draft: next } : prev)}
        onClose={() => setEditingRow(null)}
        onSave={handleSaveEditedRow}
      />

      {/* ── Shared Legend Sheets modal (existing modal, unchanged) ──── */}
      <LegendSheetsModal
        open={legendModalOpen}
        onClose={() => setLegendModalOpen(false)}
        section="instrument_index"
      />
    </div>
  );
};

export default InstrumentIndex;
