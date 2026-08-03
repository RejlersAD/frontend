/**
 * Pump Hydraulic — Project History (client-side)
 * ===============================================
 * Stores point-in-time snapshots of the form state so users can refer
 * back to old documents per project (Job No. / Project Title).
 *
 * Soft-coded:
 *   • Storage keys, retention limits and project-key fields are all
 *     module-level constants — change here, not in callers.
 *   • Snapshot shape is a single source of truth — extending it does
 *     NOT require UI changes (extra metadata flows through opaquely).
 *
 * NO backend changes — uses localStorage only. Plays nicely with the
 * existing form-state key (`STORAGE_KEY` from the template config) by
 * never overwriting it without the user clicking "Load".
 */
import PUMP_HYDRAULIC_TABS, { STORAGE_KEY as FORM_STORAGE_KEY } from './pumpHydraulicTemplate.config';
import { REFRESH_EVENT } from './pumpHydraulicAIMapper';
import {
  cloudCreateSnapshot, cloudDeleteSnapshot, cloudDeleteProject, cloudClearAll,
  isCloudAvailable,
} from './pumpHydraulicHistoryCloud';

// ─── Soft-coded constants ────────────────────────────────────────────────
export const HISTORY_STORAGE_KEY = 'radai.pumpHydraulic.history.v1';

// Maximum snapshots kept overall — oldest are pruned when exceeded.
export const MAX_SNAPSHOTS_TOTAL = 200;

// Soft-coded list of form-state keys that determine the "project" bucket.
// First non-empty value wins. Adding a new identifier (e.g. contract_no) is
// a one-line change here.
const PROJECT_KEY_FIELDS = ['job_no', 'contract_no', 'project_title', 'client_job_no'];

// Soft-coded fields surfaced as snapshot metadata (used by the UI for
// listing). Extend here, automatically flows to the panel.
const META_FIELDS = [
  { key: 'project_title',  label: 'Project'      },
  { key: 'job_no',         label: 'Job No.'      },
  { key: 'client_name',    label: 'Client'       },
  { key: 'pump_tag_no',    label: 'Pump Tag'     },
  { key: 'calculation_no', label: 'Calc. No.'    },
];

// Snapshot sources — soft-coded so we can extend later.
export const SNAPSHOT_SOURCES = {
  AI_EXTRACTION: 'ai_extraction',
  MANUAL:        'manual',
  AUTO:          'auto',
};

// Event raised whenever the history list mutates (so open panels refresh).
export const HISTORY_EVENT = 'radai:pumpHydraulic:historyChanged';

// ─── Helpers ─────────────────────────────────────────────────────────────
const safeJSON = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

const readForm    = () => safeJSON(localStorage.getItem(FORM_STORAGE_KEY), {});
const readHistory = () => {
  const list = safeJSON(localStorage.getItem(HISTORY_STORAGE_KEY), []);
  return Array.isArray(list) ? list : [];
};
const writeHistory = (list) => {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
  try { window.dispatchEvent(new CustomEvent(HISTORY_EVENT)); } catch { /* no-op */ }
};

