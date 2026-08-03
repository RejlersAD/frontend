/**
 * API client for the Instrument IO List Workflow.
 * Thin axios wrapper — all endpoint paths come from the soft-coded config.
 */

import apiClient, { apiClientLongTimeout } from './api.service'
import { IO_LIST_WORKFLOW_API } from '../config/ioListWorkflow.config'

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
   * Upload + extract a PDF. Returns:
   *   { cached: true|false, document: {...} }
   * Uses the long-timeout client because extraction is synchronous (typically
   * fast — PyMuPDF only — but allow up to ~25 minutes for very large PDFs).
   */
  async uploadDocument({ file, metadata = {}, onUploadProgress } = {}) {
    const form = new FormData()
    form.append('pdf_file', file)
    Object.entries(metadata).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, v)
    })
    const { data } = await apiClientLongTimeout.post(
      IO_LIST_WORKFLOW_API.documents,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      },
    )
    return data
  },

  /** Trigger re-extraction on an existing document. */
  async reExtract(id) {
    const { data } = await apiClientLongTimeout.post(
      IO_LIST_WORKFLOW_API.reextract(id),
    )
    return data
  },

  /** Delete a document. */
  async deleteDocument(id) {
    await apiClient.delete(IO_LIST_WORKFLOW_API.documentById(id))
    return true
  },

  /** Download xlsx as a Blob URL. */
  async downloadXlsx(id, filename = 'IOList.xlsx') {
    const resp = await apiClient.get(IO_LIST_WORKFLOW_API.exportXlsx(id), {
      responseType: 'blob',
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

  /** Diff two documents (typically two revisions of the same chain). */
  async diff(oldId, newId) {
    const { data } = await apiClient.post(IO_LIST_WORKFLOW_API.diff, {
      old_id: oldId,
      new_id: newId,
    })
    return data
  },
}

export default ioListWorkflowService
