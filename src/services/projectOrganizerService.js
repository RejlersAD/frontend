/**
 * Project Organizer — shared CRUD + activity-log service
 * ==========================================================
 * Thin wrapper around the shared /project-organizer/ endpoints. Any
 * adopting tool imports this instead of writing its own project service.
 */
import apiClient from './api.service';
import { PROJECT_ORGANIZER_CONFIG } from '../config/projectOrganizer.config';

const { api } = PROJECT_ORGANIZER_CONFIG;

export async function listProjects({ q = '', status = '' } = {}) {
  const params = {};
  if (q) params.q = q;
  if (status) params.status = status;
  const res = await apiClient.get(api.list, { params });
  return res.data?.items || [];
}

export async function createProject(payload) {
  const res = await apiClient.post(api.list, payload);
  return res.data;
}

export async function updateProject(projectId, payload) {
  const res = await apiClient.patch(api.detail(projectId), payload);
  return res.data;
}

export async function deleteProject(projectId) {
  const res = await apiClient.delete(api.detail(projectId));
  return res.data;
}

export async function getProjectActivity(projectId, { toolCode = '' } = {}) {
  const params = {};
  if (toolCode) params.tool_code = toolCode;
  const res = await apiClient.get(api.activity(projectId), { params });
  return res.data?.items || [];
}

export async function logProjectActivity(projectId, { toolCode, summary, metadata = {} }) {
  const res = await apiClient.post(api.activity(projectId), {
    tool_code: toolCode,
    summary,
    metadata,
  });
  return res.data;
}

export default {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectActivity,
  logProjectActivity,
};
