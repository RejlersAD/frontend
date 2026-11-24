import apiClient from './api.service'

// Team & Enterprise tiers. Every call is authorized and tenant-scoped by the API;
// UI checks only decide what to show.
const ROOT = '/enterprise'
const options = { suppressErrorToast: true }
const data = request => request.then(response => response.data)

export const getEnterpriseContext = signal => data(apiClient.get(`${ROOT}/context/`, { ...options, signal }))

export const getTeam = id => data(apiClient.get(`${ROOT}/teams/${id}/`, options))
export const createTeam = body => data(apiClient.post(`${ROOT}/teams/`, body, options))
export const updateTeam = (id, body) => data(apiClient.patch(`${ROOT}/teams/${id}/`, body, options))
export const archiveTeam = id => data(apiClient.delete(`${ROOT}/teams/${id}/`, options))

export const addTeamMember = (id, body) => data(apiClient.post(`${ROOT}/teams/${id}/members/`, body, options))
export const updateTeamMember = (id, userId, body) =>
  data(apiClient.patch(`${ROOT}/teams/${id}/members/${userId}/`, body, options))
export const removeTeamMember = (id, userId) =>
  data(apiClient.delete(`${ROOT}/teams/${id}/members/${userId}/`, options))

export const listMyWorkspaces = () => data(apiClient.get(`${ROOT}/my-workspaces/`, options))
export const shareWorkspace = (id, body) => data(apiClient.post(`${ROOT}/teams/${id}/workspaces/`, body, options))
export const updateSharedWorkspace = (id, workspaceId, body) =>
  data(apiClient.patch(`${ROOT}/teams/${id}/workspaces/${workspaceId}/`, body, options))
export const unshareWorkspace = (id, workspaceId) =>
  data(apiClient.delete(`${ROOT}/teams/${id}/workspaces/${workspaceId}/`, options))

export const updateEdition = body => data(apiClient.patch(`${ROOT}/organization/edition/`, body, options))
export const updatePolicy = body => data(apiClient.patch(`${ROOT}/organization/policy/`, body, options))
export const getRetentionPreview = () => data(apiClient.get(`${ROOT}/organization/retention-preview/`, options))
export const listOrgAdmins = () => data(apiClient.get(`${ROOT}/organization/admins/`, options))
export const addOrgAdmin = body => data(apiClient.post(`${ROOT}/organization/admins/`, body, options))
export const removeOrgAdmin = id => data(apiClient.delete(`${ROOT}/organization/admins/${id}/`, options))

export const getAuditSummary = params => data(apiClient.get(`${ROOT}/audit-logs/summary/`, { ...options, params }))
export const listOrgModels = () => data(apiClient.get(`${ROOT}/organization/models/`, options))
export const listAuditLogs = params => data(apiClient.get(`${ROOT}/audit-logs/`, { ...options, params }))
export const exportAuditLogs = params =>
  apiClient.get(`${ROOT}/audit-logs/export/`, { ...options, params, responseType: 'blob' })
    .then(response => {
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      const match = /filename="([^"]+)"/.exec(response.headers?.['content-disposition'] || '')
      link.href = url
      link.download = match ? match[1] : 'radai-audit.csv'
      link.click()
      URL.revokeObjectURL(url)
    })

// Show the API's own validation message; never echo request bodies.
export const enterpriseError = error => {
  const status = error?.response?.status
  const body = error?.response?.data
  if (body && typeof body === 'object') {
    if (typeof body.detail === 'string') return body.detail
    const first = Object.values(body).flat().find(v => typeof v === 'string')
    if (first) return first
  }
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'Not found, or Team & Enterprise features are turned off.'
  return 'The request could not be completed. Please retry.'
}
