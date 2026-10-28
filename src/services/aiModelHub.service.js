import apiClient from './api.service'

// AI model hub endpoints (contract: ai-model-hub-contract.md).
// Base path maps to /api/v1/rbac/admin/ai/ on the server.
const ROOT = '/rbac/admin/ai/'
const options = { suppressErrorToast: true, sensitiveRequest: true, timeout: 45000 }
const unwrap = request => request.then(response => response.data)

export const listProviders = signal => unwrap(apiClient.get(`${ROOT}providers`, { ...options, signal }))
export const listModels = (params = {}, signal) => unwrap(apiClient.get(`${ROOT}models`, { ...options, params, signal }))
export const setModelEnabled = (providerId, modelId, enabled) =>
  unwrap(apiClient.patch(`${ROOT}models/${encodeURIComponent(providerId)}/${encodeURIComponent(modelId)}`, { enabled }, options))

export const listCredentials = signal => unwrap(apiClient.get(`${ROOT}credentials`, { ...options, signal }))
export const testCredentialPayload = body => unwrap(apiClient.post(`${ROOT}credentials/test`, body, options))
export const createCredential = body => unwrap(apiClient.post(`${ROOT}credentials`, body, options))
export const testSavedCredential = id => unwrap(apiClient.post(`${ROOT}credentials/${id}/test`, {}, options))
export const rotateCredential = (id, secret) => unwrap(apiClient.post(`${ROOT}credentials/${id}/rotate`, { secret }, options))
export const revokeCredential = id => unwrap(apiClient.delete(`${ROOT}credentials/${id}`, options))

export const listRoutes = signal => unwrap(apiClient.get(`${ROOT}routes`, { ...options, signal }))
export const saveRoute = (taskId, chain) => unwrap(apiClient.put(`${ROOT}routes/${encodeURIComponent(taskId)}`, { chain }, options))

export const startSync = () => unwrap(apiClient.post(`${ROOT}sync`, {}, options))
export const getSyncRun = runId => unwrap(apiClient.get(`${ROOT}sync/${encodeURIComponent(runId)}`, options))
export const getSyncSchedule = signal => unwrap(apiClient.get(`${ROOT}sync/schedule`, { ...options, signal }))
export const saveSyncSchedule = body => unwrap(apiClient.put(`${ROOT}sync/schedule`, body, options))

export const getStorageStatus = signal => unwrap(apiClient.get(`${ROOT}storage-status`, { ...options, signal }))
export const getOverview = signal => unwrap(apiClient.get(`${ROOT}overview`, { ...options, signal }))

// Never reflect provider errors or request bodies: a rejected secret may be present.
export const hubError = error => {
  const status = error?.response?.status
  if (status === 401 || status === 403) return 'Administrator access is required to manage AI configuration.'
  if (status === 404) return 'This item is no longer available. Refresh the page.'
  if (status === 422) return 'The selection is not eligible for this task. Review the inline errors and adjust.'
  if (status === 429) return 'Requests are temporarily limited. Wait briefly, then retry.'
  if (status === 503) return 'Secure credential storage is unavailable. Ask the server administrator to configure the encryption key.'
  return 'The request could not be completed. Your entries are retained; please retry.'
}

// Per-slot routing errors from a 422 response, shape-tolerant.
export const routeErrors = error => {
  const data = error?.response?.data
  if (!data) return null
  if (Array.isArray(data.errors)) return data.errors
  if (Array.isArray(data.chain)) return data.chain
  if (data.detail) return [typeof data.detail === 'string' ? data.detail : null, null, null]
  return null
}
