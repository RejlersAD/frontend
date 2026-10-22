// ============================================================================
// Critical Line List — page shell inside the RADAI layout.
// Header: title, underline tabs (routed), split "Upload files" button.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CllProvider, useCll } from './CllStore';
import UploadDrawer from './UploadDrawer';
import ProjectGate from './ProjectGate';

const BASE = '/engineering/piping/critical-line-list';

function Shell() {
  const { match, discrepancies, setUploadDrawerOpen, activeProject, exitProject } = useCll();
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
  const openItems = discrepancies.length;
  const analysisUpToDate = true; // uploads commit immediately → analysis always current

  const openDrawer = () => { setMenuOpen(false); setUploadDrawerOpen(true); };

  return (
    <div className="rd-page">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
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
        {/* Split upload button */}
        <div ref={menuRef} style={{ position: 'relative', display: 'flex' }}>
          <button className="rd-btn rd-btn-primary" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} onClick={openDrawer}>
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
              {['Process Line List', 'Stress Criticality'].map(label => (
                <button key={label} onClick={openDrawer}
                  className="rd-btn rd-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rd-text)' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
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
          <span title={analysisUpToDate ? 'Up to date' : 'Re-run needed'}
            style={{ width: 8, height: 8, borderRadius: '50%', background: analysisUpToDate ? 'var(--rd-success)' : 'var(--rd-warning)' }} />
        </NavLink>
        <NavLink to={`${BASE}/review`} className={({ isActive }) => `rd-tab ${isActive ? 'rd-tab-active' : ''}`}>
          Review Queue
          {openItems > 0 && <span className="rd-pill rd-pill-warning rd-mono">{openItems}</span>}
        </NavLink>
      </nav>

      <div style={{ marginTop: '1.25rem' }}>
        <Outlet />
      </div>
      <UploadDrawer />
    </div>
  );
}

export default function CllPage() {
  return (
    <CllProvider>
      <Shell />
    </CllProvider>
  );
}
