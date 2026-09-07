/**
 * API client for the Instrument IO List Workflow.
 * Thin axios wrapper — all endpoint paths come from the soft-coded config.
 */

import apiClient, { apiClientLongTimeout } from './api.service'
import { IO_LIST_WORKFLOW_API } from '../config/ioListWorkflow.config'

// BUG FIX: bumped from 20 to 30 minutes. See uploadDocument's own
// docstring for the fuller worst-case math this covers (Vision retries x
// Thorough Scan tiling x page count) — Thorough Scan now runs
// VISION_PASSES (2) independent passes over the tile grid per page (see
// pid_vision_extractor.py), i.e. up to 8 real Vision calls per page, not
// 4. At ~45-60s per call (including this module's own retry logic on a
// slow/degraded connection), even a modest 2-page Thorough Scan
// document's worst case (16 calls) can approach the old 20-minute
// ceiling, and anything larger legitimately exceeds it — a real
// re-extract was observed running past 20 minutes and getting cut off by
// this exact timeout, not stuck. 30 minutes is a generous bound, not a
// promise every upload/re-extract takes that long — the vast majority
// (a plain I/O List table, or a P&ID with a working key on Quick Scan)
// finish in seconds; this just stops the CLIENT from giving up while the
// SERVER is still legitimately working.
const IO_LIST_VISION_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000

