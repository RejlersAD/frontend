// ============================================================================
// Project gate — shown before the CLL workspace. Users select an existing
// project or create a new one (name + unit required). Only then do the
// Line Register / Upload Analysis / Review Queue tabs become available.
// ============================================================================
import React, { useState } from 'react';
import { useCll } from './CllStore';

function CreateProjectModal({ onClose }) {
  const { createProject } = useCll();
  const [form, setForm] = useState({ name: '', unit: '', client: '', description: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && form.unit.trim();

  const submit = () => { if (valid) { createProject(form); onClose(); } };

  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-modal" role="dialog" aria-label="Create project">
        <header className="rd-drawer-header">
          Create project
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="rd-card-body space-y-3">
          {[
            ['name', 'Project name *', 'e.g. ADNOC Ruwais Train 4'],
            ['unit', 'Unit *', 'e.g. U-100'],
            ['client', 'Client', 'e.g. ADNOC'],
            ['description', 'Description', 'Optional scope note'],
          ].map(([k, label, ph]) => (
            <label key={k} className="rd-text-muted" style={{ display: 'block', fontSize: 'var(--rd-text-caption)' }}>
              {label}
              <input className="rd-input" value={form[k]} onChange={set(k)} placeholder={ph} />
            </label>
          ))}
        </div>
        <footer className="rd-drawer-footer">
          <button className="rd-btn rd-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="rd-btn rd-btn-primary" disabled={!valid} onClick={submit}>Create & open</button>
        </footer>
      </div>
    </>
  );
}

export default function ProjectGate() {
  const { projects, selectProject } = useCll();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingTop: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'var(--rd-text-page-title)', fontWeight: 600, color: 'var(--rd-text)' }}>
          Critical Line List
        </h1>
        <p className="rd-text-muted" style={{ marginTop: 4 }}>
          Select a project to open its Critical Line List, or create a new one.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* New project card */}
        <button className="rd-card" onClick={() => setCreateOpen(true)}
          style={{ minHeight: 150, cursor: 'pointer', borderStyle: 'dashed', borderWidth: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', color: 'var(--rd-accent)', background: 'transparent' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v16m8-8H4" />
          </svg>
          <span style={{ fontWeight: 600 }}>New project</span>
        </button>

        {projects.map(p => (
          <button key={p.id} className="rd-card" onClick={() => selectProject(p.id)}
            style={{ minHeight: 150, cursor: 'pointer', textAlign: 'left', padding: '1rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--rd-text)' }}>{p.name}</div>
            <div className="rd-text-muted rd-mono" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 4 }}>
              {p.unit}{p.client ? ` · ${p.client}` : ''}
            </div>
            {p.description && (
              <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 6 }}>{p.description}</div>
            )}
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 'auto', paddingTop: 8 }}>
              Created {new Date(p.createdAt).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>

      {projects.length === 0 && (
        <p className="rd-text-muted" style={{ textAlign: 'center', marginTop: '1rem', fontSize: 'var(--rd-text-caption)' }}>
          No projects yet — create your first project to start building a Critical Line List.
        </p>
      )}

      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
