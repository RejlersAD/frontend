/** Deterministic P&ID → IO List extraction API (alignment spec §8).
 * All routes live under the existing instrument-io-workflow tree. */
import apiClient from './api.service'

const BASE = '/instrument-io-workflow'

export const ioExtractionService = {
  async uploadFile(projectId, file) {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await apiClient.post(
      `${BASE}/projects/${projectId}/extraction-files/`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
    return data
  },

  async listFiles(projectId) {
    const { data } = await apiClient.get(`${BASE}/projects/${projectId}/extraction-files/list/`)
    return data
  },

  async saveLegend(projectId, payload) {
    const { data } = await apiClient.put(`${BASE}/projects/${projectId}/extraction-legend/`, payload)
    return data
  },

  async saveDocInfo(projectId, payload) {
    const { data } = await apiClient.put(`${BASE}/projects/${projectId}/extraction-doc-info/`, payload)
    return data
  },

  async startExtraction(projectId, useAi) {
    const { data } = await apiClient.post(`${BASE}/projects/${projectId}/extract/`, { useAi: !!useAi })
    return data
  },

  async getStatus(projectId, extractionId) {
    const { data } = await apiClient.get(`${BASE}/projects/${projectId}/extractions/${extractionId}/status/`)
    return data
  },

  async getExtraction(projectId, extractionId, { tab = 'io', sheet } = {}) {
    const params = { tab }
    if (sheet) params.sheet = sheet
    const { data } = await apiClient.get(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/`, { params })
    return data
  },

  async postDecisions(projectId, extractionId, decisions) {
    const { data } = await apiClient.post(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/decisions/`, decisions)
    return data
  },

  async askAi(projectId, extractionId, loopKey) {
    const { data } = await apiClient.post(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/ai/${encodeURIComponent(loopKey)}/`)
    return data
  },

  exportUrl(projectId, extractionId, format) {
    // NOTE: 'format' is DRF's reserved renderer-negotiation param (a
    // ?format=review request 404s before reaching the view) — use 'fmt'.
    return `/api/v1${BASE}/projects/${projectId}/extractions/${extractionId}/export/?fmt=${format}`
  },
}

export default ioExtractionService
