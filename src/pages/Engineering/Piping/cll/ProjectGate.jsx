// ============================================================================
// Project gate — shown before the CLL workspace. Users select an existing
// project or create a new one (name + unit + PROJECT LOCATION required).
// The location picks which stress criticality criteria apply to every line:
//   Onshore  → built-in ADNOC AGPS-SP-PI-004 Table 2 (Onshore)
//   Offshore → the offshore criteria table must be uploaded
// Cards show storage + location pills; projects can be edited/deleted.
// ============================================================================
import React, { useState } from 'react';
import { useCll } from './CllStore';

const STORAGE_OPTIONS = [
  { value: 'database', label: 'Database (recommended)' },
  { value: 's3', label: 'AWS S3 bucket' },
  { value: 'local', label: 'This browser only' },
];

const STORAGE_PILL = {
  database: { label: 'Database', bg: 'rgba(34,197,94,.12)', fg: '#15803d' },
  s3: { label: 'S3', bg: 'rgba(245,158,11,.14)', fg: '#b45309' },
  local: { label: 'Browser', bg: 'rgba(100,116,139,.14)', fg: '#475569' },
};

export const LOCATION_OPTIONS = [
  { value: 'onshore', label: 'Onshore', sub: 'Criteria: ADNOC AGPS-SP-PI-004 Table 2 (Onshore)' },
  { value: 'offshore', label: 'Offshore', sub: 'Criteria: upload the offshore criteria table' },
];

/** Header pill for the project location (used on cards + page header). */
export function LocationPill({ project, criteria }) {
  const lt = project?.locationType;
  if (!lt) return null;
  if (lt === 'onshore') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="rd-pill rd-pill-info">Onshore</span>
        <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>· AGPS-SP-PI-004 Table 2</span>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="rd-pill rd-pill-info">Offshore</span>
      {criteria
        ? <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>· {criteria.fileName || criteria.standard} Rev {criteria.revision || '—'}</span>
        : <span style={{ color: 'var(--rd-danger)', fontSize: 'var(--rd-text-caption)' }}>· criteria not uploaded</span>}
    </span>
  );
}

