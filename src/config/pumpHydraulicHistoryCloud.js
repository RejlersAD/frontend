/**
 * Pump Hydraulic — Cloud Sync Service
 * ====================================
 * Talks to the Django ViewSet at:
 *   /api/v1/process-datasheet/pump-hydraulic-snapshots/
 *
 * The cloud is the source of truth when the user is signed in. Local
 * `localStorage` history is preserved as an offline cache + fallback.
 *
 * Soft-coded:
 *   • Endpoint base + per-call paths are module-level constants.
 *   • Field mapping (frontend ↔ backend) lives in `mapToCloud`/`mapFromCloud`
 *     so adding a metadata field is a one-line change in both places.
 *   • Network failures degrade gracefully — caller may opt to keep the
 *     local snapshot via `{ offlineFallback: true }`.
 */
import apiClient from '../services/api.service';
import { STORAGE_KEYS } from './app.config';

// ─── Soft-coded endpoints ────────────────────────────────────────────────
const BASE = '/process-datasheet/pump-hydraulic-snapshots';
const ENDPOINTS = {
  list:     `${BASE}/`,
  create:   `${BASE}/`,
  detail:   (id) => `${BASE}/${id}/`,
  projects: `${BASE}/projects/`,
  clear:    `${BASE}/clear/`,
};

// ─── Mappers ─────────────────────────────────────────────────────────────
// Cloud → local snapshot shape (mirrors the localStorage record).
const mapFromCloud = (row) => ({
  id:         row.id,
  savedAt:    row.created_at,
  projectKey: row.project_key,
  label:      row.label || '',
  source:     row.source,
  context:    row.context || {},
  meta: {
    project_title:  row.project_title  || '',
    job_no:         row.job_no         || '',
    client_name:    row.client_name    || '',
    pump_tag_no:    row.pump_tag_no    || '',
    calculation_no: row.calculation_no || '',
  },
  formState: row.form_state || {},
  remote: true,
});

// Local → cloud payload (server derives project_key + meta server-side).
const mapToCloud = (snap) => ({
  label:      snap.label || '',
  source:     snap.source || 'manual',
  context:    snap.context || {},
  form_state: snap.formState || {},
});

// ─── Public API ──────────────────────────────────────────────────────────
export const cloudListSnapshots = async ({ projectKey, limit } = {}) => {
  const params = {};
  if (projectKey) params.project_key = projectKey;
  if (limit)      params.limit       = limit;
  const { data } = await apiClient.get(ENDPOINTS.list, { params });
  const rows = Array.isArray(data) ? data : (data?.results || []);
  return rows.map(mapFromCloud);
};

export const cloudListProjects = async () => {
  const { data } = await apiClient.get(ENDPOINTS.projects);
  const rows = Array.isArray(data) ? data : (data?.results || []);
  return rows.map((r) => ({
    projectKey:  r.project_key,
    count:       r.count,
    lastSavedAt: r.last_saved_at,
  }));
};

export const cloudCreateSnapshot = async (snap) => {
  const { data } = await apiClient.post(ENDPOINTS.create, mapToCloud(snap));
  return mapFromCloud(data);
};

export const cloudDeleteSnapshot = async (id) => {
  await apiClient.delete(ENDPOINTS.detail(id));
};

export const cloudDeleteProject = async (projectKey) => {
  await apiClient.delete(ENDPOINTS.clear, { params: { project_key: projectKey } });
};

export const cloudClearAll = async () => {
  await apiClient.delete(ENDPOINTS.clear);
};

// Convenience helper used by the panel — returns true if the user is
// authenticated (i.e. cloud sync should be attempted).
export const isCloudAvailable = () => {
  try { return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN); }
  catch { return false; }
};

const _exports = {
  cloudListSnapshots, cloudListProjects, cloudCreateSnapshot,
  cloudDeleteSnapshot, cloudDeleteProject, cloudClearAll, isCloudAvailable,
};
export default _exports;
