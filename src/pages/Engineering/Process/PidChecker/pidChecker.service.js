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
  if (Array.isArray(data?.reference_data)) return data.reference_data
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
  const fileName = d.file_name ?? d.filename ?? d.original_filename ?? null
  return {
    id,
    // Until the title-block reader lands, the file name is the drawing number.
    drawingNo: d.drawing_number ?? d.document_number ?? d.drawing_no
      ?? (fileName ? fileName.replace(/\.pdf$/i, '') : null),
    title: d.title ?? null, // '—' when the title block has not been read
    fileName,
    type: d.drawing_type || (/process flow diagram/i.test(d.title ?? '') ? 'PFD' : null) || null, // PFD | P&ID | UFD ('' from backend = unset; PFD auto-detected from the title block)
    rev: d.revision ?? d.rev ?? null,
    readability, // 'vector' | 'ocr' | 'unreadable' | null
    status: d.status ?? null, // pending | processing | completed | failed
    set: d.set_name ?? d.set ?? d.drawing_set ?? null,
    charactersRead: chars,
    lineNumbers,
    tags,
    findingsOpen: d.findings_open ?? d.open_findings ?? d.total_issues ?? null,
    findingsTotal: d.findings_total ?? d.findings_count ?? d.total_issues ?? null,
    // One entry per sheet of a multi-sheet PDF (page_index, drawing_number,
    // title) and the cross-sheet tag occurrences for the "Tags across
    // sheets" table (both from the v2 list serializer, 30 Oct 2026).
    sheets: Array.isArray(d.sheets) ? d.sheets : [],
    tagsAcrossSheets: Array.isArray(d.tags_across_sheets) ? d.tags_across_sheets : [],
    signed: d.signed ?? d.signed_off ?? false,
    reviewedBy: d.reviewed_by ?? null,
    approvedBy: d.approved_by ?? null,
    updatedAt: d.updated_at ?? null,
    raw: d,
  }
}

