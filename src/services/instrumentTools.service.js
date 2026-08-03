/**
 * Instrument Tools API service.
 *
 * Mirrors backend/apps/instrument_tools/urls.py. Each tool exposes:
 *   • generate(file | rows, { download })  → POST mode=generate
 *   • qc(file | rows)                      → POST mode=qc
 *
 * All endpoints accept either a multipart file upload (`file`) or a JSON
 * `rows: [...]` payload — the same code path serves both.
 */
import apiService from './api.service'

const BASE = '/instrument-tools'

// Soft-coded modes — must match backend services.MODE_* constants.
const MODE_GENERATE = 'generate'
const MODE_QC = 'qc'

// Soft-coded download flag value the backend expects.
const DOWNLOAD_FLAG = '1'

// Soft-coded per-request timeout. PDF / image parsing on the server can take
// noticeably longer than the default 120s, so we grant up to 5 minutes for
// these tools. Override via Vite env var `VITE_INSTRUMENT_TOOLS_TIMEOUT_MS`.
const REQUEST_TIMEOUT_MS = Number(
  import.meta?.env?.VITE_INSTRUMENT_TOOLS_TIMEOUT_MS || 300000
)

/**
 * Build a FormData payload from either a File or a rows array.
 * Soft-coded so all three tool wrappers share the same input contract.
 */
function _buildPayload({ file, rows, mode, download }) {
  if (file instanceof File || file instanceof Blob) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', mode)
    if (download) fd.append('download', DOWNLOAD_FLAG)
    return { data: fd, headers: { 'Content-Type': 'multipart/form-data' } }
  }
  return {
    data: {
      rows: Array.isArray(rows) ? rows : [],
      mode,
      ...(download ? { download: DOWNLOAD_FLAG } : {}),
    },
    headers: { 'Content-Type': 'application/json' },
  }
}

function _makeToolClient(stem) {
  const url = `${BASE}/${stem}/`
  return {
    generate: ({ file, rows, download = false } = {}) => {
      const { data, headers } = _buildPayload({ file, rows, mode: MODE_GENERATE, download })
      return apiService.post(url, data, { headers, timeout: REQUEST_TIMEOUT_MS })
    },
    qc: ({ file, rows } = {}) => {
      const { data, headers } = _buildPayload({ file, rows, mode: MODE_QC, download: false })
      return apiService.post(url, data, { headers, timeout: REQUEST_TIMEOUT_MS })
    },
  }
}

const instrumentToolsService = {
  meta: () => apiService.get(`${BASE}/meta/`),
  ioList:            _makeToolClient('io-list'),
  cableBlockDiagram: _makeToolClient('cable-block-diagram'),
  cableSchedule:     _makeToolClient('cable-schedule'),
}

export default instrumentToolsService
