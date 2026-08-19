import apiClient from './api.service'

// ═════════════════════════════════════════════════════════════════════
// Soft-coded API config for P&ID Checker V2
// ═════════════════════════════════════════════════════════════════════
const BASE_PATH = '/pid-checker-v2'
const EXTRACT_ENDPOINT = `${BASE_PATH}/extract-line-tags/`
const EXTRACTIONS_ENDPOINT = `${BASE_PATH}/extractions/`
const LEGENDS_ENDPOINT = `${BASE_PATH}/legends/`
const LEGENDS_DEFAULT_TEMPLATE_ENDPOINT = `${BASE_PATH}/legends/default-template/`
const VALIDATE_ENDPOINT = `${BASE_PATH}/validate-line-tags/`
const LINE_LISTS_ENDPOINT = `${BASE_PATH}/line-lists/`
const CROSS_CHECK_ENDPOINT = `${BASE_PATH}/cross-check/`
const EQUIPMENT_LISTS_ENDPOINT = `${BASE_PATH}/equipment-lists/`
const EQUIPMENT_CROSS_CHECK_ENDPOINT = `${BASE_PATH}/equipment-cross-check/`
const INSTRUMENT_INDEXES_ENDPOINT = `${BASE_PATH}/instrument-indexes/`
const INSTRUMENT_CROSS_CHECK_ENDPOINT = `${BASE_PATH}/instrument-cross-check/`
const EXTRACT_EQUIPMENT_TAGS_ENDPOINT = `${BASE_PATH}/extract-equipment-tags/`
const EXTRACT_INSTRUMENT_TAGS_ENDPOINT = `${BASE_PATH}/extract-instrument-tags/`
const EXTRACT_INSTRUMENT_TAGS_STATUS_ENDPOINT = `${BASE_PATH}/extract-instrument-tags/status/`
const USAGE_LIST_ENDPOINT = `${BASE_PATH}/usage/`
const USAGE_SUMMARY_ENDPOINT = `${BASE_PATH}/usage/summary/`
const USAGE_REPORT_ENDPOINT = `${BASE_PATH}/usage/report/`
const UPLOAD_FIELD = 'file'
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000   // OCR can take a few minutes
// Instrument extraction now runs async — polling budget for the client.
const INSTRUMENT_ASYNC_POLL_INTERVAL_MS = 3000
const INSTRUMENT_ASYNC_MAX_WAIT_MS = 60 * 60 * 1000   // 60 min ceiling

// Legend sections (extend when the backend adds more)
export const LEGEND_SECTIONS = [
  { id: 'line_list', label: 'Line List' },
  { id: 'equipment_list', label: 'Equipment List' },
  { id: 'instrument_index', label: 'Instrument Index' },
]

// Extraction modes
export const MODE_OCR = 'ocr'
export const MODE_VISION = 'vision'

// Vision providers exposed to the UI
export const VISION_PROVIDERS = [
  { id: 'openai', label: 'OpenAI GPT-4o',    keyPrefix: 'sk-' },
  { id: 'claude', label: 'Claude Sonnet 4.5', keyPrefix: 'sk-ant-' },
]

/**
 * Upload a P&ID / line-list PDF and receive the extracted line tags.
 * @param {File} file
 * @param {{
 *   mode?: 'ocr'|'vision',
 *   forceOcr?: boolean,
 *   provider?: 'openai'|'claude',
 *   apiKey?: string,
 *   projectId?: number,
 *   onProgress?: (pct:number)=>void
 * }} [opts]
 */
