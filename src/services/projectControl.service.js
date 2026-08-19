/**
 * Project Management — API service layer.
 *
 * Thin axios wrappers around /api/v1/project-control/* and /api/v1/projects/*.
 * Every URL is sourced from `projectControl.config.js`.
 */
import apiClient from './api.service'
import { PROJECT_CONTROL_ENDPOINTS as EP, QHSE_IMPORT_CONFIG } from '../config/projectControl.config'

const unwrap = (p) => p.then((r) => r.data)

// ─── Phase flags ──────────────────────────────────────────────────────────────
export const getPhaseFlags = () => unwrap(apiClient.get(EP.phaseFlags))

// ─── Projects (existing core endpoints) ──────────────────────────────────────
export const listProjects     = (params)    => unwrap(apiClient.get(EP.projects, { params }))
export const getProject       = (id)        => unwrap(apiClient.get(`${EP.projects}${id}/`))
export const createProject    = (payload)   => unwrap(apiClient.post(EP.projects, payload))
export const updateProject    = (id, body)  => unwrap(apiClient.patch(`${EP.projects}${id}/`, body))
export const deleteProject    = (id)        => unwrap(apiClient.delete(`${EP.projects}${id}/`))
export const getProjectStats  = ()          => unwrap(apiClient.get(EP.projectStats))

// ─── Analytics (Phase 1 live) ────────────────────────────────────────────────
export const getCostKpis        = (projectId)       => unwrap(apiClient.get(EP.costKpis,    { params: { project: projectId } }))
export const getEstimateVariance = (projectId, opts = {}) =>
  unwrap(apiClient.get(EP.variance, { params: { project: projectId, ...opts } }))
export const runFinanceSync     = (projectId)       => unwrap(apiClient.post(EP.financeSync, { project: projectId }))

// ─── Estimates ───────────────────────────────────────────────────────────────
export const listEstimates    = (projectId, params = {}) =>
  unwrap(apiClient.get(EP.estimates, { params: { project: projectId, ...params } }))
export const getEstimate      = (id)        => unwrap(apiClient.get(`${EP.estimates}${id}/`))
export const createEstimate   = (payload)   => unwrap(apiClient.post(EP.estimates, payload))
export const updateEstimate   = (id, body)  => unwrap(apiClient.patch(`${EP.estimates}${id}/`, body))
export const approveEstimate  = (id)        => unwrap(apiClient.post(`${EP.estimates}${id}/approve/`))
export const supersedeEstimate = (id)       => unwrap(apiClient.post(`${EP.estimates}${id}/supersede/`))

// ─── BOQ Excel import ────────────────────────────────────────────────────────
export const importBoqExcel = (projectId, file, { kind = 'estimate', title = '', notes = '' } = {}) => {
  const form = new FormData()
  form.append('project', projectId)
  form.append('file', file)
  form.append('kind', kind)
  if (title) form.append('title', title)
  if (notes) form.append('notes', notes)
  return unwrap(apiClient.post(EP.importBoq, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }))
}

// ─── Documents ───────────────────────────────────────────────────────────────
export const listDocuments    = (projectId, params = {}) =>
  unwrap(apiClient.get(EP.documents, { params: { project: projectId, ...params } }))

export const uploadDocument = (projectId, file, { kind = 'other', title = '' } = {}) => {
  const form = new FormData()
  form.append('project', projectId)
  form.append('file', file)
  form.append('kind', kind)
  if (title) form.append('title', title)
  return unwrap(apiClient.post(EP.documents, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }))
}

export const presignDocumentDownload = (docId) =>
  unwrap(apiClient.get(EP.presignDoc(docId)))

export const deleteDocument = (docId) =>
  unwrap(apiClient.delete(`${EP.documents}${docId}/`))

// ─── Phase 2/3/4 stubs (return 501 today) ────────────────────────────────────
export const runAiTakeoff    = (projectId) => unwrap(apiClient.post(EP.aiTakeoff,  { project: projectId }))
export const getEvm          = (projectId) => unwrap(apiClient.get(EP.evm,         { params: { project: projectId } }))
export const getCashflow     = (projectId) => unwrap(apiClient.get(EP.cashflow,    { params: { project: projectId } }))
export const getRiskAnalytics = (projectId) => unwrap(apiClient.get(EP.risk,       { params: { project: projectId } }))
export const runChangeDetection = (docId)  => unwrap(apiClient.post(EP.changeDetect, { document: docId }))

// ─── QHSE smart import ───────────────────────────────────────────────────────
// Fetches /api/v1/qhse/projects/ then maps each row to a Project payload via
// QHSE_IMPORT_CONFIG. Pure-frontend orchestration: keeps the two department
// tables independent (per feature-isolation rules) while giving the user a
// one-click "pull from QHSE" workflow.

