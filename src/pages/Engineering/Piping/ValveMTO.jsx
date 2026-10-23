/**
 * VALVE MTO — Piping Valve Material Take-Off (staged extraction flow)
 *
 * Canonical route: /engineering/piping/valve-mto
 *   (legacy /engineering/piping/pms redirects here — see App.jsx)
 * Deep links: ?stage=1..4 focuses a stage; /register opens the register.
 *
 * Flow (fixed order, gated — §2):
 *   Stage 1 P&ID (PDF parse, title block, line-number pattern)
 *   Stage 2 PMS (class coverage; skippable)
 *   Stage 3 RADAI AI Engine (server-configured; settings)
 *   Stage 4 Valve Legend (match check vs drawing; mapping)
 *   → Start Extraction → register (ISLAND / FIELD / COMBINED / Order list /
 *     Review) with inline editing, Excel import/export and server
 *     persistence.
 *
 * Styling: radai-tokens.css (--rd-* tokens + .rd-* component classes)
 * only — no ad-hoc colours, no emoji (line icons only).
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircleIcon, LockClosedIcon, ChevronDownIcon, ChevronRightIcon,
  CloudArrowUpIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, BookOpenIcon,
  EllipsisHorizontalIcon, XMarkIcon, ExclamationTriangleIcon,
  DocumentArrowUpIcon, ArrowPathIcon, EyeIcon, PlusIcon, TrashIcon,
  MagnifyingGlassIcon, TableCellsIcon, BoltIcon, AdjustmentsHorizontalIcon,
  ArrowsPointingOutIcon, ArrowsPointingInIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';

import valveMtoService from '../../../services/valveMtoService';
import * as valveMtoLegendService from '../../../services/valveMtoLegendService';
import projectOrganizerService from '../../../services/projectOrganizerService';
import {
  ProjectCard, ProjectFormModal, ProjectSwitcher, useActiveProject,
} from '../../../components/ProjectOrganizer';
import { PROJECT_ORGANIZER_CONFIG } from '../../../config/projectOrganizer.config';
import {
  allocationTab, DEFAULT_ROW, DEFAULT_FILENAME,
} from '../../../config/valveMTO.config';
import importValveMTOFile from '../../../config/valveMTOImporter';
import exportValveMTOWorkbook, { exportValveMTOAllData } from '../../../config/valveMTOExporter';
import LegendSheetsModal from '../Process/components/LegendSheetsModal';

// ---------------------------------------------------------------------------
// Soft-coded config
// ---------------------------------------------------------------------------
const VM_PROJECTS = {
  toolCode: 'piping_pms',
  storageKey: 'valveMTOActiveProject',
  theme: PROJECT_ORGANIZER_CONFIG.defaultTheme,
  createTitle: 'New Valve MTO Project',
};

// Mapping organizer project_id → server ValveMTOProject id.
const SERVER_LINK_KEY = 'radai.valveMTO.serverProjects.v1';

// Legend Manager (§4): shared LegendSheetsModal UI, Valve MTO's OWN
// isolated legend table via the legendApi prop bundle.
const VM_LEGEND_SECTION_IDS = ['valve', 'piping', 'line_list', 'instrument_signal',
  'control_valve_regulator', 'scope_symbols', 'limit_line'];
const VM_LEGEND_API = {
  listLegends: valveMtoLegendService.listLegends,
  createLegend: valveMtoLegendService.createLegend,
  updateLegend: valveMtoLegendService.updateLegend,
  deleteLegend: valveMtoLegendService.deleteLegend,
  activateLegend: valveMtoLegendService.activateLegend,
  previewLegendWorkbook: valveMtoLegendService.previewLegendWorkbook,
  importLegendWorkbook: valveMtoLegendService.importLegendWorkbook,
  sections: VM_LEGEND_SECTION_IDS.map((id) => ({ id, label: id.replaceAll('_', ' ') })),
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_WAIT_MS = 60 * 60 * 1000;

const STAGES = [
  { n: 1, key: 'pid', title: 'P&ID', subtitle: 'Upload and parse the source P&ID drawing' },
  { n: 2, key: 'pms', title: 'PMS', subtitle: 'Piping Material Specification — class coverage' },
  { n: 3, key: 'engine', title: 'RADAI AI Engine', subtitle: 'Server-configured extraction engine' },
  { n: 4, key: 'legend', title: 'Valve Legend', subtitle: 'Match the valve legend to this drawing' },
];

const LINE_PATTERN_PRESETS = [
  { id: 'service-seq-size-class-insul', label: 'SERVICE-SEQ-SIZE-CLASS-INSUL', example: 'P-51220-18"-31170-C' },
  { id: 'size-unit-fluid-seq-class-insul', label: 'SIZE-UNIT-FLUID-SEQ-CLASS-INSUL', example: '8"-2600-P-305-11051YR-I' },
  { id: 'unit-fluid-seq-class-insul', label: 'UNIT-FLUID-SEQ-CLASS-INSUL', example: '2600-AY-005-17091R-V' },
  { id: 'size-fluid-class-seq-insul', label: 'SIZE-FLUID-CLASS-SEQ-INSUL', example: '6-PL-DC3N-8166-P' },
  { id: 'custom', label: 'Custom', example: 'Named-group regex (size/class/fluid/seq/insul)' },
];

// Ready-made custom-regex templates (Python named groups) so users can pick
// a close starting point instead of writing a regex from scratch. Selecting
// one fills the custom input and re-runs the parse immediately.
const CUSTOM_REGEX_TEMPLATES = [
  {
    id: 'adnoc-extended',
    label: 'ADNOC extended — U-prefixed / letter-suffixed / 6-digit seq, 4–6 char class',
    example: 'P-U51316-8"-PA0D1-C · P-51524A-1"-PA0D-C',
    regex: '^(?P<fluid>[A-Z]{1,3})-(?P<seq>U?\\d{5,6}[A-Z]?)-(?P<size>\\d+(?:\\.\\d+)?)["\']?-(?P<class>[A-Z0-9]{4,6})(?:-(?P<insul>[A-Z]\\d?))?$',
  },
  {
    id: 'standard-flex',
    label: 'Standard flexible — service-seq-size-class with optional insulation',
    example: 'P-51220-18"-31170-C · BD-71027-4"-PA0B',
    regex: '(?P<fluid>[A-Z]{1,3})-(?P<seq>\\d{4,6})-(?P<size>\\d+(?:\\.\\d+)?)["\']?-(?P<class>[A-Z0-9]{3,6})(?:-(?P<insul>[A-Z]))?',
  },
  {
    id: 'size-first',
    label: 'Size first — size-unit-fluid-seq-class',
    example: '8"-2600-P-305-11051YR-I',
    regex: '^(?P<size>\\d+)["\']?-\\d+-(?P<fluid>[A-Z]{1,3})-(?P<seq>\\d{3,6})-(?P<class>[A-Z0-9]+)(?:-(?P<insul>[A-Z]))?$',
  },
];

const PATTERN_MIN_RATIO = 0.8;

// Stage 3 BYOK — the user's own vision API key lives ONLY in
// sessionStorage (per project), is sent with the Start-Extraction
// request, and is never written to localStorage or the server.
const byokStorageKeys = (projectId) => ({
  provider: `radai_vmto_byok_provider::${projectId || 'none'}`,
  apiKey: `radai_vmto_byok_apikey::${projectId || 'none'}`,
});
const readByok = (projectId) => {
  try {
    const k = byokStorageKeys(projectId);
    return {
      provider: sessionStorage.getItem(k.provider) || 'openai',
      apiKey: sessionStorage.getItem(k.apiKey) || '',
    };
  } catch { return { provider: 'openai', apiKey: '' }; }
};

// §7 data contract — stage states and row enums.
export const STAGE_STATES = ['locked', 'active', 'complete', 'needs-recheck'];
export const VALVE_CATEGORIES = ['manual', 'control', 'actuated-onoff', 'psv', 'solenoid'];
export const SCOPE_STATUSES = ['new-in-scope', 'existing-reused', 'existing-outside', 'vendor-package'];

const SCOPE_PILL = {
  'new-in-scope': { label: 'NEW', cls: 'rd-pill rd-pill-success' },
  'existing-reused': { label: 'Reused', cls: 'rd-pill rd-pill-info' },
  'existing-outside': { label: 'Existing', cls: 'rd-pill rd-pill-neutral' },
  'vendor-package': { label: 'Vendor', cls: 'rd-pill rd-pill-neutral' },
};

const REGISTER_TABS = [
  { id: 'island', label: 'ISLAND' },
  { id: 'field', label: 'FIELD' },
  { id: 'combined', label: 'COMBINED' },
  { id: 'order', label: 'Order list' },
  { id: 'review', label: 'Review' },
];

// §6 COMBINED column order. Extra hidden columns available via Columns.
const REGISTER_COLUMNS = [
  { key: 'sl_no', label: 'SL. NO.', width: 52 },
  { key: 'area', label: 'AREA', width: 140 },
  { key: 'type', label: 'TYPE', width: 150, editable: true },
  { key: 'pms_class', label: 'PIPING MATERIAL CLASS', width: 150, editable: true },
  { key: 'piping_class', label: 'PIPING CLASS', width: 100, editable: true },
  { key: 'rating', label: 'RATING / FACING', width: 110, editable: true },
  { key: 'size_1', label: 'SIZE (NB)', width: 80, editable: true },
  { key: 'qty_observed', label: 'OBSERVED QTY', width: 80, editable: true },
  { key: 'bore', label: 'BORE', width: 60, editable: true },
  { key: 'pid_number', label: 'P&ID NUMBER', width: 150, editable: true },
  { key: 'pid_rev', label: 'REV', width: 52, editable: true },
  { key: 'line_number', label: 'LINE NUMBER', width: 160, editable: true },
  { key: 'valve_tag', label: 'VALVE TAG', width: 110, editable: true },
  { key: 'description', label: 'DESCRIPTION', width: 200, editable: true },
  { key: 'qty_island', label: 'TOTAL TO BE ORDERED (ISLAND)', width: 90, editable: true, numeric: true },
  { key: 'qty_field', label: 'TOTAL TO BE ORDERED (FIELD)', width: 90, editable: true, numeric: true },
  { key: 'unit', label: 'UNIT', width: 60, editable: true },
  { key: 'remarks', label: 'REMARKS', width: 180, editable: true },
];

const EXTRA_COLUMNS = [
  { key: 'category', label: 'CATEGORY', width: 100 },
  { key: 'scope_status', label: 'SCOPE STATUS', width: 110 },
  { key: 'type_basis', label: 'TYPE BASIS', width: 110 },
  { key: 'confidence_score', label: 'CONFIDENCE', width: 90 },
  { key: 'page', label: 'PAGE', width: 60 },
  { key: 'pos_x', label: 'X', width: 70 },
  { key: 'pos_y', label: 'Y', width: 70 },
];

const HOW_IT_WORKS = [
  ['Reading text layer', 'The P&ID PDF is parsed server-side (PyMuPDF): title block, line-number labels, revision/scope clouds, piping classes.'],
  ['Detecting symbols', 'Vector valve symbols (ellipses, bow-ties) are detected on each sheet; vision tiles catch what vectors miss. Spectacle blinds, reducers, flanges and fittings are excluded.'],
  ['Matching legend & tag rules', 'Each symbol is typed by tag-code rule first, then the valve legend symbol, then note rules — otherwise it stays UNIDENTIFIED, never guessed.'],
  ['Associating lines & sizes', 'Size, line number and piping class come from the nearest line label (confirmed line-number pattern).'],
  ['Applying scope', 'Project scope: only NEW manual valves inside scope clouds get an order quantity; everything else is observed-only with the reason in REMARKS.'],
  ['Building register', 'Rows land in the register with confidence + evidence crops for review before procurement.'],
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};

const fmtConfidence = (row) => {
  const v = row.confidence_score;
  if (v === null || v === undefined || v === '') return null;
  return Number(v);
};

/** Review checks (§6 Review tab) — computed client-side from the rows. */
function buildReviewChecks(rows, settings) {
  const threshold = settings?.engine_review_threshold ?? 0.8;
  const unidentified = rows.filter((r) => !r.type || r.type === 'UNIDENTIFIED' || r.type_basis === 'unidentified');
  const fieldGaps = rows.filter((r) => !r.size_1 || !r.piping_class || !r.line_number || r.line_number === 'Not traced');
  const lowConf = rows.filter((r) => {
    const c = fmtConfidence(r);
    return c !== null && c < threshold;
  });
  const legendAck = settings?.legend_ack?.reason ? rows.filter((r) => r.type_basis === 'legend-symbol') : [];
  const inferred = rows.filter((r) => r.material_source === 'inferred' || r.material_source === 'per-pms');
  const qtyMismatch = rows.filter((r) => {
    const total = Number(r.qty_combined) || 0;
    return (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0) !== total;
  });
  return [
    { id: 'unidentified', check: 'Unidentified valves', rows: unidentified, impact: 'Type not confirmed — cannot be ordered', filter: (r) => !r.type || r.type === 'UNIDENTIFIED' || r.type_basis === 'unidentified' },
    { id: 'field-gaps', check: 'Field gaps (size / class / line)', rows: fieldGaps, impact: 'Missing data blocks procurement specs', filter: (r) => !r.size_1 || !r.piping_class || !r.line_number || r.line_number === 'Not traced' },
    { id: 'low-confidence', check: 'Low confidence', rows: lowConf, impact: `Below review threshold (${threshold})`, filter: (r) => { const c = fmtConfidence(r); return c !== null && c < threshold; } },
    { id: 'legend-ack', check: 'Legend mismatch acknowledged', rows: legendAck, impact: 'Results may be incomplete', filter: (r) => r.type_basis === 'legend-symbol' },
    { id: 'inferred', check: 'Rating/material inferred (no PMS)', rows: inferred, impact: 'Verify against the project PMS', filter: (r) => r.material_source === 'inferred' || r.material_source === 'per-pms' },
    { id: 'qty-mismatch', check: 'Island + Field ≠ Total', rows: qtyMismatch, impact: 'Allocation must sum to the total', filter: (r) => (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0) !== (Number(r.qty_combined) || 0) },
  ];
}

