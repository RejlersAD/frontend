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
export const listProjectTasks = (projectId, params = {}) =>
  unwrap(apiClient.get(EP.projectTasks, { params: { project_id: projectId, ...params } }))
export const listProjectMilestones = (projectId, params = {}) =>
  unwrap(apiClient.get(EP.projectMilestones, { params: { project_id: projectId, ...params } }))

// ─── Analytics (Phase 1 live) ────────────────────────────────────────────────
export const getCostKpis        = (projectId)       => unwrap(apiClient.get(EP.costKpis,    { params: { project: projectId } }))
export const getCommercialDashboard = (projectId) => unwrap(apiClient.get(EP.commercialDashboard, { params: { project: projectId } }))
export const getPortfolioExceptions = (params = {}) => unwrap(apiClient.get(EP.portfolioExceptions, { params }))
export const getEstimateVariance = (projectId, opts = {}) =>
  unwrap(apiClient.get(EP.variance, { params: { project: projectId, ...opts } }))
export const runFinanceSync     = (projectId)       => unwrap(apiClient.post(EP.financeSync, { project: projectId }))
export const listWbsNodes       = (projectId)       => unwrap(apiClient.get(EP.wbsNodes, { params: { project: projectId } }))
export const createWbsNode      = (payload)         => unwrap(apiClient.post(EP.wbsNodes, payload))
export const listControlAccounts = (projectId, params = {}) => unwrap(apiClient.get(EP.controlAccounts, { params: { project: projectId, ...params } }))
export const createControlAccount = (payload) => unwrap(apiClient.post(EP.controlAccounts, payload))
export const updateControlAccount = (id, payload) => unwrap(apiClient.patch(`${EP.controlAccounts}${id}/`, payload))
export const submitControlAccount = (id) => unwrap(apiClient.post(`${EP.controlAccounts}${id}/submit/`))
export const approveControlAccount = (id) => unwrap(apiClient.post(`${EP.controlAccounts}${id}/approve/`))
export const closeControlAccount = (id) => unwrap(apiClient.post(`${EP.controlAccounts}${id}/close/`))
export const listReportingPeriods = (projectId, params = {}) => unwrap(apiClient.get(EP.reportingPeriods, { params: { project: projectId, ...params } }))
export const createReportingPeriod = (payload) => unwrap(apiClient.post(EP.reportingPeriods, payload))
export const updateReportingPeriod = (id, payload) => unwrap(apiClient.patch(`${EP.reportingPeriods}${id}/`, payload))
export const submitReportingPeriod = (id) => unwrap(apiClient.post(`${EP.reportingPeriods}${id}/submit/`))
export const lockReportingPeriod = (id) => unwrap(apiClient.post(`${EP.reportingPeriods}${id}/lock/`))
export const reopenReportingPeriod = (id, reason) => unwrap(apiClient.post(`${EP.reportingPeriods}${id}/reopen/`, { reason }))
export const getReportingPeriodHistory = (id) => unwrap(apiClient.get(`${EP.reportingPeriods}${id}/history/`))
export const reconcileReportingPeriod = (id) => unwrap(apiClient.post(`${EP.reportingPeriods}${id}/reconcile/`))
export const listReconciliations = (id) => unwrap(apiClient.get(`${EP.reportingPeriods}${id}/reconciliations/`))
export const listApprovedHours = (projectId) => unwrap(apiClient.get(EP.approvedHours, { params: { project: projectId } }))
export const createApprovedHour = (payload) => unwrap(apiClient.post(EP.approvedHours, payload))
export const submitApprovedHour = (id) => unwrap(apiClient.post(`${EP.approvedHours}${id}/submit/`))
export const approveApprovedHour = (id) => unwrap(apiClient.post(`${EP.approvedHours}${id}/approve/`))
export const reverseApprovedHour = (id, reason) => unwrap(apiClient.post(`${EP.approvedHours}${id}/reverse/`, { reason }))
export const listIntegratedSnapshots = (projectId) => unwrap(apiClient.get(EP.integratedSnapshots, { params: { project: projectId } }))
export const listBudgetAllocations = (projectId)    => unwrap(apiClient.get(EP.budgetAllocations, { params: { project: projectId } }))
export const createBudgetAllocation = (payload)     => unwrap(apiClient.post(EP.budgetAllocations, payload))
export const approveBudgetAllocation = (id)         => unwrap(apiClient.post(`${EP.budgetAllocations}${id}/approve/`))
export const listCostAllocations = (projectId, params = {}) => unwrap(apiClient.get(EP.costAllocations, { params: { project: projectId, ...params } }))
export const createCostAllocation = (payload)       => unwrap(apiClient.post(EP.costAllocations, payload))
export const approveCostAllocation = (id)           => unwrap(apiClient.post(`${EP.costAllocations}${id}/approve/`))
export const listCostLedger      = (projectId, params = {}) => unwrap(apiClient.get(EP.costLedger, { params: { project: projectId, ...params } }))

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
export const listChangeEvents = (projectId, params = {}) =>
  unwrap(apiClient.get(EP.changes, { params: { project: projectId, ...params } }))

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
  listProjectTasks, listProjectMilestones,
  getCostKpis, getCommercialDashboard, getPortfolioExceptions, getEstimateVariance, runFinanceSync,
  listWbsNodes, createWbsNode,
  listControlAccounts, createControlAccount, updateControlAccount, submitControlAccount, approveControlAccount, closeControlAccount,
  listReportingPeriods, createReportingPeriod, updateReportingPeriod, submitReportingPeriod, lockReportingPeriod, reopenReportingPeriod,
  getReportingPeriodHistory, reconcileReportingPeriod, listReconciliations,
  listApprovedHours, createApprovedHour, submitApprovedHour, approveApprovedHour, reverseApprovedHour, listIntegratedSnapshots,
  listBudgetAllocations, createBudgetAllocation, approveBudgetAllocation,
  listCostAllocations, createCostAllocation, approveCostAllocation, listCostLedger,
  listEstimates, getEstimate, createEstimate, updateEstimate, approveEstimate, supersedeEstimate,
  importBoqExcel,
  listDocuments, uploadDocument, presignDocumentDownload, deleteDocument,
  runAiTakeoff, getEvm, getCashflow, getRiskAnalytics, runChangeDetection, listChangeEvents,
  listQhseProjects, mapQhseRowToProjectPayload, importQhseRows,
}
