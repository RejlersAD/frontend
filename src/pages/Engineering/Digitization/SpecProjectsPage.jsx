/**
 * Spec Customization — Projects
 * Route:  /engineering/digitization/spec-customization/projects
 *
 * Lightweight, RBAC-aware project organiser for the Paper Spec PDF
 * Extractor. Mirrors the Non-TEFF projects page but stays self-contained
 * and uses a pink / rose theme to match the existing Spec Customization
 * landing page badges. No business-logic dependency on the extractor.
 *
 * All API endpoint paths and visual tokens are soft-coded in PROJECT_PAGE_CFG.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlusIcon,
  FolderIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ArrowRightIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';

// ---------------------------------------------------------------------------
// Soft-coded configuration
// ---------------------------------------------------------------------------
const PROJECT_PAGE_CFG = {
  api: {
    list:   '/spec-customization/projects/',
    detail: (id) => `/spec-customization/projects/${id}/`,
    items:  (id) => `/spec-customization/projects/${id}/items/`,
  },
  routes: {
    extractorPage: '/engineering/digitization/spec-customization',
  },
  storageKey: 'specCustomActiveProject',
  statuses: [
    { value: 'active',    label: 'Active',    color: '#be185d', bg: 'rgba(190,24,93,0.10)'   },
    { value: 'on_hold',   label: 'On hold',   color: '#b45309', bg: 'rgba(180,83,9,0.10)'    },
    { value: 'completed', label: 'Completed', color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)'   },
    { value: 'archived',  label: 'Archived',  color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  ],
  theme: {
    accent:        '#db2777',                  // pink-600
    accentAlt:     '#9333ea',                  // violet-600 (gradient pair)
    accentSoft:    'rgba(219,39,119,0.08)',
    accentBorder:  'rgba(219,39,119,0.22)',
    cardBg:        '#ffffff',
    pageBg:        '#fdf2f8',                  // pink-50
    text:          '#0f172a',
    muted:         '#64748b',
  },
};

const statusMeta = (value) =>
  PROJECT_PAGE_CFG.statuses.find((s) => s.value === value) || PROJECT_PAGE_CFG.statuses[0];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const SpecProjectsPage = () => {
  const navigate = useNavigate();
  const T = PROJECT_PAGE_CFG.theme;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [query, setQuery]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [busy, setBusy]         = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (query)        params.q       = query;
      if (statusFilter) params.status  = statusFilter;
      const res = await apiClient.get(PROJECT_PAGE_CFG.api.list, { params });
      setProjects(res.data.items || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const visibleProjects = useMemo(() => projects, [projects]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const handleCreate = async (payload) => {
    setBusy(true);
    try {
      await apiClient.post(PROJECT_PAGE_CFG.api.list, payload);
      setShowCreate(false);
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id, payload) => {
    setBusy(true);
    try {
      await apiClient.patch(PROJECT_PAGE_CFG.api.detail(id), payload);
      setEditing(null);
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update project.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(
      `Delete project "${p.name}"?\nAssociated extractions stay in the system but become unassigned.`
    )) return;
    setBusy(true);
    try {
      await apiClient.delete(PROJECT_PAGE_CFG.api.detail(p.project_id));
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete project.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = (p) => {
    // Persist the active project so the extractor page can pick it up.
    try {
      localStorage.setItem(PROJECT_PAGE_CFG.storageKey, JSON.stringify({
        project_id: p.project_id,
        name:       p.name,
        code:       p.code,
        plant:      p.plant,
        client:     p.client,
        discipline: p.discipline,
      }));
    } catch (_) { /* ignore */ }
    navigate(PROJECT_PAGE_CFG.routes.extractorPage);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate(PROJECT_PAGE_CFG.routes.extractorPage)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: `1px solid ${T.accentBorder}`,
              color: T.accent, padding: '8px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeftIcon width={16} /> Back to Extractor
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderIcon width={26} style={{ color: T.accent }} />
              Spec Customization Projects
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
              Organise paper-spec extractions by engineering project. Role-based — you see what you create; admins see all.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
            color: '#fff', border: 'none', padding: '10px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(219,39,119,0.30)',
          }}
        >
          <FolderPlusIcon width={18} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16,
        background: T.cardBg, padding: 12, borderRadius: 10,
        border: `1px solid ${T.accentBorder}`,
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      background: T.accentSoft, borderRadius: 8, padding: '8px 12px' }}>
          <MagnifyingGlassIcon width={16} style={{ color: T.accent }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code, client, or plant…"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 13, color: T.text, outline: 'none',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${T.accentBorder}`, background: '#fff',
            color: T.text, cursor: 'pointer',
          }}
        >
          <option value="">All statuses</option>
          {PROJECT_PAGE_CFG.statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Status / Errors */}
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12,
                      borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: T.muted }}>Loading projects…</div>
      ) : visibleProjects.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} theme={T} />
      ) : (
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        }}>
          {visibleProjects.map((p) => (
            <ProjectCard
              key={p.project_id}
              project={p}
              theme={T}
              onOpen={() => handleOpen(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {(showCreate || editing) && (
        <ProjectFormModal
          theme={T}
          initial={editing}
          busy={busy}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSubmit={(payload) =>
            editing ? handleUpdate(editing.project_id, payload) : handleCreate(payload)
          }
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------
const ProjectCard = ({ project, theme, onOpen, onEdit, onDelete }) => {
  const meta = statusMeta(project.status);
  const totalExtractions = (project.job_count || 0) + (project.document_count || 0);
  return (
    <div
      style={{
        background: theme.cardBg, border: `1px solid ${theme.accentBorder}`,
        borderRadius: 12, padding: 16, position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(219,39,119,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text,
                       whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
          </h3>
          {project.code && (
            <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
              {project.code}
            </div>
          )}
        </div>
        <span style={{
          background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        }}>{meta.label}</span>
      </div>

      <div style={{ fontSize: 12, color: theme.muted, marginBottom: 12,
                    minHeight: 30, lineHeight: 1.5 }}>
        {project.description?.slice(0, 110) || <em>No description.</em>}
        {project.description?.length > 110 && '…'}
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: theme.muted, marginBottom: 12, flexWrap: 'wrap' }}>
        {project.plant      && <Tag label="Plant"      value={project.plant}      theme={theme} />}
        {project.client     && <Tag label="Client"     value={project.client}     theme={theme} />}
        {project.discipline && <Tag label="Discipline" value={project.discipline} theme={theme} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: `1px solid ${theme.accentBorder}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: theme.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChartBarIcon width={13} />
          {totalExtractions} extraction{totalExtractions === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn title="Edit"   onClick={onEdit}   theme={theme}><PencilSquareIcon width={14} /></IconBtn>
          <IconBtn title="Delete" onClick={onDelete} theme={theme} danger><TrashIcon width={14} /></IconBtn>
          <button onClick={onOpen} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: theme.accent, color: '#fff', border: 'none',
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Open <ArrowRightIcon width={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Tag = ({ label, value, theme }) => (
  <span style={{
    background: theme.accentSoft, color: theme.accent,
    padding: '2px 8px', borderRadius: 4, fontWeight: 600,
  }}>{label}: {value}</span>
);

const IconBtn = ({ children, theme, danger, ...rest }) => (
  <button {...rest} style={{
    background: 'transparent',
    border: `1px solid ${danger ? '#fca5a5' : theme.accentBorder}`,
    color: danger ? '#b91c1c' : theme.accent,
    padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
  }}>{children}</button>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
const EmptyState = ({ onCreate, theme }) => (
  <div style={{
    background: theme.cardBg, padding: 50, textAlign: 'center',
    borderRadius: 12, border: `1px dashed ${theme.accentBorder}`,
  }}>
    <FolderIcon width={48} style={{ color: theme.accent, opacity: 0.5, margin: '0 auto 12px' }} />
    <h2 style={{ margin: 0, fontSize: 18, color: theme.text }}>No projects yet</h2>
    <p style={{ margin: '6px 0 18px', fontSize: 13, color: theme.muted }}>
      Create a project to group related paper-spec PDF extractions and piping classes.
    </p>
    <button onClick={onCreate} style={{
      background: theme.accent, color: '#fff', border: 'none',
      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }}>
      <FolderPlusIcon width={16} style={{ verticalAlign: -3, marginRight: 6 }} />
      Create your first project
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Create / Edit modal
// ---------------------------------------------------------------------------
const ProjectFormModal = ({ initial, onClose, onSubmit, busy, theme }) => {
  const [form, setForm] = useState(() => ({
    name:        initial?.name        || '',
    code:        initial?.code        || '',
    client:      initial?.client      || '',
    plant:       initial?.plant       || '',
    discipline:  initial?.discipline  || '',
    description: initial?.description || '',
    status:      initial?.status      || 'active',
  }));
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initial && (initial.code || initial.client || initial.plant || initial.discipline))
  );
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name.trim().length > 0 && !busy;
  const handleSubmit = (e) => { e?.preventDefault?.(); if (canSubmit) onSubmit(form); };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', borderRadius: 14, padding: 0, width: 'min(520px, 92vw)',
        maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px',
          background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(147,51,234,0.05))`,
          borderBottom: `1px solid ${theme.accentBorder}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: theme.cardBg, border: `1px solid ${theme.accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderPlusIcon width={18} style={{ color: theme.accent }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
              {initial ? 'Edit project' : 'Create new project'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.muted }}>
              {initial ? 'Update the project details.' : 'Group your paper-spec extractions under one project.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <XMarkIcon width={20} style={{ color: theme.muted }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflow: 'auto', display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700,
                            color: theme.text, textTransform: 'uppercase',
                            letterSpacing: 0.5, marginBottom: 6 }}>
              Project Name *
            </label>
            <input
              type="text"
              value={form.name}
              autoFocus
              required
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g., ADNOC LNG Train-3 PMS"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${theme.accentBorder}`, fontSize: 14,
                outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = theme.accent;
                                e.target.style.boxShadow = `0 0 0 3px ${theme.accentSoft}`; }}
              onBlur={(e) => { e.target.style.borderColor = theme.accentBorder;
                               e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700,
                            color: theme.text, textTransform: 'uppercase',
                            letterSpacing: 0.5, marginBottom: 6 }}>
              Description <span style={{ color: theme.muted, fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="Brief project description…"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${theme.accentBorder}`, fontSize: 13,
                resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              background: 'transparent', border: 'none', color: theme.accent,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
              padding: 0,
            }}
          >
            {showAdvanced ? '− Hide advanced fields' : '+ Add code, client, plant, discipline, status'}
          </button>

          {showAdvanced && (
            <div style={{ display: 'grid', gap: 12, padding: 14,
                          background: theme.accentSoft, borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Code"        value={form.code}        onChange={(v) => update('code', v)} theme={theme} />
                <Field label="Client"      value={form.client}      onChange={(v) => update('client', v)} theme={theme} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Plant"       value={form.plant}       onChange={(v) => update('plant', v)} theme={theme} />
                <Field label="Discipline"  value={form.discipline}  onChange={(v) => update('discipline', v)} theme={theme} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: theme.muted,
                                textTransform: 'uppercase', letterSpacing: 0.4 }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: `1px solid ${theme.accentBorder}`, fontSize: 13, marginTop: 4,
                    background: '#fff',
                  }}
                >
                  {PROJECT_PAGE_CFG.statuses.map((s) =>
                    <option key={s.value} value={s.value}>{s.label}</option>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px', borderTop: `1px solid ${theme.accentBorder}`,
          background: '#fafafa',
        }}>
          <button type="button" onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${theme.accentBorder}`,
            color: theme.muted, padding: '9px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Cancel</button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              background: canSubmit
                ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`
                : '#cbd5e1',
              color: '#fff', border: 'none',
              padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: canSubmit ? '0 4px 14px rgba(219,39,119,0.30)' : 'none',
            }}
          >
            <CheckIcon width={14} /> {busy ? 'Saving…' : (initial ? 'Save changes' : 'Create project')}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field = ({ label, value, onChange, theme, required }) => (
  <div>
    <label style={{ fontSize: 12, fontWeight: 600, color: theme.muted }}>{label}</label>
    <input
      type="text"
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: `1px solid ${theme.accentBorder}`, fontSize: 13, marginTop: 4,
      }}
    />
  </div>
);

export default SpecProjectsPage;
