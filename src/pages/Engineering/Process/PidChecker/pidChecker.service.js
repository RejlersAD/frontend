/**
 * P&ID Checker — data layer for the redesigned screens.
 *
 * Wraps the existing backend surface (verified):
 *  - V2 API base  /api/v2/pid-verification/  (projects, upload-pid, results,
 *    reference-data, api-keys, drawing-image, reprocess, run-ai-checks …)
 *  - V1 shim      /api/v1/pid-verification/  (projects list/detail only)
 *  - 9.8 model hub via aiModelHub.service.js (models + routes)
 *  - User-level BYOK key endpoints via sldService (getKey/testKey/saveKey/removeKey)
 *
 * §5 rules: every count is computed client-side from the same lists at
 * render time. Where the backend has no data, callers render the spec's
 * honest empty state — this layer never invents numbers.
 */
import axios from 'axios'
import { API_BASE_URL } from '../../../../config/api.config'
import sldService from '../../../../services/sldService'

const API_V2_BASE_URL = API_BASE_URL.includes('/v1')
  ? API_BASE_URL.replace('/v1', '/v2')
  : `${API_BASE_URL}/v2`

const V2 = `${API_V2_BASE_URL}/pid-verification`
const V1 = `${API_BASE_URL}/pid-verification`

function authHeader() {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
  return token ? { Authorization: 'Bearer ' + token } : {}
}

const unwrapArray = data => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.projects)) return data.projects
  if (Array.isArray(data?.documents)) return data.documents
  if (Array.isArray(data?.items)) return data.items
  return []
}

// ── normalisers ─────────────────────────────────────────────────────────

export function normalizeProject(p = {}) {
  const id = p.project_id ?? p.id ?? null
  return {
    id,
    name: p.project_name ?? p.name ?? 'Untitled project',
    number: p.project_number ?? p.number ?? null,
    client: p.client ?? p.client_profile ?? p.customer ?? null,
    description: p.description ?? '',
    status: p.status ?? null, // e.g. 'blocked' when the backend provides it
    updatedAt: p.updated_at ?? p.modified_at ?? p.created_at ?? null,
    raw: p,
  }
}

export function normalizeDrawing(d = {}) {
  const id = d.document_id ?? d.id ?? null
  const chars = d.characters_read ?? d.total_characters ?? d.text_length ?? null
  const lineNumbers = d.line_numbers_found ?? d.line_count ?? d.lines ?? null
  const tags = d.instrument_tags_found ?? d.tag_count ?? d.tags ?? null
  const readability = d.readability
    ?? (d.is_scanned === true || d.ocr_used === true ? 'ocr' : null)
  return {
    id,
    drawingNo: d.drawing_number ?? d.document_number ?? d.drawing_no ?? null,
    title: d.title ?? d.filename ?? d.original_filename ?? '—',
    type: d.drawing_type ?? d.doc_type ?? null, // PFD | P&ID | UFD
    rev: d.revision ?? d.rev ?? null,
    readability, // 'vector' | 'ocr' | 'unreadable' | null
    status: d.status ?? null,
    set: d.set_name ?? d.set ?? d.drawing_set ?? null,
    charactersRead: chars,
    lineNumbers,
    tags,
    findingsOpen: d.findings_open ?? d.open_findings ?? null,
    findingsTotal: d.findings_total ?? d.findings_count ?? null,
    signed: d.signed ?? d.signed_off ?? false,
    raw: d,
  }
}

// ── projects ────────────────────────────────────────────────────────────

export async function listProjects() {
  try {
    const res = await axios.get(`${V2}/projects/`, { headers: authHeader() })
    return unwrapArray(res.data).map(normalizeProject)
  } catch (err) {
    // fall back to the v1 shim (list only)
    const res = await axios.get(`${V1}/projects/`, { headers: authHeader() })
    return unwrapArray(res.data).map(normalizeProject)
  }
}

export async function getProject(projectId) {
  try {
    const res = await axios.get(`${V2}/projects/${projectId}/`, { headers: authHeader() })
    return normalizeProject(res.data)
  } catch (err) {
    const res = await axios.get(`${V1}/projects/${projectId}/`, { headers: authHeader() })
    return normalizeProject(res.data)
  }
}

