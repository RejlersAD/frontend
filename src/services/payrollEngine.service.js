/**
 * Payroll Engine — API service.
 * Base path: /api/v1/payroll-engine/
 */
import apiClient from './api.service'

const BASE = '/payroll-engine'
const unwrap = (p) => p.then((r) => r.data)

const payrollEngineService = {
  // ── Catalog (soft-coded options from backend) ──────────────────────────
  getCatalog: () => unwrap(apiClient.get(`${BASE}/catalog/`)),

  // ── Dashboard ──────────────────────────────────────────────────────────
  getDashboardSummary: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/dashboard-summary/`, { params })),

  // ── Employees ──────────────────────────────────────────────────────────
  listEmployees: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/employees/`, { params })),

  getEmployee: (id) =>
    unwrap(apiClient.get(`${BASE}/employees/${id}/`)),

  createEmployee: (payload) =>
    unwrap(apiClient.post(`${BASE}/employees/`, payload)),

  updateEmployee: (id, payload) =>
    unwrap(apiClient.patch(`${BASE}/employees/${id}/`, payload)),

  deleteEmployee: (id) =>
    unwrap(apiClient.delete(`${BASE}/employees/${id}/`)),

  importEmployeesXlsx: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return unwrap(apiClient.post(`${BASE}/employees/import-xlsx/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },

  exportEmployeesXlsx: () =>
    apiClient.get(`${BASE}/employees/export-xlsx/`, { responseType: 'blob' })
      .then((r) => r.data),

  // ── Runs ───────────────────────────────────────────────────────────────
  listRuns: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/runs/`, { params })),

  getRun: (id) =>
    unwrap(apiClient.get(`${BASE}/runs/${id}/`)),

  generateRun: ({ year, month, overwrite = false, note = '', working_days = 22 }) =>
    unwrap(apiClient.post(`${BASE}/runs/`, { year, month, overwrite, note, working_days })),

  deleteRun: (id, { force = false, note = '' } = {}) =>
    unwrap(apiClient.delete(`${BASE}/runs/${id}/`, {
      params: force ? { force: 'true' } : undefined,
      data: force ? { force: true, note } : undefined,
    })),

  regenerateRun: (id, payload = {}) =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/regenerate/`, payload)),

  // ── External file upload (ValueFrame / Sympa) ──────────────────────────
  uploadExternalFile: (runId, file, fileType = 'valueframe') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('file_type', fileType)
    return unwrap(apiClient.post(`${BASE}/runs/${runId}/upload-external/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },
  listRunUploads: (runId) =>
    unwrap(apiClient.get(`${BASE}/runs/${runId}/uploads/`)),

  refreshRunTotals: (id) =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/refresh-totals/`)),

  refreshRunHoursFromTimesheet: (id, { force = false } = {}) =>
    unwrap(apiClient.post(
      `${BASE}/runs/${id}/refresh-hours-from-timesheet/${force ? '?force=true' : ''}`,
    )),

  hrApproveRun: (id, note = '') =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/hr-approve/`, { note })),

  financeApproveRun: (id, note = '') =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/finance-approve/`, { note })),

  releaseRun: (id, note = '') =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/release/`, { note })),

  revertRun: (id, note = '') =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/revert/`, { note })),

  forceRevertRun: (id, note = '') =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/force-revert/`, { note })),

  updateRun: (id, payload) =>
    unwrap(apiClient.patch(`${BASE}/runs/${id}/`, payload)),

  applyBulkDeduction: (id, payload) =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/bulk-deduction/`, payload)),

  reverseBulkDeduction: (id) =>
    unwrap(apiClient.post(`${BASE}/runs/${id}/bulk-deduction/reverse/`)),

  getRunWorkflowLog: (id) =>
    unwrap(apiClient.get(`${BASE}/runs/${id}/workflow-log/`)),

  downloadRunMasterXlsx: (id) =>
    apiClient.get(`${BASE}/runs/${id}/download-master-xlsx/`, { responseType: 'blob' })
      .then((r) => r.data),

  downloadRunPayslipPack: (id) =>
    apiClient.get(`${BASE}/runs/${id}/download-payslip-pack/`, { responseType: 'blob' })
      .then((r) => r.data),

  uploadRunAdjustments: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return unwrap(apiClient.post(`${BASE}/runs/${id}/upload-adjustments/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },

  importFullXlsx: (file, { year, month }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('year', year)
    fd.append('month', month)
    return unwrap(apiClient.post(`${BASE}/runs/import-full-xlsx/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },

  // ── Payslips ───────────────────────────────────────────────────────────
  listPayslips: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/payslips/`, { params })),

  getPayslip: (id) =>
    unwrap(apiClient.get(`${BASE}/payslips/${id}/`)),

  updatePayslip: (id, payload) =>
    unwrap(apiClient.patch(`${BASE}/payslips/${id}/`, payload)),

  deletePayslip: (id) =>
    unwrap(apiClient.delete(`${BASE}/payslips/${id}/`)),

  downloadPayslipXlsx: (id) =>
    apiClient.get(`${BASE}/payslips/${id}/download-xlsx/`, { responseType: 'blob' })
      .then((r) => r.data),

  getPayslipChangeHistory: (id, params = {}) =>
    unwrap(apiClient.get(`${BASE}/payslips/${id}/change-history/`, { params })),

  // ── Line items ─────────────────────────────────────────────────────────
  listLineItems: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/line-items/`, { params })),

  createLineItem: (payload) =>
    unwrap(apiClient.post(`${BASE}/line-items/`, payload)),

  updateLineItem: (id, payload) =>
    unwrap(apiClient.patch(`${BASE}/line-items/${id}/`, payload)),

  deleteLineItem: (id) =>
    unwrap(apiClient.delete(`${BASE}/line-items/${id}/`)),

  // ── Adjustments ────────────────────────────────────────────────────────
  listAdjustments: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/adjustments/`, { params })),

  createAdjustment: (payload) =>
    unwrap(apiClient.post(`${BASE}/adjustments/`, payload)),

  updateAdjustment: (id, payload) =>
    unwrap(apiClient.patch(`${BASE}/adjustments/${id}/`, payload)),

  deleteAdjustment: (id) =>
    unwrap(apiClient.delete(`${BASE}/adjustments/${id}/`)),

  cancelAdjustment: (id) =>
    unwrap(apiClient.post(`${BASE}/adjustments/${id}/cancel/`)),

  reopenAdjustment: (id) =>
    unwrap(apiClient.post(`${BASE}/adjustments/${id}/reopen/`)),

  bulkCancelAdjustments: (ids) =>
    unwrap(apiClient.post(`${BASE}/adjustments/bulk-cancel/`, { ids })),

  getAdjustmentSummary: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/adjustments/summary/`, { params })),

  // ── Workflow log (read-only) ───────────────────────────────────────────
  listWorkflowLog: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/workflow-log/`, { params })),

  // ── Comparison (external HR file vs run) ───────────────────────────────
  listComparisons: (params = {}) =>
    unwrap(apiClient.get(`${BASE}/comparisons/`, { params })),

  getComparison: (id) =>
    unwrap(apiClient.get(`${BASE}/comparisons/${id}/`)),

  listComparisonRows: (id, params = {}) =>
    unwrap(apiClient.get(`${BASE}/comparisons/${id}/rows/`, { params })),

  uploadComparison: ({ runId, file, sourceLabel = '', sourceProfile = 'auto' }) => {
    const fd = new FormData()
    fd.append('run', runId)
    fd.append('file', file)
    if (sourceLabel)   fd.append('source_label', sourceLabel)
    if (sourceProfile) fd.append('source_profile', sourceProfile)
    return unwrap(apiClient.post(`${BASE}/comparisons/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },

  deleteComparison: (id) =>
    unwrap(apiClient.delete(`${BASE}/comparisons/${id}/`)),

  downloadComparisonXlsx: (id) =>
    apiClient.get(`${BASE}/comparisons/${id}/export-xlsx/`, { responseType: 'blob' })
      .then((r) => r.data),

  getComparisonProfiles: () =>
    unwrap(apiClient.get(`${BASE}/comparisons/profiles/`)),
}

/** Helper for triggering browser download from a blob response. */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default payrollEngineService
