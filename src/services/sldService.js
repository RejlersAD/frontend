/**
 * API client for the staged SLD Equipment Comparison flow
 * ("RADAI SLD Comparison" canvas). Mounted under
 * /api/v1/electrical-comparison/sld/.
 *
 * BYOK security: the key is sent only to the key endpoints, is stored
 * encrypted server-side, and is never echoed back, cached in
 * localStorage, or written to logs.
 */
import apiClient from './api.service'

const BASE = '/electrical-comparison/sld'

const sldService = {
  // ── projects (existing electrical-comparison project endpoints) ──────
  async listProjects() {
    const { data } = await apiClient.get('/electrical-comparison/projects/')
    return data
  },
  async createProject({ projectName, description = '' }) {
    const { data } = await apiClient.post('/electrical-comparison/projects/', {
      project_name: projectName, description,
    })
    return data
  },
  async deleteProject(projectId) {
    await apiClient.delete(`/electrical-comparison/projects/${projectId}/`)
  },

  // ── staged state ──────────────────────────────────────────────────────
  async getState(projectId) {
    const { data } = await apiClient.get(`${BASE}/${projectId}/state/`)
    return data
  },

  // ── Stage 1: files ────────────────────────────────────────────────────
  async uploadFile(projectId, kind, file) {
    const form = new FormData()
    form.append('kind', kind)
    form.append('file', file)
    const { data } = await apiClient.post(`${BASE}/${projectId}/files/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
    return data
  },
  async updateMapping(projectId, fileId, patch) {
    const { data } = await apiClient.put(`${BASE}/${projectId}/files/${fileId}/mapping/`, patch)
    return data
  },

  // ── Stage 2: BYOK key (server-stored, encrypted) ─────────────────────
  async getKey() {
    const { data } = await apiClient.get(`${BASE}/user/ai-key/`)
    return data
  },
  async testKey(provider, apiKey) {
    const { data } = await apiClient.post(`${BASE}/user/ai-key/test/`, {
      provider, api_key: apiKey,
    }, { sensitiveRequest: true, timeout: 60000 })
    return data
  },
  async saveKey(provider, apiKey) {
    const { data } = await apiClient.put(`${BASE}/user/ai-key/`, {
      provider, api_key: apiKey,
    }, { sensitiveRequest: true })
    return data
  },
  async removeKey() {
    await apiClient.delete(`${BASE}/user/ai-key/`)
  },

  // ── Stage 3: legend ───────────────────────────────────────────────────
  async setLegend(projectId, payload) {
    const { data } = await apiClient.put(`${BASE}/${projectId}/legend/`, payload)
    return data
  },

  // ── analysis ──────────────────────────────────────────────────────────
  async analyse(projectId) {
    const { data } = await apiClient.post(`${BASE}/${projectId}/analyse/`, {}, { timeout: 30000 })
    return data
  },
  async listAnalyses(projectId) {
    const { data } = await apiClient.get(`${BASE}/${projectId}/analyses/`)
    return data
  },
  async getAnalysis(projectId, analysisId, tab) {
    const { data } = await apiClient.get(`${BASE}/${projectId}/analyses/${analysisId}/`, {
      params: tab ? { tab } : {},
    })
    return data
  },
  async deleteAnalysis(projectId, analysisId) {
    await apiClient.delete(`${BASE}/${projectId}/analyses/${analysisId}/`)
  },
  async exportAnalysis(projectId, analysisId, format = 'workbook') {
    const { data } = await apiClient.get(
      `${BASE}/${projectId}/analyses/${analysisId}/export/`, {
        params: { format }, responseType: 'blob', timeout: 120000,
      })
    const url = window.URL.createObjectURL(new Blob([data]))
    const a = document.createElement('a')
    a.href = url
    a.download = format === 'drafting'
      ? `SLD_drafting_comments_${analysisId}.xlsx`
      : `SLD_comparison_${analysisId}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
  },
}

export default sldService
