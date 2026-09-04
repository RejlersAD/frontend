import apiClient from './api.service'

const unwrap = (promise) => promise.then((response) => response.data)
const BASE = '/hr'

const hrCoreService = {
  getWorkspace: () => unwrap(apiClient.get(`${BASE}/self-service-workspace/`)),
  askAssistant: (question) => unwrap(apiClient.post(`${BASE}/assistant/ask/`, { question })),
  getAssistantHistory: () => unwrap(apiClient.get(`${BASE}/assistant/`)),
  listPolicies: (params = {}) => unwrap(apiClient.get(`${BASE}/policies/`, { params })),
  createPrivacyRequest: (payload) => unwrap(apiClient.post(`${BASE}/privacy-requests/`, payload)),
  listPrivacyRequests: () => unwrap(apiClient.get(`${BASE}/privacy-requests/`)),
  listGraphConnections: () => unwrap(apiClient.get(`${BASE}/microsoft-graph-connections/`)),
  testGraphConnection: (id) => unwrap(apiClient.post(`${BASE}/microsoft-graph-connections/${id}/test-connection/`)),
  syncEntra: (id) => unwrap(apiClient.post(`${BASE}/microsoft-graph-connections/${id}/sync-entra/`)),
  syncSharePointPolicies: (id) => unwrap(apiClient.post(`${BASE}/microsoft-graph-connections/${id}/sync-sharepoint-policies/`)),
  sendTeamsTest: (id, recipientEntraId) => unwrap(apiClient.post(`${BASE}/microsoft-graph-connections/${id}/send-test-teams/`, { recipient_entra_id: recipientEntraId })),
}

export default hrCoreService
