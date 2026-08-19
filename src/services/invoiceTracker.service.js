/**
 * Invoice Tracker API service — Accounts Receivable.
 *
 * Talks to /api/v1/invoice-tracker/. Separate from finance.service.js
 * (which targets A/P). Keep these two services isolated so the A/P
 * approval logic stays untouched.
 */
import apiClient from './api.service'
import { TRACKER_API_CONFIG } from '../config/invoiceTracker.config'

const BASE = TRACKER_API_CONFIG.baseUrl

const buildParams = (filters = {}) => {
  const p = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined) return
    p.append(k, v)
  })
  return p
}

const invoiceTrackerService = {
  async list(filters = {}) {
    const p = buildParams(filters)
    const r = await apiClient.get(`${BASE}/invoices/?${p.toString()}`)
    return r.data
  },

  async retrieve(id) {
    const r = await apiClient.get(`${BASE}/invoices/${id}/`)
    return r.data
  },

  async create(payload) {
    const r = await apiClient.post(`${BASE}/invoices/`, payload)
    return r.data
  },

  async update(id, payload) {
    const r = await apiClient.patch(`${BASE}/invoices/${id}/`, payload)
    return r.data
  },

  async remove(id) {
    const r = await apiClient.delete(`${BASE}/invoices/${id}/`)
    return r.data
  },

  async stats(filters = {}) {
    const p = buildParams(filters)
    const r = await apiClient.get(`${BASE}/invoices/stats/?${p.toString()}`)
    return r.data
  },

  /**
   * Bulk-import a customer-invoice Excel master file.
   *
   * @param {File}    file        the .xlsx upload
   * @param {string}  sheetsCsv   optional comma-separated sheet whitelist
   * @returns import counters: {rows_created, rows_updated, rows_skipped, errors[]}
   */
  async importExcel(file, sheetsCsv = '') {
    const fd = new FormData()
    fd.append('file', file)
    if (sheetsCsv) fd.append('sheets', sheetsCsv)
    const r = await apiClient.post(`${BASE}/invoices/import-excel/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  },

  async uploadAttachment(invoiceId, file) {
    const fd = new FormData()
    fd.append('file', file)
    const r = await apiClient.post(
      `${BASE}/invoices/${invoiceId}/upload-attachment/`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return r.data
  },

  async deleteAttachment(attachmentId) {
    const r = await apiClient.delete(`${BASE}/attachments/${attachmentId}/`)
    return r.data
  },

  /** Fetch the soft-coded finance-engine rules (FX, VAT, ICV, statuses). */
  async getConfig() {
    const r = await apiClient.get(`${BASE}/invoices/config/`)
    return r.data
  },

  /** Re-apply every Excel-derived formula on a single invoice. */
  async recompute(id) {
    const r = await apiClient.post(`${BASE}/invoices/${id}/recompute/`)
    return r.data
  },
}

export default invoiceTrackerService
