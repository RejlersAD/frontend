import apiClient from './api.service'

const endpoint = projectId => `/planning-intelligence/agreement-workspaces/projects/${projectId}/`
const options = signal => ({ signal, suppressErrorToast: true })

export const agreementWorkspaceService = {
  get: async (projectId, signal) => (await apiClient.get(endpoint(projectId), options(signal))).data,
  analyze: async (projectId, file, requestId, signal) => {
    if (!(file instanceof File)) return (await apiClient.post(`${endpoint(projectId)}analyze/`, { file_ids: [file], idempotency_key: requestId }, options(signal))).data
    const body = new FormData()
    body.append('file', file)
    body.append('idempotency_key', requestId)
    return (await apiClient.post(`${endpoint(projectId)}analyze/`, body, options(signal))).data
  },
  accept: async (projectId, draft, selection, signal) => (await apiClient.post(`${endpoint(projectId)}accept/`, {
    workspace_id: draft.id, revision: draft.revision,
    reason: selection?.reason || 'Accept document-supported inputs and build the project draft; retain proposals and unresolved exceptions for review.',
    ...(selection?.selected_fact_ids?.length ? { selected_fact_ids: selection.selected_fact_ids } : {}),
  }, options(signal))).data,
  create: async (file, values, requestId, signal) => {
    const body = new FormData()
    body.append('file', file)
    body.append('idempotency_key', requestId)
    if (values.name?.trim()) body.append('name', values.name.trim())
    if (values.code?.trim()) body.append('code', values.code.trim())
    if (values.ai_api_key?.trim()) body.append('ai_api_key', values.ai_api_key.trim())
    if (values.ai_model?.trim()) body.append('ai_model', values.ai_model.trim())
    return (await apiClient.post('/planning-intelligence/agreement-workspaces/create/', body, options(signal))).data
  },
}

export const agreementError = error => {
  const data = error?.response?.data
  const message = data?.detail || data?.message || data?.error
  if (typeof message === 'string') return message
  const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).filter(Boolean).join(' ') : value && typeof value === 'object' ? Object.values(value).map(text).filter(Boolean).join(' ') : ''
  const field = data && typeof data === 'object' && Object.entries(data).find(([key, value]) => !['status', 'request_id'].includes(key) && (key !== 'code' || typeof value !== 'string') && text(value))
  if (field) return `${['detail', 'error', 'message', 'non_field_errors'].includes(field[0]) ? '' : `${field[0].replaceAll('_', ' ')}: `}${text(field[1])}`
  return error?.message || 'The agreement workspace could not be loaded.'
}
