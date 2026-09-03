import apiClient from './api.service'

const BASE_URL = '/hr'
const payload = (response) => response?.data ?? response

const hrFoundationService = {
  async resolveEmployee(identifier) {
    return payload(await apiClient.get(`${BASE_URL}/employees/resolve/`, { params: { identifier } }))
  },

  async getIdentityHealth(employeeId) {
    return payload(await apiClient.get(`${BASE_URL}/employees/${employeeId}/identity-health/`))
  },

  async repairIdentity(employeeId) {
    return payload(await apiClient.post(`${BASE_URL}/employees/${employeeId}/repair-identity/`))
  },

  async getWorkflows(params = {}) {
    return payload(await apiClient.get(`${BASE_URL}/workflows/`, { params }))
  },

  async decideWorkflow(workflowId, decision, note = '') {
    return payload(await apiClient.post(`${BASE_URL}/workflows/${workflowId}/${decision}/`, { note }))
  },
}

export default hrFoundationService
