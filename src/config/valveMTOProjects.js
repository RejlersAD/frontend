/**
 * Valve MTO — Project Store (Soft-coded)
 * ======================================
 * Lets a user maintain *multiple* Valve MTO workspaces (one per real-world
 * project / package). The "active" project's rows + header are mirrored
 * into the legacy STORAGE_KEY so the rest of the page keeps working
 * unchanged.
 *
 * State shape (single JSON blob in localStorage):
 *   { activeId: string|null, items: ProjectEntry[] }
 *
 * ProjectEntry = {
 *   id,           // 'p_<ts>_<rand>'
 *   name,         // user-facing label
 *   description,  // optional
 *   createdAt,    // ISO
 *   updatedAt,    // ISO
 *   project,      // header meta object
 *   rows,         // valve rows
 * }
 *
 * All thresholds and keys are soft-coded — never hardcoded inline.
 */

// ─── Soft-coded config ───────────────────────────────────────────────────
export const PROJECTS_STORAGE_KEY  = 'radai.valveMTO.projects.v1';
export const PROJECTS_REFRESH_EVENT = 'radai:valveMTO:projects:refresh';
export const PROJECT_NAME_MAX_LEN = 80;
export const PROJECT_DESC_MAX_LEN = 240;
export const PROJECT_DEFAULT_NAME = 'Default Workspace';

const newId = () => `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

const safeRead = () => {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return { activeId: null, items: [] };
    const p = JSON.parse(raw);
    return {
      activeId: typeof p?.activeId === 'string' ? p.activeId : null,
      items:    Array.isArray(p?.items) ? p.items : [],
    };
  } catch {
    return { activeId: null, items: [] };
  }
};

const safeWrite = (state) => {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(PROJECTS_REFRESH_EVENT));
  } catch (err) {
    console.warn('[ValveMTOProjects] write failed:', err?.message);
  }
};

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Returns full state — used by the page on mount. If no projects exist yet,
 * a default project is created (so the rest of the app always has an
 * active project and existing workspace data is preserved on first run).
 */
export const ensureInitialised = ({ project, rows } = {}) => {
  let s = safeRead();
  if (!s.items.length) {
    const now = new Date().toISOString();
    const seed = {
      id:          newId(),
      name:        PROJECT_DEFAULT_NAME,
      description: 'Auto-created from your previous workspace.',
      createdAt:   now,
      updatedAt:   now,
      project:     { ...(project || {}) },
      rows:        Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [],
    };
    s = { activeId: seed.id, items: [seed] };
    safeWrite(s);
  } else if (!s.activeId || !s.items.find((p) => p.id === s.activeId)) {
    s = { ...s, activeId: s.items[0].id };
    safeWrite(s);
  }
  return s;
};

export const listProjects = () =>
  safeRead().items.slice().sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || ''),
  );

export const getActiveProjectId = () => safeRead().activeId;

export const getActiveProject = () => {
  const s = safeRead();
  return s.items.find((p) => p.id === s.activeId) || null;
};

export const getProject = (id) => safeRead().items.find((p) => p.id === id) || null;

export const setActiveProject = (id) => {
  const s = safeRead();
  if (!s.items.find((p) => p.id === id)) return null;
  safeWrite({ ...s, activeId: id });
  return id;
};

export const createProject = ({ name, description = '', project = {}, rows = [] } = {}) => {
  const cleanName = truncate((name || '').trim() || `Project ${new Date().toLocaleString()}`, PROJECT_NAME_MAX_LEN);
  const now = new Date().toISOString();
  const entry = {
    id:          newId(),
    name:        cleanName,
    description: truncate(description, PROJECT_DESC_MAX_LEN),
    createdAt:   now,
    updatedAt:   now,
    project:     { ...project },
    rows:        rows.map((r) => ({ ...r })),
  };
  const s = safeRead();
  safeWrite({ activeId: entry.id, items: [entry, ...s.items] });
  return entry;
};

export const renameProject = (id, name, description) => {
  const s = safeRead();
  const items = s.items.map((p) =>
    p.id === id
      ? {
          ...p,
          name:        truncate((name || '').trim() || p.name, PROJECT_NAME_MAX_LEN),
          description: description == null ? p.description : truncate(description, PROJECT_DESC_MAX_LEN),
          updatedAt:   new Date().toISOString(),
        }
      : p,
  );
  safeWrite({ ...s, items });
};

export const deleteProject = (id) => {
  const s = safeRead();
  const items = s.items.filter((p) => p.id !== id);
  let activeId = s.activeId;
  if (activeId === id) activeId = items[0]?.id || null;
  if (!items.length) {
    // Always keep at least one project around.
    const now = new Date().toISOString();
    const seed = {
      id: newId(), name: PROJECT_DEFAULT_NAME, description: '',
      createdAt: now, updatedAt: now, project: {}, rows: [],
    };
    safeWrite({ activeId: seed.id, items: [seed] });
    return seed.id;
  }
  safeWrite({ activeId, items });
  return activeId;
};

/**
 * Persist the live workspace into the active project slot. Called after
 * every workspace change (debounced by the consumer).
 */
export const syncActiveProject = ({ project, rows }) => {
  const s = safeRead();
  if (!s.activeId) return;
  const items = s.items.map((p) =>
    p.id === s.activeId
      ? {
          ...p,
          project:   { ...(project || {}) },
          rows:      Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [],
          updatedAt: new Date().toISOString(),
        }
      : p,
  );
  safeWrite({ ...s, items });
};

const _exports = {
  PROJECTS_STORAGE_KEY, PROJECTS_REFRESH_EVENT,
  PROJECT_NAME_MAX_LEN, PROJECT_DESC_MAX_LEN, PROJECT_DEFAULT_NAME,
  ensureInitialised, listProjects, getActiveProject, getActiveProjectId,
  getProject, setActiveProject, createProject, renameProject, deleteProject,
  syncActiveProject,
};
export default _exports;
