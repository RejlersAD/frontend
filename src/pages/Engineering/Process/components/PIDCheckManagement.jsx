import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { API_BASE_URL } from '../../../../config/api.config';
import {
  ClipboardCheck, Search, X, Download, Upload, Filter, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, AlertCircle, HelpCircle, ShieldCheck,
  History, Activity, AlertTriangle, FileSpreadsheet, Send, ThumbsUp, ThumbsDown,
  RotateCcw, Bot, User, Wand2, Key,
} from 'lucide-react';
import { PID_CHECK_SCOPE_REGISTER } from '../../../../data/pidCheckScopeRegister';

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise P&ID Checker Management
// Full-width management workspace on top of the 358-check AI Check Scope
// Register (PID_AI_Check_Scope_Register.xlsx). Presentation-only: all state is
// local (localStorage), ready to be wired to backend endpoints later.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pid-check-management-v1';

const authHeader = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const RESULTS = ['Pass', 'Fail', 'N/A', 'Not Checked'];
const CONFIDENCES = ['High', 'Low'];
const DISPOSITIONS = ['', 'Accepted', 'Rejected', 'Rework', 'Deferred'];
const REVIEW_STATES = ['Draft', 'In Review', 'Approved'];

const PART_META = {
  A: { label: 'Part A — FEED Stage', color: '#2563eb' },
  B: { label: 'Part B — Detail Engineering', color: '#7c3aed' },
  C: { label: 'Part C — Consistency Checks', color: '#0d9488' },
};

const FEAS_META = {
  AUTO: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: Bot, label: 'AUTO' },
  ASSIST: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: Wand2, label: 'ASSIST' },
  HUMAN: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: User, label: 'HUMAN' },
};

const RESULT_META = {
  Pass: { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle2 },
  Fail: { color: '#991b1b', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
  'N/A': { color: '#475569', bg: '#f8fafc', border: '#e2e8f0', icon: MinusCircle },
  'Not Checked': { color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: HelpCircle },
};

const REQUIRED_REFERENCE_DOCS = [
  { name: 'Line List', dataType: 'line_list' },
  { name: 'Equipment List', dataType: 'equipment_list' },
  { name: 'Instrument Index', dataType: 'instrument_index' },
  { name: 'Relief Register' },
  { name: 'Cause & Effect Diagrams' },
  { name: 'HOLD Register' },
  { name: 'Tie-in Schedule' },
  { name: 'Tag Numbering Procedure' },
  { name: 'Utility Summary / UFDs' },
  { name: 'Piping Material Spec Index' },
];

// Reference documents typically needed per Part C section (soft-coded heuristic)
const SECTION_DOC_HINTS = [
  ['LINE LIST', ['Line List']],
  ['EQUIPMENT LIST', ['Equipment List']],
  ['INSTRUMENT INDEX', ['Instrument Index']],
  ['RELIEF', ['Relief Register']],
  ['CAUSE & EFFECT', ['Cause & Effect Diagrams']],
  ['HOLD', ['HOLD Register']],
  ['TIE-IN', ['Tie-in Schedule']],
  ['UTILITY', ['Utility Summary / UFDs']],
  ['PIPING SPECS', ['Piping Material Spec Index']],
  ['PFD', ['PFD / Heat & Material Balance']],
  ['PLOT PLAN', ['Plot Plan / 3D Model']],
  ['VENDOR', ['Vendor Package Documentation']],
  ['ELECTRICAL', ['Electrical Documents']],
];

// SOFT-CODED: AI check analysis modes (backend run_ai_checks) with BYOK support
const AI_CHECK_MODES = [
  { id: 'standard',        label: 'Standard (server OCR)',   needsKey: null },
  { id: 'enhanced_openai', label: 'Enhanced — OpenAI Vision', needsKey: 'openai' },
  { id: 'deep_claude',     label: 'Deep — Claude Vision',     needsKey: 'claude' },
  { id: 'hybrid',          label: 'Hybrid — OpenAI + Claude', needsKey: 'both' },
];

const now = () => new Date().toISOString();

const seedActivity = () => ([
  { at: now(), actor: 'System', action: 'Register loaded', detail: `${PID_CHECK_SCOPE_REGISTER.length} checks imported from AI Check Scope Register (Parts A/B/C).` },
]);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupted state — fall through to defaults */ }
  return null;
}

function Badge({ meta, children }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {children}
    </span>
  );
}

