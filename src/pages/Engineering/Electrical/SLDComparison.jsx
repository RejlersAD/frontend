/**
 * SLD Equipment Comparison — "RADAI SLD Comparison" canvas.
 * Route: /engineering/electrical/sld
 *
 * Flow: project list → project → New analysis (3 gated stages) → Results.
 * Stages: 1 Upload files → 2 RADAI AI Engine (BYOK) → 3 Electrical legend → Analyse.
 * A stage is locked until the previous one is complete.
 *
 * Design: RADAI tokens only (radai-tokens.css). No emoji, no gradients.
 * Primary buttons flat var(--rd-primary). Violet is reserved for the BYOK key pill.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftIcon, ArrowUpTrayIcon, BoltIcon, BookOpenIcon, CheckCircleIcon,
  ChevronDownIcon, DocumentArrowUpIcon, KeyIcon, LockClosedIcon, TableCellsIcon,
  TrashIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import sldService from '../../../services/sldService';

// ── constants ────────────────────────────────────────────────────────────────
const STAGES = [
  { n: 1, title: 'Upload files', subtitle: 'Upload at least 2 of 3. RADAI shows what it read from each file before you continue.' },
  { n: 2, title: 'RADAI AI Engine', subtitle: 'Reads the SLD with your own key (BYOK). The key is saved once to your profile, encrypted on the server, and never shown again.' },
  { n: 3, title: 'Electrical legend', subtitle: 'Symbols and tag rules used to sort every tag before comparing.' },
];

const FILE_SLOTS = [
  { kind: 'sld', label: 'SLD drawing (PDF)', accept: '.pdf' },
  { kind: 'equipment', label: 'Equipment List', accept: '.xlsx,.xls,.pdf' },
  { kind: 'load', label: 'Load List', accept: '.xlsx,.xls,.pdf' },
];

const RESULT_TABS = [
  { id: 'equipment', label: 'SLD vs Equipment List' },
  { id: 'load', label: 'SLD vs Load List' },
  { id: 'eqload', label: 'Equipment vs Load List' },
  { id: 'drafting', label: 'Drafting check' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'cables', label: 'Cables' },
];

const EQ_STATUS_PILL = {
  matched: 'rd-pill-success',
  'not-on-sld': 'rd-pill-neutral',
  'sld-only': 'rd-pill-warning',
  'sld-demolition': 'rd-pill-info',
  'cable-only': 'rd-pill-neutral',
  'different-tag': 'rd-pill-warning',
  'no-tag-in-list': 'rd-pill-neutral',
};
const EQ_STATUS_LABEL = {
  matched: 'Matched', 'not-on-sld': 'Not on SLD', 'sld-only': 'On SLD only',
  'sld-demolition': 'On SLD · demolition', 'cable-only': 'Cable reference only',
  'different-tag': 'Different tag on SLD', 'no-tag-in-list': 'No tag in list',
};
const LOAD_STATUS_PILL = {
  agrees: 'rd-pill-success', 'board-mismatch': 'rd-pill-danger',
  'rating-mismatch': 'rd-pill-danger', 'tag-conflict': 'rd-pill-danger',
  'not-on-sld': 'rd-pill-neutral', 'not-in-load-list': 'rd-pill-neutral',
  'board-not-covered': 'rd-pill-neutral',
};
const LOAD_STATUS_LABEL = {
  agrees: 'Agrees', 'board-mismatch': 'Board mismatch', 'rating-mismatch': 'Rating mismatch',
  'tag-conflict': 'Tag conflict', 'not-on-sld': 'Not on SLD',
  'not-in-load-list': 'Not in Load List', 'board-not-covered': 'Board not covered',
};

const PDF_TYPE_LABEL = {
  'vector-text': 'Vector — text layer',
  'vector-outlines': 'Vector — text drawn as outlines (OCR used)',
  scanned: 'Scanned image',
};

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════
export default function SLDComparison() {
  const [projects, setProjects] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const data = await sldService.listProjects();
      setProjects(Array.isArray(data) ? data : (data.projects || data.results || []));
    } catch {
      setError('Could not load projects.');
      setProjects([]);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  if (!activeProject) {
    return (
      <ProjectList
        projects={projects} error={error}
        onOpen={setActiveProject}
        onCreated={(p) => { setActiveProject(p); }}
        onDeleted={async (p) => { await sldService.deleteProject(p.project_id); loadProjects(); }}
        onRefresh={loadProjects}
      />
    );
  }
  return (
    <ProjectWorkspace
      project={activeProject}
      onBack={() => { setActiveProject(null); loadProjects(); }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Project list
// ═══════════════════════════════════════════════════════════════════════════
function ProjectList({ projects, onOpen, onCreated, onDeleted, onRefresh, error }) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if ((projects || []).some((p) => (p.project_name || p.name || '').toLowerCase() === trimmed.toLowerCase())) {
      setCreateError(`A project named "${trimmed}" already exists`);
      return;
    }
    setCreating(true); setCreateError('');
    try {
      const p = await sldService.createProject({ projectName: trimmed });
      onCreated(p.project_id ? p : { project_id: p.project_id || p.id, project_name: trimmed });
    } catch (e) {
      setCreateError(e?.response?.data?.error || 'Could not create the project.');
    } finally { setCreating(false); }
  };

  return (
    <div className="rd-page">
      <div className="rd-card">
        <div className="rd-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SLD Equipment Comparison — Projects</span>
          <button className="rd-btn rd-btn-primary" onClick={() => setShowForm((v) => !v)}>New Project</button>
        </div>
        <div className="rd-card-body">
          <p className="rd-text-muted" style={{ marginTop: 0 }}>
            Compare the single line diagram with the Equipment List and Load List before issue.
          </p>
          {showForm && (
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              <input className="rd-input" placeholder="Project name" value={name}
                onChange={(e) => setName(e.target.value)} style={{ maxWidth: 320 }} />
              <button className="rd-btn rd-btn-primary" onClick={create} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              {createError && <span className="rd-pill rd-pill-danger">{createError}</span>}
            </div>
          )}
          {error && <div className="rd-banner rd-banner-danger">{error}</div>}
          {projects === null ? (
            <div className="rd-skeleton" style={{ height: 120 }} />
          ) : projects.length === 0 ? (
            <p className="rd-text-muted">No projects yet — create one to start an SLD comparison.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {projects.map((p) => (
                <div key={p.project_id || p.id} className="rd-card" style={{ cursor: 'pointer' }}
                  onClick={() => onOpen({ project_id: p.project_id || p.id, project_name: p.project_name || p.name })}>
                  <div className="rd-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{p.project_name || p.name}</strong>
                    <button className="rd-btn rd-btn-ghost rd-btn-sm" title="Delete project"
                      onClick={async (e) => { e.stopPropagation(); await onDeleted(p); onRefresh(); }}>
                      <TrashIcon width={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Project workspace — page frame + tabs
// ═══════════════════════════════════════════════════════════════════════════
function ProjectWorkspace({ project, onBack }) {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('new');  // new | results | previous
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [analysisId, setAnalysisId] = useState(null);

  const reload = useCallback(async () => {
    try {
      setState(await sldService.getState(project.project_id));
    } catch {
      setError('Could not load the project state.');
    }
  }, [project.project_id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const analysesCount = state?.analyses_count || 0;
  const analysed = analysesCount > 0;

  return (
    <div className="rd-page">
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Engineering / 1.4 Electrical / SLD / {project.project_name}
          </div>
          <h1 style={{ margin: '4px 0', fontSize: 'var(--rd-text-title)', display: 'flex', gap: 8, alignItems: 'center' }}>
            SLD Equipment Comparison
            <span className="rd-pill rd-pill-neutral">Project {project.project_name}</span>
            <span className="rd-pill rd-pill-neutral">
              {analysed ? 'Analysed' : 'Draft'}
            </span>
          </h1>
          <p className="rd-text-muted" style={{ margin: 0 }}>
            Compare the single line diagram with the Equipment List and Load List before issue.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="rd-btn rd-btn-secondary" onClick={onBack}>
            <ArrowLeftIcon width={16} /> Back to projects
          </button>
          <button className="rd-btn rd-btn-secondary" disabled title="Export from Results or Previous analyses">
            Export <ChevronDownIcon width={14} />
          </button>
        </div>
      </div>

      {error && <div className="rd-banner rd-banner-danger">{error}</div>}
      {toast && (
        <div className="rd-banner rd-banner-info" style={{ borderLeft: '4px solid var(--rd-success)' }}>{toast}</div>
      )}

      {/* tabs */}
      <div style={{ borderBottom: '1px solid var(--rd-border)', display: 'flex', gap: '1.5rem', margin: '1rem 0' }}>
        <button className={`rd-tab ${tab === 'new' ? 'rd-tab-active' : ''}`} onClick={() => setTab('new')}>
          New analysis <span className="rd-pill rd-pill-neutral">{(state?.files || []).length} of 3</span>
        </button>
        <button className={`rd-tab ${tab === 'results' ? 'rd-tab-active' : ''}`}
          disabled={!analysed} onClick={() => analysed && setTab('results')}>
          Results
        </button>
        <button className={`rd-tab ${tab === 'previous' ? 'rd-tab-active' : ''}`} onClick={() => setTab('previous')}>
          Previous analyses <span className="rd-pill rd-pill-neutral">{analysesCount}</span>
        </button>
      </div>

      {!state ? <div className="rd-skeleton" style={{ height: 200 }} /> : (
        <>
          {tab === 'new' && (
            <NewAnalysis
              project={project} state={state} reload={reload}
              setToast={setToast}
              onAnalysed={(id) => { setAnalysisId(id); setTab('results'); reload(); }}
            />
          )}
          {tab === 'results' && (
            <Results project={project} analysisId={analysisId || state?.latest_analysis?.id} />
          )}
          {tab === 'previous' && (
            <PreviousAnalyses
              project={project} reload={reload}
              onView={(id) => { setAnalysisId(id); setTab('results'); }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// New analysis — stepper + stages + readiness
// ═══════════════════════════════════════════════════════════════════════════
function NewAnalysis({ project, state, reload, setToast, onAnalysed }) {
  const [busy, setBusy] = useState('');

  const files = state.files || [];
  const byKind = useMemo(() => Object.fromEntries(files.map((f) => [f.kind, f])), [files]);
  const hasSld = Boolean(byKind.sld);
  const fileCount = files.length;

  // stage completion
  const stage1 = fileCount >= 2;
  const stage2 = (!hasSld && stage1) || Boolean(state.byok);
  const stage3 = (!hasSld && stage1) || state.stage_state?.['3'] === 'complete' || Boolean(state.legend?.source);
  const allReady = stage1 && stage2 && stage3;

  const stageInfo = (n) => {
    if (n === 1) return { done: stage1, line: stage1 ? `${fileCount} of 3 files · ${byKind.sld?.summary?.drawing_no || 'lists only'}` : '' };
    const notNeeded = !hasSld && stage1;   // only after Stage 1 is complete (§2)
    if (n === 2) return {
      done: stage2, notNeeded,
      line: notNeeded ? 'Not needed — no SLD uploaded'
        : state.byok ? `Using your key ••••${state.byok.last4}` : '',
    };
    return {
      done: stage3, notNeeded,
      line: notNeeded ? 'Not needed — no SLD uploaded'
        : state.legend?.source ? (state.legend.name || 'Legend active') : '',
    };
  };

  const analyse = async () => {
    setBusy('analyse');
    try {
      const { analysisId } = await sldService.analyse(project.project_id);
      // poll until completed/failed
      const poll = async () => {
        const a = await sldService.getAnalysis(project.project_id, analysisId);
        if (a.status === 'completed') {
          setToast(`Analysis complete · ${a.headline?.loadConflicts ?? 0} Load List conflicts · ${a.headline?.draftingTotal ?? 0} drafting findings`);
          onAnalysed(analysisId);
          return;
        }
        if (a.status === 'failed') { setToast(a.error || 'Analysis failed.'); return; }
        setTimeout(poll, 4000);
      };
      poll();
    } finally { setBusy(''); }
  };

  return (
    <div className="rd-card">
      <div className="rd-card-header">Set up analysis</div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '1.25rem' }}>
        <p className="rd-text-muted" style={{ margin: 0 }}>
          Complete each stage in order. A stage unlocks only when the previous one is complete.
          Your key and the project legend are remembered.
        </p>

        {/* stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STAGES.map((s, i) => {
            const info = stageInfo(s.n);
            const locked = s.n > 1 && !stageInfo(s.n - 1).done && !(s.n > 1 && !hasSld && stageInfo(s.n).done);
            return (
              <React.Fragment key={s.n}>
                {i > 0 && <div style={{ flex: 1, height: 1, background: 'var(--rd-border)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    background: info.done ? 'var(--rd-success)' : 'var(--rd-surface-subtle)',
                    color: info.done ? '#fff' : 'var(--rd-text-muted)', fontSize: 13,
                  }}>
                    {info.done ? '✓' : (locked ? <LockClosedIcon width={14} /> : s.n)}
                  </span>
                  <div>
                    <div style={{ fontSize: 'var(--rd-text-body)' }}>Stage {s.n} · {s.title}</div>
                    <div style={{ fontSize: 'var(--rd-text-caption)' }}>
                      <span className={`rd-pill ${info.done ? 'rd-pill-success' : locked ? 'rd-pill-neutral' : 'rd-pill-warning'}`}>
                        {info.done ? 'Complete' : locked ? 'Locked' : 'In progress'}
                      </span>
                      {info.line && <span className="rd-text-muted" style={{ marginLeft: 6 }}>{info.line}</span>}
                      {locked && <span className="rd-text-muted" style={{ marginLeft: 6 }}>Complete Stage {s.n - 1} to unlock</span>}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* stage panels */}
        <Stage1Files project={project} byKind={byKind} reload={reload} setToast={setToast}
          locked={false} />
        <Stage2Engine state={state} reload={reload} locked={!stage1 && hasSld} notNeeded={!hasSld} />
        <Stage3Legend project={project} state={state} reload={reload} locked={!stage2} notNeeded={!hasSld} />

        {/* readiness */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--rd-border-soft)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: 'var(--rd-text-body)' }}>
            <strong>Readiness</strong>
            <span>{stage1 ? '✓' : '○'} Files uploaded (at least 2)</span>
            <span>{stage2 ? '✓' : '○'} RADAI AI Engine — your key</span>
            <span>{stage3 ? '✓' : '○'} Electrical legend active</span>
          </div>
          <button className="rd-btn rd-btn-primary" disabled={!allReady || busy === 'analyse'}
            title={!allReady ? `Complete Stage ${!stage1 ? 1 : !stage2 ? 2 : 3} first` : ''}
            onClick={analyse}>
            {busy === 'analyse' ? 'Analysing…' : 'Analyse'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage 1 — Upload files
// ═══════════════════════════════════════════════════════════════════════════
function Stage1Files({ project, byKind, reload, setToast, locked }) {
  const [busy, setBusy] = useState('');
  const refs = { sld: useRef(), equipment: useRef(), load: useRef() };

  const upload = async (kind, file) => {
    if (!file) return;
    setBusy(kind);
    try {
      await sldService.uploadFile(project.project_id, kind, file);
      await reload();
      const count = Object.keys(byKind).length + (byKind[kind] ? 0 : 1);
      if (count >= 2) setToast('Stage 1 complete · Stage 2 unlocked');
    } catch (e) {
      setToast(e?.response?.data?.error || 'Could not read that file.');
    } finally { setBusy(''); }
  };

  return (
    <section className="rd-card" aria-label="Stage 1 Upload files">
      <div className="rd-card-header">
        <DocumentArrowUpIcon width={16} /> Stage 1 — Upload files
        <span className="rd-pill rd-pill-neutral" style={{ marginLeft: 'auto' }}>{Object.keys(byKind).length} of 3 files</span>
      </div>
      <div className="rd-card-body">
        <p className="rd-text-muted" style={{ marginTop: 0 }}>{STAGES[0].subtitle}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {FILE_SLOTS.map((slot) => {
            const f = byKind[slot.kind];
            return (
              <div key={slot.kind} className="rd-card" style={f ? { borderColor: 'var(--rd-success)' } : {}}>
                <div className="rd-card-body" style={{ display: 'grid', gap: 8 }}>
                  <strong>{slot.label}</strong>
                  {!f ? (
                    <div className="rd-dropzone" style={{ textAlign: 'center', padding: '1.25rem', cursor: 'pointer' }}
                      onClick={() => refs[slot.kind].current?.click()}>
                      <ArrowUpTrayIcon width={20} style={{ margin: '0 auto' }} />
                      <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>Drag and drop or browse</div>
                    </div>
                  ) : (
                    <>
                      <div className="rd-text-muted rd-mono" style={{ fontSize: 'var(--rd-text-caption)' }}>{f.name}</div>
                      <SlotSummary kind={slot.kind} summary={f.summary} />
                      <button className="rd-btn rd-btn-ghost rd-btn-sm"
                        onClick={async () => { /* delete handled server-side on replace */ }}>
                        Remove
                      </button>
                    </>
                  )}
                  <input ref={refs[slot.kind]} type="file" accept={slot.accept} hidden
                    onChange={(e) => { upload(slot.kind, e.target.files[0]); e.target.value = ''; }} />
                  {busy === slot.kind && <span className="rd-text-muted">Reading…</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SlotSummary({ kind, summary }) {
  if (!summary) return null;
  if (kind === 'sld') {
    return (
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 'var(--rd-text-caption)', margin: 0 }}>
        <dt className="rd-text-muted">Drawing no.</dt><dd className="rd-mono" style={{ margin: 0 }}>{summary.drawing_no || '—'}</dd>
        <dt className="rd-text-muted">Revision</dt><dd style={{ margin: 0 }}>{summary.rev || '—'}{summary.sheets_agree ? ' · sheets agree' : ' · differs between sheets'}</dd>
        <dt className="rd-text-muted">PDF type</dt><dd style={{ margin: 0 }}>{PDF_TYPE_LABEL[summary.pdf_type] || summary.pdf_type}</dd>
        {summary.scope && (<><dt className="rd-text-muted">Clouds</dt><dd style={{ margin: 0 }}>Scope {summary.scope}</dd></>)}
      </dl>
    );
  }
  if (kind === 'equipment') {
    return (
      <div style={{ fontSize: 'var(--rd-text-caption)', display: 'grid', gap: 4 }}>
        <div><span className="rd-text-muted">Document:</span> <span className="rd-mono">{summary.document} · Rev {summary.rev}</span></div>
        {(summary.sheets || []).map((s) => (
          <div key={s.name}>{s.name} · {s.row_count} rows <span className="rd-pill rd-pill-neutral">{s.status}</span></div>
        ))}
        {(summary.rewrites || []).length > 0 && (
          <div className="rd-banner rd-banner-info" style={{ fontSize: 'var(--rd-text-caption)' }}>
            <strong>Tag rewrites</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: '1.1rem' }}>
              {summary.rewrites.map((r, i) => <li key={i} className="rd-mono">{r}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 'var(--rd-text-caption)', display: 'grid', gap: 4 }}>
      <div><span className="rd-text-muted">Document:</span> <span className="rd-mono">{summary.document} · Rev {summary.rev}</span></div>
      <div><span className="rd-text-muted">Board covered:</span> {summary.board}{summary.section ? ` (${summary.section})` : ''} · {(summary.loads || []).length} loads</div>
      <div><span className="rd-text-muted">Columns:</span> {(summary.columns || []).join(' · ')}</div>
      {(summary.notes || []).map((n, i) => (
        <div key={i} className="rd-banner rd-banner-warning" style={{ fontSize: 'var(--rd-text-caption)' }}>{n}</div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage 2 — RADAI AI Engine (BYOK)
// ═══════════════════════════════════════════════════════════════════════════
function Stage2Engine({ state, reload, locked, notNeeded }) {
  const [modal, setModal] = useState(false);
  const byok = state.byok;

  return (
    <section className="rd-card" aria-label="Stage 2 RADAI AI Engine">
      <div className="rd-card-header"><BoltIcon width={16} /> Stage 2 — RADAI AI Engine (BYOK)</div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '0.75rem' }}>
        <p className="rd-text-muted" style={{ margin: 0 }}>{STAGES[1].subtitle}</p>
        {notNeeded ? (
          <span className="rd-pill rd-pill-neutral">Not needed — no SLD uploaded</span>
        ) : byok ? (
          <>
            <span className="rd-pill" style={{ background: 'var(--rd-accent)', color: '#fff', width: 'fit-content' }}>
              Using your key ••••{byok.last4}{byok.last_tested_at ? ` · tested ${new Date(byok.last_tested_at).toLocaleString()}` : ''}
            </span>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 'var(--rd-text-caption)', margin: 0 }}>
              <dt className="rd-text-muted">Provider</dt><dd style={{ margin: 0 }}>{byok.provider === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}</dd>
              <dt className="rd-text-muted">Key</dt><dd className="rd-mono" style={{ margin: 0 }}>••••{byok.last4}</dd>
              <dt className="rd-text-muted">Last test</dt><dd style={{ margin: 0 }}>{byok.last_tested_at ? new Date(byok.last_tested_at).toLocaleString() : '—'}</dd>
            </dl>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => setModal(true)}>Replace key</button>
              <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={async () => { await sldService.removeKey(); reload(); }}>Remove key</button>
            </div>
          </>
        ) : (
          <div className="rd-banner rd-banner-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Connect your key to read the SLD.</span>
            <button className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => setModal(true)} disabled={locked}>
              <KeyIcon width={14} /> Connect key
            </button>
          </div>
        )}
      </div>
      {modal && (
        <ConnectKeyModal
          onClose={() => setModal(false)}
          onSaved={async () => { setModal(false); await reload(); }}
        />
      )}
    </section>
  );
}

function ConnectKeyModal({ onClose, onSaved }) {
  const [provider, setProvider] = useState('claude');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      setTestResult(await sldService.testKey(provider, key.trim()));
    } catch {
      setTestResult({ valid: false, message: 'Provider not reachable — try again' });
    } finally { setTesting(false); }
  };

  const save = async () => {
    setSaving(true);
    try { await sldService.saveKey(provider, key.trim()); await onSaved(); }
    finally { setSaving(false); }
  };

  return (
    <div className="rd-modal-backdrop" onClick={onClose}>
      <div className="rd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rd-drawer-header" style={{ background: 'var(--rd-primary-soft)' }}>
          Connect your key
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose}><XMarkIcon width={16} /></button>
        </div>
        <div className="rd-drawer-body" style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="rd-text-muted">Provider</span>
            <select className="rd-select" value={provider} onChange={(e) => { setProvider(e.target.value); setTestResult(null); }}>
              <option value="claude">Claude (Anthropic)</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="rd-text-muted">API key</span>
            <input className="rd-input" type="password" value={key} autoComplete="off"
              placeholder={provider === 'claude' ? 'sk-ant-…' : 'sk-…'}
              onChange={(e) => { setKey(e.target.value); setTestResult(null); }} />
          </label>
          <p className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', margin: 0 }}>
            Sent only to the RADAI server and stored encrypted against your user. It is never shown again,
            stored in the browser, or written to logs.
          </p>
          {testResult && (
            <span className={`rd-pill ${testResult.valid ? 'rd-pill-success' : 'rd-pill-danger'}`}>{testResult.message}</span>
          )}
        </div>
        <div className="rd-drawer-footer">
          <button className="rd-btn rd-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="rd-btn rd-btn-secondary" onClick={test} disabled={testing || !key.trim()}>
            {testing ? 'Testing…' : 'Test key'}
          </button>
          <button className="rd-btn rd-btn-primary" onClick={save} disabled={!testResult?.valid || saving}>
            {saving ? 'Saving…' : 'Save key'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage 3 — Electrical legend
// ═══════════════════════════════════════════════════════════════════════════
function Stage3Legend({ project, state, reload, locked, notNeeded }) {
  const [busy, setBusy] = useState(false);
  const legend = state.legend || {};
  const activate = async () => {
    setBusy(true);
    try { await sldService.setLegend(project.project_id, { fromDrawing: true }); await reload(); }
    finally { setBusy(false); }
  };
  return (
    <section className="rd-card" aria-label="Stage 3 Electrical legend">
      <div className="rd-card-header">
        <BookOpenIcon width={16} /> Stage 3 — Electrical legend
        <a className="rd-btn rd-btn-secondary rd-btn-sm" style={{ marginLeft: 'auto' }}
          href="/engineering/legends?section=electrical">Open Legend Manager</a>
      </div>
      <div className="rd-card-body" style={{ display: 'grid', gap: '0.75rem' }}>
        <p className="rd-text-muted" style={{ margin: 0 }}>{STAGES[2].subtitle}</p>
        {notNeeded ? (
          <span className="rd-pill rd-pill-neutral">Not needed — no SLD uploaded</span>
        ) : (
          <>
            <label className="rd-card" style={{ display: 'flex', gap: 8, padding: '0.75rem', cursor: 'pointer' }}>
              <input type="radio" checked={legend.source === 'drawing'} readOnly onClick={activate} disabled={locked || busy} />
              <span>
                <strong>Build from drawing legend</strong>
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
                  LEGENDS block on sheet 002 · tag rules for the drawing area
                </div>
              </span>
            </label>
            {legend.source && (
              <span className="rd-pill rd-pill-success">Legend active — {legend.name || 'ready to analyse'}</span>
            )}
            {!legend.source && (
              <button className="rd-btn rd-btn-primary rd-btn-sm" style={{ width: 'fit-content' }}
                onClick={activate} disabled={locked || busy}>
                {busy ? 'Activating…' : 'Activate legend for this project'}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════════
function Results({ project, analysisId }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!analysisId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const d = await sldService.getAnalysis(project.project_id, analysisId);
        if (cancelled) return;
        setData(d);
        if (d.status === 'completed') {
          // open the first tab with conflicts
          const order = ['load', 'equipment', 'drafting', 'interfaces', 'cables'];
          const conflictTabs = {
            load: (d.headline?.loadConflicts || 0),
            equipment: (d.headline?.matchedTotal || 0) - (d.headline?.matched || 0),
            drafting: d.headline?.draftingTotal || 0,
          };
          setTab(order.find((t) => (conflictTabs[t] || 0) > 0) || 'equipment');
        }
      } catch { if (!cancelled) setError('Could not load the analysis.'); }
    })();
    return undefined;
  }, [project.project_id, analysisId]);

  if (error) return <div className="rd-banner rd-banner-danger">{error}</div>;
  if (!analysisId) return <p className="rd-text-muted">No analysis selected — pick one under Previous analyses.</p>;
  if (!data) return <div className="rd-skeleton" style={{ height: 200 }} />;
  if (data.status !== 'completed') {
    return <p className="rd-text-muted">Analysis {data.status}…</p>;
  }
  const h = data.headline || {};
  const b = data.banner || {};
  const hasBanner = (b.boardMismatch || b.tagConflict || b.ratingMismatch || b.wrongAreaCode);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* headline tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
        <div className="rd-kpi"><div className="rd-kpi-value">{h.boards ?? 0}</div><div className="rd-kpi-label">Boards on SLD</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>+ {h.transformers ?? 0} transformers · {h.generators ?? 0} generators</div></div>
        <div className="rd-kpi"><div className="rd-kpi-value">{h.matched ?? 0} of {h.matchedTotal ?? 0}</div><div className="rd-kpi-label">Matched with Equipment List</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{h.notOnSldByType ?? 0} not on SLD by type</div></div>
        <div className="rd-kpi" style={{ borderColor: 'var(--rd-danger)' }}>
          <div className="rd-kpi-value" style={{ color: 'var(--rd-danger)' }}>{h.loadConflicts ?? 0} of {h.loadTotal ?? 0}</div>
          <div className="rd-kpi-label">Load List conflicts</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>Board, rating or tag</div></div>
        <div className="rd-kpi"><div className="rd-kpi-value" style={{ color: 'var(--rd-warning)' }}>{h.draftingTotal ?? 0}</div>
          <div className="rd-kpi-label">Drafting issues</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{h.draftingHigh ?? 0} high · {h.draftingMedium ?? 0} medium</div></div>
        <div className="rd-kpi"><div className="rd-kpi-value">{h.interfaces ?? 0}</div><div className="rd-kpi-label">Interfaces</div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>Other areas — not compared</div></div>
      </div>

      {/* banner */}
      {hasBanner ? (
        <div className="rd-banner rd-banner-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span><strong>Review before issue</strong></span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {b.boardMismatch > 0 && <span className="rd-pill rd-pill-danger">Board mismatch | {b.boardMismatch}</span>}
            {b.tagConflict > 0 && <span className="rd-pill rd-pill-danger">Tag conflict | {b.tagConflict}</span>}
            {b.ratingMismatch > 0 && <span className="rd-pill rd-pill-danger">Rating mismatch | {b.ratingMismatch}</span>}
            {b.wrongAreaCode > 0 && <span className="rd-pill rd-pill-warning">Wrong area code | {b.wrongAreaCode}</span>}
          </span>
          <button className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => setTab('load')}>Open Load List conflicts →</button>
        </div>
      ) : null}

      {/* tabs */}
      <div className="rd-card">
        <div className="rd-card-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {RESULT_TABS.map((t) => (
            <button key={t.id} className={`rd-tab ${tab === t.id ? 'rd-tab-active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            <button className="rd-btn rd-btn-secondary rd-btn-sm"
              onClick={() => sldService.exportAnalysis(project.project_id, analysisId, 'workbook')}>
              Export <ChevronDownIcon width={12} />
            </button>
          </span>
        </div>
        <div className="rd-card-body">
          <ResultTable project={project} analysisId={analysisId} tab={tab || 'equipment'} />
        </div>
      </div>
    </div>
  );
}

function ResultTable({ project, analysisId, tab }) {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({});
  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (async () => {
      const d = await sldService.getAnalysis(project.project_id, analysisId, tab);
      if (!cancelled) { setRows(d.rows || []); setMeta(d.meta || {}); }
    })();
    return undefined;
  }, [project.project_id, analysisId, tab]);

  if (!rows) return <div className="rd-skeleton" style={{ height: 120 }} />;

  if (tab === 'equipment') return <EquipmentTable rows={rows} meta={meta} />;
  if (tab === 'load') return <LoadTable rows={rows} meta={meta} />;
  if (tab === 'eqload') return <EqLoadTable rows={rows} meta={meta} />;
  if (tab === 'drafting') return <DraftingTable rows={rows} meta={meta} />;
  if (tab === 'interfaces') return <SimpleTable rows={rows} cols={['Tag', 'Where on SLD', 'Meaning']} keys={['tag', 'where', 'meaning']}
    subtitle="Tags of other areas or drawings. Listed for reference — never counted as extra." />;
  return <SimpleTable rows={rows} cols={['Cable tag', 'Size', 'Sheet']} keys={['tag', 'size', 'sheet']}
    subtitle="Matched before equipment rules, so a cable tag can never become a panel." />;
}

function EquipmentTable({ rows, meta }) {
  const [filter, setFilter] = useState('all');
  const [showDemo, setShowDemo] = useState(false);
  const counts = useMemo(() => ({
    matched: rows.filter((r) => r.status === 'matched').length,
    'not-on-sld': rows.filter((r) => r.status === 'not-on-sld').length,
    'sld-only': rows.filter((r) => r.status === 'sld-only').length,
  }), [rows]);
  const visible = rows.filter((r) => {
    const isDemo = r.listSheet === 'Demolition';
    if (isDemo && !showDemo) return false;
    if (filter === 'all') return true;
    return r.status === filter;
  });
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p className="rd-text-muted" style={{ margin: 0, fontSize: 'var(--rd-text-caption)' }}>
        New Equipment sheet: {meta.summary?.['New Equipment']?.row_count ?? '—'} rows → {meta.summary?.['New Equipment']?.tag_count ?? '—'} tags after splitting 285-U-558A/B.
        Boards, transformers and generators only — loads are compared in the Load List tab.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {['all', 'matched', 'not-on-sld', 'sld-only'].map((f) => (
          <button key={f} className={`rd-btn rd-btn-sm ${filter === f ? 'rd-btn-primary' : 'rd-btn-ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : `${EQ_STATUS_LABEL[f]} ${counts[f]}`}
          </button>
        ))}
        <button className="rd-btn rd-btn-secondary rd-btn-sm" style={{ marginLeft: 'auto' }}
          onClick={() => setShowDemo((v) => !v)}>
          {showDemo ? 'Hide demolition rows' : `Show demolition rows (${meta.summary?.Demolition?.row_count ?? 0})`}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="rd-table">
          <thead><tr><th>Tag</th><th>Description</th><th>Category</th><th>List sheet</th><th>On SLD</th><th>Status</th><th>Reason</th></tr></thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i}>
                <td className="rd-mono">{r.tag}{r.subline && <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{r.subline}</div>}</td>
                <td>{r.description}</td>
                <td>{r.category}</td>
                <td>{r.listSheet}</td>
                <td>{r.onSld}</td>
                <td><span className={`rd-pill ${EQ_STATUS_PILL[r.status] || 'rd-pill-neutral'}`}>{EQ_STATUS_LABEL[r.status] || r.status}</span></td>
                <td className="rd-text-muted">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadTable({ rows, meta }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p className="rd-text-muted" style={{ margin: 0, fontSize: 'var(--rd-text-caption)' }}>
        Board {meta.board} {meta.section ? `(${meta.section})` : ''} · compared on tag, feeding board, rated kW and description.
        Click a tag for the SLD evidence.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="rd-table">
          <thead><tr><th>Tag</th><th>Description (list)</th><th>Board (list)</th><th>Board (SLD)</th><th>kW (list)</th><th>kW (SLD)</th><th>Status</th><th>Issue</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="rd-mono">{r.tag}</td>
                <td>{r.description}</td>
                <td className="rd-mono">{r.boardList}</td>
                <td>{r.boardSld && r.boardSld !== r.boardList
                  ? <span className="rd-pill rd-pill-danger rd-mono">{r.boardSld}</span>
                  : <span className="rd-mono">{r.boardSld}</span>}</td>
                <td>{r.kwList}</td>
                <td>{r.kwSld ?? '—'}</td>
                <td><span className={`rd-pill ${LOAD_STATUS_PILL[r.status] || 'rd-pill-neutral'}`}>{LOAD_STATUS_LABEL[r.status] || r.status}</span></td>
                <td className="rd-text-muted">{r.issue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
        {meta.notInListCount ?? 0} other {meta.board} loads on the SLD are Not in Load List.
        Loads on other boards are shown as Board not covered and are not counted as extra.
      </p>
    </div>
  );
}

const EQLOAD_STATUS_PILL = {
  matched: 'rd-pill-success',
  'not-in-equipment-list': 'rd-pill-danger',
  'board-covered': 'rd-pill-success',
  'board-not-covered': 'rd-pill-neutral',
};
const EQLOAD_STATUS_LABEL = {
  matched: 'Matched', 'not-in-equipment-list': 'Not in Equipment List',
  'board-covered': 'Board covered', 'board-not-covered': 'Board not covered',
};

function EqLoadTable({ rows, meta }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p className="rd-text-muted" style={{ margin: 0, fontSize: 'var(--rd-text-caption)' }}>
        Every load must trace to an Equipment-List board. Board rows show whether the Load List covers that panel
        {meta.board ? ` (Load List covers ${meta.board}${meta.section ? ` · ${meta.section}` : ''})` : ''}.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="rd-table">
          <thead><tr><th>Tag</th><th>Description (Load List)</th><th>Board</th><th>Rated kW</th><th>Status</th><th>Equipment List description</th><th>List sheet</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="rd-mono">{r.tag}</td>
                <td>{r.description}</td>
                <td className="rd-mono">{r.board}</td>
                <td>{r.ratedKw ?? '—'}</td>
                <td><span className={`rd-pill ${EQLOAD_STATUS_PILL[r.status] || 'rd-pill-neutral'}`}>{EQLOAD_STATUS_LABEL[r.status] || r.status}</span></td>
                <td>{r.equipmentDescription}</td>
                <td>{r.equipmentSheet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DraftingTable({ rows, meta }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p className="rd-text-muted" style={{ margin: 0, fontSize: 'var(--rd-text-caption)' }}>
        AGPS-SP-EDS-002 title-block checks passed on both sheets ({meta.drawing_no} Rev {meta.rev}). Tag checks below.
      </p>
      <table className="rd-table">
        <thead><tr><th>Check</th><th>Location</th><th>Result</th><th>Severity</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.check}</td>
              <td className="rd-mono">{r.location}</td>
              <td>{r.result}</td>
              <td><span className={`rd-pill ${r.severity === 'high' ? 'rd-pill-danger' : 'rd-pill-warning'}`}>{r.severity}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ rows, cols, keys, subtitle }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <p className="rd-text-muted" style={{ margin: 0, fontSize: 'var(--rd-text-caption)' }}>{subtitle}</p>
      <table className="rd-table">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{keys.map((k) => <td key={k} className={k === 'tag' ? 'rd-mono' : ''}>{r[k]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Previous analyses
// ═══════════════════════════════════════════════════════════════════════════
function PreviousAnalyses({ project, reload, onView }) {
  const [list, setList] = useState(null);
  const load = useCallback(async () => {
    const d = await sldService.listAnalyses(project.project_id);
    setList(d.analyses || []);
  }, [project.project_id]);
  useEffect(() => { load(); }, [load]);

  if (!list) return <div className="rd-skeleton" style={{ height: 120 }} />;
  if (!list.length) return <p className="rd-text-muted">No previous analyses.</p>;
  return (
    <div className="rd-card">
      <div className="rd-card-header"><TableCellsIcon width={16} /> Previous analyses</div>
      <div className="rd-card-body">
        <table className="rd-table">
          <thead><tr><th>Date</th><th>Status</th><th>Conflicts</th><th></th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td>
                  <span className={`rd-pill ${a.status === 'completed' ? 'rd-pill-success' : a.status === 'failed' ? 'rd-pill-danger' : 'rd-pill-warning'}`}>
                    {a.status}{a.outdated ? ' · outdated' : ''}
                  </span>
                </td>
                <td>{a.headline?.loadConflicts ?? '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="rd-btn rd-btn-secondary rd-btn-sm" onClick={() => onView(a.id)}>View Results</button>
                  <button className="rd-btn rd-btn-ghost rd-btn-sm"
                    onClick={() => sldService.exportAnalysis(project.project_id, a.id, 'workbook')}>Download xlsx</button>
                  <button className="rd-btn rd-btn-ghost rd-btn-sm"
                    onClick={async () => { await sldService.deleteAnalysis(project.project_id, a.id); load(); reload(); }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
