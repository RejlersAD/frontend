// ============================================================================
// Critical Line List — page shell inside the RADAI layout.
// Header: title, actions (⬆ Upload files ▾ · ⋯ · Export ▾) + freshness
// indicator; routed underline tabs; §5 status banner under the tabs (visible
// on every tab); <Outlet/>; <UploadDrawer/>.
// The analysis summary is computed once in <AnalysisSummaryProvider> and
// shared by the shell (tabs/banner) and the Upload Analysis tab.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CllProvider, useCll } from './CllStore';
import UploadDrawer from './UploadDrawer';
import ProjectGate from './ProjectGate';
import { AnalysisSummaryProvider, useAnalysisSummary } from '../../../../features/critical-line-list/analysis/useAnalysisSummary';
import AnalysisBanner from '../../../../features/critical-line-list/analysis/AnalysisBanner';
import { fmtDateTime } from '../../../../features/critical-line-list/analysis/analysisState';
import { exportRegisterWorkbook, LINE_LIST_FIELDS } from './cllFiles';

const BASE = '/engineering/piping/critical-line-list';

const STATE_DOT = {
  complete: 'var(--rd-success)',
  outdated: 'var(--rd-warning)',
  blocked: 'var(--rd-danger)',
  running: 'var(--rd-accent)',
  empty: 'var(--rd-border)',
};
const STATE_TITLE = {
  complete: 'Analysis up to date',
  outdated: 'Analysis out of date — re-run needed',
  blocked: 'Analysis blocked — file errors',
  running: 'Analysis running…',
  empty: 'No files uploaded',
};

/** §4 freshness indicator (right of the header actions). */
function Freshness() {
  const { summary, state } = useAnalysisSummary();
  const ll = summary.files.processLineList;
  const sc = summary.files.stressCriticality;
  let text = 'No files uploaded yet';
  if (state === 'complete') {
    text = `Line list Rev ${ll?.revision ?? '—'} · Criticality Rev ${sc?.revision ?? '—'} · analysed ${fmtDateTime(summary.lastRunAt)}`;
  } else if (state === 'outdated') {
    text = `Line list Rev ${ll?.revision ?? '—'} uploaded · analysis out of date`;
  } else if (state === 'blocked') {
    const bad = Object.values(summary.files).filter(Boolean).find(f => f.errors > 0);
    text = `${bad?.title || 'File'} Rev ${bad?.revision ?? '—'} has ${bad?.errors ?? 0} errors · analysis blocked`;
  } else if (state === 'running') {
    text = 'Analysis running…';
  }
  return (
    <span className="rd-text-muted" title={text}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--rd-text-caption)', marginRight: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_DOT[state] || STATE_DOT.empty }} />
      <span style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </span>
  );
}

