import apiClient from './api.service'

const ROOT = '/file-replica'
const READ_TIMEOUT_MS = 30000
const unwrap = request => request.then(response => response.data)
const requestOptions = { suppressErrorToast: true }
const readAll = async (path, params = {}, signal) => {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Loading server data timed out. Please retry.')
      error.isTimeout = true
      reject(error)
      controller.abort()
    }, READ_TIMEOUT_MS)
  })
  const load = async () => {
    const items = [], nextPages = new Set()
    let page = 1
    let more = true
    while (more) {
      const data = await unwrap(apiClient.get(`${ROOT}/${path}/`, { ...requestOptions, timeout: READ_TIMEOUT_MS, params: { ...params, page }, signal: controller.signal }))
      items.push(...(Array.isArray(data) ? data : data?.results || []))
      more = Boolean(data?.next)
      if (more && nextPages.has(String(data.next))) throw new Error('The server returned a repeated results page. Please retry.')
      if (more) nextPages.add(String(data.next))
      page += 1
    }
    return items
  }
  try { return await Promise.race([load(), deadline]) }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
}

export const listSources = signal => readAll('sources', {}, signal)
export const listScans = id => unwrap(apiClient.get(`${ROOT}/sources/${id}/scans/`, requestOptions))
export const createSource = body => unwrap(apiClient.post(`${ROOT}/sources/`, body, requestOptions))
export const updateSource = (id, body) => unwrap(apiClient.patch(`${ROOT}/sources/${id}/`, body, requestOptions))
export const rotateToken = id => unwrap(apiClient.post(`${ROOT}/sources/${id}/rotate-token/`, {}, requestOptions))
export const listScopes = (params, signal) => readAll('scopes', params, signal)
export const updateScope = (id, body) => unwrap(apiClient.patch(`${ROOT}/scopes/${id}/`, body, requestOptions))
export const listEntries = (params, signal) => unwrap(apiClient.get(`${ROOT}/entries/`, { ...requestOptions, params, signal }))
export const downloadEntry = (id, inline = false) => unwrap(apiClient.get(`${ROOT}/entries/${id}/download/`, {
  ...requestOptions, responseType: 'blob', params: inline ? { inline: 1 } : undefined,
}))
export const extractEntry = id => unwrap(apiClient.post(`${ROOT}/entries/${id}/extract/`, {}, { ...requestOptions, timeout: 120000 }))
export const listExtractions = (id, signal) => unwrap(apiClient.get(`${ROOT}/entries/${id}/extractions/`, { ...requestOptions, signal }))
export const reviewExtraction = (id, body) => unwrap(apiClient.post(`${ROOT}/extractions/${id}/review/`, body, requestOptions))

export const itemsFrom = data => Array.isArray(data) ? data : data?.results || []
export const replicaError = (error, fallback = 'The request could not be completed.') => {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.error === 'string') return data.error
  if (data && !(data instanceof Blob) && typeof data === 'object') {
    return Object.entries(data).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ')
  }
  return error?.message || fallback
}

// Navigation is a convenience; the API independently enforces administrative access.
export const canManageReplica = user => {
  const account = user?.user || user
  const roles = user?.roles || account?.roles || []
  return account?.is_superuser === true || (Array.isArray(roles) && roles.some(role =>
    role?.is_active !== false && ['super_admin', 'admin', 'ict_admin'].includes(role?.code || role?.role_code || role))
  )
}
