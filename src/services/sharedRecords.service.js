import apiClient from './api.service'

const base = '/projects/shared-records/'
const path = (sourceType, sourceId) => `${base}${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}/`
const config = options => ({ suppressErrorToast: true, ...options })
const unwrap = promise => promise.then(response => response.data)

export const listSharedRecords = (params, options = {}) => unwrap(apiClient.get(base, config({ ...options, params })))
export const getSharedRecord = (sourceType, sourceId, options = {}) => unwrap(apiClient.get(path(sourceType, sourceId), config(options)))
export const findSharedRecordCandidates = (sourceType, sourceId, params, options = {}) => unwrap(apiClient.get(`${path(sourceType, sourceId)}candidates/`, config({ ...options, params })))
export const linkSharedRecord = (sourceType, sourceId, payload) => unwrap(apiClient.post(`${path(sourceType, sourceId)}link/`, payload, config()))
export const findSharedTargets = (params, options = {}) => unwrap(apiClient.get('/projects/shared-record-targets/', config({ ...options, params })))

export function sharedRecordError(error, fallback) {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.error === 'string') return data.error
  if (data && typeof data === 'object') {
    const messages = Object.values(data).flat().filter(value => typeof value === 'string')
    if (messages.length) return messages.join(' ')
  }
  return fallback
}