export default function PIDCheckManagement({ projectName, projectId, analysisContext }) {
  const persisted = useMemo(loadState, []);
  const apiUrl = projectId ? `${API_BASE_URL}/pid-verification/projects/${projectId}/check-management/` : null;
  const [syncState, setSyncState] = useState('local'); // 'local' | 'loading' | 'synced' | 'error'

  // ── Register state: { [checkId]: { result, confidence, finding, disposition } }
  const [rows, setRows] = useState(persisted?.rows || {});
  // ── Workflow state ──────────────────────────────────────────────────────────
  const [reviewState, setReviewState] = useState(persisted?.reviewState || 'Draft');
  const [revision, setRevision] = useState(persisted?.revision || 0);
  const [revisions, setRevisions] = useState(persisted?.revisions || [
    { rev: 0, at: now(), actor: 'System', note: `Initial register — ${PID_CHECK_SCOPE_REGISTER.length} checks, no results yet.`, state: 'Draft' },
  ]);
  const [activity, setActivity] = useState(persisted?.activity || seedActivity());
  // ── Reference document checklist ────────────────────────────────────────────
  const [docsProvided, setDocsProvided] = useState(persisted?.docsProvided || {});
  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [partFilter, setPartFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [feasFilter, setFeasFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [sideTab, setSideTab] = useState('activity');
  const [page, setPage] = useState(0);
  const [aiRun, setAiRun] = useState(null); // { runId, status, error }
  const [refDocTarget, setRefDocTarget] = useState(null); // doc object awaiting file pick
  // ── BYOK (Bring Your Own Key) for AI check runs ───────────────────────────
  const [byokOpen, setByokOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('standard');
  const [openaiKey, setOpenaiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  // ── Project documents status (gates Run AI Checks) ────────────────────────
  const [projectDocs, setProjectDocs] = useState(null); // { total, completed, processing, failed }
  // ── Uploaded reference data files (Ref Docs tab) ──────────────────────────
  const [refDataFiles, setRefDataFiles] = useState([]);
  const pollRef = useRef(null);
  const refDocFileRef = useRef(null);
  const fileRef = useRef(null);
  const PAGE_SIZE = 25;

  const persist = (next) => {
    const snapshot = {
      rows: next.rows ?? rows,
      reviewState: next.reviewState ?? reviewState,
      revision: next.revision ?? revision,
      revisions: next.revisions ?? revisions,
      activity: next.activity ?? activity,
      docsProvided: next.docsProvided ?? docsProvided,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* quota — ignore */ }
    if (apiUrl) {
      axios.put(apiUrl, snapshot, { headers: authHeader() })
        .then(() => setSyncState('synced'))
        .catch(() => setSyncState('error'));
    }
  };

  // ── Server persistence: load once per project ─────────────────────────────
  useEffect(() => {
    if (!apiUrl) return undefined;
    let cancelled = false;
    setSyncState('loading');
    axios.get(apiUrl, { headers: authHeader() })
      .then(res => {
        if (cancelled || !res.data) return;
        const d = res.data;
        if (d.rows && Object.keys(d.rows).length) setRows(d.rows);
        if (d.reviewState) setReviewState(d.reviewState);
        if (typeof d.revision === 'number') setRevision(d.revision);
        if (Array.isArray(d.revisions) && d.revisions.length) setRevisions(d.revisions);
        if (Array.isArray(d.activity) && d.activity.length) setActivity(d.activity);
        if (d.docsProvided && Object.keys(d.docsProvided).length) setDocsProvided(d.docsProvided);
        setSyncState('synced');
      })
      .catch(() => setSyncState('error'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const logActivity = (actor, action, detail, base) => {
    const next = [{ at: now(), actor, action, detail }, ...(base || activity)];
    setActivity(next);
    return next;
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const s = new Set();
    PID_CHECK_SCOPE_REGISTER.forEach(r => { if (partFilter === 'all' || r.part === partFilter) s.add(r.section); });
    return [...s];
  }, [partFilter]);

  const stats = useMemo(() => {
    const total = PID_CHECK_SCOPE_REGISTER.length;
    const counts = { Pass: 0, Fail: 0, 'N/A': 0, 'Not Checked': 0 };
    const byFeas = { AUTO: { done: 0, total: 0 }, ASSIST: { done: 0, total: 0 }, HUMAN: { done: 0, total: 0 } };
    let lowConfidence = 0, failNoEvidence = 0;
    PID_CHECK_SCOPE_REGISTER.forEach(r => {
      const st = rows[r.id];
      byFeas[r.feasibility].total += 1;
      if (st?.result && RESULTS.includes(st.result)) {
        counts[st.result] += 1;
        byFeas[r.feasibility].done += 1;
        if (st.confidence === 'Low') lowConfidence += 1;
        if (st.result === 'Fail' && !st.finding?.trim()) failNoEvidence += 1;
      }
    });
    const executed = counts.Pass + counts.Fail + counts['N/A'] + counts['Not Checked'];
    return { total, counts, executed, noResult: total - executed, pct: total ? Math.round((executed / total) * 100) : 0, byFeas, lowConfidence, failNoEvidence };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PID_CHECK_SCOPE_REGISTER.filter(r => {
      if (partFilter !== 'all' && r.part !== partFilter) return false;
      if (sectionFilter !== 'all' && r.section !== sectionFilter) return false;
      if (feasFilter !== 'all' && r.feasibility !== feasFilter) return false;
      const st = rows[r.id];
      if (resultFilter !== 'all') {
        if (resultFilter === 'none') { if (st?.result) return false; }
        else if (st?.result !== resultFilter) return false;
      }
      if (q && !(`${r.id} ${r.description} ${r.section}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, partFilter, sectionFilter, feasFilter, resultFilter, rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Data-quality: which reference docs does the current filter scope need?
  const neededDocs = useMemo(() => {
    const need = new Set();
    PID_CHECK_SCOPE_REGISTER.forEach(r => {
      SECTION_DOC_HINTS.forEach(([key, docs]) => {
        if (r.section.toUpperCase().includes(key)) docs.forEach(d => need.add(d));
      });
    });
    return [...need];
  }, []);
  const missingDocs = neededDocs.filter(d => !docsProvided[d]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateRow = (id, patch) => {
    const next = { ...rows, [id]: { ...rows[id], ...patch } };
    setRows(next);
    persist({ rows: next });
  };

  const resetAll = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Reset all check results, dispositions and workflow state?')) return;
    const act = logActivity('Engineer', 'Register reset', 'All results cleared back to blank register.');
    setRows({});
    persist({ rows: {}, activity: act });
  };

  // ── Import / Export ─────────────────────────────────────────────────────────
  const exportRegister = () => {
    const data = PID_CHECK_SCOPE_REGISTER.map(r => {
      const st = rows[r.id] || {};
      return {
        'Check ID': r.id,
        'Part': r.partLabel,
        'Section': r.section,
        'Check Description': r.description,
        'AI Feasibility': r.feasibility,
        'AI Result': st.result || '',
        'AI Confidence': st.confidence || '',
        'AI Finding / Evidence': st.finding || '',
        'Engineer Disposition': st.disposition || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 10 }, { wch: 34 }, { wch: 44 }, { wch: 70 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 50 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AI Check Register');

    const summary = XLSX.utils.aoa_to_sheet([
      ['Group', 'Checks', 'Pass', 'Fail', 'N/A', 'Not Checked', 'No Result', '% Executed'],
      ['Part A — FEED Stage', ...partSummary('A')],
      ['Part B — Detail Engineering', ...partSummary('B')],
      ['Part C — Consistency Checks', ...partSummary('C')],
      ['TOTAL', stats.total, stats.counts.Pass, stats.counts.Fail, stats.counts['N/A'], stats.counts['Not Checked'], stats.noResult, `${stats.pct}%`],
      [],
      ['Review State', reviewState],
      ['Revision', `Rev ${revision}`],
      ['Exported', new Date().toLocaleString()],
    ]);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');
    XLSX.writeFile(wb, `PID_AI_Check_Register_Rev${revision}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    const act = logActivity('Engineer', 'Export', `Register exported to Excel (Rev ${revision}, ${stats.executed}/${stats.total} executed).`);
    persist({ activity: act });
  };

  const partSummary = (p) => {
    const rowsP = PID_CHECK_SCOPE_REGISTER.filter(r => r.part === p);
    const c = { Pass: 0, Fail: 0, 'N/A': 0, 'Not Checked': 0 };
    rowsP.forEach(r => { const res = rows[r.id]?.result; if (c[res] !== undefined) c[res] += 1; });
    const done = c.Pass + c.Fail + c['N/A'] + c['Not Checked'];
    return [rowsP.length, c.Pass, c.Fail, c['N/A'], c['Not Checked'], rowsP.length - done, `${rowsP.length ? Math.round((done / rowsP.length) * 100) : 0}%`];
  };

  const importRegister = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      const validIds = new Set(PID_CHECK_SCOPE_REGISTER.map(r => r.id));
      const next = { ...rows };
      let applied = 0;
      json.forEach(row => {
        const id = String(row['Check ID'] || '').trim();
        if (!validIds.has(id)) return;
        const result = String(row['AI Result'] || '').trim();
        next[id] = {
          result: RESULTS.includes(result) ? result : undefined,
          confidence: CONFIDENCES.includes(row['AI Confidence']) ? row['AI Confidence'] : undefined,
          finding: row['AI Finding / Evidence'] ? String(row['AI Finding / Evidence']) : undefined,
          disposition: row['Engineer Disposition'] ? String(row['Engineer Disposition']) : undefined,
        };
        applied += 1;
      });
      setRows(next);
      const act = logActivity('AI Tool', 'Import', `${applied} check rows imported from "${file.name}".`);
      persist({ rows: next, activity: act });
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(`Import failed: ${err.message}`);
    }
  };

  // ── Workflow transitions ────────────────────────────────────────────────────
  const transition = (to, note) => {
    const nextRev = to === 'Draft' ? revision + 1 : revision;
    const revEntry = to === 'Draft'
      ? { rev: nextRev, at: now(), actor: 'Engineer', note: note || `Returned to draft — Rev ${nextRev} opened.`, state: to }
      : { rev: nextRev, at: now(), actor: 'Engineer', note: note || `State changed to ${to}.`, state: to };
    const nextRevisions = [revEntry, ...revisions];
    const act = logActivity('Engineer', `Workflow: ${reviewState} → ${to}`, revEntry.note);
    setReviewState(to);
    setRevision(nextRev);
    setRevisions(nextRevisions);
    persist({ reviewState: to, revision: nextRev, revisions: nextRevisions, activity: act });
  };

  const stateColor = { Draft: '#64748b', 'In Review': '#d97706', Approved: '#059669' }[reviewState];

  // ── AI check execution (smart deterministic engine) ───────────────────────

  const runAiChecks = async () => {
    if (!projectId || aiRun?.status === 'pending' || aiRun?.status === 'extracting' || aiRun?.status === 'checking') return;
    setAiRun({ status: 'checking' });
    try {
      // Smart engine: deterministic, instant — runs on stored analysis data
      // (extraction summaries, comparison results, findings, reference data).
      const res = await axios.post(
        `${API_BASE_URL}/pid-verification/projects/${projectId}/check-management/smart-run/`,
        {},
        { headers: authHeader() },
      );
      const { rows: smartRows, meta } = res.data;
      const next = { ...rows };
      let executed = 0, passed = 0, failed = 0, notChecked = 0;
      Object.entries(smartRows || {}).forEach(([cid, v]) => {
        next[cid] = { ...next[cid], result: v.result, confidence: v.confidence, finding: v.finding };
        executed += 1;
        if (v.result === 'Pass') passed += 1;
        else if (v.result === 'Fail') failed += 1;
        else if (v.result === 'Not Checked') notChecked += 1;
      });
      setRows(next);
      setAiRun({ status: 'completed' });
      const act = logActivity(
        'AI Engine',
        'Smart check run completed',
        `${executed} checks executed from stored analysis data (${meta?.documents ?? 0} docs, ${meta?.sheets ?? 0} sheets, ${meta?.findings ?? 0} findings): ${passed} Pass · ${failed} Fail · ${notChecked} Not Checked.`,
      );
      persist({ rows: next, activity: act });
    } catch (err) {
      setAiRun({ status: 'failed', error: err.response?.data?.error || err.message });
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Load project document status (gates AI checks) + reference data files ──
  const loadProjectDocs = React.useCallback(() => {
    if (!projectId) return;
    axios.get(`${API_BASE_URL}/pid-verification/list/?project_id=${projectId}`, { headers: authHeader() })
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setProjectDocs({
          total: list.length,
          completed: list.filter(d => d.status === 'completed').length,
          processing: list.filter(d => d.status === 'processing' || d.status === 'uploaded').length,
          failed: list.filter(d => d.status === 'failed').length,
        });
      })
      .catch(() => {});
  }, [projectId]);

  const loadRefDataFiles = React.useCallback(() => {
    if (!projectId) return;
    axios.get(`${API_BASE_URL}/pid-verification/projects/${projectId}/reference-data/`, { headers: authHeader() })
      .then(res => setRefDataFiles(Array.isArray(res.data) ? res.data : (res.data?.reference_data || res.data?.results || [])))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    loadProjectDocs();
    loadRefDataFiles();
    // Keep doc status fresh while uploads are processing
    const t = setInterval(() => {
      setProjectDocs(prev => {
        if (prev && prev.processing > 0) loadProjectDocs();
        return prev;
      });
    }, 15000);
    return () => clearInterval(t);
  }, [loadProjectDocs, loadRefDataFiles]);

  // ── Reference document upload (line/equipment/instrument lists) ──────────
  const refDocUpload = async (docName, dataType, file) => {
    if (!projectId || !file) return;
    const fd = new FormData();
    fd.append('data_type', dataType);
    fd.append('file', file);
    try {
      await axios.post(
        `${API_BASE_URL}/pid-verification/projects/${projectId}/reference-data/upload/`,
        fd,
        { headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' } },
      );
      const nextDocs = { ...docsProvided, [docName]: true };
      setDocsProvided(nextDocs);
      const act = logActivity('Engineer', 'Reference document uploaded', `${docName}: "${file.name}" uploaded and queued for parsing.`);
      persist({ docsProvided: nextDocs, activity: act });
      loadRefDataFiles();
      // Parsing is async — refresh a few times so the status chip updates
      setTimeout(loadRefDataFiles, 8000);
      setTimeout(loadRefDataFiles, 20000);
    } catch (err) {
      const act = logActivity('System', 'Reference upload failed', `${docName}: ${err.response?.data?.error || err.message}`);
      persist({ activity: act });
    }
  };

  const aiRunning = aiRun && ['pending', 'extracting', 'checking'].includes(aiRun.status);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg overflow-hidden bg-transparent" style={{ border: '1px solid #e1e9f1', background: '#f7fafc' }}>

      {/* ══ Header ══ */}
      <div className="px-6 py-4 bg-white flex items-center gap-4 flex-wrap" style={{ borderBottom: '1px solid #e1e9f1' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#087f91' }}>
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-slate-900">P&ID Checker Management</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white" style={{ background: stateColor }}>
              {reviewState}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Rev {revision}</span>
            {apiUrl && (
              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
                syncState === 'synced' ? 'text-emerald-500' : syncState === 'error' ? 'text-red-500' : 'text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  syncState === 'synced' ? 'bg-emerald-500' : syncState === 'error' ? 'bg-red-500' : 'bg-slate-300 animate-pulse'
                }`} />
                {syncState === 'synced' ? 'Saved' : syncState === 'error' ? 'Sync error' : syncState === 'loading' ? 'Loading…' : 'Local'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {projectName ? `${projectName} · ` : ''}{PID_CHECK_SCOPE_REGISTER.length}-check AI Scope Register — FEED · Detail Engineering · Consistency
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {projectId && (
            <button type="button" onClick={runAiChecks}
              disabled={aiRunning || reviewState === 'Approved' || (projectDocs && projectDocs.completed === 0)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#087f91' }}
              title={
                projectDocs && projectDocs.completed === 0
                  ? projectDocs.processing > 0
                    ? `${projectDocs.processing} P&ID document(s) still processing on the Overview tab — AI checks unlock when at least one completes`
                    : 'Upload and process a P&ID on the Overview tab first'
                  : 'Extract registers from processed P&IDs and run AUTO reconciliation checks'
              }>
              <Bot className={`w-4 h-4 ${aiRunning ? 'animate-pulse' : ''}`} />
              {aiRunning
                ? `AI ${aiRun.status}…`
                : projectDocs && projectDocs.completed === 0 && projectDocs.processing > 0
                  ? `Processing ${projectDocs.processing} doc(s)…`
                  : 'Run AI Checks'}
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importRegister} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: '1px solid #dbe4ee', background: '#fff', color: '#132746' }}>
            <Upload className="w-4 h-4" /> Import Results
          </button>
          <button type="button" onClick={exportRegister}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: '1px solid #087f91', background: '#fff', color: '#087f91' }}>
            <FileSpreadsheet className="w-4 h-4" /> Export Register
          </button>
          {reviewState === 'Draft' && (
            <button type="button" onClick={() => transition('In Review', `Submitted for review — ${stats.executed}/${stats.total} checks executed.`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors">
              <Send className="w-3.5 h-3.5" /> Submit for Review
            </button>
          )}
          {reviewState === 'In Review' && (
            <>
              <button type="button" onClick={() => transition('Approved', `Approved at Rev ${revision} — ${stats.counts.Fail} candidate discrepancies logged for disposition.`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                <ThumbsUp className="w-3.5 h-3.5" /> Approve
              </button>
              <button type="button" onClick={() => transition('Draft', 'Rejected — returned to draft for rework.')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors">
                <ThumbsDown className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
          {reviewState === 'Approved' && (
            <button type="button" onClick={() => transition('Draft', 'New revision opened after approval.')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Open New Revision
            </button>
          )}
          <button type="button" onClick={resetAll} title="Reset register"
            className="p-2 rounded-lg border border-slate-300 text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ══ Overview ↔ Checks 358 interconnection banner ══ */}
      {analysisContext && (
        <div className="px-6 pt-3">
          <div className="flex items-center gap-2.5 rounded-lg px-4 py-2.5"
            style={{ border: '1px solid #dbe4ee', background: analysisContext.hasResults ? '#f2fafb' : '#fff8ec' }}>
            <Activity className="w-4 h-4 flex-shrink-0" style={{ color: analysisContext.hasResults ? '#087f91' : '#a55a00' }} />
            {analysisContext.hasResults ? (
              <p className="text-xs" style={{ color: '#40536d' }}>
                Connected to the Overview analysis: <b>{analysisContext.drawings}</b> P&ID drawing{analysisContext.drawings === 1 ? '' : 's'} processed, <b>{analysisContext.issues}</b> finding{analysisContext.issues === 1 ? '' : 's'} raised in the latest run. Run AI Checks below to reconcile the register against reference documents.
              </p>
            ) : projectDocs && projectDocs.processing > 0 ? (
              <p className="text-xs" style={{ color: '#40536d' }}>
                <b>{projectDocs.processing}</b> P&ID document{projectDocs.processing === 1 ? '' : 's'} still processing from your Overview upload — pages are analyzed one by one (large multi-page P&IDs can take a while). <b>Run AI Checks</b> unlocks automatically once at least one document completes.
              </p>
            ) : (
              <p className="text-xs" style={{ color: '#40536d' }}>
                No P&ID has been analyzed yet on the Overview tab. Upload &amp; process at least one drawing there first — AI checks extract their registers from processed drawings.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ BYOK — AI engine selection + optional user API keys ══ */}
      {projectId && (
        <div className="px-6 pt-3">
          <div className="rounded-lg bg-white overflow-hidden" style={{ border: '1px solid #e1e9f1' }}>
            <button type="button" onClick={() => setByokOpen(o => !o)}
              className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left transition-colors hover:bg-slate-50">
              <Key className="w-4 h-4" style={{ color: '#087f91' }} />
              <span className="text-xs font-bold" style={{ color: '#132746' }}>
                AI Engine: {AI_CHECK_MODES.find(m => m.id === analysisMode)?.label}
              </span>
              <span className="text-[10px] font-semibold" style={{ color: '#667892' }}>
                {analysisMode === 'standard' ? 'no key needed' : (openaiKey || claudeKey) ? 'BYOK key set' : 'uses server-configured key'}
              </span>
              {byokOpen
                ? <ChevronDown className="w-4 h-4 ml-auto" style={{ color: '#667892' }} />
                : <ChevronRight className="w-4 h-4 ml-auto" style={{ color: '#667892' }} />}
            </button>
            {byokOpen && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ borderTop: '1px solid #eef3f8' }}>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: '#667892' }}>Analysis mode</label>
                  <select value={analysisMode} onChange={e => setAnalysisMode(e.target.value)} disabled={aiRunning}
                    className="w-full text-xs px-2.5 py-2 rounded-lg bg-white outline-none disabled:opacity-50"
                    style={{ border: '1px solid #dbe4ee', color: '#132746' }}>
                    {AI_CHECK_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                {['openai', 'both'].includes(AI_CHECK_MODES.find(m => m.id === analysisMode)?.needsKey) && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: '#667892' }}>OpenAI API key (BYOK)</label>
                    <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
                      placeholder="sk-… (blank = server-configured key)" disabled={aiRunning}
                      className="w-full text-xs px-2.5 py-2 rounded-lg bg-white outline-none disabled:opacity-50"
                      style={{ border: '1px solid #dbe4ee', color: '#132746' }} />
                  </div>
                )}
                {['claude', 'both'].includes(AI_CHECK_MODES.find(m => m.id === analysisMode)?.needsKey) && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: '#667892' }}>Claude API key (BYOK)</label>
                    <input type="password" value={claudeKey} onChange={e => setClaudeKey(e.target.value)}
                      placeholder="sk-ant-… (blank = server-configured key)" disabled={aiRunning}
                      className="w-full text-xs px-2.5 py-2 rounded-lg bg-white outline-none disabled:opacity-50"
                      style={{ border: '1px solid #dbe4ee', color: '#132746' }} />
                  </div>
                )}
                <p className="text-[10px] md:col-span-3" style={{ color: '#667892' }}>
                  BYOK keys are sent with the run request only and are never stored. Leave blank to use the platform key configured by your administrator.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ KPI strip — Equipment List style stat cells ══ */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-5 rounded-lg overflow-hidden bg-white" style={{ border: '1px solid #e1e9f1' }}>
          {[
            { icon: FileSpreadsheet, label: 'Total checks',   value: stats.total,               color: '#50647e' },
            { icon: CheckCircle2,    label: 'Pass',           value: stats.counts.Pass,         color: '#087f91' },
            { icon: XCircle,         label: 'Fail',           value: stats.counts.Fail,         color: '#c9252d' },
            { icon: AlertTriangle,   label: 'Not checked',    value: stats.counts['Not Checked'], color: '#a55a00' },
            { icon: History,         label: 'Review pending', value: stats.noResult,            color: '#50647e' },
          ].map((k, i) => (
            <div key={k.label} className="flex items-center gap-3 px-5 py-4" style={{ borderRight: i < 4 ? '1px solid #e1e9f1' : 'none' }}>
              <k.icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 750, color: '#132746', lineHeight: 1.1 }}>{k.value}</div>
                <div className="text-xs" style={{ color: '#667892' }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feasibility progress bars */}
      <div className="px-6 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(stats.byFeas).map(([cls, v]) => {
          const meta = FEAS_META[cls];
          const pct = v.total ? Math.round((v.done / v.total) * 100) : 0;
          return (
            <div key={cls} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <Badge meta={meta}><meta.icon className="w-3 h-3" />{meta.label}</Badge>
                <span className="text-xs font-bold text-slate-600">{v.done}/{v.total} · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ Data-quality alerts ══ */}
      {aiRun?.status === 'failed' && (
        <div className="px-6 pt-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">AI check run failed: {aiRun.error || 'unknown error'}</p>
          </div>
        </div>
      )}
      {aiRunning && (
        <div className="px-6 pt-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <p className="text-xs text-emerald-700 font-medium">
              AI check run in progress — stage: <span className="font-black uppercase">{aiRun.status}</span>. Extraction registers are built from the project&apos;s processed P&IDs, then AUTO reconciliation checks run against the uploaded reference data. This can take several minutes.
            </p>
          </div>
        </div>
      )}
      {(stats.lowConfidence > 0 || stats.failNoEvidence > 0 || missingDocs.length > 0) && (
        <div className="px-6 pt-3 space-y-2">
          {stats.failNoEvidence > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">
                {stats.failNoEvidence} Fail result{stats.failNoEvidence > 1 ? 's' : ''} missing mandatory Finding/Evidence — every Fail must name sheet, tag and both conflicting values.
              </p>
            </div>
          )}
          {stats.lowConfidence > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium">
                {stats.lowConfidence} result{stats.lowConfidence > 1 ? 's' : ''} marked Low confidence — these rest on partial legibility or assumed conventions and need engineer verification.
              </p>
            </div>
          )}
          {missingDocs.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5">
              <AlertCircle className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-sky-700 font-medium">
                {missingDocs.length} reference document{missingDocs.length > 1 ? 's' : ''} not yet provided — dependent checks will record &ldquo;Not Checked — [document] not provided&rdquo;. Tick supplied documents in the Reference Docs tab.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="p-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* ══ Register table ══ */}
        <div className="rounded-lg bg-white overflow-hidden" style={{ border: '1px solid #e1e9f1' }}>
          {/* Card title row */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #e1e9f1' }}>
            <h3 className="text-sm font-bold" style={{ color: '#132746' }}>Check register</h3>
            <span className="text-xs" style={{ color: '#667892' }}>{filtered.length} of {stats.total} checks · Rev {revision} · {reviewState}</span>
          </div>
          {/* Filter bar */}
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap bg-white" style={{ borderBottom: '1px solid #e1e9f1' }}>
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text" value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search check ID, description, section…"
                className="w-full text-xs pl-7 pr-7 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 placeholder-slate-400 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select value={partFilter} onChange={e => { setPartFilter(e.target.value); setSectionFilter('all'); setPage(0); }}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer">
              <option value="all">All Parts</option>
              {Object.entries(PART_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            <select value={sectionFilter} onChange={e => { setSectionFilter(e.target.value); setPage(0); }}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer max-w-[220px]">
              <option value="all">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={feasFilter} onChange={e => { setFeasFilter(e.target.value); setPage(0); }}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer">
              <option value="all">All Feasibility</option>
              <option value="AUTO">AUTO</option>
              <option value="ASSIST">ASSIST</option>
              <option value="HUMAN">HUMAN</option>
            </select>
            <select value={resultFilter} onChange={e => { setResultFilter(e.target.value); setPage(0); }}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer">
              <option value="all">All Results</option>
              {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="none">No Result</option>
            </select>
            <span className="text-[11px] font-bold text-slate-400 ml-auto">{filtered.length} of {stats.total} checks</span>
          </div>

          {/* Start banner — mirrors the Equipment List "Start an extraction" dashed callout */}
          {stats.executed === 0 && !aiRunning && (
            <div className="mx-4 mt-4 mb-1 flex items-center justify-between gap-4 rounded-lg px-4 py-3.5"
              style={{ border: '1.5px dashed #9fd3dc', background: '#f2fafb' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#132746' }}>Start an AI check run</p>
                <p className="text-xs mt-0.5" style={{ color: '#667892' }}>Upload P&IDs and reference documents, then run AI checks to populate this register — or record results manually.</p>
              </div>
              {projectId && (
                <button type="button" onClick={runAiChecks}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: '#087f91' }}>
                  Run AI Checks
                </button>
              )}
            </div>
          )}

          {/* Table header */}
          <div className="grid grid-cols-[90px_1fr_90px_110px_100px_32px] gap-2 px-4 py-2 border-b border-slate-100 bg-white text-[10px] font-black uppercase tracking-wide text-slate-400">
            <span>Check ID</span><span>Description</span><span>Feasibility</span><span>AI Result</span><span>Confidence</span><span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50">
            {pageRows.map(r => {
              const st = rows[r.id] || {};
              const expanded = expandedId === r.id;
              const rMeta = st.result ? RESULT_META[st.result] : null;
              const fMeta = FEAS_META[r.feasibility];
              return (
                <div key={r.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="w-full grid grid-cols-[90px_1fr_90px_110px_100px_32px] gap-2 px-4 py-2.5 items-center text-left hover:bg-slate-50/80 transition-colors"
                  >
                    <span className="text-xs font-black text-teal-700 font-mono">{r.id}</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-slate-700 leading-5 line-clamp-2">{r.description}</span>
                      <span className="block text-[10px] text-slate-400 truncate mt-0.5">{PART_META[r.part].label} · {r.section}</span>
                    </span>
                    <Badge meta={fMeta}>{fMeta.label}</Badge>
                    <span>
                      {rMeta
                        ? <Badge meta={rMeta}><rMeta.icon className="w-3 h-3" />{st.result}</Badge>
                        : <span className="text-[10px] font-bold text-slate-300 uppercase">—</span>}
                    </span>
                    <span className={`text-[10px] font-bold uppercase ${st.confidence === 'Low' ? 'text-amber-600' : st.confidence === 'High' ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {st.confidence || '—'}
                    </span>
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 pt-1 bg-slate-50/60 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">AI Result</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {RESULTS.map(res => {
                                const m = RESULT_META[res];
                                const active = st.result === res;
                                return (
                                  <button key={res} type="button" disabled={reviewState === 'Approved'}
                                    onClick={() => updateRow(r.id, { result: active ? undefined : res })}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                                    style={active
                                      ? { background: m.color, color: '#fff', border: `1px solid ${m.color}` }
                                      : { background: '#fff', color: m.color, border: `1px solid ${m.border}` }}>
                                    {res}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">AI Confidence</label>
                            <div className="flex gap-1.5">
                              {CONFIDENCES.map(c => (
                                <button key={c} type="button" disabled={reviewState === 'Approved'}
                                  onClick={() => updateRow(r.id, { confidence: st.confidence === c ? undefined : c })}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-40 ${
                                    st.confidence === c
                                      ? (c === 'High' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-amber-500 border-amber-500 text-white')
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                                  }`}>
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Engineer Disposition</label>
                            <select value={st.disposition || ''} disabled={reviewState === 'Approved'}
                              onChange={e => updateRow(r.id, { disposition: e.target.value || undefined })}
                              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none cursor-pointer w-full disabled:opacity-40">
                              {DISPOSITIONS.map(d => <option key={d} value={d}>{d || '— Pending —'}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">
                            Finding / Evidence {st.result === 'Fail' && <span className="text-red-500">(mandatory for Fail)</span>}
                          </label>
                          <textarea
                            value={st.finding || ''} disabled={reviewState === 'Approved'}
                            onChange={e => updateRow(r.id, { finding: e.target.value || undefined })}
                            placeholder="Sheet number, tag/line involved, conflicting values, governing document… (≤ 50 words)"
                            rows={5}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 placeholder-slate-400 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 resize-y disabled:opacity-40"
                          />
                          {r.feasibility === 'HUMAN' && (
                            <p className="mt-1.5 text-[10px] text-slate-400 italic">
                              HUMAN-class check — record &ldquo;Not Checked&rdquo; and summarize drawing content only; the conclusion belongs to the engineer.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {pageRows.length === 0 && (
              <div className="py-16 text-center">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-400">No checks match the current filters</p>
              </div>
            )}
          </div>

          {/* Pagination — EL style "x–y of z" */}
          <div className="px-4 py-2.5 flex items-center justify-between bg-white" style={{ borderTop: '1px solid #e1e9f1' }}>
            <span className="text-xs" style={{ color: '#667892' }}>
              {filtered.length === 0 ? '0–0 of 0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="w-7 h-7 rounded text-xs font-bold disabled:opacity-30 transition-colors"
                style={{ border: '1px solid #dbe4ee', color: '#40536d', background: '#fff' }}>
                ‹
              </button>
              <span className="w-7 h-7 rounded text-xs font-bold flex items-center justify-center text-white" style={{ background: '#087f91' }}>{page + 1}</span>
              <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}
                className="w-7 h-7 rounded text-xs font-bold disabled:opacity-30 transition-colors"
                style={{ border: '1px solid #dbe4ee', color: '#40536d', background: '#fff' }}>
                ›
              </button>
            </div>
          </div>
        </div>

        {/* ══ Side panel: Activity / Revisions / Reference Docs ══ */}
        <div className="rounded-lg bg-white overflow-hidden self-start sticky top-4" style={{ border: '1px solid #e1e9f1' }}>
          <div className="flex border-b border-slate-100">
            {[
              { id: 'activity', label: 'Activity', icon: Activity },
              { id: 'revisions', label: 'Revisions', icon: History },
              { id: 'docs', label: 'Ref Docs', icon: FileSpreadsheet },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => setSideTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold border-b-2 transition-all ${
                  sideTab === t.id ? 'text-teal-700 border-teal-500 bg-teal-50/40' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {sideTab === 'activity' && (
              <div className="divide-y divide-slate-50">
                {activity.map((a, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700">{a.action}</span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(a.at).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-4">{a.detail}</p>
                    <p className="text-[10px] text-teal-600 font-bold mt-1">{a.actor}</p>
                  </div>
                ))}
              </div>
            )}

            {sideTab === 'revisions' && (
              <div className="divide-y divide-slate-50">
                {revisions.map((r, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                      style={{ background: { Draft: '#64748b', 'In Review': '#d97706', Approved: '#059669' }[r.state] || '#64748b' }}>
                      R{r.rev}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-700">{r.state}</p>
                      <p className="text-[11px] text-slate-500 leading-4">{r.note}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.actor} · {new Date(r.at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sideTab === 'docs' && (
              <div className="divide-y divide-slate-50">
                <div className="px-4 py-2.5 bg-slate-50/60">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Reference documents (apart from P&ID & Legend sheets)</p>
                </div>
                <input
                  ref={refDocFileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.txt" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (refDocTarget && f) refDocUpload(refDocTarget.name, refDocTarget.dataType, f);
                    setRefDocTarget(null);
                  }}
                />
                {REQUIRED_REFERENCE_DOCS.map(doc => {
                  const uploads = doc.dataType ? refDataFiles.filter(f => f.data_type === doc.dataType) : [];
                  const latest = uploads[0] || null; // API returns newest first
                  const provided = !!docsProvided[doc.name] || !!latest;
                  const needed = neededDocs.includes(doc.name);
                  const statusMeta = latest
                    ? ({
                        completed: { label: 'Parsed ✓', color: '#059669', bg: '#ecfdf5' },
                        processing: { label: 'Parsing…', color: '#d97706', bg: '#fffbeb' },
                        pending: { label: 'Queued…', color: '#d97706', bg: '#fffbeb' },
                        failed: { label: 'Parse failed', color: '#dc2626', bg: '#fef2f2' },
                      }[latest.status] || { label: latest.status, color: '#64748b', bg: '#f8fafc' })
                    : null;
                  return (
                    <div key={doc.name} className="px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox" checked={provided}
                          onChange={() => {
                            const next = { ...docsProvided, [doc.name]: !provided };
                            setDocsProvided(next);
                            persist({ docsProvided: next });
                          }}
                          className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
                        />
                        <span className={`text-xs flex-1 ${provided ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>{doc.name}</span>
                        {doc.dataType && projectId && (
                          <button
                            type="button"
                            onClick={() => { setRefDocTarget(doc); refDocFileRef.current?.click(); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors"
                            title={`${latest ? 'Replace' : 'Upload'} ${doc.name} (Excel/CSV/PDF) — parsed automatically for AI checks`}
                          >
                            <Upload className="w-3 h-3" /> {latest ? 'Replace' : 'Upload'}
                          </button>
                        )}
                        {provided
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          : needed && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      {latest && (
                        <div className="ml-6 mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 truncate max-w-[150px]" title={latest.file_name}>📄 {latest.file_name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: statusMeta.color, background: statusMeta.bg }}>
                            {statusMeta.label}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="px-4 py-2.5 bg-slate-50/60">
                  <p className="text-[10px] text-slate-400">
                    {Object.values(docsProvided).filter(Boolean).length}/{REQUIRED_REFERENCE_DOCS.length} provided · Amber icon = required by Part C cross-checks · Upload enabled for Line List, Equipment List & Instrument Index (parsed for AI checks)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer note per rules of engagement */}
      <div className="px-6 pb-5">
        <p className="text-[10px] text-slate-400 italic text-center">
          This AI check supplements but does not replace discipline squad check, inter-discipline review, and HAZOP.
        </p>
      </div>
    </div>
  );
}
