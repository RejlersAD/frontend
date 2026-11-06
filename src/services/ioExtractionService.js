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

  async getExtraction(projectId, extractionId, { tab = 'io', sheet, scope } = {}) {
    const params = { tab }
    if (sheet) params.sheet = sheet
    if (scope) params.scope = scope
    const { data } = await apiClient.get(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/`, { params })
    return data
  },

  async postDecisions(projectId, extractionId, decisions) {
    const { data } = await apiClient.post(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/decisions/`, decisions)
    return data
  },

  async listExtractions(projectId) {
    const { data } = await apiClient.get(`${BASE}/projects/${projectId}/extractions/`)
    return data
  },

  async patchRow(projectId, extractionId, tag, updates) {
    const { data } = await apiClient.patch(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/rows/${encodeURIComponent(tag)}/`,
      updates)
    return data
  },

  async askAi(projectId, extractionId, loopKey) {
    const { data } = await apiClient.post(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/ai/${encodeURIComponent(loopKey)}/`)
    return data
  },

  /** Authenticated workbook download (a plain <a href> carries no JWT).
   * format defaults to 'standard' (the Standard Template workbook). */
  async exportWorkbook(projectId, extractionId, format = 'standard') {
    const params = format ? { fmt: format } : {}
    const { data, headers } = await apiClient.get(
      `${BASE}/projects/${projectId}/extractions/${extractionId}/export/`,
      { params, responseType: 'blob', timeout: 120000 })
    const disposition = headers?.['content-disposition'] || ''
    const m = disposition.match(/filename="?([^";]+)"?/)
    const filename = m ? m[1] : `io-list-${format || 'workbook'}.xlsx`
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return {
      filename,
      rows: parseInt(headers?.['x-export-rows'] || '', 10) || null,
      template: headers?.['x-export-template'] || '',
    }
  },

  /** Export template (I/O List) setting: effective template + settings. */
  async getExportTemplate(projectId) {
    const { data } = await apiClient.get(`${BASE}/projects/${projectId}/export-template/`)
    return data
  },

  async uploadExportTemplate(projectId, file, scope = 'project') {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('scope', scope)
    const { data } = await apiClient.post(
      `${BASE}/projects/${projectId}/export-template/`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
    return data
  },

  async deleteExportTemplate(projectId) {
    const { data } = await apiClient.delete(`${BASE}/projects/${projectId}/export-template/`)
    return data
  },

  async patchExportSettings(projectId, payload) {
    const { data } = await apiClient.patch(`${BASE}/projects/${projectId}/export-settings/`, payload)
    return data
  },
}

export default ioExtractionService