/** Small dropdown wrapper used by the ⋯ and Export ▾ menus. */
function Menu({ label, children, className = 'rd-btn rd-btn-secondary' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={className} aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}</button>
      {open && (
        <div className="rd-card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 200, zIndex: 40, padding: 4 }}
          onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Top-right toast (green left accent). */
function Toast() {
  const { toast } = useCll();
  if (!toast) return null;
  return (
    <div role="status" style={{
      position: 'fixed', top: 16, right: 16, zIndex: 100, minWidth: 280, maxWidth: 380,
      background: 'var(--rd-surface)', border: '1px solid var(--rd-border-soft)',
      borderLeft: '4px solid var(--rd-success)', borderRadius: 8,
      padding: '0.75rem 1rem', boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 'var(--rd-text-body)', color: 'var(--rd-text)' }}>{toast.title}</div>
      {toast.detail && <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 2 }}>{toast.detail}</div>}
    </div>
  );
}

function Shell() {
  const { match, discrepancies, setUploadDrawerOpen, setDrawerFileKind, activeProject, exitProject, files } = useCll();
  const { summary, state } = useAnalysisSummary();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Gate: a project must be selected before the CLL workspace opens.
  if (!activeProject) {
    return (
      <div className="rd-page">
        <ProjectGate />
      </div>
    );
  }

  const lineCount = match?.lines.length || 0;
  const openItems = summary.review?.open ?? discrepancies.length;

  const openDrawer = (kind) => {
    setMenuOpen(false);
    if (kind) setDrawerFileKind(kind);
    setUploadDrawerOpen(true);
  };

  const doExport = () => {
    if (!match) return;
    const columns = files.lineList?.rawHeaders?.length
      ? files.lineList.rawHeaders
      : LINE_LIST_FIELDS.filter(f => f.required).map(f => f.label);
    exportRegisterWorkbook(match.lines, columns, { revision: files.lineList?.revision });
  };

  return (
    <div className="rd-page">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            1. Engineering › 1.2 Piping › <button onClick={exitProject} className="rd-btn-ghost"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--rd-accent)', fontSize: 'inherit' }}
              title="Switch project">{activeProject.name} › {activeProject.unit}</button>
          </div>
          <h1 style={{ fontSize: 'var(--rd-text-page-title)', fontWeight: 600, color: 'var(--rd-text)', margin: '2px 0 0' }}>
            Critical Line List
          </h1>
        </div>

        {/* Header actions — right-to-left: ⬆ Upload files ▾ · ⋯ · Export ▾ · freshness */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Freshness />
          <Menu label="Export ▾">
            <button className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}
              onClick={doExport} disabled={!match}>Line register (.xlsx)</button>
          </Menu>
          <Menu label="⋯" className="rd-btn rd-btn-secondary" aria-label="More actions">
            <button className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}
              onClick={() => openDrawer()}>Upload files…</button>
          </Menu>

          {/* Split upload button */}
          <div ref={menuRef} style={{ position: 'relative', display: 'flex' }}>
            <button className="rd-btn rd-btn-primary" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} onClick={() => openDrawer()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
              </svg>
              Upload files
            </button>
            <button className="rd-btn rd-btn-primary" aria-label="Upload menu" aria-expanded={menuOpen}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.35)', padding: '0 0.6rem' }}
              onClick={() => setMenuOpen(o => !o)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9l6 6 6-6" /></svg>
            </button>
            {menuOpen && (
              <div className="rd-card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 220, zIndex: 40, padding: 4 }}>
                {[['processLineList', 'Process Line List'], ['stressCriticality', 'Stress Criticality']].map(([kind, label]) => (
                  <button key={kind} onClick={() => openDrawer(kind)}
                    className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Underline tabs (routed) */}
      <nav style={{ display: 'flex', borderBottom: '1px solid var(--rd-border-soft)', marginTop: '0.75rem' }} aria-label="CLL views">
        <NavLink end to={BASE} className={({ isActive }) => `rd-tab ${isActive ? 'rd-tab-active' : ''}`}>
          Line Register
          <span className="rd-pill rd-pill-neutral rd-mono">{lineCount}</span>
        </NavLink>
        <NavLink to={`${BASE}/analysis`} className={({ isActive }) => `rd-tab ${isActive ? 'rd-tab-active' : ''}`}>
          Upload Analysis
          <span title={STATE_TITLE[state]}
            style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_DOT[state] || STATE_DOT.empty }} />
        </NavLink>
        <NavLink to={`${BASE}/review`} className={({ isActive }) => `rd-tab ${isActive ? 'rd-tab-active' : ''}`}>
          Review Queue
          {openItems > 0 && <span className="rd-pill rd-pill-warning rd-mono">{openItems}</span>}
        </NavLink>
      </nav>

      {/* §5 status banner — visible on every tab */}
      <AnalysisBanner />

      <div style={{ marginTop: '1rem' }}>
        <Outlet />
      </div>
      <UploadDrawer />
      <Toast />
    </div>
  );
}

export default function CllPage() {
  return (
    <CllProvider>
      <AnalysisSummaryProvider>
        <Shell />
      </AnalysisSummaryProvider>
    </CllProvider>
  );
}