/** Two selectable location cards (radio semantics, keyboard accessible). */
export function LocationCards({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Project location" style={{ display: 'flex', gap: 8, marginTop: 6 }}>
      {LOCATION_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={selected} tabIndex={0}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(opt.value); } }}
            style={{
              flex: 1, textAlign: 'left', cursor: 'pointer', padding: '0.75rem 0.875rem',
              borderRadius: 8, background: 'var(--rd-surface)',
              border: `2px solid ${selected ? 'var(--rd-accent)' : 'var(--rd-border-soft)'}`,
              outline: 'none',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%', flex: '0 0 auto',
                border: `2px solid ${selected ? 'var(--rd-accent)' : 'var(--rd-border)'}`,
                background: selected ? 'var(--rd-accent)' : 'transparent',
                boxShadow: selected ? 'inset 0 0 0 3px var(--rd-surface)' : 'none',
              }} />
              <span style={{ fontWeight: 600, color: 'var(--rd-text)' }}>{opt.label}</span>
            </div>
            <div className="rd-text-muted" style={{ fontSize: 11.5, marginTop: 4 }}>{opt.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

/** Shared create/edit project modal. Pass `project` to edit, omit to create. */
function ProjectModal({ project, onClose }) {
  const { createProject, updateProject } = useCll();
  const isEdit = !!project;
  const [form, setForm] = useState({
    name: project?.name || '',
    unit: project?.unit || '',
    client: project?.client || '',
    description: project?.description || '',
    storage: project?.storage || 'database',
    locationType: project?.locationType ?? null,
  });
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && form.unit.trim() && !!form.locationType;

  const submit = () => {
    if (!valid) { setTouched(true); return; }
    if (isEdit) updateProject(project.id, form);
    else createProject(form);
    onClose();
  };

  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-modal" role="dialog" aria-label={isEdit ? 'Edit project' : 'Create project'}>
        <header className="rd-drawer-header">
          {isEdit ? 'Edit project' : 'Create project'}
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
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Project location *
            <LocationCards value={form.locationType}
              onChange={v => setForm(f => ({ ...f, locationType: v }))} />
            <div style={{ marginTop: 4 }}>
              Sets which stress criticality criteria apply to every line in this project.
            </div>
            {touched && !form.locationType && (
              <div style={{ color: 'var(--rd-danger)', marginTop: 4 }}>Select Onshore or Offshore</div>
            )}
          </div>
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            Storage
            <div role="radiogroup" aria-label="Storage" style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {STORAGE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" role="radio" aria-checked={form.storage === opt.value}
                  onClick={() => setForm(f => ({ ...f, storage: opt.value }))}
                  className={`rd-btn rd-btn-sm ${form.storage === opt.value ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                  style={{ flex: 1 }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <footer className="rd-drawer-footer">
          <button className="rd-btn rd-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="rd-btn rd-btn-primary" disabled={!valid}
            title={!form.locationType ? 'Select Onshore or Offshore' : undefined}
            onClick={submit}>
            {isEdit ? 'Save changes' : 'Create & open'}
          </button>
        </footer>
      </div>
    </>
  );
}

function DeleteConfirm({ project, onClose }) {
  const { deleteProject } = useCll();
  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-modal" role="alertdialog" aria-label="Delete project">
        <header className="rd-drawer-header">
          Delete project
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="rd-card-body">
          Delete project “{project.name}”? Its files, history and resolutions will be removed.
        </div>
        <footer className="rd-drawer-footer">
          <button className="rd-btn rd-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="rd-btn rd-btn-primary" style={{ background: 'var(--rd-danger, #dc2626)' }}
            onClick={() => { deleteProject(project.id); onClose(); }}>
            Delete
          </button>
        </footer>
      </div>
    </>
  );
}

const iconBtnStyle = {
  padding: 4, borderRadius: 6, border: 'none', background: 'transparent',
  color: 'var(--rd-text-muted)', cursor: 'pointer', lineHeight: 0,
};

export default function ProjectGate() {
  const { projects, selectProject } = useCll();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

        {projects.map(p => {
          const pill = STORAGE_PILL[p.storage] || STORAGE_PILL.database;
          return (
            <button key={p.id} className="rd-card" onClick={() => selectProject(p.id)}
              style={{ minHeight: 150, cursor: 'pointer', textAlign: 'left', padding: '1rem', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                <span role="button" aria-label="Edit project" title="Edit project" style={iconBtnStyle}
                  onClick={(e) => { e.stopPropagation(); setEditProject(p); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
                      d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <span role="button" aria-label="Delete project" title="Delete project" style={iconBtnStyle}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
                      d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                  </svg>
                </span>
              </span>
              <div style={{ fontWeight: 600, color: 'var(--rd-text)', paddingRight: 44 }}>{p.name}</div>
              <div className="rd-text-muted rd-mono" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 4 }}>
                {p.unit}{p.client ? ` · ${p.client}` : ''}
              </div>
              {p.description && (
                <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 6 }}>{p.description}</div>
              )}
              <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 'auto', paddingTop: 8,
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '1px 8px', borderRadius: 999, background: pill.bg, color: pill.fg,
                  fontSize: 'var(--rd-text-caption)', fontWeight: 600 }}>
                  {pill.label}
                </span>
                {p.locationType && (
                  <span className="rd-pill rd-pill-info" style={{ textTransform: 'capitalize' }}>{p.locationType}</span>
                )}
                Created {new Date(p.createdAt).toLocaleDateString()}
              </div>
            </button>
          );
        })}
      </div>

      {projects.length === 0 && (
        <p className="rd-text-muted" style={{ textAlign: 'center', marginTop: '1rem', fontSize: 'var(--rd-text-caption)' }}>
          No projects yet — create your first project to start building a Critical Line List.
        </p>
      )}

      {createOpen && <ProjectModal onClose={() => setCreateOpen(false)} />}
      {editProject && <ProjectModal project={editProject} onClose={() => setEditProject(null)} />}
      {deleteTarget && <DeleteConfirm project={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