/** Table status mapping (spec B): Queued / Running / Checked / Failed. */
export function drawingStatusLabel(d) {
  const s = String(d?.status || '').toLowerCase()
  if (s === 'processing' || s === 'running') return 'Running'
  if (s === 'completed' || s === 'complete' || s === 'checked') return 'Checked'
  if (s === 'failed' || s === 'error') return 'Failed'
  if (s === 'pending' || s === 'queued' || s === 'uploaded') return 'Queued'
  return d?.status || 'Queued'
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

export async function updateProject(projectId, { name, number = '', client = '', description = '' }) {
  const payload = {}
  if (name) payload.project_name = name
  if (description != null) payload.description = description
  if (number) payload.project_number = number
  if (client) payload.client_profile = client
  const res = await axios.put(`${V1}/projects/${projectId}/`, payload, { headers: authHeader() })
  return normalizeProject(res.data)
}

export async function deleteProject(projectId) {
  // Backend keeps the documents — they become project-less, not deleted.
  await axios.delete(`${V1}/projects/${projectId}/`, { headers: authHeader() })
}

// ── drawings ────────────────────────────────────────────────────────────

export async function listDrawings(projectId) {
  const res = await axios.get(`${V2}/list/`, {
    headers: authHeader(),
    params: { project_id: projectId },
  })
  return unwrapArray(res.data).map(normalizeDrawing)
}

export async function uploadDrawing(projectId, file, { allowDuplicate = false } = {}) {
  const fd = new FormData()
  fd.append('file', file)
  if (projectId) fd.append('project_id', projectId)
  if (allowDuplicate) fd.append('allow_duplicate', '1')
  const res = await axios.post(`${V2}/upload-pid/`, fd, {
    headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    timeout: 2400000, // matches existing V2 page: Celery task headroom
  })
  return res.data
}

export async function getResults(documentId, page = null) {
  const res = await axios.get(`${V2}/results/${documentId}/`, {
    headers: authHeader(),
    params: page != null ? { page } : {}, // 1-based sheet number
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

export async function deleteDrawing(documentId) {
  await axios.delete(`${V2}/delete/${documentId}/`, { headers: authHeader() })
}

export function drawingImageUrl(documentId, page = 0) {
  return `${V2}/drawing-image/${documentId}/${page}/`
}

/**
 * Authenticated drawing image (spec C): a plain <img src> carries no
 * Authorization header and gets a 401. Fetch as a blob with the API token
 * and hand back an object URL. Caller must revoke it on unmount/change.
 * Never put the access token in the URL.
 */
export async function fetchDrawingImage(documentId, page = 0) {
  const res = await axios.get(drawingImageUrl(documentId, page), {
    headers: authHeader(),
    responseType: 'blob',
    timeout: 120000,
  })
  return URL.createObjectURL(res.data)
}

export async function getStatus(documentId) {
  const res = await axios.get(`${V2}/status/${documentId}/`, { headers: authHeader() })
  return res.data
}

// ── checklist (step 4, spec §8) ─────────────────────────────────────────

export async function getChecklist(documentId, page = null) {
  const res = await axios.get(`${V2}/documents/${documentId}/checklist/`, {
    headers: authHeader(),
    params: page != null ? { page } : {},
  })
  return res.data
}

export async function patchChecklistItem(documentId, page, itemNo, body) {
  const res = await axios.patch(`${V2}/documents/${documentId}/checklist/${encodeURIComponent(itemNo)}/`, body, {
    headers: authHeader(),
    params: { page },
  })
  return res.data
}

function saveBlob(res, fallbackName) {
  const disposition = res.headers?.['content-disposition'] || ''
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = match?.[1] || fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadChecklistReport(documentId, page) {
  const res = await axios.get(`${V2}/documents/${documentId}/checklist-report.xlsx`, {
    headers: authHeader(), params: { page }, responseType: 'blob', timeout: 120000,
  })
  saveBlob(res, `AI_PID_Review_Checklist_02_${documentId}.xlsx`)
}

export async function downloadProjectChecklistReport(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/checklist-report.xlsx`, {
    headers: authHeader(), params: { scope: 'all' }, responseType: 'blob', timeout: 300000,
  })
  saveBlob(res, `AI_PID_Review_Checklist_02_${projectId}_AllPIDs.xlsx`)
}

export async function importChecklistReport(documentId, page, file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await axios.post(`${V2}/documents/${documentId}/checklist-report/import/`, fd, {
    headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    params: { page },
    timeout: 120000,
  })
  return res.data
}

export async function getProjectChecklist(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/checklist/`, { headers: authHeader(), timeout: 120000 })
  return res.data
}

export async function uploadChecklistTemplate(projectId, file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await axios.post(`${V2}/projects/${projectId}/checklist-template/`, fd, {
    headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
  })
  return res.data
}

export async function patchReviewMeta(documentId, patch) {
  const res = await axios.patch(`${V2}/documents/${documentId}/review-meta/`, patch, { headers: authHeader() })
  return res.data
}

// ── extraction (step 3, spec §3.1) ──────────────────────────────────────

export async function getExtraction(documentId, kind = null, page = null) {
  const params = {}
  if (kind) params.kind = kind
  if (page != null) params.page = page // 1-based sheet number
  const res = await axios.get(`${V2}/documents/${documentId}/extraction/`, {
    headers: authHeader(),
    params,
  })
  return res.data
}

export async function getExtractionSummary(documentId) {
  const res = await axios.get(`${V2}/documents/${documentId}/extraction/summary/`, { headers: authHeader() })
  return res.data
}

export async function patchExtractionItem(documentId, entityId, patch) {
  const res = await axios.patch(`${V2}/documents/${documentId}/extraction/${entityId}/`, patch, { headers: authHeader() })
  return res.data
}

// ── 3D scene (spec §4.1 — PidScene3D viewer) ────────────────────────────

/**
 * 3D scene for one sheet: GET documents/<id>/scene3d/?page=N (1-based).
 * Returns { status:'ok', lines, valves, equipment, connectors, findings,
 * bounds } or { status:'no_vector_geometry' } for scanned/OCR sheets.
 */
export async function getScene3D(documentId, page) {
  const res = await axios.get(`${V2}/documents/${documentId}/scene3d/`, {
    headers: authHeader(),
    params: { page },
  })
  return res.data
}

// ── findings (engineer review) ──────────────────────────────────────────
// PATCH findings/<id>/ accepts { severity?, status? } — status is one of
// open | reviewed | resolved (PIDVFinding.FindingStatus). Reject comments
// have no backend field, so callers keep them in a local store.
export async function patchFinding(findingId, patch) {
  const res = await axios.patch(`${V2}/findings/${findingId}/`, patch, {
    headers: authHeader(),
  })
  return res.data
}

// ── exports ─────────────────────────────────────────────────────────────
// Export endpoints require the Authorization header, so a plain <a href>
// cannot be used — fetch as blob and trigger a download client-side.
export async function downloadExport(documentId, kind /* 'excel' | 'pdf' */, view = 'all', filename = null) {
  const res = await axios.get(`${V2}/export/${kind}/${documentId}/`, {
    headers: authHeader(),
    params: { view },
    responseType: 'blob',
    timeout: 120000,
  })
  const disposition = res.headers?.['content-disposition'] || ''
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  const downloadName = filename || match?.[1] || `pidv_${kind}_${documentId}.${kind === 'excel' ? 'xlsx' : 'pdf'}`
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return downloadName
}

// ── project sheets + combined review (spec A3/B1) ───────────────────────

export async function getProjectSheets(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/sheets/`, { headers: authHeader() })
  return res.data
}

export async function getProjectReview(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/review/`, { headers: authHeader(), timeout: 60000 })
  return res.data
}

export async function getProjectFindings(projectId, { scope = 'all', sheetId = null, kind = 'sheet' } = {}) {
  const res = await axios.get(`${V2}/projects/${projectId}/findings/`, {
    headers: authHeader(),
    params: { scope, kind, ...(sheetId ? { sheet_id: sheetId } : {}) },
  })
  return res.data
}

export async function runCrossCheck(projectId) {
  const res = await axios.post(`${V2}/projects/${projectId}/cross-check/`, {}, { headers: authHeader() })
  return res.data
}

export async function patchSheet(sheetId, patch) {
  const res = await axios.patch(`${V2}/sheets/${sheetId}/`, patch, { headers: authHeader() })
  return res.data
}

export async function downloadProjectReport(projectId) {
  const res = await axios.get(`${V2}/projects/${projectId}/report.xlsx`, {
    headers: authHeader(),
    params: { scope: 'all' },
    responseType: 'blob',
    timeout: 120000,
  })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `pidv_project_${projectId}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
  getStatus, patchFinding, downloadExport,
  listReferenceData, uploadReferenceData, deleteReferenceData,
  getProjectApiKeys, saveProjectApiKey, deleteProjectApiKey,
  getAiProviderStatus, runAiChecks,
  getUserKey, testUserKey, saveUserKey, removeUserKey,
}