/**
 * Fetch raw QHSE projects (camelCase serializer rows) from any configured source.
 * @param {Object} [opts]
 * @param {string} [opts.baseUrl]  '' = use local apiClient (cookie/JWT). Any
 *                                 absolute URL hits that origin directly.
 * @param {string} [opts.token]    Bearer token forwarded when baseUrl is set.
 */
export const listQhseProjects = async (opts = {}) => {
  const { sourceEndpoint, sourceParams } = QHSE_IMPORT_CONFIG
  const baseUrl = (opts.baseUrl || '').replace(/\/+$/, '')

  // Local source — re-use the authenticated axios client.
  if (!baseUrl) {
    const data = await unwrap(
      apiClient.get(sourceEndpoint, { params: sourceParams })
    )
    return Array.isArray(data) ? data : (data?.results || [])
  }

  // Remote source — direct fetch so we can pass a custom Bearer token without
  // poisoning the global apiClient interceptor.
  const qs = new URLSearchParams(sourceParams || {}).toString()
  const url = `${baseUrl}${sourceEndpoint}${qs ? `?${qs}` : ''}`
  const headers = { Accept: 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token.trim()}`

  let resp
  try {
    resp = await fetch(url, { method: 'GET', headers, credentials: 'omit' })
  } catch (err) {
    const e = new Error('cors_or_network')
    e.cause = err
    throw e
  }
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error('auth_failed')
    e.status = resp.status
    throw e
  }
  if (!resp.ok) {
    const e = new Error(`Source returned HTTP ${resp.status}`)
    e.status = resp.status
    throw e
  }
  const data = await resp.json()
  return Array.isArray(data) ? data : (data?.results || [])
}

/** Map a single QHSE row → Project create/update payload using the soft-coded config. */
export const mapQhseRowToProjectPayload = (row) => {
  const payload = {}
  for (const { from, to, transform } of QHSE_IMPORT_CONFIG.fieldMap) {
    const raw = row?.[from]
    const val = transform ? transform(raw) : raw
    if (val !== undefined && val !== null && val !== '') payload[to] = val
  }
  for (const [field, fn] of Object.entries(QHSE_IMPORT_CONFIG.derivedFields || {})) {
    const val = fn(row)
    if (val !== undefined && val !== null && val !== '') payload[field] = val
  }
  return payload
}

/**
 * Drive the import. Receives QHSE rows + the current Project list, returns
 * { created, updated, failed, errors: [{ row, error }] }.
 * onProgress (optional): called as ({ done, total, row }) for each completed row.
 */
export const importQhseRows = async (qhseRows, existingProjects, onProgress) => {
  const { joinKey, policy } = QHSE_IMPORT_CONFIG
  const byKey = new Map(
    (existingProjects || []).map((p) => [String(p[joinKey.projectField] ?? '').trim().toLowerCase(), p])
  )
  const summary = { created: 0, updated: 0, failed: 0, errors: [] }
  let done = 0
  const total = qhseRows.length

  for (const row of qhseRows) {
    const key = String(row?.[joinKey.qhseField] ?? '').trim().toLowerCase()
    const payload = mapQhseRowToProjectPayload(row)
    const existing = key ? byKey.get(key) : null

    try {
      if (existing) {
        if (!policy.updateIfExisting) {
          // Treat as a no-op success
        } else {
          await updateProject(existing.id, payload)
          summary.updated += 1
        }
      } else if (policy.createIfMissing) {
        const created = await createProject(payload)
        summary.created += 1
        if (created?.[joinKey.projectField]) {
          byKey.set(String(created[joinKey.projectField]).trim().toLowerCase(), created)
        }
      }
    } catch (err) {
      summary.failed += 1
      const detail = err?.response?.data || err?.message || String(err)
      summary.errors.push({ row, error: detail })
    } finally {
      done += 1
      onProgress?.({ done, total, row })
    }
  }
  return summary
}

export default {
  getPhaseFlags,
  listProjects, getProject, createProject, updateProject, deleteProject, getProjectStats,
  getCostKpis, getEstimateVariance, runFinanceSync,
  listEstimates, getEstimate, createEstimate, updateEstimate, approveEstimate, supersedeEstimate,
  importBoqExcel,
  listDocuments, uploadDocument, presignDocumentDownload, deleteDocument,
  runAiTakeoff, getEvm, getCashflow, getRiskAnalytics, runChangeDetection,
  listQhseProjects, mapQhseRowToProjectPayload, importQhseRows,
}
