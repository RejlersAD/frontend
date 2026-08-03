/**
 * electricalDatasheet.service.js
 * Smart Electrical Datasheet Generator — history, edit, recheck, share, comments.
 */
import apiClient from './api.service';

// Soft-coded base path (same as the existing inline calls in
// SmartElectricalDatasheetPage.jsx use)
const BASE = '/electrical-datasheet/datasheets';

const electricalDatasheetService = {
  // ── History ──────────────────────────────────────────────────────
  listGenerated: (params = {}) =>
    apiClient.get(`${BASE}/generated/`, { params }).then(r => r.data),

  getGenerated: (id) =>
    apiClient.get(`${BASE}/generated/${id}/`).then(r => r.data),

  archiveGenerated: (id) =>
    apiClient.delete(`${BASE}/generated/${id}/archive/`).then(r => r.data),

  // ── Inline cell edit ─────────────────────────────────────────────
  updateCells: (id, edits, source = 'manual') =>
    apiClient.patch(`${BASE}/generated/${id}/cells/`, { edits, source }).then(r => r.data),

  listCellEdits: (id) =>
    apiClient.get(`${BASE}/generated/${id}/cell-edits/`).then(r => r.data),

  // ── Recheck ──────────────────────────────────────────────────────
  recheck: (id) =>
    apiClient.post(`${BASE}/generated/${id}/recheck/`).then(r => r.data),

  // ── AI Suggest ───────────────────────────────────────────────────
  suggestCell: (id, rowIndex) =>
    apiClient.post(`${BASE}/generated/${id}/suggest/`, { row_index: rowIndex }).then(r => r.data),

  // ── Snapshots / revisions ────────────────────────────────────────
  listSnapshots: (id) =>
    apiClient.get(`${BASE}/generated/${id}/snapshots/`).then(r => r.data),

  createSnapshot: (id, label, note = '') =>
    apiClient.post(`${BASE}/generated/${id}/snapshots/`, { label, note }).then(r => r.data),

  compareSnapshots: (id, a, b) =>
    apiClient.get(`${BASE}/generated/${id}/snapshots/${a}/compare/${b}/`).then(r => r.data),

  // ── Comments ────────────────────────────────────────────────────
  listComments: (id) =>
    apiClient.get(`${BASE}/generated/${id}/comments/`).then(r => r.data),

  addComment: (id, text, rowIndex = null, columnKey = '') =>
    apiClient.post(`${BASE}/generated/${id}/comments/`, {
      text, row_index: rowIndex, column_key: columnKey,
    }).then(r => r.data),

  // ── Share ───────────────────────────────────────────────────────
  createShare: (id) =>
    apiClient.post(`${BASE}/generated/${id}/share/`).then(r => r.data),

  // ── Excel download ──────────────────────────────────────────────
  downloadExcel: (id) =>
    apiClient.get(`${BASE}/generated/${id}/excel/`, { responseType: 'blob' }),
};

export default electricalDatasheetService;
