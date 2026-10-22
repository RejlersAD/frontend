// ============================================================================
// Critical Line List API — thin wrapper over the shared axios instance.
// All calls use `silentTimeout` so background sync failures never spam the
// global toast; the store decides what to surface.
// ============================================================================
import apiClient from '../../../../services/api.service';

const BASE = '/engineering/piping/critical-line-list';
const CFG = { silentTimeout: true };

const unwrap = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  return d?.results || d?.projects || [];
};

export const listProjects = async () => unwrap(await apiClient.get(`${BASE}/projects/`, CFG));

export const createProject = async (payload) =>
  (await apiClient.post(`${BASE}/projects/`, payload, CFG)).data;

export const updateProject = async (id, payload) =>
  (await apiClient.patch(`${BASE}/projects/${id}/`, payload, CFG)).data;

export const deleteProject = (id) =>
  apiClient.delete(`${BASE}/projects/${id}/`, CFG);

export const getProjectData = async (id) =>
  (await apiClient.get(`${BASE}/projects/${id}/data/`, CFG)).data;

export const putProjectData = async (id, payload) =>
  (await apiClient.put(`${BASE}/projects/${id}/data/`, payload, CFG)).data;

export default {
  listProjects, createProject, updateProject, deleteProject,
  getProjectData, putProjectData,
};
