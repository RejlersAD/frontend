// ============================================================================
// Critical Line List — page shell inside the RADAI layout.
// Header: title + location pill, actions (⬆ Upload files ▾ · ⋯ · Export ▾) +
// freshness indicator; routed underline tabs; §5 status banner under the tabs
// (visible on every tab); <Outlet/>; <UploadDrawer/>.
// Projects without a locationType (legacy) get a blocking "Set project
// location" modal; analysis is blocked until it is set.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CllProvider, useCll } from './CllStore';
import UploadDrawer from './UploadDrawer';
import ProjectGate, { LocationPill, LocationCards, LOCATION_OPTIONS } from './ProjectGate';
import { AnalysisSummaryProvider, useAnalysisSummary } from '../../../../features/critical-line-list/analysis/useAnalysisSummary';
import AnalysisBanner from '../../../../features/critical-line-list/analysis/AnalysisBanner';
import { fmtDateTime, fmtNum } from '../../../../features/critical-line-list/analysis/analysisState';
import { exportRegisterWorkbook, LDT_FIELDS } from './cllFiles';

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
  blocked: 'Analysis blocked',
  running: 'Analysis running…',
  empty: 'No files uploaded',
};

/** §5 freshness: `LDT Rev <r> · <criteria short> · analysed <date time>`. */
function Freshness() {
  const { summary, state } = useAnalysisSummary();
  const ll = summary.files.processLineList;
  const crit = summary.criteria;
  const criteriaShort = crit
    ? `${crit.standard || 'Criteria'} T2`
    : 'no criteria';
  let text = 'No files uploaded yet';
  if (state === 'complete') {
    text = `LDT Rev ${ll?.revision ?? '—'} · ${criteriaShort} · analysed ${fmtDateTime(summary.lastRunAt)}`;
  } else if (state === 'outdated') {
    text = `LDT Rev ${ll?.revision ?? '—'} · ${criteriaShort} · analysis out of date`;
  } else if (state === 'blocked') {
    text = summary.blockingReason || 'Analysis blocked';
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

/** Blocking modal for legacy projects with no location set (§1). */
function SetLocationModal() {
  const { activeProject, setLocationType, canSetLocation, role } = useCll();
  const [value, setValue] = useState(null);
  if (!activeProject || activeProject.locationType) return null;
  if (!canSetLocation) {
    // Non Lead/Admin roles get a read-only banner instead (role stub: the
    // default Engineer role IS allowed — see CllStore CAN_SET_LOCATION).
    return (
      <div className="rd-banner rd-banner-warning" style={{ marginTop: '1rem' }}>
        Project location not set — ask the Lead Stress Engineer.
      </div>
    );
  }
  return (
    <>
      <div className="rd-modal-backdrop" />
      <div className="rd-modal" role="alertdialog" aria-label="Set project location" aria-modal="true">
        <header className="rd-drawer-header">Set project location</header>
        <div className="rd-card-body space-y-3">
          <p className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)', margin: 0 }}>
            This project predates the location requirement. Sets which stress criticality
            criteria apply to every line in this project.
          </p>
          <LocationCards value={value} onChange={setValue} />
          <p className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', margin: 0 }}>
            Signed in as {role}.
          </p>
        </div>
        <footer className="rd-drawer-footer">
          <button className="rd-btn rd-btn-primary" disabled={!value}
            title={!value ? 'Select Onshore or Offshore' : undefined}
            onClick={() => setLocationType(value)}>
            Save location
          </button>
        </footer>
      </div>
    </>
  );
}

/** ⋯ → Change project location — confirm dialog (§1). */
function ChangeLocationModal({ onClose }) {
  const { activeProject, evaluation, setLocationType } = useCll();
  const current = activeProject.locationType;
  const target = LOCATION_OPTIONS.find(o => o.value !== current);
  const n = evaluation?.evaluations.length || 0;
  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-modal" role="alertdialog" aria-label="Change project location">
        <header className="rd-drawer-header">
          Change project location
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="rd-card-body">
          Changing to {target.label} replaces the criteria for all {fmtNum(n)} lines.
          Overrides are kept; the analysis must be re-run.
        </div>
        <footer className="rd-drawer-footer">
          <button className="rd-btn rd-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="rd-btn rd-btn-primary"
            onClick={() => { setLocationType(target.value); onClose(); }}>
            Change to {target.label}
          </button>
        </footer>
      </div>
    </>
  );
}

function Shell() {
  const {
    evaluation, setUploadDrawerOpen, setDrawerFileKind, activeProject, exitProject,
    files, criteria, canSetLocation,
  } = useCll();
  const { summary, state } = useAnalysisSummary();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changeLocOpen, setChangeLocOpen] = useState(false);
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

  const locationSet = !!activeProject.locationType;
  const lineCount = evaluation?.evaluations.length || 0;
  const openItems = summary.review?.open ?? 0;

  const openDrawer = (kind) => {
    setMenuOpen(false);
    if (kind) setDrawerFileKind(kind);
    setUploadDrawerOpen(true);
  };

  const criteriaLabel = `Stress criticality criteria (${activeProject.locationType === 'offshore' ? 'Offshore' : 'Onshore'})`;

  const doExport = () => {
    if (!evaluation) return;
    const columns = files.lineList?.rawHeaders?.length
      ? files.lineList.rawHeaders
      : LDT_FIELDS.filter(f => f.required).map(f => f.label);
    exportRegisterWorkbook(evaluation.evaluations, columns, { revision: files.lineList?.revision });
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
          <h1 style={{ fontSize: 'var(--rd-text-page-title)', fontWeight: 600, color: 'var(--rd-text)', margin: '2px 0 0',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            Critical Line List
            <LocationPill project={activeProject}
              criteria={criteria ? { ...criteria, fileName: files.criteriaFile?.name } : null} />
          </h1>
        </div>

        {/* Header actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Freshness />
          <Menu label="Export ▾">
            <button className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}
              onClick={doExport} disabled={!evaluation}>Line register (.xlsx)</button>
          </Menu>
          <Menu label="⋯" className="rd-btn rd-btn-secondary" aria-label="More actions">
            <button className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}
              onClick={() => openDrawer()}>Upload files…</button>
            {canSetLocation && locationSet && (
              <button className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}
                onClick={() => setChangeLocOpen(true)}>Change project location</button>
            )}
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
              <div className="rd-card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 260, zIndex: 40, padding: 4 }}>
                {[['processLineList', 'Process Line List (LDT)'], ['stressCriteria', criteriaLabel]].map(([kind, label]) => (
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
      <SetLocationModal />
      {changeLocOpen && <ChangeLocationModal onClose={() => setChangeLocOpen(false)} />}
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