export async function createProject({ name, number = '', client = '', description = '' }) {
  const payload = { project_name: name, description }
  // Optional fields the redesign captures; tolerated if the backend ignores them.
  if (number) payload.project_number = number
  if (client) payload.client_profile = client
  const res = await axios.post(`${V2}/projects/`, payload, { headers: authHeader() })
  return normalizeProject(res.data)
}

// ── drawings ────────────────────────────────────────────────────────────

export async function listDrawings(projectId) {
  const res = await axios.get(`${V2}/list/`, {
    headers: authHeader(),
    params: { project_id: projectId },
  })
  return unwrapArray(res.data).map(normalizeDrawing)
}

export async function uploadDrawing(projectId, file) {
  const fd = new FormData()
  fd.append('file', file)
  if (projectId) fd.append('project_id', projectId)
  const res = await axios.post(`${V2}/upload-pid/`, fd, {
    headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    timeout: 2400000, // matches existing V2 page: Celery task headroom
  })
  return res.data
}

export async function getResults(documentId) {
  const res = await axios.get(`${V2}/results/${documentId}/`, {
    headers: authHeader(),
    timeout: 30000,
  })
  return res.data
}

export async function reprocess(documentId) {
  const res = await axios.post(`${V2}/reprocess/${documentId}/`, {}, { headers: authHeader() })
  return res.data
}

export async function updateDrawing(documentId, patch) {
  const res = await axios.put(`${V2}/update/${documentId}/`, patch, { headers: authHeader() })
  return res.data
}

export function drawingImageUrl(documentId, page = 0) {
  return `${V2}/drawing-image/${documentId}/${page}/`
}

// ── reference data ──────────────────────────────────────────────────────

export async function listReferenceData(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/reference-data/`, {
    headers: authHeader(),
  })
  return unwrapArray(res.data)
}

export async function uploadReferenceData(projectId, dataType, file) {
  const fd = new FormData()
  fd.append('data_type', dataType)
  fd.append('file', file)
  const res = await axios.post(`${V2}/projects/${projectId}/reference-data/upload/`, fd, {
    headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
  })
  return res.data
}

export async function deleteReferenceData(referenceId) {
  await axios.delete(`${V2}/reference-data/${referenceId}/`, { headers: authHeader() })
}

// ── AI / BYOK ───────────────────────────────────────────────────────────
// Project-level keys live on the v2 endpoint; the user-level test/save
// round-trip reuses sldService's BYOK endpoints (never stored client-side).

export async function getProjectApiKeys(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/api-keys/`, {
    headers: authHeader(),
  })
  return res.data
}

export async function saveProjectApiKey(projectId, provider, apiKey) {
  const payload = {}
  payload[`${provider}_key`] = apiKey
  const res = await axios.post(`${V2}/projects/${projectId}/api-keys/`, payload, {
    headers: authHeader(),
  })
  return res.data
}

export async function deleteProjectApiKey(projectId, provider) {
  await axios.delete(`${V2}/projects/${projectId}/api-keys/${provider}/`, {
    headers: authHeader(),
  })
}

export async function getAiProviderStatus() {
  const res = await axios.get(`${API_BASE_URL}/rbac/ai-provider-status/`, {
    headers: authHeader(),
  })
  return res.data?.providers ?? []
}

export async function runAiChecks(projectId) {
  const res = await axios.post(`${V2}/projects/${projectId}/run-ai-checks/`, {}, {
    headers: authHeader(),
    timeout: 600000,
  })
  return res.data
}

// Re-exported user-level BYOK endpoints (sldService)
export const getUserKey = () => sldService.getKey()
export const testUserKey = (provider, apiKey) => sldService.testKey(provider, apiKey)
export const saveUserKey = (provider, apiKey) => sldService.saveKey(provider, apiKey)
export const removeUserKey = () => sldService.removeKey()

export default {
  listProjects, getProject, createProject,
  listDrawings, uploadDrawing, getResults, reprocess, updateDrawing, drawingImageUrl,
  listReferenceData, uploadReferenceData, deleteReferenceData,
  getProjectApiKeys, saveProjectApiKey, deleteProjectApiKey,
  getAiProviderStatus, runAiChecks,
  getUserKey, testUserKey, saveUserKey, removeUserKey,
}
