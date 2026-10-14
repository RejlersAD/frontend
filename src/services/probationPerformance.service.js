import apiClient from './api.service'

const BASE_URL = '/onboarding/performance-reports/'

const unwrapList = (response) => {
  const payload = response?.data ?? response
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.results) ? payload.results : []
}

const probationPerformanceService = {
  async getForEmployee(employeeId) {
    const response = await apiClient.get(BASE_URL, { params: { employee_id: employeeId } })
    return unwrapList(response)
  },

  async generate(employeeId) {
    const response = await apiClient.post(BASE_URL, { employee: employeeId })
    return response?.data ?? response
  },

  async update(reportId, values) {
    const response = await apiClient.patch(`${BASE_URL}${reportId}/`, values)
    return response?.data ?? response
  },

  async refreshInsights(reportId) {
    const response = await apiClient.post(`${BASE_URL}${reportId}/refresh-insights/`)
    return response?.data ?? response
  },
}

export default probationPerformanceService
