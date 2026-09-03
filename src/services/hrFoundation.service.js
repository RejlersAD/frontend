import apiClient from './api.service'

const BASE_URL = '/hr'
const payload = (response) => response?.data ?? response
const list = (response) => {
  const data = payload(response)
  return Array.isArray(data) ? data : (data?.results || [])
}

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

  async getPerformanceCycles(params = {}) { return list(await apiClient.get(`${BASE_URL}/performance-cycles/`, { params })) },
  async getGoals(params = {}) { return list(await apiClient.get(`${BASE_URL}/goals/`, { params })) },
  async createGoal(data) { return payload(await apiClient.post(`${BASE_URL}/goals/`, data)) },
  async submitGoal(id) { return payload(await apiClient.post(`${BASE_URL}/goals/${id}/submit/`)) },
  async approveGoal(id) { return payload(await apiClient.post(`${BASE_URL}/goals/${id}/approve/`)) },
  async checkInGoal(data) { return payload(await apiClient.post(`${BASE_URL}/goal-check-ins/`, data)) },
  async getReviews(params = {}) { return list(await apiClient.get(`${BASE_URL}/performance-reviews/`, { params })) },
  async saveReview(data) { return payload(await apiClient.post(`${BASE_URL}/performance-reviews/`, data)) },
  async submitReview(id) { return payload(await apiClient.post(`${BASE_URL}/performance-reviews/${id}/submit/`)) },
  async getFeedback(params = {}) { return list(await apiClient.get(`${BASE_URL}/continuous-feedback/`, { params })) },
  async createFeedback(data) { return payload(await apiClient.post(`${BASE_URL}/continuous-feedback/`, data)) },
  async getDevelopmentPlans(params = {}) { return list(await apiClient.get(`${BASE_URL}/development-plans/`, { params })) },
  async createDevelopmentPlan(data) { return payload(await apiClient.post(`${BASE_URL}/development-plans/`, data)) },
  async getTalentAssessments(params = {}) { return list(await apiClient.get(`${BASE_URL}/talent-assessments/`, { params })) },
  async getPromotionCases(params = {}) { return list(await apiClient.get(`${BASE_URL}/promotion-cases/`, { params })) },
  async getShifts(params = {}) { return list(await apiClient.get(`${BASE_URL}/work-shifts/`, { params })) },
  async getShiftAssignments(params = {}) { return list(await apiClient.get(`${BASE_URL}/shift-assignments/`, { params })) },
  async getOvertimeRequests(params = {}) { return list(await apiClient.get(`${BASE_URL}/overtime-requests/`, { params })) },
  async createOvertimeRequest(data) { return payload(await apiClient.post(`${BASE_URL}/overtime-requests/`, data)) },
  async decideOvertime(id, decision, data = {}) { return payload(await apiClient.post(`${BASE_URL}/overtime-requests/${id}/${decision}/`, data)) },
  async getServiceRequests(params = {}) { return list(await apiClient.get(`${BASE_URL}/service-requests/`, { params })) },
  async createServiceRequest(data) { return payload(await apiClient.post(`${BASE_URL}/service-requests/`, data)) },
  async decideServiceRequest(id, decision, note = '') { return payload(await apiClient.post(`${BASE_URL}/service-requests/${id}/${decision}/`, { note })) },
  async cancelServiceRequest(id, note = '') { return payload(await apiClient.post(`${BASE_URL}/service-requests/${id}/cancel/`, { note })) },
  async commentServiceRequest(id, body) { return payload(await apiClient.post(`${BASE_URL}/service-requests/${id}/comment/`, { body })) },
}

export default hrFoundationService
