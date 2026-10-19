/**
 * API client for Valve MTO's OWN, fully isolated legend/reference-data
 * table (apps.valve_mto.models.ValveMTOLegend) — NOT
 * apps.pid_checker_v2's PidCheckerV2LegendSheet (used by P&ID
 * Verification V1/V2, via services/pidCheckerV2API.js).
 *
 * Architectural fix, this session: that shared pid_checker_v2 table has
 * only ONE active legend per (user, section), with no per-module
 * dimension at all, so Valve MTO's own auto-created defaults needing to
 * be active to feed the Vision prompt (see piping_valve_mto_extractor.py's
 * _build_legend_context) kept silently becoming the active legend in
 * P&ID V1/V2 too — confirmed real, repeatedly reported. This service
 * talks to Valve MTO's own table instead, where activating a legend can
 * never affect P&ID V1/V2, by construction.
 *
 * Same response shape as pidCheckerV2API.js's legend functions on
 * purpose (legend_id, section, name, description, definition, is_active,
 * created_at, updated_at) — LegendSheetsModal.jsx/ValveMTO.jsx were
 * written against that shape, so only the API module being called needed
 * to change, not the shape consumed.
 */
import apiClient from './api.service'

const LEGENDS_ENDPOINT = '/valve-mto/legends/'

export async function listLegends(section) {
  const params = section ? { section } : undefined
  const res = await apiClient.get(LEGENDS_ENDPOINT, { params })
  return res.data
}

export async function getLegend(legendId) {
  const res = await apiClient.get(`${LEGENDS_ENDPOINT}${legendId}/`)
  return res.data
}

export async function createLegend(payload) {
  const res = await apiClient.post(LEGENDS_ENDPOINT, payload)
  return res.data
}

export async function updateLegend(legendId, payload) {
  const res = await apiClient.patch(`${LEGENDS_ENDPOINT}${legendId}/`, payload)
  return res.data
}

export async function deleteLegend(legendId) {
  await apiClient.delete(`${LEGENDS_ENDPOINT}${legendId}/`)
}

export async function activateLegend(legendId) {
  const res = await apiClient.post(`${LEGENDS_ENDPOINT}${legendId}/activate/`)
  return res.data
}

export async function listActiveLegends(section) {
  const params = section ? { section } : undefined
  const res = await apiClient.get(`${LEGENDS_ENDPOINT}active/`, { params })
  return res.data
}

// SOFT-CODED: same reasoning as pidCheckerV2API.LEGEND_WORKBOOK_TIMEOUT_MS —
// S3 image archival makes production imports slower than the 120 s default.
const LEGEND_WORKBOOK_TIMEOUT_MS = 10 * 60 * 1000   // 10 min

export async function previewLegendWorkbook({ file }) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await apiClient.post(`${LEGENDS_ENDPOINT}workbook-preview/`, body, { timeout: LEGEND_WORKBOOK_TIMEOUT_MS })
  return data
}

export async function importLegendWorkbook({ file, sheetMap }) {
  const body = new FormData()
  body.append('file', file)
  body.append('sheet_map', JSON.stringify(sheetMap))
  const { data } = await apiClient.post(`${LEGENDS_ENDPOINT}workbook-import/`, body, { timeout: LEGEND_WORKBOOK_TIMEOUT_MS })
  return data
}
