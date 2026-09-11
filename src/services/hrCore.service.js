import apiClient from './api.service'

const unwrap = (promise) => promise.then((response) => response.data)
const BASE = '/hr'

const hrCoreService = {
  applyOvertimeBenefit: (id, data) => unwrap(apiClient.post(`${BASE}/overtime-requests/${id}/apply-benefit/`, data)),
  getOvertimeDays: (employee) => unwrap(apiClient.get(`${BASE}/overtime-requests/available-days/`, { params: { employee } })),
  getOvertimeEmployees: () => unwrap(apiClient.get(`${BASE}/overtime-requests/employees/`)),
  getOvertimeRequests: (params) => unwrap(apiClient.get(`${BASE}/overtime-requests/`, { params })),
  getOvertimeRequest: (id, params) => unwrap(apiClient.get(`${BASE}/overtime-requests/${id}/`, { params })),
  createOvertimeDays: (data) => unwrap(apiClient.post(`${BASE}/overtime-requests/submit-days/`, data)),
  createOvertimeRequest: (data) => unwrap(apiClient.post(`${BASE}/overtime-requests/`, data)),
  reviewOvertimeRequest: (id, action, note) => unwrap(apiClient.post(`${BASE}/overtime-requests/${id}/${action}/`, { note })),
  getWorkforceSummary: () => unwrap(apiClient.get(`${BASE}/employees/workforce-summary/`, { timeout: 20_000 })),
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
