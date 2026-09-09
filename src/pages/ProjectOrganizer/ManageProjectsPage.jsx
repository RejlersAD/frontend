/**
 * Manage Projects
 * ===============
 * Route: /projects (standalone, no sidebar nav entry yet — reached via any
 * adopting tool's ProjectSwitcher "Manage" link).
 *
 * Generic grid/cards CRUD page for the shared Project Organizer. Clicking a
 * project's "Open" expands a small panel with its cross-tool activity feed
 * (tool_code + summary + timestamp), proving the shared history works
 * across whichever tools have logged activity against it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderPlusIcon, FolderIcon, MagnifyingGlassIcon, ClockIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { PROJECT_ORGANIZER_CONFIG } from '../../config/projectOrganizer.config';
import projectOrganizerService from '../../services/projectOrganizerService';
import { ProjectCard, ProjectFormModal } from '../../components/ProjectOrganizer';

const T = PROJECT_ORGANIZER_CONFIG.defaultTheme;

const ManageProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [query, setQuery]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [busy, setBusy]         = useState(false);
  const [openProjectId, setOpenProjectId] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const items = await projectOrganizerService.listProjects({ q: query, status: statusFilter });
      setProjects(items);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const visibleProjects = useMemo(() => projects, [projects]);

  const handleCreate = async (payload) => {
    setBusy(true);
    try {
      await projectOrganizerService.createProject(payload);
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
      await projectOrganizerService.updateProject(id, payload);
      setEditing(null);
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not update project.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await projectOrganizerService.deleteProject(p.project_id);
      if (openProjectId === p.project_id) setOpenProjectId(null);
      await loadProjects();
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not delete project.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (p) => {
    if (openProjectId === p.project_id) { setOpenProjectId(null); return; }
    setOpenProjectId(p.project_id);
    setActivityLoading(true);
    try {
      const items = await projectOrganizerService.getProjectActivity(p.project_id);
      setActivity(items);
    } catch (_) {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderIcon width={26} style={{ color: T.accent }} />
            Projects
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
            Shared project registry — usable across any engineering tool that adopts it.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
            color: '#fff', border: 'none', padding: '10px 18px',
            borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <FolderPlusIcon width={18} /> New Project
        </button>
      </div>

      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16,
        background: T.cardBg, padding: 12, borderRadius: 10, border: `1px solid ${T.accentBorder}`,
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      background: T.accentSoft, borderRadius: 8, padding: '8px 12px' }}>
          <MagnifyingGlassIcon width={16} style={{ color: T.accent }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code, client, or plant…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, color: T.text, outline: 'none' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: `1px solid ${T.accentBorder}`, background: '#fff', color: T.text, cursor: 'pointer' }}
        >
          <option value="">All statuses</option>
          {PROJECT_ORGANIZER_CONFIG.statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: T.muted }}>Loading projects…</div>
      ) : visibleProjects.length === 0 ? (
        <div style={{ background: T.cardBg, padding: 50, textAlign: 'center', borderRadius: 12, border: `1px dashed ${T.accentBorder}` }}>
          <FolderIcon width={48} style={{ color: T.accent, opacity: 0.5, margin: '0 auto 12px' }} />
          <h2 style={{ margin: 0, fontSize: 18, color: T.text }}>No projects yet</h2>
          <p style={{ margin: '6px 0 18px', fontSize: 13, color: T.muted }}>Create a project to start organising your work.</p>
          <button onClick={() => setShowCreate(true)} style={{
            background: T.accent, color: '#fff', border: 'none', padding: '10px 20px',
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <FolderPlusIcon width={16} style={{ verticalAlign: -3, marginRight: 6 }} />
            Create your first project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {visibleProjects.map((p) => (
            <div key={p.project_id}>
              <ProjectCard
                project={p}
                theme={T}
                onOpen={() => handleOpen(p)}
                onEdit={() => setEditing(p)}
                onDelete={() => handleDelete(p)}
              />
              {openProjectId === p.project_id && (
                <div style={{
                  marginTop: 8, background: T.cardBg, border: `1px solid ${T.accentBorder}`,
                  borderRadius: 10, padding: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: T.text }}>
                      <ClockIcon width={14} style={{ color: T.accent }} /> Activity
                    </div>
                    <button onClick={() => setOpenProjectId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <XMarkIcon width={14} style={{ color: T.muted }} />
                    </button>
                  </div>
                  {activityLoading ? (
                    <div style={{ fontSize: 12, color: T.muted }}>Loading…</div>
                  ) : activity.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.muted }}>No activity logged yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {activity.map((a) => (
                        <div key={a.id} style={{ fontSize: 12, color: T.text, display: 'flex', gap: 8 }}>
                          <span style={{ background: T.accentSoft, color: T.accent, padding: '1px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {a.tool_code}
                          </span>
                          <span style={{ flex: 1 }}>{a.summary}</span>
                          <span style={{ color: T.muted, whiteSpace: 'nowrap' }}>
                            {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(showCreate || editing) && (
        <ProjectFormModal
          theme={T}
          initial={editing}
          busy={busy}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSubmit={(payload) => (editing ? handleUpdate(editing.project_id, payload) : handleCreate(payload))}
        />
      )}
    </div>
  );
};

export default ManageProjectsPage;
