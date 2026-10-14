/**
 * API client for Valve MTO server-side persistence (apps.valve_mto).
 *
 * Until this existed, the Valve MTO workspace (ValveMTO.jsx) was ENTIRELY
 * client-persisted — closing the browser silently lost all extracted/
 * hand-corrected data. This mirrors every row saved locally to the server
 * too, so it survives regardless of the browser — localStorage stays in
 * place alongside it as an offline-friendly cache, not the only copy.
 *
 * Field-name mapping: the frontend's local row shape (VALVE_COLUMNS in
 * config/valveMTO.config.js) uses different key names than the server
 * model (apps.valve_mto.models.ValveMTORow) — mapLocalRowToServer/
 * mapServerRowToLocal below are the single source of truth for that
 * translation, so the rest of the page never has to think about it.
 *
 * BUG FIX: `size_2` used to be silently dropped on every server save —
 * the server model originally only had one secondary-size column
 * (`size_secondary`, holding `bore`). The model now also has
 * `size_secondary_2` for `size_2`, so both of the local schema's
 * secondary-size columns round-trip correctly.
 */
import apiClient from './api.service'
import { sizeNBFromLineNumber, allocationTab } from '../config/valveMTO.config'

const BASE = '/valve-mto/projects/'
// BYOK connectivity check — this one endpoint lives on the EXTRACTION app
// (apps.pid_verification), not apps.valve_mto (row persistence, the rest
// of this file) — kept here anyway since this is the single "Valve MTO"
// service the frontend imports from.
const TEST_KEY_URL = '/pid-verification/extract-valve-mto/test-key/'

export function mapLocalRowToServer(row) {
  const island = Number(row.qty_island) || 0
  const field = Number(row.qty_field) || 0
  return {
    tag_number: row.valve_tag || '',
    valve_type: row.type || '',
    pms_class: row.pms_class || '',
    piping_class: row.piping_class || '',
    rating: row.rating || '',
    facing: row.facing || '',
    size_primary: row.size_1 || sizeNBFromLineNumber(row.line_number),
    size_secondary: row.bore || '',
    size_secondary_2: row.size_2 || '',
    line_number: row.line_number || '',
    line_list_ref: row.line_list || '',
    pid_number: row.pid_number || '',
    description: row.description || '',
    qty_island: island,
    qty_field: field,
    qty_combined: island + field,
    qty_observed: row.qty_observed === '' || row.qty_observed == null ? null : Number(row.qty_observed),
    unit: row.unit || '',
    area: row.area || '',
    operational_status: '',
    remarks: row.remarks || '',
    confidence: row.confidence || '',
    location_hint: row.location_hint || '',
    tab: allocationTab(row),
  }
}

export function mapServerRowToLocal(row) {
  return {
    id: `v_${row.id}`,
    sl_no: 0,
    area: row.area || '',
    tab: row.tab || '',
    type: row.valve_type || '',
    pms_class: row.pms_class || '',
    piping_class: row.piping_class || '',
    rating: row.rating || '',
    facing: row.facing || '',
    size_1: row.size_primary || sizeNBFromLineNumber(row.line_number),
    size_2: row.size_secondary_2 || '',
    bore: row.size_secondary || '',
    line_number: row.line_number || '',
    line_list: row.line_list_ref || '',
    pid_number: row.pid_number || '',
    valve_tag: row.tag_number || '',
    description: row.description || '',
    qty_island: row.qty_island ?? 0,
    qty_field: row.qty_field ?? 0,
    qty_observed: row.qty_observed ?? '',
    unit: row.unit || '',
    remarks: row.remarks || '',
    confidence: row.confidence || '',
    location_hint: row.location_hint || '',
  }
}

const valveMtoService = {
  async listProjects() {
    const { data } = await apiClient.get(BASE)
    return data
  },

  async createProject({ projectName, sourcePdfName = '', status = 'extracting' } = {}) {
    const { data } = await apiClient.post(BASE, {
      project_name: projectName, source_pdf_name: sourcePdfName, status,
    })
    return data
  },

  async updateProject(id, patch) {
    const { data } = await apiClient.put(`${BASE}${id}/`, patch)
    return data
  },

  async getProject(id) {
    const { data } = await apiClient.get(`${BASE}${id}/`)
    return data
  },

  async deleteProject(id) {
    await apiClient.delete(`${BASE}${id}/`)
    return true
  },

  /** Bulk-replaces the project's entire row set. `rows` = local-shaped rows. */
  async saveRows(id, localRows) {
    const { data } = await apiClient.post(`${BASE}${id}/save-rows/`, {
      rows: localRows.map(mapLocalRowToServer),
    })
    return data
  },

  async getRows(id) {
    const { data } = await apiClient.get(`${BASE}${id}/rows/`)
    return data.map(mapServerRowToLocal)
  },

  async exportXlsx(id, filename = 'ValveMTO.xlsx') {
    const resp = await apiClient.post(`${BASE}${id}/export/`, {}, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([resp.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  /**
   * Test a BYOK Vision API key (OpenAI or Claude) before committing to an
   * actual extraction run — mirrors
   * ioListWorkflowService.testVisionApiKey's contract exactly. One
   * minimal, cheap call, no PDF/image involved.
   */
  async testApiKey(provider, apiKey) {
    const { data } = await apiClient.post(TEST_KEY_URL, { provider, api_key: apiKey }, {
      sensitiveRequest: true, timeout: 30000,
    })
    return data
  },
}

export default valveMtoService
