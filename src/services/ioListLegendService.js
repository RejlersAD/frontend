/**
 * API client for I/O List Legend Sheets — completely independent from
 * P&ID's pidCheckerV2API.js legend endpoints (separate backend table,
 * separate routes, separate symbol-image storage). Seeded once via a
 * backend data migration from P&ID's existing legends; no ongoing
 * connection after that.
 */
import apiClient from './api.service'

const BASE_PATH = '/instrument-io-workflow'
const LEGENDS_ENDPOINT = `${BASE_PATH}/legends/`
const LEGENDS_LOOKUP_ADD_ENDPOINT = `${BASE_PATH}/legends/add-lookup/`
const LEGENDS_LOOKUP_EDIT_ENDPOINT = `${BASE_PATH}/legends/edit-lookup/`
const LEGENDS_LOOKUP_DELETE_ENDPOINT = `${BASE_PATH}/legends/delete-lookup/`
const LEGENDS_LOOKUP_SECTIONS_ENDPOINT = `${BASE_PATH}/legends/lookup-sections/`
const SYMBOL_IMAGES_ENDPOINT = `${BASE_PATH}/symbol-images/`
const SYMBOL_IMAGE_UPLOAD_ENDPOINT = `${BASE_PATH}/symbol-image/upload/`
const SYMBOL_IMAGE_DELETE_ENDPOINT = `${BASE_PATH}/symbol-image/delete/`
const DEFAULT_SYMBOL_IMAGES_ENDPOINT = `${BASE_PATH}/default-symbol-images/`

// I/O-List-specific section list — restructured away from P&ID parity:
// 9 P&ID-only sections dropped, 9 renamed to I/O-List-appropriate
// id/label pairs, plus I/O-List-only additions with no P&ID equivalent
// (instrument_symbols, signal_types, cabinet_locations). No longer kept
// in lockstep with P&ID's own LEGEND_SECTIONS (pidCheckerV2API.js).
export const LEGEND_SECTIONS = [
  { id: 'equipment_register', label: 'Equipment Numbering' },
  { id: 'instrument_index', label: 'Instrument Tagging' },
  { id: 'main_equipment', label: 'Main Equipment' },
  { id: 'valve_types', label: 'Manual Valves' },
  { id: 'actuator_types', label: 'Actuator Types' },
  { id: 'flow_instruments', label: 'Flow Instruments' },
  { id: 'control_valves', label: 'Control Valves' },
  { id: 'signal_line_types', label: 'Line Representation' },
  { id: 'equipment_symbols', label: 'Equipment Symbols' },
  { id: 'instrument_functions', label: 'Instrument Functions' },
  { id: 'instrument_typical_letter', label: 'Instrument Typical Letter' },
  { id: 'instrument_bubbles', label: 'Instrument Bubbles' },
  { id: 'instrument_symbols', label: 'Instruments' },
  { id: 'signal_types', label: 'Signal Types' },
  { id: 'cabinet_locations', label: 'Cabinet/Panel Locations' },
  { id: 'well_instrument_tagging', label: 'Well Instrument Tagging' },
  { id: 'well_equipment_numbering', label: 'Well Equipment Numbering' },
  { id: 'line_numbering', label: 'Line Numbering' },
  { id: 'inline_equipment', label: 'In Line Equipment' },
]

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

// Add/edit/delete ONE lookup entry in the user's active legend for a
// section, without resending the whole definition — backs the "+ Add to
// Legend" quick-add button on an unrecognised Legend Check finding, and
// the Manage Legends modal's own lookup-table row editor.
export async function addLegendLookupEntry({ section, code, description }) {
  const res = await apiClient.post(LEGENDS_LOOKUP_ADD_ENDPOINT, { section, code, description })
  return res.data
}

export async function editLegendLookupEntry({ section, code, description }) {
  const res = await apiClient.put(LEGENDS_LOOKUP_EDIT_ENDPOINT, { section, code, description })
  return res.data
}

export async function deleteLegendLookupEntry({ section, code }) {
  await apiClient.delete(LEGENDS_LOOKUP_DELETE_ENDPOINT, { data: { section, code } })
}

// Which of the current user's active legends have a lookup table at all —
// several sections (equipment_register, well_*) are format/regex-only and
// have no lookup field, so offering them in "Add to Legend"'s Section
// dropdown let a user pick one and then fail on save with "no lookup table
// to add to" no matter what they typed. Filters the dropdown down to only
// sections a code can actually be added to.
export async function listLookupSections() {
  const res = await apiClient.get(LEGENDS_LOOKUP_SECTIONS_ENDPOINT)
  return res.data?.sections || []
}

// Legend symbol reference pictures — user-scoped (not project-scoped, since
// I/O List legends aren't project-scoped either). No shared default-picture
// library or cross-project fallback like P&ID has — just this user's own
// uploads.
export async function getSymbolImages() {
  const res = await apiClient.get(SYMBOL_IMAGES_ENDPOINT)
  return res.data
}

// Repo-committed default pictures (one-time copy of P&ID's static library,
// independently stored under static/io_list_default_symbols/) for whichever
// names the user hasn't uploaded their own picture for.
export async function getDefaultSymbolImages(section, symbolNames) {
  const res = await apiClient.post(DEFAULT_SYMBOL_IMAGES_ENDPOINT, { section, symbol_names: symbolNames })
  return res.data
}

export async function uploadSymbolImage(section, symbolName, file) {
  const form = new FormData()
  form.append('section', section)
  form.append('symbol_name', symbolName)
  form.append('image', file)
  const res = await apiClient.post(SYMBOL_IMAGE_UPLOAD_ENDPOINT, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function deleteSymbolImage(section, symbolName) {
  const res = await apiClient.delete(SYMBOL_IMAGE_DELETE_ENDPOINT, {
    params: { section, symbol_name: symbolName },
  })
  return res.data
}
