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
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FolderPlusIcon, FolderIcon, MagnifyingGlassIcon, ClockIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { PROJECT_ORGANIZER_CONFIG } from '../../config/projectOrganizer.config';
import projectOrganizerService from '../../services/projectOrganizerService';
import { ProjectCard, ProjectFormModal } from '../../components/ProjectOrganizer';

const T = PROJECT_ORGANIZER_CONFIG.defaultTheme;
const DEFAULT_OPEN_TARGET_ROUTE = '/engineering/process/hmb-extractor';
const DEFAULT_ACTIVE_PROJECT_STORAGE_KEY = 'hmbExtractorActiveProject';

const ManageProjectsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || '';
  const activeProjectStorageKey = location.state?.activeProjectStorageKey || '';
  const isPickerMode = Boolean(returnTo && activeProjectStorageKey);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [query, setQuery]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [formError, setFormError] = useState('');
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
  const dashboardStats = useMemo(() => {
    const total = visibleProjects.length;
    const active = visibleProjects.filter((p) => p.status === 'active').length;
    const completed = visibleProjects.filter((p) => p.status === 'completed').length;
    const totalActivity = visibleProjects.reduce((sum, p) => sum + (p.activity_count || 0), 0);
    return [
      { label: 'Total Projects', value: total },
      { label: 'Active', value: active },
      { label: 'Completed', value: completed },
      { label: 'Activity Logs', value: totalActivity },
    ];
  }, [visibleProjects]);

  const handleCreate = async (payload) => {
    setFormError('');
    setBusy(true);
    try {
      await projectOrganizerService.createProject(payload);
      setShowCreate(false);
      await loadProjects();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id, payload) => {
    setFormError('');
    setBusy(true);
    try {
      await projectOrganizerService.updateProject(id, payload);
      setEditing(null);
      await loadProjects();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Could not update project.');
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
    const targetStorageKey = isPickerMode
      ? activeProjectStorageKey
      : DEFAULT_ACTIVE_PROJECT_STORAGE_KEY;

    try {
      localStorage.setItem(targetStorageKey, JSON.stringify({
        project_id: p.project_id,
        name: p.name,
        code: p.code,
        plant: p.plant,
        client: p.client,
        discipline: p.discipline,
      }));
    } catch (_) { /* best-effort */ }

    if (isPickerMode) {
      navigate(returnTo);
      return;
    }

    navigate(DEFAULT_OPEN_TARGET_ROUTE);
  };

  const handleViewActivity = async (p) => {
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

  const handleOpenLegacy = async (p) => {
    if (isPickerMode) {
      try {
        localStorage.setItem(activeProjectStorageKey, JSON.stringify({
          project_id: p.project_id,
          name: p.name,
          code: p.code,
          plant: p.plant,
          client: p.client,
          discipline: p.discipline,
        }));
      } catch (_) { /* best-effort */ }
      navigate(returnTo);
      return;
    }

    await handleViewActivity(p);
  };

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(145deg, #f8fafc 0%, #f2f7f7 38%, #eef5f6 100%)',
      padding: 'clamp(16px, 3vw, 32px)',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(15,118,110,0.07) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 460,
          height: 460,
          borderRadius: '50%',
          top: -200,
          right: -130,
          pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(8,145,178,0.20), transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 360,
          height: 360,
          borderRadius: '50%',
          bottom: -160,
          left: -80,
          pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(15,118,110,0.18), transparent 70%)',
        }}
      />

      <div style={{ width: '100%', maxWidth: 'min(1880px, 96vw)', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))',
          border: '1px solid rgba(148,163,184,0.22)',
          backdropFilter: 'blur(10px)',
          borderRadius: 18,
          padding: 'clamp(16px, 3vw, 24px)',
          boxShadow: '0 14px 36px rgba(15,23,42,0.08)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 10 }}>
                <FolderIcon width={28} style={{ color: T.accent }} />
                Project Organizer
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: T.muted }}>
                {isPickerMode
                  ? 'Select a project to return to your tool and continue working.'
                  : 'Open a project to continue in HMB Extractor and upload documents.'}
              </p>
            </div>
            <button
              onClick={() => { setFormError(''); setShowCreate(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`,
                color: '#fff', border: 'none', padding: '10px 18px',
                borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(15,118,110,0.25)',
              }}
            >
              <FolderPlusIcon width={18} /> New Project
            </button>
          </div>

          <div style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {dashboardStats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  border: '1px solid rgba(148,163,184,0.20)',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  {stat.label}
                </div>
                <div style={{ marginTop: 3, fontSize: 24, fontWeight: 800, color: T.text }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap',
          background: 'rgba(255,255,255,0.92)',
          padding: 12,
          borderRadius: 12,
          border: '1px solid rgba(148,163,184,0.22)',
          boxShadow: '0 8px 24px rgba(2,6,23,0.05)',
        }}>
          <div style={{
            flex: 1,
            minWidth: 260,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: T.accentSoft,
            borderRadius: 9,
            padding: '9px 12px',
            border: `1px solid ${T.accentBorder}`,
          }}>
            <MagnifyingGlassIcon width={16} style={{ color: T.accent }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, client, or plant..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, color: T.text, outline: 'none' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 9, fontSize: 13,
              border: `1px solid ${T.accentBorder}`, background: '#fff', color: T.text,
              cursor: 'pointer', minWidth: 160,
            }}
          >
            <option value="">All statuses</option>
            {PROJECT_ORGANIZER_CONFIG.statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: T.muted,
            background: T.cardBg,
            borderRadius: 12,
            border: `1px solid ${T.accentBorder}`,
          }}>
            Loading projects...
          </div>
        ) : visibleProjects.length === 0 ? (
          <div style={{
            background: T.cardBg, padding: 50, textAlign: 'center', borderRadius: 14,
            border: `1px dashed ${T.accentBorder}`, boxShadow: '0 12px 28px rgba(2,6,23,0.05)',
          }}>
            <FolderIcon width={48} style={{ color: T.accent, opacity: 0.5, margin: '0 auto 12px' }} />
            <h2 style={{ margin: 0, fontSize: 18, color: T.text }}>No projects yet</h2>
            <p style={{ margin: '6px 0 18px', fontSize: 13, color: T.muted }}>Create a project to start organising your work.</p>
            <button onClick={() => { setFormError(''); setShowCreate(true); }} style={{
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentAlt})`, color: '#fff', border: 'none', padding: '10px 20px',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <FolderPlusIcon width={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              Create your first project
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 22vw, 380px), 1fr))' }}>
            {visibleProjects.map((p) => (
              <div key={p.project_id}>
                <ProjectCard
                  project={p}
                  theme={T}
                  openLabel={isPickerMode ? 'Select' : 'Open Tool'}
                  onOpen={() => handleOpen(p)}
                  onEdit={() => setEditing(p)}
                  onDelete={() => handleDelete(p)}
                />
                {!isPickerMode && (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleOpenLegacy(p)}
                      style={{
                        border: `1px solid ${T.accentBorder}`,
                        background: 'rgba(255,255,255,0.92)',
                        color: T.text,
                        borderRadius: 8,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {openProjectId === p.project_id ? 'Hide Activity' : 'View Activity'}
                    </button>
                  </div>
                )}
                {openProjectId === p.project_id && (
                  <div style={{
                    marginTop: 8,
                    background: 'rgba(255,255,255,0.92)',
                    border: '1px solid rgba(148,163,184,0.22)',
                    borderRadius: 10,
                    padding: 12,
                    boxShadow: '0 10px 24px rgba(2,6,23,0.06)',
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
                      <div style={{ fontSize: 12, color: T.muted }}>Loading...</div>
                    ) : activity.length === 0 ? (
                      <div style={{ fontSize: 12, color: T.muted }}>No activity logged yet.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {activity.map((a) => (
                          <div key={a.id} style={{
                            fontSize: 12,
                            color: T.text,
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: 8,
                            alignItems: 'start',
                            borderBottom: '1px dashed rgba(100,116,139,0.20)',
                            paddingBottom: 6,
                          }}>
                            <span style={{
                              background: T.accentSoft,
                              color: T.accent,
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}>
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
      </div>

      {(showCreate || editing) && (
        <ProjectFormModal
          theme={T}
          initial={editing}
          formError={formError}
          busy={busy}
          onClose={() => { setShowCreate(false); setEditing(null); setFormError(''); }}
          onSubmit={(payload) => (editing ? handleUpdate(editing.project_id, payload) : handleCreate(payload))}
        />
      )}
    </div>
  );
};

export default ManageProjectsPage;
