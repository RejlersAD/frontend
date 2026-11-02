/**
 * SLD Checker — data layer for the redesigned screens.
 *
 * Two backends:
 *  - Core staged comparison API via sldService
 *    (/api/v1/electrical-comparison/sld/ — projects, files, analyse,
 *    analysis results, workbook export, user-level BYOK key endpoints).
 *  - Checker API under /api/v1/sld-checker/ (run, workspace, sheet images,
 *    extraction nodes, topology, findings, checklist, check limits config,
 *    project review). Where the checker backend has no data yet, callers
 *    render the honest empty state — this layer never invents numbers.
 *
 * BYOK security (inherited from sldService): the key is sent only to the
 * key endpoints, is stored encrypted server-side, and is never echoed
 * back, cached in localStorage, or written to logs.
 */
import axios from 'axios'
import { API_BASE_URL } from '../../../../config/api.config'
import sldService from '../../../../services/sldService'

const BASE = `${API_BASE_URL}/sld-checker`

function authHeader() {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
  return token ? { Authorization: 'Bearer ' + token } : {}
}

const get = (url, params) => axios.get(url, { headers: authHeader(), params }).then(r => r.data)
const post = (url, body = {}) => axios.post(url, body, { headers: authHeader() }).then(r => r.data)
const patch = (url, body) => axios.patch(url, body, { headers: authHeader() }).then(r => r.data)
const put = (url, body) => axios.put(url, body, { headers: authHeader() }).then(r => r.data)

// ── core staged comparison (delegated) ──────────────────────────────────
export const listProjects = () => sldService.listProjects()
export const createProject = payload => sldService.createProject(payload)
export const deleteProject = projectId => sldService.deleteProject(projectId)
export const getState = projectId => sldService.getState(projectId)
export const uploadFile = (projectId, kind, file) => sldService.uploadFile(projectId, kind, file)
export const analyse = projectId => sldService.analyse(projectId)
export const getAnalysis = (projectId, analysisId, tab) => sldService.getAnalysis(projectId, analysisId, tab)
export const listAnalyses = projectId => sldService.listAnalyses(projectId)
export const exportAnalysis = (projectId, analysisId, format) => sldService.exportAnalysis(projectId, analysisId, format)
export const getKey = () => sldService.getKey()
export const testKey = (provider, apiKey) => sldService.testKey(provider, apiKey)
export const saveKey = (provider, apiKey) => sldService.saveKey(provider, apiKey)
export const removeKey = () => sldService.removeKey()

// ── checker: run + workspace ────────────────────────────────────────────

/** Run the checker rules on a completed core analysis. */
export async function run(analysisId) {
  return post(`${BASE}/analyses/${analysisId}/run/`)
}

/**
 * Project workspace: one row per SLD sheet of a file. Params are optional
 * — omit both for the project-wide sheet list.
 */
export async function workspace(projectId, fileId = null, sheet = null) {
  const params = {}
  if (fileId != null) params.file = fileId
  if (sheet != null) params.sheet = sheet
  return get(`${BASE}/projects/${projectId}/workspace/`, params)
}

// ── checker: sheet image (authenticated blob, like the process checker) ─

export function sheetImageUrl(sheetId) {
  return `${BASE}/sheets/${sheetId}/image/`
}

/**
 * Authenticated sheet image. A plain <img src> carries no Authorization
 * header and gets a 401 — fetch as a blob and hand back an object URL.
 * Caller must revoke it on unmount/change. Never put the token in the URL.
 */
export async function fetchSheetImage(sheetId) {
  const res = await axios.get(sheetImageUrl(sheetId), {
    headers: authHeader(),
    responseType: 'blob',
    timeout: 120000,
  })
  return URL.createObjectURL(res.data)
}

// ── checker: extraction review (step 3) ─────────────────────────────────

export async function extraction(analysisId, tab = null) {
  return get(`${BASE}/analyses/${analysisId}/extraction/`, tab ? { tab } : {})
}

/** Edit an extraction node; the backend re-runs the affected rules. */
export async function patchNode(nodeId, body) {
  return patch(`${BASE}/nodes/${nodeId}/`, body)
}

// ── checker: topology (network + 3D views) ──────────────────────────────

export async function topology(analysisId) {
  return get(`${BASE}/analyses/${analysisId}/topology/`)
}

// ── checker: findings (step 5) ──────────────────────────────────────────

export async function findings(analysisId, { family = null, sheet = null } = {}) {
  const params = {}
  if (family && family !== 'All') params.family = family
  if (sheet != null) params.sheet = sheet
  return get(`${BASE}/analyses/${analysisId}/findings/`, params)
}

export async function patchFinding(findingId, body) {
  return patch(`${BASE}/findings/${findingId}/`, body)
}

// ── checker: checklist (AI-SLD-01, step 4) ──────────────────────────────

export async function getChecklist(analysisId) {
  return get(`${BASE}/analyses/${analysisId}/checklist/`)
}

export async function patchChecklistItem(analysisId, no, body) {
  return patch(`${BASE}/analyses/${analysisId}/checklist/${encodeURIComponent(no)}/`, body)
}

export function checklistReportUrl(analysisId) {
  return `${BASE}/analyses/${analysisId}/checklist-report.xlsx`
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

export async function downloadChecklistReport(analysisId) {
  const res = await axios.get(checklistReportUrl(analysisId), {
    headers: authHeader(), responseType: 'blob', timeout: 120000,
  })
  saveBlob(res, `AI_SLD_Review_Checklist_01_${analysisId}.xlsx`)
}

// ── checker: check limits config (step 2) ───────────────────────────────

export async function getConfig(projectId) {
  return get(`${BASE}/projects/${projectId}/config/`)
}

export async function putConfig(projectId, body) {
  return put(`${BASE}/projects/${projectId}/config/`, body)
}

// ── checker: project review (All SLDs scope) ────────────────────────────

export async function review(projectId) {
  return get(`${BASE}/projects/${projectId}/review/`)
}

export default {
  listProjects, createProject, deleteProject, getState, uploadFile,
  analyse, getAnalysis, listAnalyses, exportAnalysis,
  getKey, testKey, saveKey, removeKey,
  run, workspace, sheetImageUrl, fetchSheetImage,
  extraction, patchNode, topology, findings, patchFinding,
  getChecklist, patchChecklistItem, checklistReportUrl, downloadChecklistReport,
  getConfig, putConfig, review,
}