/** Map a server register row (§7) to the local row shape. */
function serverRowToLocal(r) {
  return {
    id: `v_${r.id}`,
    server_id: r.id,
    sl_no: r.row_order + 1,
    area: r.area || '',
    tab: r.tab || '',
    type: r.valve_type || '',
    pms_class: r.pms_class || '',
    piping_class: r.piping_class || '',
    rating: r.rating || '',
    facing: r.facing || '',
    size_1: r.size_primary || '',
    size_2: r.size_secondary_2 || '',
    bore: r.size_secondary || '',
    line_number: r.line_number || '',
    line_list: r.line_list_ref || '',
    pid_number: r.pid_number || '',
    pid_rev: r.pid_rev || '',
    valve_tag: r.tag_number || '',
    description: r.description || '',
    qty_island: r.qty_island ?? 0,
    qty_field: r.qty_field ?? 0,
    qty_combined: r.qty_combined ?? 0,
    qty_observed: r.qty_observed ?? '',
    unit: r.unit || '',
    remarks: r.remarks || '',
    confidence: r.confidence || '',
    location_hint: r.location_hint || '',
    page: r.page, pos_x: r.pos_x, pos_y: r.pos_y,
    variant: r.variant || '',
    category: r.category || '',
    type_basis: r.type_basis || '',
    symbol_group_id: r.symbol_group_id || '',
    scope_status: r.scope_status || '',
    piping_class_source: r.piping_class_source || '',
    material_source: r.material_source || '',
    confidence_score: r.confidence_score,
    evidence_crop_url: r.evidence_crop_url || '',
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ValveMTO({ view }) {
  const [searchParams] = useSearchParams();
  const focusStage = Number(searchParams.get('stage')) || null;

  // ── Project organizer ───────────────────────────────────────────────
  const { activeProject, setActiveProject, hydrated: projHydrated } = useActiveProject(VM_PROJECTS.storageKey);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectModal, setProjectModal] = useState({ open: false, editing: null });

  // ── Server-side state ───────────────────────────────────────────────
  const [serverProject, setServerProject] = useState(null);
  const [settings, setSettings] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [rows, setRows] = useState([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);
  const [job, setJob] = useState(null);

  // ── UI state ────────────────────────────────────────────────────────
  const [openStage, setOpenStage] = useState(focusStage || 1);
  const [registerTab, setRegisterTab] = useState('combined');
  const [registerFilter, setRegisterFilter] = useState(null); // predicate from a review action
  const [search, setSearch] = useState('');
  const [extraCols, setExtraCols] = useState([]);
  const [showHow, setShowHow] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [legendDrawer, setLegendDrawer] = useState(false);
  const [evidenceRow, setEvidenceRow] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const registerRef = useRef(null);
  const pollRef = useRef(null);
  const fileRefs = { pid: useRef(null), pms: useRef(null), import: useRef(null) };

  const activeDrawing = drawings[0] || null;
  const stageState = settings?.stage_state || {};
  const approvalStatus = stageState.approval || 'draft';

  // ── Project list bootstrap ──────────────────────────────────────────
  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const items = await projectOrganizerService.listProjects();
      setProjects(Array.isArray(items) ? items : []);
    } catch { setProjects([]); } finally { setProjectsLoading(false); }
  }, []);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  // ── Resolve (or create) the server-side ValveMTOProject ─────────────
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!activeProject) { setServerProject(null); setSettings(null); setDrawings([]); setRows([]); setRowsLoaded(false); return; }
      const links = readJson(SERVER_LINK_KEY, {});
      let serverId = links[activeProject.project_id];
      try {
        if (serverId) {
          setServerProject(await valveMtoService.getProject(serverId));
        } else {
          const created = await valveMtoService.createProject({
            projectName: activeProject.name || activeProject.project_id,
            status: 'extracting',
          });
          serverId = created.id;
          writeJson(SERVER_LINK_KEY, { ...links, [activeProject.project_id]: serverId });
          if (!cancelled) setServerProject(created);
        }
      } catch {
        if (!cancelled) setError('Could not reach the Valve MTO server. Data stays local until the server is back.');
        return;
      }
      if (cancelled || !serverId) return;
      try {
        const [s, d] = await Promise.all([
          valveMtoService.getSettings(serverId),
          valveMtoService.listDrawings(serverId),
        ]);
        if (cancelled) return;
        setSettings(s);
        setDrawings(Array.isArray(d) ? d : []);
        const reg = await valveMtoService.getRegister(serverId, 'combined');
        if (cancelled) return;
        setRows((reg.rows || []).map(serverRowToLocal));
        setRowsLoaded(true);
      } catch { /* server persistence is best-effort */ }
    };
    if (projHydrated) resolve();
    return () => { cancelled = true; };
  }, [activeProject, projHydrated]);

  // Deep link /register → scroll to the register section.
  useEffect(() => {
    if (view === 'register' && registerRef.current) {
      registerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [view, rowsLoaded]);

  // ── Settings persistence helper ─────────────────────────────────────
  const saveSettings = useCallback(async (patch) => {
    if (!serverProject) return null;
    try {
      const updated = await valveMtoService.saveSettings(serverProject.id, patch);
      setSettings(updated);
      return updated;
    } catch { return null; }
  }, [serverProject]);

  const setStageComplete = useCallback(async (n, state = 'complete') => {
    const next = { ...(settings?.stage_state || {}), [String(n)]: state };
    await saveSettings({ stage_state: next });
  }, [settings, saveSettings]);

  // ── Stage gating (§2) ───────────────────────────────────────────────
  const patternInfo = activeDrawing?.parsed?.pattern || null;
  const patternRatio = patternInfo && patternInfo.total ? patternInfo.parsed_count / patternInfo.total : 0;
  const stage1Complete = Boolean(
    activeDrawing && activeDrawing.confirmed_drawing_number
    && (patternRatio >= PATTERN_MIN_RATIO || settings?.line_pattern_preset === 'custom'),
  );
  const pmsClasses = settings?.pms_data?.classes || {};
  const stage2Complete = Boolean(
    settings?.pms_skipped || Object.keys(pmsClasses).length > 0,
  );
  const stage3Complete = stageState['3'] === 'complete' || stageState['3'] === 'needs-recheck';
  const stage4Complete = Boolean(settings?.legend) && (
    stageState['4'] === 'complete' || stageState['4'] === 'needs-recheck'
    || Boolean(settings?.legend_ack?.reason)
  );

  const stageStatus = useCallback((n) => {
    const complete = { 1: stage1Complete, 2: stage2Complete, 3: stage3Complete, 4: stage4Complete }[n];
    const stored = stageState[String(n)];
    if (complete) return stored === 'needs-recheck' ? 'needs-recheck' : 'complete';
    const prevComplete = n === 1 || { 2: stage1Complete, 3: stage2Complete, 4: stage3Complete }[n];
    return prevComplete ? 'active' : 'locked';
  }, [stage1Complete, stage2Complete, stage3Complete, stage4Complete, stageState]);

  const allStagesComplete = stage1Complete && stage2Complete && stage3Complete && stage4Complete;
  const firstIncomplete = STAGES.find((s) => stageStatus(s.n) !== 'complete' && stageStatus(s.n) !== 'needs-recheck');

  // ── Extraction polling ──────────────────────────────────────────────
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => stopPolling, []);

  const startPolling = useCallback((jobId) => {
    stopPolling();
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const j = await valveMtoService.getJob(serverProject.id, jobId);
        setJob(j);
        if (j.status === 'completed' || j.status === 'failed' || Date.now() - started > POLL_MAX_WAIT_MS) {
          stopPolling();
          if (j.status === 'completed') {
            const reg = await valveMtoService.getRegister(serverProject.id, 'combined');
            setRows((reg.rows || []).map(serverRowToLocal));
            setRowsLoaded(true);
          }
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL_MS);
  }, [serverProject]);

  const startExtraction = async () => {
    if (!serverProject || !allStagesComplete) return;
    setBusy('extract'); setError('');
    try {
      const j = await valveMtoService.startExtraction(serverProject.id, readByok(serverProject.id));
      setJob(j);
      startPolling(j.id);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not start extraction.');
    } finally { setBusy(''); }
  };

  // ── Register rows: inline edit + server autosave ────────────────────
  const autosaveTimer = useRef(null);
  const persistRows = useCallback((nextRows) => {
    if (!serverProject) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      valveMtoService.saveRows(serverProject.id, nextRows).catch(() => {});
    }, 800);
  }, [serverProject]);

  const updateRow = (id, key, value) => {
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [key]: value };
        // ISLAND/FIELD split must sum to TOTAL (§5 validation).
        if (key === 'qty_island' || key === 'qty_field') {
          updated.qty_combined = (Number(updated.qty_island) || 0) + (Number(updated.qty_field) || 0);
        }
        return updated;
      });
      persistRows(next);
      return next;
    });
  };

  const addRow = () => {
    const row = { ...DEFAULT_ROW(), id: `m_${Date.now()}`, sl_no: rows.length + 1, tab: 'combined' };
    const next = [...rows, row];
    setRows(next); persistRows(next);
  };

  const deleteRow = (id) => {
    const next = rows.filter((r) => r.id !== id).map((r, i) => ({ ...r, sl_no: i + 1 }));
    setRows(next); persistRows(next);
  };

  // ── Excel import (always enabled beside Start Extraction) ───────────
  const onImportFile = async (file) => {
    if (!file) return;
    setBusy('import'); setError('');
    try {
      const { rows: imported } = await importValveMTOFile(file);
      const next = [...rows, ...imported.map((r, i) => ({ ...r, id: r.id || `i_${Date.now()}_${i}` }))];
      next.forEach((r, i) => { r.sl_no = i + 1; });
      setRows(next); persistRows(next);
    } catch { setError('Could not import that file.'); } finally { setBusy(''); }
  };

  // ── Derived register data ───────────────────────────────────────────
  const threshold = settings?.engine_review_threshold ?? 0.8;
  const reviewChecks = useMemo(() => buildReviewChecks(rows, settings), [rows, settings]);
  const reviewCount = useMemo(
    () => reviewChecks.filter((c) => c.rows.length > 0).length,
    [reviewChecks],
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    if (registerTab === 'island') list = list.filter((r) => Number(r.qty_island) > 0 || allocationTab(r) === 'island');
    else if (registerTab === 'field') list = list.filter((r) => Number(r.qty_field) > 0 || allocationTab(r) === 'field');
    else if (registerTab === 'order') list = list.filter((r) => (Number(r.qty_combined) || ((Number(r.qty_island) || 0) + (Number(r.qty_field) || 0))) > 0);
    else if (registerTab === 'review' && registerFilter) list = list.filter(registerFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => [r.valve_tag, r.line_number, r.description, r.type, r.pid_number]
        .some((v) => String(v || '').toLowerCase().includes(q)));
    }
    return list;
  }, [rows, registerTab, registerFilter, search]);

  // KPIs (only once an extraction/import exists).
  const kpis = useMemo(() => {
    if (!rows.length) return null;
    const toOrder = rows.reduce((a, r) => a + ((Number(r.qty_island) || 0) + (Number(r.qty_field) || 0)), 0);
    const unidentified = rows.filter((r) => !r.type || r.type === 'UNIDENTIFIED' || r.type_basis === 'unidentified').length;
    const gaps = reviewChecks.find((c) => c.id === 'field-gaps')?.rows.length || 0;
    const instruments = rows.filter((r) => r.category && r.category !== 'manual').length;
    return { found: rows.length, toOrder, unidentified, gaps, instruments };
  }, [rows, reviewChecks]);

  const legendMismatch = Boolean(settings?.legend_ack?.reason);
  const allResolved = rows.length > 0 && reviewChecks.every((c) => c.rows.length === 0);

  // ── Stage 1 handlers ────────────────────────────────────────────────
  const onUploadPid = async (files) => {
    if (!serverProject || !files?.length) return;
    setBusy('pid'); setError('');
    try {
      for (const file of Array.from(files)) {
        const drawing = await valveMtoService.uploadDrawing(serverProject.id, file);
        setDrawings((prev) => [drawing, ...prev]);
      }
      const s = await valveMtoService.getSettings(serverProject.id);
      setSettings(s);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not parse that PDF.');
    } finally { setBusy(''); }
  };

  const [draftDrawingNo, setDraftDrawingNo] = useState('');
  const [draftRev, setDraftRev] = useState('');
  useEffect(() => {
    setDraftDrawingNo(activeDrawing?.confirmed_drawing_number || activeDrawing?.parsed?.title_block?.company_drawing_no || '');
    setDraftRev(activeDrawing?.confirmed_rev || activeDrawing?.parsed?.title_block?.rev || '');
  }, [activeDrawing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDrawing = async () => {
    if (!serverProject || !activeDrawing) return;
    setBusy('confirm'); setError('');
    try {
      const updated = await valveMtoService.confirmDrawing(serverProject.id, activeDrawing.id, {
        drawingNumber: draftDrawingNo,
        rev: draftRev,
        patternPreset: settings?.line_pattern_preset || 'service-seq-size-class-insul',
        patternRegex: settings?.line_pattern_regex || '',
      });
      setDrawings((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      const pat = updated?.parsed?.pattern;
      const ratio = pat && pat.total ? pat.parsed_count / pat.total : 0;
      const preset = settings?.line_pattern_preset || 'service-seq-size-class-insul';
      if (preset !== 'custom' && pat?.total && ratio < PATTERN_MIN_RATIO) {
        setError(`Drawing confirmed, but only ${pat.parsed_count} of ${pat.total} line labels match the selected pattern (${Math.round(ratio * 100)}% — Stage 1 needs at least ${Math.round(PATTERN_MIN_RATIO * 100)}%). Review the unparsed labels below and pick a different pattern, or use the custom regex option to complete Stage 1.`);
      } else {
        await setStageComplete(1, 'complete');
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not confirm the drawing.');
    } finally { setBusy(''); }
  };

  const changePattern = async (preset, regex) => {
    const updated = await saveSettings({
      line_pattern_preset: preset,
      ...(regex !== undefined ? { line_pattern_regex: regex } : {}),
    });
    // Re-confirm to re-run the pattern server-side.
    if (updated && activeDrawing) {
      try {
        const d = await valveMtoService.confirmDrawing(serverProject.id, activeDrawing.id, {
          drawingNumber: draftDrawingNo, rev: draftRev,
          patternPreset: preset, patternRegex: regex ?? settings?.line_pattern_regex ?? '',
        });
        setDrawings((prev) => prev.map((x) => (x.id === d.id ? d : x)));
      } catch { /* keep settings */ }
    }
  };

  // ── Stage 2 handlers ────────────────────────────────────────────────
  const [pmsResult, setPmsResult] = useState(null);
  const onUploadPms = async (file) => {
    if (!serverProject || !file) return;
    setBusy('pms'); setError('');
    try {
      const result = await valveMtoService.uploadPms(serverProject.id, file);
      setPmsResult(result);
      await setStageComplete(2, result.coverage?.blocked ? 'needs-recheck' : 'complete');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not parse that PMS workbook.');
    } finally { setBusy(''); }
  };

  const skipPms = async () => {
    const updated = await saveSettings({ pms_skipped: true, pms_infer_from_drawing: true, pms_data: {} });
    if (updated) { setPmsResult(null); await setStageComplete(2, 'complete'); }
  };

  // ── Stage 3 handlers ────────────────────────────────────────────────
  const [engineTest, setEngineTest] = useState(null);
  const onTestEngine = async () => {
    if (!serverProject) return;
    setBusy('engine');
    try {
      setEngineTest(await valveMtoService.testEngine(serverProject.id));
    } catch (e) {
      setEngineTest(e?.response?.data || { ok: false, detail: 'Engine not configured — ask an Admin' });
    } finally { setBusy(''); }
  };

  const saveEngineSettings = async (patch) => {
    await saveSettings(patch);
    await setStageComplete(3, 'complete');
  };

  // ── Stage 4 handlers ────────────────────────────────────────────────
  const [legends, setLegends] = useState([]);
  const [legendCheck, setLegendCheck] = useState(null);
  useEffect(() => {
    valveMtoLegendService.listLegends('valve').then((l) => setLegends(Array.isArray(l) ? l : [])).catch(() => {});
  }, [legendDrawer]);

  const selectLegend = async (legendId) => {
    await saveSettings({ legend: legendId || null, legend_ack: {} });
    setLegendCheck(null);
  };

  const runLegendCheck = async () => {
    if (!serverProject || !settings?.legend) return;
    setBusy('legend'); setError('');
    try {
      const result = await valveMtoService.checkLegend(serverProject.id, {
        legendId: settings.legend,
        drawingId: activeDrawing?.id,
      });
      setLegendCheck(result);
      await setStageComplete(4, result.passed ? 'complete' : 'needs-recheck');
    } catch (e) {
      setError(e?.response?.data?.error || 'Legend check failed.');
    } finally { setBusy(''); }
  };

  const acknowledgeLegend = async (reason) => {
    await saveSettings({
      legend_ack: { by: 'user', reason, at: new Date().toISOString() },
    });
    await setStageComplete(4, 'complete');
  };

  // ── Render helpers ──────────────────────────────────────────────────
  const pill = (text, cls) => <span className={`rd-pill ${cls}`}>{text}</span>;

  const stagePill = (n) => {
    const st = stageStatus(n);
    if (st === 'complete') return pill('Complete', 'rd-pill-success');
    if (st === 'needs-recheck') return pill('Re-check', 'rd-pill-warning');
    if (st === 'locked') return pill('Locked', 'rd-pill-neutral');
    return pill('Active', 'rd-pill-info');
  };

  const stageOneLine = (n) => {
    if (n === 1 && activeDrawing) {
      const tb = activeDrawing.parsed?.title_block || {};
      return `${activeDrawing.confirmed_drawing_number || tb.company_drawing_no || activeDrawing.original_name}`
        + `${activeDrawing.confirmed_rev ? ` · Rev ${activeDrawing.confirmed_rev}` : ''}`
        + ` · ${activeDrawing.page_count || 0} sheet${(activeDrawing.page_count || 0) === 1 ? '' : 's'}`;
    }
    if (n === 2) {
      if (settings?.pms_skipped) return 'Skipped';
      const count = Object.keys(pmsClasses).length;
      return count ? `${count} classes loaded` : '';
    }
    if (n === 3) return engineTest?.ok ? `Engine: connected · ${engineTest.elapsed_s ?? ''} s` : '';
    if (n === 4) {
      const lg = legends.find((l) => l.legend_id === settings?.legend);
      return lg ? lg.name : '';
    }
    return '';
  };

  const visibleColumns = [...REGISTER_COLUMNS, ...EXTRA_COLUMNS.filter((c) => extraCols.includes(c.key))];

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="rd-page" style={{ padding: '2rem 1.5rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <nav className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Engineering / 1.2 Piping / Valve MTO
          </nav>
          <h1 style={{ fontSize: 'var(--rd-text-page-title)', margin: '0.25rem 0' }}>Valve MTO</h1>
          <p className="rd-text-muted">Valve take-off from P&IDs. Verify quantities and specifications before procurement.</p>
        </header>
        <div className="rd-card">
          <div className="rd-card-header">Select a project to begin</div>
          <div className="rd-card-body" style={{ display: 'grid', gap: '1rem' }}>
            {projectsLoading && <div className="rd-skeleton" style={{ height: 80 }} />}
            {!projectsLoading && projects.map((p) => (
              <ProjectCard key={p.project_id} project={p} theme={VM_PROJECTS.theme}
                onOpen={() => setActiveProject(p)}
                onEdit={() => setProjectModal({ open: true, editing: p })}
                onDelete={async () => { await projectOrganizerService.deleteProject(p.project_id); refreshProjects(); }} />
            ))}
            {!projectsLoading && (
              <button className="rd-btn rd-btn-primary" style={{ justifySelf: 'start' }}
                onClick={() => setProjectModal({ open: true, editing: null })}>
                <PlusIcon width={16} /> New project
              </button>
            )}
          </div>
        </div>
        {projectModal.open && (
          <ProjectFormModal
            theme={VM_PROJECTS.theme}
            initial={projectModal.editing}
            onClose={() => setProjectModal({ open: false, editing: null })}
            onSubmit={async (payload) => {
              if (projectModal.editing) {
                await projectOrganizerService.updateProject(projectModal.editing.project_id, payload);
              } else {
                const p = await projectOrganizerService.createProject({ ...payload, tool_code: VM_PROJECTS.toolCode });
                setActiveProject(p);
              }
              setProjectModal({ open: false, editing: null });
              refreshProjects();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rd-page" style={{
      padding: fullscreen ? '1rem 2rem' : '2rem 1.5rem',
      maxWidth: fullscreen ? '100%' : undefined,
    }}>
      {/* ── Page header (§1) ─────────────────────────────────────────── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <nav className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Engineering / 1.2 Piping / Valve MTO
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'var(--rd-text-page-title)', margin: 0 }}>Valve MTO</h1>
            {pill(`Register VMTO-${activeProject.code || activeProject.name || ''}`, 'rd-pill-neutral')}
            {pill(`Rev ${activeDrawing?.confirmed_rev || activeDrawing?.parsed?.title_block?.rev || '—'}`, 'rd-pill-neutral')}
            {approvalStatus === 'approved' ? pill('Approved', 'rd-pill-success')
              : approvalStatus === 'in-review' ? pill('In review', 'rd-pill-info')
              : pill('Draft', 'rd-pill-neutral')}
          </div>
          <p className="rd-text-muted" style={{ marginTop: '0.25rem' }}>
            Valve take-off from P&IDs. Verify quantities and specifications before procurement.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
          <ProjectSwitcher
            projects={projects}
            activeProject={activeProject}
            loading={projectsLoading}
            theme={VM_PROJECTS.theme}
            onSwitch={setActiveProject}
            onCreate={() => setProjectModal({ open: true, editing: null })}
            onClear={() => setActiveProject(null)}
            onManage={() => {}}
          />
          <button className="rd-btn rd-btn-secondary" onClick={() => setLegendDrawer(true)}>
            <BookOpenIcon width={16} /> Manage legends
          </button>
          <div style={{ position: 'relative' }}>
            <button className="rd-btn rd-btn-secondary" onClick={() => setShowExportMenu((v) => !v)}>
              <ArrowDownTrayIcon width={16} /> Export <ChevronDownIcon width={12} />
            </button>
            {showExportMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setShowExportMenu(false)} />
                <div className="rd-card" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 40, minWidth: 260, padding: 6 }}>
                  {[
                    ['MTO workbook (customer format)', () => serverProject && valveMtoService.exportFormat(serverProject.id, 'mto')],
                    ['Full data export', () => serverProject && valveMtoService.exportFormat(serverProject.id, 'full')],
                    ['Order list only', () => serverProject && valveMtoService.exportFormat(serverProject.id, 'order')],
                    ['Client-side workbook (5-sheet template)', () => exportValveMTOWorkbook({ rows, filename: DEFAULT_FILENAME })],
                    ['Client-side all-data export', () => exportValveMTOAllData({ rows })],
                  ].map(([label, fn]) => (
                    <button key={label} className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => { setShowExportMenu(false); fn(); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="rd-btn rd-btn-ghost" aria-label="More actions" onClick={() => setShowMoreMenu((v) => !v)}>
              <EllipsisHorizontalIcon width={18} />
            </button>
            {showMoreMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setShowMoreMenu(false)} />
                <div className="rd-card" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 40, minWidth: 200, padding: 6 }}>
                  <button className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => { setFullscreen((v) => !v); setShowMoreMenu(false); }}>
                    {fullscreen ? <ArrowsPointingInIcon width={16} /> : <ArrowsPointingOutIcon width={16} />}
                    {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {error && <div className="rd-banner rd-banner-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── KPI row (§1, only once an extraction exists) ─────────────── */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="rd-kpi rd-card"><div className="rd-kpi-value">{kpis.found}</div><div className="rd-kpi-label">Valves found</div></div>
          <div className="rd-kpi rd-card"><div className="rd-kpi-value" style={{ color: 'var(--rd-success)' }}>{kpis.toOrder}</div><div className="rd-kpi-label">To order (project scope)</div></div>
          <div className="rd-kpi rd-card"><div className="rd-kpi-value" style={{ color: kpis.unidentified ? 'var(--rd-danger)' : undefined }}>{kpis.unidentified}</div><div className="rd-kpi-label">Unidentified</div></div>
          <div className="rd-kpi rd-card"><div className="rd-kpi-value" style={{ color: kpis.gaps ? 'var(--rd-warning)' : undefined }}>{kpis.gaps}</div><div className="rd-kpi-label">Field gaps</div></div>
          <div className="rd-kpi rd-card"><div className="rd-kpi-value">{kpis.instruments}</div><div className="rd-kpi-label">Instrument items</div></div>
        </div>
      )}

      {/* ── Status banner (§1) ───────────────────────────────────────── */}
      {settings?.extraction_outdated && rows.length > 0 && (
        <div className="rd-banner rd-banner-warning" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <span>PMS, legend or drawing changed after the last extraction — results may be stale.</span>
          <button className="rd-btn rd-btn-primary rd-btn-sm" onClick={startExtraction} disabled={!allStagesComplete || busy === 'extract'}>
            Re-run extraction
          </button>
        </div>
      )}
      {!settings?.extraction_outdated && rows.length > 0 && legendMismatch && (
        <div className="rd-banner rd-banner-danger" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <span>Legend {legends.find((l) => l.legend_id === settings.legend)?.name || ''} does not match this drawing — results may be incomplete</span>
          <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setOpenStage(4)}>Change legend</button>
        </div>
      )}
      {!settings?.extraction_outdated && !legendMismatch && rows.length > 0 && !allResolved && (
        <div className="rd-banner rd-banner-warning" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>{kpis?.unidentified + kpis?.gaps > 0 ? `${(kpis?.unidentified || 0) + (kpis?.gaps || 0)} valves need review before procurement` : 'Valves need review before procurement'}</span>
          <span style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {pill(`Unidentified | ${kpis?.unidentified ?? 0}`, 'rd-pill-danger')}
            {pill(`Field gaps | ${kpis?.gaps ?? 0}`, 'rd-pill-warning')}
            {pill(`Low confidence | ${reviewChecks.find((c) => c.id === 'low-confidence')?.rows.length ?? 0}`, 'rd-pill-warning')}
            <button className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => { setRegisterTab('review'); setRegisterFilter(null); registerRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
              Open review
            </button>
          </span>
        </div>
      )}
      {rows.length > 0 && allResolved && approvalStatus !== 'approved' && (
        <div className="rd-banner rd-banner-info" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderColor: 'var(--rd-success)' }}>
          <span style={{ color: 'var(--rd-success)' }}>Ready for approval</span>
          <button className="rd-btn rd-btn-primary rd-btn-sm"
            onClick={() => saveSettings({ stage_state: { ...stageState, approval: 'in-review' } })}>
            Submit for approval
          </button>
        </div>
      )}

      {/* ── Extraction summary (§1) ──────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="rd-card" style={{ marginBottom: '1rem' }}>
          <button className="rd-btn rd-btn-ghost" onClick={() => setShowSummary((v) => !v)} style={{ width: '100%', justifyContent: 'space-between' }}>
            <span>Open extraction summary</span>
            {showSummary ? <ChevronDownIcon width={14} /> : <ChevronRightIcon width={14} />}
          </button>
          {showSummary && job?.result && (
            <div className="rd-card-body rd-text-muted" style={{ fontSize: 'var(--rd-text-body)' }}>
              {`Last job: ${job.result.row_count ?? rows.length} rows · ${job.result.unidentified ?? 0} unidentified · ${job.result.field_gaps ?? 0} field gaps · P&ID ${job.result.pid_number || '—'} Rev ${job.result.pid_rev || '—'}`}
            </div>
          )}
        </div>
      )}

      {/* ── How extraction works (§1, neutral collapsible) ───────────── */}
      <div className="rd-card" style={{ marginBottom: '1rem' }}>
        <button className="rd-btn rd-btn-ghost" onClick={() => setShowHow((v) => !v)} style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <InformationCircleIcon width={16} /> How extraction works
          </span>
          {showHow ? <ChevronDownIcon width={14} /> : <ChevronRightIcon width={14} />}
        </button>
        {showHow && (
          <div className="rd-card-body">
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
              {HOW_IT_WORKS.map(([title, body]) => (
                <li key={title} style={{ fontSize: 'var(--rd-text-body)' }}>
                  <strong>{title}.</strong> <span className="rd-text-muted">{body}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* ── Stage workspace (§2) ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Left vertical stage rail */}
        <nav className="rd-card" aria-label="Extraction stages" style={{ alignSelf: 'start' }}>
          {STAGES.map((s) => {
            const st = stageStatus(s.n);
            return (
              <button key={s.n}
                onClick={() => st !== 'locked' && setOpenStage(s.n)}
                disabled={st === 'locked'}
                style={{
                  display: 'flex', width: '100%', textAlign: 'left', gap: '0.75rem',
                  padding: '0.75rem 1rem', border: 'none', background: openStage === s.n ? 'var(--rd-primary-soft)' : 'transparent',
                  borderLeft: openStage === s.n ? '3px solid var(--rd-primary)' : '3px solid transparent',
                  cursor: st === 'locked' ? 'not-allowed' : 'pointer', opacity: st === 'locked' ? 0.55 : 1,
                  color: 'var(--rd-text)', alignItems: 'flex-start',
                }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: st === 'complete' ? 'var(--rd-success)' : st === 'locked' ? 'var(--rd-surface-subtle)' : 'var(--rd-primary)',
                  color: st === 'locked' ? 'var(--rd-text-faint)' : '#fff', fontSize: 13, fontWeight: 700,
                }}>
                  {st === 'complete' ? <CheckCircleIcon width={16} /> : st === 'locked' ? <LockClosedIcon width={13} /> : s.n}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                    <strong style={{ fontSize: 'var(--rd-text-body)' }}>{s.title}</strong>
                    {stagePill(s.n)}
                  </span>
                  <span className="rd-text-muted" style={{ display: 'block', fontSize: 'var(--rd-text-caption)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {st === 'locked' ? `Complete Stage ${s.n - 1} to unlock` : (stageOneLine(s.n) || s.subtitle)}
                  </span>
                </span>
              </button>
            );
          })}
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--rd-border-soft)' }}>
            <button className="rd-btn rd-btn-primary" style={{ width: '100%' }}
              disabled={!allStagesComplete || busy === 'extract'}
              title={allStagesComplete ? 'Start extraction' : `Complete Stage ${firstIncomplete?.n} (${firstIncomplete?.title}) first`}
              onClick={startExtraction}>
              <BoltIcon width={16} /> {busy === 'extract' ? 'Starting…' : 'Start Extraction'}
            </button>
            <button className="rd-btn rd-btn-secondary" style={{ width: '100%', marginTop: 8 }}
              onClick={() => fileRefs.import.current?.click()} disabled={busy === 'import'}>
              <ArrowUpTrayIcon width={16} /> {busy === 'import' ? 'Importing…' : 'Import .xls/.xlsx/.csv'}
            </button>
            <input ref={fileRefs.import} type="file" accept=".xls,.xlsx,.csv" hidden
              onChange={(e) => { onImportFile(e.target.files?.[0]); e.target.value = ''; }} />
            {/* Readiness checklist (§2) */}
            <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'grid', gap: 4 }}>
              {STAGES.map((s) => {
                const ok = ['complete', 'needs-recheck'].includes(stageStatus(s.n));
                return (
                  <li key={s.n} className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {ok
                      ? <CheckCircleIcon width={14} style={{ color: 'var(--rd-success)' }} />
                      : <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--rd-border)', display: 'inline-block' }} />}
                    Stage {s.n} — {s.title}
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Stage panels */}
        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          {openStage === 1 && (
            <StagePid
              status={stageStatus(1)} busy={busy}
              drawings={drawings} activeDrawing={activeDrawing}
              settings={settings}
              draftDrawingNo={draftDrawingNo} setDraftDrawingNo={setDraftDrawingNo}
              draftRev={draftRev} setDraftRev={setDraftRev}
              onUpload={onUploadPid} onConfirm={confirmDrawing}
              onPatternChange={changePattern}
              fileRef={fileRefs.pid}
            />
          )}
          {openStage === 2 && (
            <StagePms
              status={stageStatus(2)} busy={busy} settings={settings}
              drawingClasses={activeDrawing?.parsed?.classes || []}
              pmsResult={pmsResult}
              onUpload={onUploadPms} onSkip={skipPms}
              fileRef={fileRefs.pms}
            />
          )}
          {openStage === 3 && (
            <StageEngine
              status={stageStatus(3)} busy={busy} settings={settings}
              engineTest={engineTest} onTest={onTestEngine}
              onSave={saveEngineSettings}
              hasTextLayer={activeDrawing?.pdf_type === 'vector'}
              hasScopeCloud={(activeDrawing?.parsed?.clouds?.scope || 0) > 0}
              projectId={serverProject?.id}
            />
          )}
          {openStage === 4 && (
            <StageLegend
              status={stageStatus(4)} busy={busy} settings={settings}
              legends={legends} check={legendCheck}
              onSelect={selectLegend} onCheck={runLegendCheck}
              onAcknowledge={acknowledgeLegend}
              onOpenManager={() => setLegendDrawer(true)}
              onMapGroup={async (groupId, mapping) => {
                const lg = legends.find((l) => l.legend_id === settings?.legend);
                if (!lg) return;
                const definition = { ...(lg.definition || {}) };
                definition.symbol_group_map = { ...(definition.symbol_group_map || {}), [groupId]: mapping };
                await valveMtoLegendService.updateLegend(lg.legend_id, { definition });
                runLegendCheck();
              }}
            />
          )}
        </div>
      </div>

      {/* ── Job progress ─────────────────────────────────────────────── */}
      {job && ['queued', 'running'].includes(job.status) && (
        <div className="rd-card" style={{ marginBottom: '1rem' }}>
          <div className="rd-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowPathIcon width={16} /> Extraction running — {job.current_step || 'queued'}
          </div>
          <div className="rd-card-body">
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: 4 }}>
              {(job.steps || []).map((s) => (
                <li key={s.name} style={{ fontSize: 'var(--rd-text-body)', color: s.status === 'done' ? 'var(--rd-success)' : s.status === 'running' ? 'var(--rd-text)' : 'var(--rd-text-faint)' }}>
                  {s.name}{s.detail ? ` — ${s.detail}` : ''}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      {job?.status === 'failed' && (
        <div className="rd-banner rd-banner-danger" style={{ marginBottom: '1rem' }}>
          Extraction failed: {job.error || 'unknown error'}
        </div>
      )}

      {/* ── Register (§6) ────────────────────────────────────────────── */}
      <section className="rd-card" ref={registerRef} aria-label="Valve register">
        <div className="rd-card-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <TableCellsIcon width={16} />
          <strong>Register</strong>
          <span style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <input className="rd-input" placeholder="Search tag, line, description…" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ width: 220, paddingLeft: 28 }} />
            <MagnifyingGlassIcon width={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--rd-text-faint)' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setShowColumns((v) => !v)}>
              <AdjustmentsHorizontalIcon width={14} /> Columns
            </button>
            {showColumns && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setShowColumns(false)} />
                <div className="rd-card" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 40, minWidth: 200, padding: 8 }}>
                  {EXTRA_COLUMNS.map((c) => (
                    <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 6px', fontSize: 'var(--rd-text-body)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={extraCols.includes(c.key)}
                        onChange={(e) => setExtraCols((prev) => e.target.checked ? [...prev, c.key] : prev.filter((k) => k !== c.key))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={addRow}><PlusIcon width={14} /> Add row</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '0 1rem', borderBottom: '1px solid var(--rd-border-soft)', flexWrap: 'wrap' }}>
          {REGISTER_TABS.map((t) => (
            <button key={t.id}
              className={`rd-tab ${registerTab === t.id ? 'rd-tab-active' : ''}`}
              onClick={() => { setRegisterTab(t.id); setRegisterFilter(null); }}>
              {t.label}
              {t.id === 'review' && reviewCount > 0 && pill(reviewCount, 'rd-pill-warning')}
              {t.id === 'order' && rows.some((r) => (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0) > 0)
                && pill(rows.filter((r) => (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0) > 0).length, 'rd-pill-success')}
            </button>
          ))}
        </div>

        {registerTab === 'review' ? (
          <ReviewTable checks={reviewChecks} onAction={(check) => {
            setRegisterTab('combined');
            setRegisterFilter(() => check.filter);
          }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="rd-table">
              <thead>
                <tr>
                  {visibleColumns.map((c) => (
                    <th key={c.key} style={{ minWidth: c.width }} scope="col">{c.label}</th>
                  ))}
                  <th scope="col" style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr><td colSpan={visibleColumns.length + 1} className="rd-text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
                    {rowsLoaded ? 'No rows in this view.' : 'No extraction yet — complete the stages above or import a workbook.'}
                  </td></tr>
                )}
                {filteredRows.map((row) => (
                  <RegisterRow key={row.id} row={row} columns={visibleColumns}
                    threshold={threshold}
                    onEdit={updateRow} onDelete={deleteRow} onOpenEvidence={setEvidenceRow} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Evidence drawer (§6) ─────────────────────────────────────── */}
      {evidenceRow && (
        <EvidenceDrawer row={evidenceRow} threshold={threshold}
          onClose={() => setEvidenceRow(null)}
          onEdit={(key, value) => { updateRow(evidenceRow.id, key, value); setEvidenceRow((r) => ({ ...r, [key]: value })); }} />
      )}

      {/* ── Legend manager drawer (Valve MTO's OWN isolated table) ──── */}
      {legendDrawer && (
        <LegendSheetsModal
          open={legendDrawer}
          onClose={() => setLegendDrawer(false)}
          section="valve"
          projectId={activeProject?.project_id}
          legendApi={VM_LEGEND_API}
          title="Valve MTO Legend Sheets"
          description="Define extraction rules for valve tags, piping classes and line formats — isolated from P&ID Verification's legends."
          syncTitle="Isolated Valve MTO Legends"
          syncText="These legends live in Valve MTO's own table — activating here never changes P&ID Verification's active legends."
        />
      )}

      {/* ── Project form modal ───────────────────────────────────────── */}
      {projectModal.open && (
        <ProjectFormModal
          theme={VM_PROJECTS.theme}
          initial={projectModal.editing}
          onClose={() => setProjectModal({ open: false, editing: null })}
          onSubmit={async (payload) => {
            if (projectModal.editing) {
              await projectOrganizerService.updateProject(projectModal.editing.project_id, payload);
            } else {
              const p = await projectOrganizerService.createProject({ ...payload, tool_code: VM_PROJECTS.toolCode });
              setActiveProject(p);
            }
            setProjectModal({ open: false, editing: null });
            refreshProjects();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 1 — P&ID (§3)
// ---------------------------------------------------------------------------
function StagePid({ status, busy, drawings, activeDrawing, settings, draftDrawingNo, setDraftDrawingNo, draftRev, setDraftRev, onUpload, onConfirm, onPatternChange, fileRef }) {
  const [dragOver, setDragOver] = useState(false);
  const parsed = activeDrawing?.parsed || {};
  const tb = parsed.title_block || {};
  const pattern = parsed.pattern || {};
  const clouds = parsed.clouds || {};
  const preset = settings?.line_pattern_preset || 'service-seq-size-class-insul';
  const [customRegex, setCustomRegex] = useState(settings?.line_pattern_regex || '');

  if (status === 'locked') return null;
  return (
    <section className="rd-card" aria-label="Stage 1 P&ID">
      <div className="rd-card-header"><DocumentArrowUpIcon width={16} /> Stage 1 — P&ID</div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '1rem' }}>
        <div
          className={`rd-dropzone ${dragOver ? 'rd-dropzone-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
          <CloudArrowUpIcon width={28} style={{ color: 'var(--rd-text-faint)' }} />
          <div>{busy === 'pid' ? 'Uploading & parsing…' : 'Drop P&ID PDF files here, or browse'}</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>Multi-page, multiple files, up to 100 MB each</div>
          <input ref={fileRef} type="file" accept=".pdf" multiple hidden
            onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
        </div>

        {activeDrawing && (
          <>
            <div className="rd-card" style={{ background: 'var(--rd-surface-subtle)' }}>
              <div className="rd-card-header" style={{ fontSize: 'var(--rd-text-body)' }}>Drawing summary</div>
              <div className="rd-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: 'var(--rd-text-body)' }}>
                {[
                  ['Company drawing no', tb.company_drawing_no],
                  ['Contractor no', tb.contractor_no],
                  ['Rev', tb.rev],
                  ['Sheet', tb.sheet],
                  ['Title', tb.title],
                  ['Company', tb.company],
                  ['Project', tb.project],
                  ['PDF type', parsed.pdf_type === 'vector' ? 'Vector (text layer found)' : 'Raster (OCR needed)'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{label}</div>
                    <div className="rd-mono">{value || '—'}</div>
                  </div>
                ))}
              </div>
              <div className="rd-card-body rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', borderTop: '1px solid var(--rd-border-soft)' }}>
                Text layer: {parsed.counts?.line_labels ?? 0} line numbers · {parsed.counts?.tags ?? 0} tags · {parsed.counts?.notes ?? 0} notes
                {' · '}{clouds.scope || 0} scope cloud{(clouds.scope || 0) === 1 ? '' : 's'} · {clouds.revision || 0} revision cloud{(clouds.revision || 0) === 1 ? '' : 's'}
                {!(clouds.scope > 0) && <span className="rd-pill rd-pill-warning" style={{ marginLeft: 8 }}>No scope cloud found</span>}
              </div>
              {Array.isArray(clouds.thumbnails) && clouds.thumbnails.length > 0 && (
                <div className="rd-card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {clouds.thumbnails.slice(0, 6).map((t, i) => (
                    t.png_b64
                      ? <img key={i} alt={`${t.kind} cloud p${t.page}`} src={`data:image/png;base64,${t.png_b64}`} style={{ height: 64, border: '1px solid var(--rd-border)', borderRadius: 'var(--rd-radius-control)' }} />
                      : null
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
                <span className="rd-text-muted">Drawing number (confirm)</span>
                <input className="rd-input rd-mono" value={draftDrawingNo} onChange={(e) => setDraftDrawingNo(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
                <span className="rd-text-muted">Rev</span>
                <input className="rd-input rd-mono" value={draftRev} onChange={(e) => setDraftRev(e.target.value)} />
              </label>
            </div>

            <div>
              <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginBottom: 6 }}>Line-number pattern</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {LINE_PATTERN_PRESETS.map((p) => (
                  <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--rd-text-body)', cursor: 'pointer' }}>
                    <input type="radio" name="vm-line-pattern" checked={preset === p.id}
                      onChange={() => onPatternChange(p.id, p.id === 'custom' ? customRegex : undefined)} />
                    <span>{p.label}</span>
                    <span className="rd-text-muted rd-mono" style={{ fontSize: 'var(--rd-text-caption)' }}>{p.example}</span>
                  </label>
                ))}
                {preset === 'custom' && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <select className="rd-select" value="" aria-label="Custom regex template"
                      onChange={(e) => {
                        const t = CUSTOM_REGEX_TEMPLATES.find((x) => x.id === e.target.value);
                        if (!t) return;
                        setCustomRegex(t.regex);
                        onPatternChange('custom', t.regex);
                      }}>
                      <option value="" disabled>Choose a ready-made regex template…</option>
                      {CUSTOM_REGEX_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label} — {t.example}</option>
                      ))}
                    </select>
                    <input className="rd-input rd-mono" placeholder="(?P<fluid>…)-(?P<seq>…)-(?P<size>…)-(?P<class>…)-(?P<insul>…)"
                      value={customRegex}
                      onChange={(e) => setCustomRegex(e.target.value)}
                      onBlur={() => onPatternChange('custom', customRegex)} />
                    <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                      Pick a template above or edit the regex directly. Named groups used: fluid, seq, size, class, insul. Changes apply when you leave the field.
                    </span>
                  </div>
                )}
              </div>
              {pattern.total != null && (
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 8 }}>
                  {pattern.parsed_count} of {pattern.total} line labels parsed with {LINE_PATTERN_PRESETS.find((p) => p.id === preset)?.label || preset}
                  {(parsed.classes || []).length > 0 && <> · Piping classes: <span className="rd-mono">{parsed.classes.join(', ')}</span></>}
                </div>
              )}
              {Array.isArray(pattern.unparsed) && pattern.unparsed.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', cursor: 'pointer' }}>
                    Unparsed labels ({pattern.unparsed.length})
                  </summary>
                  <ul className="rd-mono" style={{ fontSize: 'var(--rd-text-caption)', margin: '6px 0', paddingLeft: '1.25rem' }}>
                    {pattern.unparsed.slice(0, 20).map((u, i) => <li key={i}>{u.text} (p{u.page})</li>)}
                  </ul>
                </details>
              )}
            </div>

            <div>
              <button className="rd-btn rd-btn-primary" onClick={onConfirm}
                disabled={busy === 'confirm' || !draftDrawingNo}>
                {busy === 'confirm' ? 'Confirming…' : 'Confirm drawing & pattern'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — PMS (§4)
// ---------------------------------------------------------------------------
function StagePms({ status, busy, settings, drawingClasses, pmsResult, onUpload, onSkip, fileRef }) {
  if (status === 'locked') return null;
  const classes = settings?.pms_data?.classes || {};
  const coverage = pmsResult?.coverage;
  const blocked = coverage?.blocked;
  return (
    <section className="rd-card" aria-label="Stage 2 PMS">
      <div className="rd-card-header"><TableCellsIcon width={16} /> Stage 2 — PMS (optional)</div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '1rem' }}>
        <p className="rd-text-muted" style={{ margin: 0, fontSize: 'var(--rd-text-body)' }}>
          Upload the project Piping Material Specification (template columns: PIPING CLASS, RATING, FACING, PIPING MATERIAL, SERVICE, CORROSION ALLOWANCE, VALVE BODY MATERIAL). The ADNOC Offshore workbook is auto-mapped from its Piping Material Codes sheet.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="rd-btn rd-btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy === 'pms'}>
            <ArrowUpTrayIcon width={16} /> {busy === 'pms' ? 'Parsing…' : 'Upload PMS workbook'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden
            onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="rd-btn rd-btn-ghost" onClick={onSkip}>Skip — fill from drawing evidence</button>
        </div>
        {settings?.pms_skipped && <div className="rd-pill rd-pill-neutral">Skipped — rating/material will be inferred from drawing evidence</div>}
        {Object.keys(classes).length > 0 && !pmsResult && (
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)' }}>
            {Object.keys(classes).length} classes loaded from {settings?.pms_data?.source || 'PMS'}
          </div>
        )}
        {coverage && (
          blocked ? (
            <div className="rd-banner rd-banner-danger" style={{ display: 'grid', gap: 8 }}>
              <span>{coverage.covered} of {coverage.total} classes covered — this PMS belongs to another project</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => fileRef.current?.click()}>Upload another PMS</button>
                <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onSkip}>Skip PMS</button>
              </span>
            </div>
          ) : (
            <div className="rd-banner rd-banner-info" style={{ borderColor: 'var(--rd-success)' }}>
              <span style={{ color: 'var(--rd-success)' }}>Covered {coverage.covered} of {coverage.total}</span>
              {coverage.uncovered_classes?.length > 0 && (
                <span className="rd-text-muted"> — uncovered: <span className="rd-mono">{coverage.uncovered_classes.join(', ')}</span></span>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stage 3 — RADAI AI Engine (§4)
// ---------------------------------------------------------------------------
function StageEngine({ status, busy, settings, engineTest, onTest, onSave, hasTextLayer, hasScopeCloud, projectId }) {
  const [method, setMethod] = useState(settings?.engine_method || (hasTextLayer ? 'vector-vision' : 'vision-only'));
  const [scope, setScope] = useState(settings?.engine_scope || (hasScopeCloud ? 'project-scope' : 'all-visible'));
  const [instruments, setInstruments] = useState(settings?.engine_instruments || 'list-separately');
  const [reviewThreshold, setReviewThreshold] = useState(settings?.engine_review_threshold ?? 0.8);
  // BYOK — key lives only in sessionStorage (see byokStorageKeys above).
  const [byokProvider, setByokProvider] = useState(() => readByok(projectId).provider);
  const [byokKey, setByokKey] = useState(() => readByok(projectId).apiKey);
  const [byokTest, setByokTest] = useState(null); // null | { valid, message }
  const [byokBusy, setByokBusy] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setMethod(settings.engine_method); setScope(settings.engine_scope);
    setInstruments(settings.engine_instruments); setReviewThreshold(settings.engine_review_threshold);
  }, [settings?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistByok = (provider, key) => {
    try {
      const k = byokStorageKeys(projectId);
      sessionStorage.setItem(k.provider, provider);
      if (key) sessionStorage.setItem(k.apiKey, key);
      else sessionStorage.removeItem(k.apiKey);
    } catch { /* sessionStorage unavailable — extraction will use central keys */ }
  };
  const onByokProvider = (v) => { setByokProvider(v); setByokTest(null); persistByok(v, byokKey); };
  const onByokKey = (v) => { setByokKey(v); setByokTest(null); persistByok(byokProvider, v); };
  const testByokKey = async () => {
    if (!byokKey.trim()) { setByokTest({ valid: false, message: 'Enter an API key first.' }); return; }
    setByokBusy(true);
    try {
      setByokTest(await valveMtoService.testApiKey(byokProvider, byokKey.trim()));
    } catch (e) {
      setByokTest({ valid: false, message: e?.response?.data?.message || e?.response?.data?.error || 'Key test failed.' });
    } finally { setByokBusy(false); }
  };

  if (status === 'locked') return null;
  return (
    <section className="rd-card" aria-label="Stage 3 RADAI AI Engine">
      <div className="rd-card-header"><BoltIcon width={16} /> Stage 3 — RADAI AI Engine</div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {engineTest === null
            ? <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)' }}>Engine status unknown — run a test.</span>
            : engineTest.ok
              ? <span className="rd-pill rd-pill-success">Engine: connected{engineTest.elapsed_s != null ? ` · OK · ${engineTest.elapsed_s} s` : ''}</span>
              : <span className="rd-pill rd-pill-danger">Engine not configured — ask an Admin, or use your own key below</span>}
          <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={onTest} disabled={busy === 'engine'}>
            {busy === 'engine' ? 'Testing…' : 'Test engine'}
          </button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: '0.75rem', border: '1px solid var(--rd-border, #e2e8f0)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 'var(--rd-text-body)' }}>Use your own AI key (BYOK)</strong>
            <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
              Optional — overrides the server key for your runs only. Stored only in this browser tab&apos;s session, never on the server.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="rd-select" value={byokProvider} onChange={(e) => onByokProvider(e.target.value)} aria-label="BYOK provider">
              <option value="openai">OpenAI</option>
              <option value="claude">Claude (Anthropic)</option>
            </select>
            <input className="rd-input" type="password" style={{ minWidth: 280, flex: 1 }}
              placeholder={byokProvider === 'openai' ? 'sk-…' : 'sk-ant-…'}
              value={byokKey} onChange={(e) => onByokKey(e.target.value)}
              aria-label="BYOK API key" autoComplete="off" />
            <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={testByokKey} disabled={byokBusy || !byokKey.trim()}>
              {byokBusy ? 'Testing…' : 'Test key'}
            </button>
            {byokKey.trim() && (
              <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={() => onByokKey('')}>Clear</button>
            )}
          </div>
          {byokTest && (
            <span className={`rd-pill ${byokTest.valid ? 'rd-pill-success' : 'rd-pill-danger'}`}>
              {byokTest.valid ? 'Key valid — extraction will use your key' : (byokTest.message || 'Key invalid')}
            </span>
          )}
          {byokKey.trim() && !byokTest?.valid && !byokTest && (
            <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
              Key entered — click Test key to validate it before extraction.
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
            <span className="rd-text-muted">Extraction method</span>
            <select className="rd-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="vector-vision">Vector + vision</option>
              <option value="vision-only">Vision only</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
            <span className="rd-text-muted">Valve scope</span>
            <select className="rd-select" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="project-scope">Project scope only — valves inside scope clouds</option>
              <option value="all-visible">All visible valves</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
            <span className="rd-text-muted">Instrument items</span>
            <select className="rd-select" value={instruments} onChange={(e) => setInstruments(e.target.value)}>
              <option value="list-separately">List separately (control, on-off, PSV, solenoid)</option>
              <option value="exclude">Exclude</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
            <span className="rd-text-muted">Confidence review threshold</span>
            <input className="rd-input" type="number" min="0" max="1" step="0.05" value={reviewThreshold}
              onChange={(e) => setReviewThreshold(Number(e.target.value))} />
          </label>
        </div>
        <div>
          <button className="rd-btn rd-btn-primary"
            onClick={() => onSave({ engine_method: method, engine_scope: scope, engine_instruments: instruments, engine_review_threshold: reviewThreshold })}>
            Save engine settings
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stage 4 — Valve Legend (§4)
// ---------------------------------------------------------------------------
function StageLegend({ status, busy, settings, legends, check, onSelect, onCheck, onAcknowledge, onOpenManager, onMapGroup }) {
  const [ackReason, setAckReason] = useState('');
  const [mapDraft, setMapDraft] = useState({});
  if (status === 'locked') return null;
  const selected = settings?.legend || '';
  const failed = check && !check.passed;
  const acked = Boolean(settings?.legend_ack?.reason);
  return (
    <section className="rd-card" aria-label="Stage 4 Valve Legend">
      <div className="rd-card-header"><BookOpenIcon width={16} /> Stage 4 — Valve Legend</div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="rd-select" style={{ minWidth: 260 }} value={selected} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Select a legend…</option>
            {legends.map((l) => <option key={l.legend_id} value={l.legend_id}>{l.name}</option>)}
          </select>
          <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={onOpenManager}>Manage legends</button>
          <button className="rd-btn rd-btn-primary rd-btn-sm" onClick={onCheck} disabled={!selected || busy === 'legend'}>
            {busy === 'legend' ? 'Checking…' : 'Run match check'}
          </button>
        </div>

        {check && (
          <div style={{ display: 'grid', gap: 8, fontSize: 'var(--rd-text-body)' }}>
            <div>
              Line format: <strong className="rd-mono">{check.line_format?.matched}/{check.line_format?.total}</strong>
              {' '}{check.line_format?.passed ? <span className="rd-pill rd-pill-success">pass</span> : <span className="rd-pill rd-pill-danger">fail (&lt;50%)</span>}
            </div>
            <div>
              Classes in legend: <strong className="rd-mono">{check.classes?.in_legend}/{check.classes?.total}</strong>
              {' '}{check.classes?.passed ? <span className="rd-pill rd-pill-success">pass</span> : <span className="rd-pill rd-pill-danger">fail (&lt;50%)</span>}
            </div>
            <div className="rd-text-muted">
              Fluid codes: {check.fluids?.matched}/{check.fluids?.total} matched{check.fluids?.matches?.length ? ` (${check.fluids.matches.join(', ')})` : ''}
            </div>

            {failed && !acked && (
              <div className="rd-banner rd-banner-danger" style={{ display: 'grid', gap: 8 }}>
                <span>This legend does not match the drawing</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => onSelect('')}>Choose another legend</button>
                  <input className="rd-input" style={{ minWidth: 220 }} placeholder="Reason (required to use anyway — Lead only)"
                    value={ackReason} onChange={(e) => setAckReason(e.target.value)} />
                  <button className="rd-btn rd-btn-ghost rd-btn-sm" disabled={!ackReason.trim()}
                    onClick={() => onAcknowledge(ackReason.trim())}>Use anyway</button>
                </span>
              </div>
            )}
            {acked && (
              <div className="rd-banner rd-banner-warning">
                Legend mismatch acknowledged — {settings.legend_ack.reason}
              </div>
            )}

            {Array.isArray(check.symbol_groups) && check.symbol_groups.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="rd-table">
                  <thead>
                    <tr>{['Symbol group', 'Count', 'Suggested type', 'Evidence', 'Status', 'Map'].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {check.symbol_groups.map((g) => (
                      <tr key={g.group_id}>
                        <td className="rd-mono">{g.group_id}</td>
                        <td>{g.count}</td>
                        <td>{g.suggested_type || '—'}</td>
                        <td className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                          {(g.evidence || []).map((e) => `p${e.page} @${Math.round(e.x)},${Math.round(e.y)}`).join(' · ') || '—'}
                        </td>
                        <td>{g.covered ? <span className="rd-pill rd-pill-success">mapped</span> : g.requires_mapping ? <span className="rd-pill rd-pill-danger">unmapped</span> : <span className="rd-pill rd-pill-neutral">small group</span>}</td>
                        <td>
                          {!g.covered && (
                            <span style={{ display: 'inline-flex', gap: 4 }}>
                              <select className="rd-select" style={{ padding: '2px 6px' }}
                                value={mapDraft[g.group_id]?.type || ''}
                                onChange={(e) => setMapDraft((prev) => ({ ...prev, [g.group_id]: { ...(prev[g.group_id] || {}), type: e.target.value } }))}>
                                <option value="">Type…</option>
                                {['BALL VALVE', 'GATE VALVE', 'GLOBE VALVE', 'CHECK VALVE', 'BUTTERFLY VALVE', 'PLUG VALVE', 'NEEDLE VALVE'].map((t) => <option key={t} value={t}>{t}</option>)}
                                <option value="__leave__">Leave unidentified</option>
                              </select>
                              <button className="rd-btn rd-btn-secondary rd-btn-sm"
                                disabled={!mapDraft[g.group_id]?.type}
                                onClick={() => {
                                  const t = mapDraft[g.group_id]?.type;
                                  onMapGroup(g.group_id, t === '__leave__' ? { leave_unidentified: true } : { type: t });
                                }}>Map</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Register row (§6 pills)
// ---------------------------------------------------------------------------
function RegisterRow({ row, columns, threshold, onEdit, onDelete, onOpenEvidence }) {
  const conf = row.confidence_score;
  return (
    <tr>
      {columns.map((c) => {
        const value = row[c.key];
        if (c.key === 'type') {
          return (
            <td key={c.key}>
              {(!value || value === 'UNIDENTIFIED' || row.type_basis === 'unidentified')
                ? <span className="rd-pill rd-pill-danger">UNIDENTIFIED</span>
                : <EditableCell value={value} onChange={(v) => onEdit(row.id, c.key, v)} />}
            </td>
          );
        }
        if (c.key === 'scope_status' && value) {
          const p = SCOPE_PILL[value] || { label: value, cls: 'rd-pill rd-pill-neutral' };
          return <td key={c.key}><span className={p.cls}>{p.label}</span></td>;
        }
        if (c.key === 'confidence_score') {
          const low = conf !== null && conf !== undefined && conf < threshold;
          return (
            <td key={c.key}>
              {conf === null || conf === undefined ? '—'
                : <span className={`rd-pill ${low ? 'rd-pill-warning' : 'rd-pill-neutral'}`}>{Number(conf).toFixed(2)}</span>}
            </td>
          );
        }
        if (c.editable) {
          return (
            <td key={c.key}>
              <EditableCell value={value} numeric={c.numeric} onChange={(v) => onEdit(row.id, c.key, v)} />
            </td>
          );
        }
        return <td key={c.key} className={c.key === 'line_number' || c.key === 'pid_number' ? 'rd-mono' : ''}>{value ?? ''}</td>;
      })}
      <td>
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" title="Evidence" onClick={() => onOpenEvidence(row)}><EyeIcon width={14} /></button>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" title="Delete row" onClick={() => onDelete(row.id)}><TrashIcon width={14} /></button>
        </span>
      </td>
    </tr>
  );
}

function EditableCell({ value, numeric, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  if (!editing) {
    return (
      <span onDoubleClick={() => setEditing(true)} title="Double-click to edit"
        style={{ display: 'block', minHeight: 20, cursor: 'text' }}>
        {value ?? ''}
      </span>
    );
  }
  return (
    <input className="rd-input" autoFocus value={draft}
      type={numeric ? 'number' : 'text'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onChange(numeric ? Number(draft) || 0 : draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
      style={{ padding: '2px 6px', fontSize: 'inherit' }} />
  );
}

// ---------------------------------------------------------------------------
// Review tab (§6 checks table)
// ---------------------------------------------------------------------------
function ReviewTable({ checks, onAction }) {
  return (
    <div style={{ overflowX: 'auto', padding: '1rem' }}>
      <table className="rd-table">
        <thead>
          <tr>{['Check', 'Result', 'Impact', 'Action'].map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id}>
              <td>{c.check}</td>
              <td>{c.rows.length > 0 ? <span className="rd-pill rd-pill-warning">{c.rows.length}</span> : <span className="rd-pill rd-pill-success">0</span>}</td>
              <td className="rd-text-muted">{c.impact}</td>
              <td>
                {c.rows.length > 0 && (
                  <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => onAction(c)}>
                    Show rows
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence drawer (§6)
// ---------------------------------------------------------------------------
function EvidenceDrawer({ row, threshold, onClose, onEdit }) {
  const conf = row.confidence_score;
  return (
    <>
      <div className="rd-drawer-backdrop" onClick={onClose} />
      <aside className="rd-drawer" aria-label="Valve evidence">
        <div className="rd-drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Evidence — {row.valve_tag || row.line_number || `Row ${row.sl_no}`}</strong>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose}><XMarkIcon width={16} /></button>
        </div>
        <div className="rd-drawer-body" style={{ display: 'grid', gap: '1rem' }}>
          {row.evidence_crop_url
            ? <img src={row.evidence_crop_url} alt="Symbol evidence" style={{ width: '100%', border: '1px solid var(--rd-border)', borderRadius: 'var(--rd-radius-control)' }} />
            : <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>No evidence crop stored for this row.</div>}
          {row.page && (
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
              Page {row.page}{row.pos_x != null ? ` · x ${Math.round(row.pos_x)}, y ${Math.round(row.pos_y)}` : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.scope_status && <span className={(SCOPE_PILL[row.scope_status] || {}).cls || 'rd-pill rd-pill-neutral'}>{(SCOPE_PILL[row.scope_status] || {}).label || row.scope_status}</span>}
            {row.type_basis && <span className="rd-pill rd-pill-neutral">basis: {row.type_basis}</span>}
            {conf !== null && conf !== undefined && (
              <span className={`rd-pill ${conf < threshold ? 'rd-pill-warning' : 'rd-pill-neutral'}`}>confidence {Number(conf).toFixed(2)}</span>
            )}
          </div>
          {[
            ['type', 'Type'], ['valve_tag', 'Valve tag'], ['line_number', 'Line number'],
            ['size_1', 'Size (NB)'], ['piping_class', 'Piping class'], ['pms_class', 'Material class'],
            ['rating', 'Rating / Facing'], ['description', 'Description'], ['remarks', 'Remarks'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
              <span className="rd-text-muted">{label}</span>
              <input className="rd-input" value={row[key] ?? ''} onChange={(e) => onEdit(key, e.target.value)} />
            </label>
          ))}
          <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
            <span className="rd-text-muted">Scope status</span>
            <select className="rd-select" value={row.scope_status || ''} onChange={(e) => onEdit('scope_status', e.target.value)}>
              <option value="">—</option>
              {SCOPE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
              <span className="rd-text-muted">Order (ISLAND)</span>
              <input className="rd-input" type="number" value={row.qty_island ?? 0} onChange={(e) => onEdit('qty_island', Number(e.target.value) || 0)} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 'var(--rd-text-caption)' }}>
              <span className="rd-text-muted">Order (FIELD)</span>
              <input className="rd-input" type="number" value={row.qty_field ?? 0} onChange={(e) => onEdit('qty_field', Number(e.target.value) || 0)} />
            </label>
          </div>
          {(Number(row.qty_island) || 0) + (Number(row.qty_field) || 0) !== (Number(row.qty_combined) || ((Number(row.qty_island) || 0) + (Number(row.qty_field) || 0))) && (
            <div className="rd-banner rd-banner-warning">Island + Field must equal the total.</div>
          )}
        </div>
      </aside>
    </>
  );
}