const firstNonEmpty = (state, keys) => {
  for (const k of keys) {
    const v = state?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

// Build the project bucket key from form state.
const deriveProjectKey = (state) => firstNonEmpty(state, PROJECT_KEY_FIELDS) || 'Untitled Project';

// Build the displayable metadata block for a snapshot.
const buildMeta = (state) => {
  const out = {};
  for (const { key } of META_FIELDS) out[key] = state?.[key] ?? '';
  return out;
};

// Convenient ID generator (timestamp + random suffix — collision-safe enough).
const newId = () => `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Capture the current form state into history.
 * @param {Object} opts
 * @param {string} [opts.label]    Optional user label.
 * @param {string} [opts.source]   One of SNAPSHOT_SOURCES.*
 * @param {Object} [opts.context]  Extra metadata (e.g. extracted pump count).
 * @returns {Object|null} Created snapshot or null if form state is empty.
 */
export const saveSnapshot = ({ label = '', source = SNAPSHOT_SOURCES.MANUAL, context = {} } = {}) => {
  const state = readForm();
  if (!state || Object.keys(state).length === 0) return null;

  const snapshot = {
    id:          newId(),
    savedAt:     new Date().toISOString(),
    projectKey:  deriveProjectKey(state),
    label:       label || '',
    source,
    context,
    meta:        buildMeta(state),
    formState:   state,
  };

  const list = [snapshot, ...readHistory()];
  // Prune the oldest entries past the cap.
  if (list.length > MAX_SNAPSHOTS_TOTAL) list.length = MAX_SNAPSHOTS_TOTAL;
  writeHistory(list);

  // Fire-and-forget cloud sync — never blocks the UI. If the user is
  // authenticated, push to Postgres (Railway) so the snapshot is
  // available across devices and sessions.
  if (isCloudAvailable()) {
    cloudCreateSnapshot(snapshot)
      .then((remote) => {
        // Replace the local row with the server-issued one (so future
        // delete/load actions hit the canonical row).
        const next = readHistory();
        const idx  = next.findIndex((s) => s.id === snapshot.id);
        if (idx !== -1) {
          next[idx] = { ...remote, formState: snapshot.formState };
          writeHistory(next);
        }
      })
      .catch((err) => {
        // Keep the local snapshot — user can retry from the panel.
        // eslint-disable-next-line no-console
        console.warn('[PumpHydraulicHistory] Cloud sync failed (kept locally):', err?.message || err);
      });
  }
  return snapshot;
};

/** Return all snapshots (newest first), optionally filtered by project key. */
export const listSnapshots = ({ projectKey } = {}) => {
  const list = readHistory();
  return projectKey ? list.filter((s) => s.projectKey === projectKey) : list;
};

/** Return distinct project keys with snapshot counts (newest activity first). */
export const listProjects = () => {
  const list = readHistory();
  const map = new Map();
  for (const s of list) {
    const cur = map.get(s.projectKey) || { projectKey: s.projectKey, count: 0, lastSavedAt: '' };
    cur.count += 1;
    if (!cur.lastSavedAt || s.savedAt > cur.lastSavedAt) cur.lastSavedAt = s.savedAt;
    // Carry through latest meta for friendly display.
    if (cur.lastSavedAt === s.savedAt) cur.meta = s.meta;
    map.set(s.projectKey, cur);
  }
  return Array.from(map.values()).sort((a, b) => (b.lastSavedAt || '').localeCompare(a.lastSavedAt || ''));
};

/** Restore a snapshot into the active form state and notify renderers. */
export const loadSnapshot = (id) => {
  const snap = readHistory().find((s) => s.id === id);
  if (!snap) return false;
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(snap.formState || {}));
  // Notify the renderer to re-read state.
  try {
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: { source: 'history', id } }));
    window.dispatchEvent(new StorageEvent('storage', { key: FORM_STORAGE_KEY }));
  } catch { /* no-op */ }
  return true;
};

/** Delete a snapshot by id. */
export const deleteSnapshot = (id) => {
  const next = readHistory().filter((s) => s.id !== id);
  writeHistory(next);
  if (isCloudAvailable()) {
    cloudDeleteSnapshot(id).catch(() => {/* tolerated — local already gone */});
  }
};

/** Delete every snapshot for a given project bucket. */
export const deleteProject = (projectKey) => {
  const next = readHistory().filter((s) => s.projectKey !== projectKey);
  writeHistory(next);
  if (isCloudAvailable()) {
    cloudDeleteProject(projectKey).catch(() => {/* tolerated */});
  }
};

/** Wipe the entire history. */
export const clearHistory = () => {
  writeHistory([]);
  if (isCloudAvailable()) {
    cloudClearAll().catch(() => {/* tolerated */});
  }
};

/** Soft-coded metadata field list (for UI rendering). */
export const HISTORY_META_FIELDS = META_FIELDS;

// Export for symmetry with other config modules.
const _exports = {
  saveSnapshot, listSnapshots, listProjects, loadSnapshot,
  deleteSnapshot, deleteProject, clearHistory,
  HISTORY_STORAGE_KEY, HISTORY_EVENT, SNAPSHOT_SOURCES, HISTORY_META_FIELDS,
};

// Silence unused import lint — PUMP_HYDRAULIC_TABS reserved for future
// per-tab thumbnails (kept here for forward-compatibility, harmless).
void PUMP_HYDRAULIC_TABS;

export default _exports;
