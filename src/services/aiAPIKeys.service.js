import apiClient from './api.service'

const ROOT = '/rbac/admin/ai-api-keys/'
const options = { suppressErrorToast: true, sensitiveRequest: true, timeout: 45000 }
const unwrap = request => request.then(response => response.data)

export const AI_PROVIDERS = { openai: 'OpenAI', anthropic: 'Anthropic Claude', gemini: 'Google Gemini' }
export const listAIKeys = signal => unwrap(apiClient.get(ROOT, { ...options, signal }))
export const createAIKey = body => unwrap(apiClient.post(ROOT, body, options))
export const updateAIKey = (id, body) => unwrap(apiClient.patch(`${ROOT}${id}/`, body, options))
export const deleteAIKey = (id, body) => unwrap(apiClient.delete(`${ROOT}${id}/`, { ...options, data: body }))
export const selectAIKey = (id, body) => unwrap(apiClient.post(`${ROOT}${id}/select/`, body, options))
export const updateAIProvider = (provider, body) => unwrap(apiClient.patch(`${ROOT}providers/${provider}/`, body, options))
export const testAIKey = (id, body) => unwrap(apiClient.post(`${ROOT}${id}/test/`, body, options))

// UI visibility only. Every operation is independently authorized by the API.
export const canManageAIKeys = user => {
  const account = user?.user || user
  if (!account || account.is_active === false || user?.is_active === false) return false
  if (user.is_deleted === true || account.is_deleted === true || (user.status && user.status !== 'active')) return false
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return false
  const roles = user?.roles || account.roles || []
  return account.is_superuser === true || (Array.isArray(roles) && roles.some(role =>
    role?.is_active !== false && ['super_admin', 'admin', 'ict_admin'].includes(role?.code || role?.role_code || role)
  ))
}

// Never reflect provider errors or request bodies: a rejected secret may be present.
export const aiKeyError = error => {
  const status = error?.response?.status
  if (status === 401 || status === 403) return 'Administrator access is required to manage AI credentials.'
  if (status === 409) return 'These settings changed since you opened them. Reload the latest settings and review your changes before saving again.'
  if (status === 503) return 'Secure credential storage is unavailable. Ask the server administrator to configure the encryption key, then refresh.'
  if (status === 400) return 'The settings could not be saved. Check the provider, name, model and key, then retry.'
  if (status === 404) return 'This credential is no longer available. Refresh the list.'
  if (status === 429) return 'A connection test is already running or requests are temporarily limited. Wait briefly, then retry.'
  return 'The AI settings request could not be completed. Your changes are still here; please retry.'
}

const testReasons = {
  credit_balance_exhausted: 'The provider account has no available credit. Ask the account administrator to restore its balance.',
  model_unavailable: 'The selected model is unavailable to this provider account. Check the model identifier and access.',
  provider_authentication: 'The provider rejected this key. Replace it with a valid credential.',
  provider_permission: 'This provider account does not have permission for the selected model.',
  provider_rate_limit: 'The provider is limiting requests. Retry after the limit resets.',
  provider_timeout: 'The provider did not respond in time. Retry the connection test.',
  dependency_missing: 'The server is missing the provider integration dependency. Ask the server administrator to check it.',
}
export const aiTestMessage = result => result?.success
  ? 'Connection verified for the tested model. This does not verify document extraction results.'
  : `${testReasons[result?.reason] || 'The connection test failed. Check the key, provider account and model access.'} The saved credential was retained.`
