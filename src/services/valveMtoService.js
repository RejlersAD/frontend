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
    // KNOWN LIMITATION (not fixable from this file alone): apps.valve_mto's
    // ValveMTORow model has no `piping_class` column at all (confirmed by
    // reading models.py directly — its own docstring calls itself "the
    // canonical 17-field schema", which predates this field existing on
    // the extractor/frontend side), and save_rows()'s own field allowlist
    // doesn't include it either. Sending it here is still correct/forward-
    // compatible (the extra key is silently dropped server-side today,
    // same as any unlisted key — it does NOT error), and makes this the
    // single place that needs no further change once a migration adds the
    // column and the allowlist is updated. Until then, piping_class only
    // round-trips within this browser session (localStorage + the
    // in-memory `rows` state), not through the server.
    piping_class: row.piping_class || '',
    rating: row.rating || '',
    // Both real server columns (migration 0003) — unlike piping_class
    // above, these round-trip fully through save AND read-back.
    facing: row.facing || '',
    size_primary: row.size_1 || '',
    size_secondary: row.bore || '',
    size_secondary_2: row.size_2 || '',
    line_number: row.line_number || '',
    line_list_ref: row.line_list || '',
    pid_number: row.pid_number || '',
    description: row.description || '',
    qty_island: island,
    qty_field: field,
    qty_combined: island + field,
    unit: row.unit || '',
    area: row.area || '',
    operational_status: '',
    remarks: row.remarks || '',
    tab: String(row.area || '').toLowerCase(),
  }
}

export function mapServerRowToLocal(row) {
  return {
    id: `v_${row.id}`,
    sl_no: 0,
    area: row.area || '',
    type: row.valve_type || '',
    pms_class: row.pms_class || '',
    // Always blank on read-back — see mapLocalRowToServer's own comment;
    // the server has nowhere to store this yet, so there is nothing to
    // read back here even though it's sent on save.
    piping_class: '',
    rating: row.rating || '',
    facing: row.facing || '',
    size_1: row.size_primary || '',
    size_2: row.size_secondary_2 || '',
    bore: row.size_secondary || '',
    line_number: row.line_number || '',
    line_list: row.line_list_ref || '',
    pid_number: row.pid_number || '',
    valve_tag: row.tag_number || '',
    description: row.description || '',
    qty_island: row.qty_island ?? 0,
    qty_field: row.qty_field ?? 0,
    unit: row.unit || '',
    remarks: row.remarks || '',
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
    const resp = await apiClient.post(`${BASE}${id}/export/`, null, { responseType: 'blob' })
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
    const { data } = await apiClient.post(TEST_KEY_URL, { provider, api_key: apiKey })
    return data
  },
}

export default valveMtoService