export async function extractLineTags(file, opts = {}) {
  const form = new FormData()
  form.append(UPLOAD_FIELD, file)

  const mode = opts.mode || MODE_OCR
  form.append('mode', mode)

  if (mode === MODE_OCR && opts.forceOcr) {
    form.append('force_ocr', 'true')
  }
  if (mode === MODE_VISION) {
    if (opts.provider) form.append('provider', opts.provider)
    if (opts.apiKey)   form.append('api_key', opts.apiKey)
  }
  if (opts.projectId) {
    form.append('project_id', opts.projectId)
  }

  const res = await apiClient.post(EXTRACT_ENDPOINT, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: REQUEST_TIMEOUT_MS,
    onUploadProgress: (evt) => {
      if (opts.onProgress && evt.total) {
        opts.onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
  return res.data
}

/** List the current user's saved extractions (most recent first). */
export async function listExtractions() {
  const res = await apiClient.get(EXTRACTIONS_ENDPOINT)
  return res.data   // array of extraction summaries
}

/** Retrieve one saved extraction with its full tag list. */
export async function getExtraction(extractionId) {
  const res = await apiClient.get(`${EXTRACTIONS_ENDPOINT}${extractionId}/`)
  return res.data
}

/** Delete a saved extraction. */
export async function deleteExtraction(extractionId) {
  await apiClient.delete(`${EXTRACTIONS_ENDPOINT}${extractionId}/`)
}

// ═════════════════════════════════════════════════════════════════════
// Legend Sheets — user-owned per-section rule sets
// ═════════════════════════════════════════════════════════════════════

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

export async function getLegendDefaultTemplate(section) {
  const res = await apiClient.get(LEGENDS_DEFAULT_TEMPLATE_ENDPOINT, { params: { section } })
  return res.data
}

/**
 * Validate a list of tags against the active Legend Sheet for a section.
 * @param {{
 *   tags: Array<{tag:string}>,
 *   section?: string,
 *   legendId?: string,
 *   useAi?: boolean,
 *   provider?: 'openai'|'claude',
 *   apiKey?: string,
 * }} payload
 */
export async function validateLineTags(payload) {
  const body = {
    tags: payload.tags || [],
    section: payload.section || 'line_list',
    use_ai: Boolean(payload.useAi),
  }
  if (payload.legendId) body.legend_id = payload.legendId
  if (payload.useAi) {
    body.vision_provider = payload.provider
    body.vision_api_key = payload.apiKey
  }
  const res = await apiClient.post(VALIDATE_ENDPOINT, body, { timeout: REQUEST_TIMEOUT_MS })
  return res.data
}

// ═════════════════════════════════════════════════════════════════════
// Master Line List (Excel) — upload + cross-check vs P&ID extraction
// ═════════════════════════════════════════════════════════════════════

export async function uploadLineList(file, { onProgress } = {}) {
  const form = new FormData()
  form.append(UPLOAD_FIELD, file)
  const res = await apiClient.post(LINE_LISTS_ENDPOINT, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: REQUEST_TIMEOUT_MS,
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
  return res.data
}

export async function listLineLists() {
  const res = await apiClient.get(LINE_LISTS_ENDPOINT)
  return res.data
}

export async function getLineList(lineListId) {
  const res = await apiClient.get(`${LINE_LISTS_ENDPOINT}${lineListId}/`)
  return res.data
}

export async function deleteLineList(lineListId) {
  await apiClient.delete(`${LINE_LISTS_ENDPOINT}${lineListId}/`)
}

export async function activateLineList(lineListId) {
  const res = await apiClient.post(`${LINE_LISTS_ENDPOINT}${lineListId}/activate/`)
  return res.data
}

/**
 * Cross-check extracted P&ID tags against the active (or specified) Line List.
 * @param {{
 *   tags: Array<{tag:string, size?:string, service_code?:string, spec?:string, serial?:string}>,
 *   lineListId?: string,
 *   useAi?: boolean,
 *   provider?: 'openai'|'claude',
 *   apiKey?: string,
 * }} payload
 */
export async function crossCheck(payload) {
  const body = {
    tags: payload.tags || [],
    use_ai: Boolean(payload.useAi),
  }
  if (payload.lineListId) body.line_list_id = payload.lineListId
  if (payload.useAi) {
    body.vision_provider = payload.provider
    body.vision_api_key = payload.apiKey
  }
  const res = await apiClient.post(CROSS_CHECK_ENDPOINT, body, { timeout: REQUEST_TIMEOUT_MS })
  return res.data
}

// ═════════════════════════════════════════════════════════════════════
// Master Equipment List (Excel) — upload + cross-check vs P&ID equipment tags
// ═════════════════════════════════════════════════════════════════════

// Soft-coded pattern for detecting equipment tags among extracted P&ID tokens.
// Matches shapes like: V-803-TF, P-101A, E-2001, C-501, T-102-A, TK-3001, HX-45
export const EQUIPMENT_TAG_REGEX = /^[A-Z]{1,3}-\d{2,4}([A-Z]?|-[A-Z0-9]{1,4})$/

export function filterEquipmentTags(tokens) {
  if (!Array.isArray(tokens)) return []
  const seen = new Set()
  const out = []
  for (const raw of tokens) {
    if (raw == null) continue
    const s = String(raw).trim().toUpperCase()
    if (!s || seen.has(s)) continue
    if (EQUIPMENT_TAG_REGEX.test(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  return out
}

export async function uploadEquipmentList(file, { onProgress } = {}) {
  const form = new FormData()
  form.append(UPLOAD_FIELD, file)
  const res = await apiClient.post(EQUIPMENT_LISTS_ENDPOINT, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: REQUEST_TIMEOUT_MS,
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
  return res.data
}

export async function listEquipmentLists() {
  const res = await apiClient.get(EQUIPMENT_LISTS_ENDPOINT)
  return res.data
}

export async function getEquipmentList(equipmentListId) {
  const res = await apiClient.get(`${EQUIPMENT_LISTS_ENDPOINT}${equipmentListId}/`)
  return res.data
}

export async function deleteEquipmentList(equipmentListId) {
  await apiClient.delete(`${EQUIPMENT_LISTS_ENDPOINT}${equipmentListId}/`)
}

export async function activateEquipmentList(equipmentListId) {
  const res = await apiClient.post(`${EQUIPMENT_LISTS_ENDPOINT}${equipmentListId}/activate/`)
  return res.data
}

/**
 * Cross-check P&ID equipment tags against the active (or specified) Equipment List.
 * @param {{
 *   equipmentTags: string[],
 *   equipmentListId?: string,
 *   useAi?: boolean,
 *   provider?: 'openai'|'claude',
 *   apiKey?: string,
 * }} payload
 */
export async function equipmentCrossCheck(payload) {
  const body = {
    equipment_tags: payload.equipmentTags || [],
    use_ai: Boolean(payload.useAi),
  }
  if (payload.equipmentListId) body.equipment_list_id = payload.equipmentListId
  // Attribute-level cross-check requires BYOK credentials on backend, so
  // whenever equipmentAttributes are supplied we also forward provider/key.
  const hasAttrs = payload.equipmentAttributes
    && typeof payload.equipmentAttributes === 'object'
    && Object.keys(payload.equipmentAttributes).length > 0
  if (payload.useAi || hasAttrs) {
    body.vision_provider = payload.provider
    body.vision_api_key = payload.apiKey
  }
  if (hasAttrs) {
    body.equipment_attributes = payload.equipmentAttributes
  }
  const res = await apiClient.post(EQUIPMENT_CROSS_CHECK_ENDPOINT, body, { timeout: REQUEST_TIMEOUT_MS })
  return res.data
}

// ── Instrument Index ──────────────────────────────────
// Soft-coded pattern for detecting instrument tags among extracted P&ID tokens.
// Matches ISA-5.1-style shapes such as: LT-8019 TF, PT-8003ATF, PCV-8004B TF,
// FE-8001, TT-1023, XV-2001A, SDV-8003TF — and un-hyphenated variants
// (SDV8005, FIC8002, PI8003A) which are common on many drawings.
export const INSTRUMENT_TAG_REGEX = /^[A-Z]{1,4}-?\d{2,4}[A-Z]?(?:\s?[A-Z]{2})?$/

export function filterInstrumentTags(tokens) {
  if (!Array.isArray(tokens)) return []
  const seen = new Set()
  const out = []
  for (const raw of tokens) {
    if (raw == null) continue
    const upper = String(raw).trim().toUpperCase()
    // canonical dedup key: strip whitespace AND hyphens.
    const canonical = upper.replace(/[\s-]+/g, '')
    if (!canonical) continue
    if (!(INSTRUMENT_TAG_REGEX.test(upper) || INSTRUMENT_TAG_REGEX.test(canonical))) continue
    if (seen.has(canonical)) continue
    seen.add(canonical)
    // preserve hyphen if the drawing had one, else keep it fused
    out.push(upper.replace(/\s+/g, ''))
  }
  return out
}

export async function uploadInstrumentIndex(file, { onProgress } = {}) {
  const form = new FormData()
  form.append(UPLOAD_FIELD, file)
  const res = await apiClient.post(INSTRUMENT_INDEXES_ENDPOINT, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: REQUEST_TIMEOUT_MS,
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
  return res.data
}

export async function listInstrumentIndexes() {
  const res = await apiClient.get(INSTRUMENT_INDEXES_ENDPOINT)
  return res.data
}

export async function getInstrumentIndex(instrumentIndexId) {
  const res = await apiClient.get(`${INSTRUMENT_INDEXES_ENDPOINT}${instrumentIndexId}/`)
  return res.data
}

export async function deleteInstrumentIndex(instrumentIndexId) {
  await apiClient.delete(`${INSTRUMENT_INDEXES_ENDPOINT}${instrumentIndexId}/`)
}

export async function activateInstrumentIndex(instrumentIndexId) {
  const res = await apiClient.post(`${INSTRUMENT_INDEXES_ENDPOINT}${instrumentIndexId}/activate/`)
  return res.data
}

/**
 * Cross-check P&ID instrument tags against the active (or specified) Instrument Index.
 * @param {{
 *   instrumentTags: string[],
 *   instrumentIndexId?: string,
 *   useAi?: boolean,
 *   provider?: 'openai'|'claude',
 *   apiKey?: string,
 * }} payload
 */
export async function instrumentCrossCheck(payload) {
  const body = {
    instrument_tags: payload.instrumentTags || [],
    use_ai: Boolean(payload.useAi),
  }
  if (payload.instrumentIndexId) body.instrument_index_id = payload.instrumentIndexId
  const hasAttrs = payload.instrumentAttributes
    && typeof payload.instrumentAttributes === 'object'
    && Object.keys(payload.instrumentAttributes).length > 0
  if (payload.useAi || hasAttrs) {
    body.vision_provider = payload.provider
    body.vision_api_key = payload.apiKey
  }
  if (hasAttrs) {
    body.instrument_attributes = payload.instrumentAttributes
  }
  const res = await apiClient.post(INSTRUMENT_CROSS_CHECK_ENDPOINT, body, { timeout: REQUEST_TIMEOUT_MS })
  return res.data
}

/**
 * BYOK Vision extraction of EQUIPMENT tags directly from the P&ID PDF.
 * Independent of the main line-tag extraction; used to pre-populate the
 * Equipment cross-check panel with high-accuracy equipment tags.
 * @param {File} file
 * @param {{ provider: 'openai'|'claude', apiKey: string }} opts
 */
export async function extractEquipmentTagsFromPid(file, { provider, apiKey } = {}) {
  const form = new FormData()
  form.append(UPLOAD_FIELD, file)
  form.append('provider', provider || '')
  form.append('api_key', apiKey || '')
  const res = await apiClient.post(EXTRACT_EQUIPMENT_TAGS_ENDPOINT, form, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

/**
 * BYOK Vision extraction of INSTRUMENT tags directly from the P&ID PDF.
 *
 * The backend runs this as an async Celery job (HTTP 202 + poll) so heavy
 * drawings don't hit the Gunicorn worker timeout. This helper handles the
 * dispatch + polling transparently and resolves with the final tag payload,
 * matching the old synchronous contract.
 *
 * @param {File} file
 * @param {{ provider: 'openai'|'claude', apiKey: string, onProgress?: (pct:number, msg:string) => void, signal?: AbortSignal }} opts
 */
export async function extractInstrumentTagsFromPid(file, { provider, apiKey, onProgress, signal } = {}) {
  const form = new FormData()
  form.append(UPLOAD_FIELD, file)
  form.append('provider', provider || '')
  form.append('api_key', apiKey || '')
  const dispatch = await apiClient.post(EXTRACT_INSTRUMENT_TAGS_ENDPOINT, form, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
  })
  const data = dispatch.data || {}
  // Backward-compat: legacy sync response returns tags directly.
  if (!data.async || !data.job_id) return data

  const jobId = data.job_id
  const started = Date.now()
  if (typeof onProgress === 'function') onProgress(1, 'Queued for extraction…')

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal && signal.aborted) throw new Error('Cancelled')
    if (Date.now() - started > INSTRUMENT_ASYNC_MAX_WAIT_MS) {
      throw new Error('Instrument extraction is still running after 60 min — please retry later.')
    }
    await new Promise((r) => setTimeout(r, INSTRUMENT_ASYNC_POLL_INTERVAL_MS))
    let poll
    try {
      poll = await apiClient.get(`${EXTRACT_INSTRUMENT_TAGS_STATUS_ENDPOINT}${jobId}/`, { signal })
    } catch (err) {
      // Transient network / gateway blip — keep polling.
      if (err?.response?.status === 404) {
        throw new Error('Extraction job expired before completing.')
      }
      continue
    }
    const body = poll.data || {}
    if (body.status === 'completed') {
      if (typeof onProgress === 'function') onProgress(100, 'Complete')
      return body
    }
    if (body.status === 'failed') {
      throw new Error(body.error || 'vision extraction failed')
    }
    if (typeof onProgress === 'function') {
      onProgress(Number(body.progress) || 0, body.message || 'Working…')
    }
  }
}

// ─── Token usage / cost tracking ─────────────────────────────────────
/**
 * List recent token-usage rows for the current user.
 * @param {{ feature?:string, since?:string, until?:string, pageSize?:number }} [opts]
 */
export async function listUsage(opts = {}) {
  const params = {}
  if (opts.feature)  params.feature = opts.feature
  if (opts.since)    params.since = opts.since
  if (opts.until)    params.until = opts.until
  if (opts.pageSize) params.page_size = opts.pageSize
  const res = await apiClient.get(USAGE_LIST_ENDPOINT, { params })
  return res.data
}

/** Aggregate usage summary (totals + by feature + by model). */
export async function getUsageSummary({ since, until } = {}) {
  const params = {}
  if (since) params.since = since
  if (until) params.until = until
  const res = await apiClient.get(USAGE_SUMMARY_ENDPOINT, { params })
  return res.data
}

/**
 * Download a consolidated token report as Excel or PDF.
 * Triggers a browser download.
 */
export async function downloadTokenReport({ format = 'xlsx', since, until } = {}) {
  const res = await apiClient.post(
    USAGE_REPORT_ENDPOINT,
    { format, since, until },
    { responseType: 'blob' },
  )
  const cd = res.headers['content-disposition'] || ''
  const m = /filename="?([^"]+)"?/i.exec(cd)
  const filename = m ? m[1] : `pid_checker_v2_token_report.${format}`
  const blob = new Blob([res.data], {
    type: format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { filename }
}

export default {
  extractLineTags, listExtractions, getExtraction, deleteExtraction,
  listLegends, getLegend, createLegend, updateLegend, deleteLegend,
  activateLegend, getLegendDefaultTemplate,
  validateLineTags,
  uploadLineList, listLineLists, getLineList, deleteLineList, activateLineList,
  crossCheck,
  uploadEquipmentList, listEquipmentLists, getEquipmentList, deleteEquipmentList, activateEquipmentList,
  equipmentCrossCheck, filterEquipmentTags, EQUIPMENT_TAG_REGEX,
  uploadInstrumentIndex, listInstrumentIndexes, getInstrumentIndex, deleteInstrumentIndex, activateInstrumentIndex,
  instrumentCrossCheck, filterInstrumentTags, INSTRUMENT_TAG_REGEX,
  extractEquipmentTagsFromPid, extractInstrumentTagsFromPid,
  listUsage, getUsageSummary, downloadTokenReport,
  MODE_OCR, MODE_VISION, VISION_PROVIDERS, LEGEND_SECTIONS,
}