const ioListWorkflowService = {
  /** Fetch backend config (columns, status codes, feature flags). */
  async getConfig() {
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_API.config)
    return data
  },

  /** List all documents, optionally filtered by chain id or document number. */
  async listDocuments({ chainId, documentNumber } = {}) {
    const params = {}
    if (chainId) params.crs_chain_id = chainId
    if (documentNumber) params.document_number = documentNumber
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_API.documents, { params })
    return data
  },

  /** Retrieve a single document with extracted comments + rows. */
  async getDocument(id) {
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_API.documentById(id))
    return data
  },

  /**
   * Lightweight live-progress poll — used by the ~2s polling loop while a
   * document is 'extracting' instead of the full getDocument() (which
   * serializes every extracted_row/extracted_comment on every tick).
   * Returns real, live numbers straight off the DB row: { id, status,
   * document_type, current_phase, pages_processed, pages_total,
   * vision_calls_done, vision_calls_total, current_rows,
   * current_comments, extraction_error, extraction_started_at } — see
   * views.py's status_view for exactly where each field comes from.
   */
  async getDocumentStatus(id) {
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_API.documentStatus(id))
    return data
  },

  /**
   * Upload — extraction ALWAYS runs in the background now (views.py's
   * create() always dispatches the Celery chord, regardless of page
   * count), so this request itself returns quickly (202 Accepted) once
   * the file is saved and the task is queued — actual extraction
   * progress is tracked separately via getDocumentStatus() polling
   * (IOListWorkflowPage.jsx's ~2s poll loop), not by waiting on this
   * call. Returns: { cached: false, document: {...}, processing: true }
   * (processing derived from the 202 status — see below).
   *
   * Still uses the long-timeout client as a safety margin for the file
   * TRANSFER itself on a slow/degraded connection (a large PDF upload),
   * not for extraction time — extraction used to happen inline here
   * before the always-async change, which is why this constant's
   * comment (and IO_LIST_VISION_UPLOAD_TIMEOUT_MS's own) still walks
   * through the old worst-case Vision-call math; kept generous rather
   * than tightened now, since a slow connection can still make even the
   * upload leg itself take a while. apiClientLongTimeout's shared
   * default (API_TIMEOUT_LONG, 300000ms/5min) is overridden per-call
   * here rather than raised globally, since that client backs other
   * endpoints too that may have their own reasons to fail faster.
   */
  async uploadDocument({ file, metadata = {}, onUploadProgress } = {}) {
    const form = new FormData()
    form.append('pdf_file', file)
    Object.entries(metadata).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, v)
    })
    const { data, status } = await apiClientLongTimeout.post(
      IO_LIST_WORKFLOW_API.documents,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
        timeout: IO_LIST_VISION_UPLOAD_TIMEOUT_MS,
      },
    )
    // BUG FIX: the response body never carried a `processing` field —
    // views.py's create() signals "still running in the background" via
    // the HTTP status alone (202 Accepted — now ALWAYS, for every
    // upload; there is no more synchronous 201 path). Destructuring only
    // `data` above discarded that status entirely, so
    // IOListWorkflowPage.jsx's handleUploaded() — which branches on
    // `result.processing` to decide whether to start polling — always
    // saw `undefined` (falsy) and took the "already done" path even when
    // the document was still status: 'extracting'. Real symptom hit
    // live: a document that took a while got stuck showing "Extracting"
    // / empty stats forever, with real completed data sitting in the
    // database the page never re-fetched.
    return { ...data, processing: status === 202 }
  },

  /** Trigger re-extraction on an existing document. */
  /**
   * `meta` forwards extra fields on the re-extract request — in practice
   * just vision_provider/vision_api_key for a P&ID drawing document (see
   * IOListWorkflowPage.jsx's handleReExtract/handleRowReExtract, which
   * pull these from sessionStorage the same way UploadCard does). Without
   * this, re-extract had no way to ever supply a key at all — it was a
   * bare POST with no body, so it always fell back to local OCR even
   * when the user had already typed a working key in during upload.
   */
  async reExtract(id, meta = {}) {
    const { data, status } = await apiClientLongTimeout.post(
      IO_LIST_WORKFLOW_API.reextract(id),
      meta,
      { timeout: IO_LIST_VISION_UPLOAD_TIMEOUT_MS },
    )
    // Same status->processing fix as uploadDocument() above — re_extract()
    // now ALWAYS dispatches async too (202), same reasoning: real
    // per-page progress via getDocumentStatus() polling instead of a
    // blocking wait with no feedback.
    return { ...data, processing: status === 202 }
  },

  /** Fetch the original PDF as a Blob for an in-app preview. */
  async getOriginalPdf(id) {
    const { data } = await apiClient.get(IO_LIST_WORKFLOW_API.originalPdf(id), {
      responseType: 'blob',
    })
    return data instanceof Blob
      ? data
      : new Blob([data], { type: 'application/pdf' })
  },

  /** Delete a document. */
  async deleteDocument(id) {
    await apiClient.delete(IO_LIST_WORKFLOW_API.documentById(id))
    return true
  },

  /**
   * Download xlsx as a Blob URL.
   * columns: 'all' (default — every canonical column) or 'relevant'
   * (only the columns applicable to this document's own type — matches
   * the I/O List Table preview's "Show relevant columns" toggle; see
   * excel_export.py's own docstring for the backend side).
   */
  async downloadXlsx(id, filename = 'IOList.xlsx', columns = 'all') {
    const resp = await apiClient.get(IO_LIST_WORKFLOW_API.exportXlsx(id), {
      responseType: 'blob',
      params: { columns },
    })
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
   * Patch a single extracted row.
   * Accepts a flat object: any key from IO_PREVIEW_COLUMNS.
   * 'tag_number' and 'page_number' are top-level model fields;
   * all other keys are merged into the row.data JSONField on the backend.
   */
  async updateRow(docId, rowId, patch) {
    const { data } = await apiClient.patch(
      IO_LIST_WORKFLOW_API.patchRow(docId, rowId),
      patch,
    )
    return data
  },

  /**
   * Assign (or unassign, with projectId = null) a document to a project.
   * `project` is a normal writable FK on the document serializer, so this
   * is a plain partial update — no dedicated backend endpoint needed.
   */
  async assignProject(id, projectId) {
    const { data } = await apiClient.patch(
      IO_LIST_WORKFLOW_API.documentById(id),
      { project: projectId },
    )
    return data
  },

  /** Diff two documents (typically two revisions of the same chain). */
  async diff(oldId, newId) {
    const { data } = await apiClient.post(IO_LIST_WORKFLOW_API.diff, {
      old_id: oldId,
      new_id: newId,
    })
    return data
  },

  /**
   * Test a BYOK Vision API key (P&ID drawing extraction) — one minimal
   * text-only call, no image, no cost beyond that ping. Returns
   * { valid: boolean, message: string }.
   */
  async testVisionApiKey(provider, apiKey) {
    const { data } = await apiClient.post(IO_LIST_WORKFLOW_API.visionTestKey, {
      provider, api_key: apiKey,
    })
    return data
  },

  /**
   * Real page count for the pre-extraction time/token estimate
   * (UploadCard, under the Quick/Thorough Scan toggle) — the file's
   * structure is opened server-side with PyMuPDF (no OCR/Vision/
   * rendering), same library the real extraction already trusts. A
   * client-side-only guess was tried first and rejected: verified wrong
   * on real documents already in this system (28 vs an actual 3 pages on
   * one, nothing detected on another). Returns the page count (integer)
   * or null if it couldn't be read (never throws to the caller — the
   * estimate just won't show for that file).
   */
  async getPdfPageCount(file) {
    try {
      const form = new FormData()
      form.append('pdf_file', file)
      const { data } = await apiClient.post(IO_LIST_WORKFLOW_API.pdfPageCount, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return typeof data.page_count === 'number' ? data.page_count : null
    } catch {
      return null
    }
  },
}

export default ioListWorkflowService
