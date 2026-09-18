import apiClient, { apiClientLongTimeout } from './api.service'

const endpoint = '/planning-intelligence/project-setup/'

export const projectSetupService = {
  options: async signal => (await apiClient.get(`${endpoint}options/`, { signal, suppressErrorToast: true })).data,
  aiSettings: async signal => (await apiClient.get(`${endpoint}ai-settings/`, { signal, suppressErrorToast: true, silentTimeout: true })).data,
  saveAISettings: async payload => (await apiClientLongTimeout.post(`${endpoint}ai-settings/`, payload, { suppressErrorToast: true, silentTimeout: true, timeout: 120000 })).data,
  removeAISettings: async () => (await apiClient.delete(`${endpoint}ai-settings/`, { suppressErrorToast: true, silentTimeout: true })).data,
  preview: async payload => (await apiClientLongTimeout.post(`${endpoint}preview/`, payload, { suppressErrorToast: true, timeout: 120000 })).data,
  create: async payload => (await apiClientLongTimeout.post(`${endpoint}create/`, payload, { suppressErrorToast: true })).data,
}
