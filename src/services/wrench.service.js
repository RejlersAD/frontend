/**
 * Wrench Integration Service
 * All API calls for the Wrench SmartProject Platform integration.
 * Credentials are never handled on the frontend – only the backend stores them (encrypted).
 * Session tokens are managed server-side (rolling token pattern).
 */
import apiService from './api.service'
import { API_TIMEOUT_WRENCH } from '../config/api.config'

const BASE = '/wrench'

// ── Soft-coded per-endpoint axios overrides ──────────────────────────────────
// Wrench upstream endpoints frequently take >2 min on cold cache or on tenants
// with thousands of transmittals (the REST API ignores pagination params and
// returns the full set every call). Use an extended timeout for these requests
// only — other backend routes keep the default ~120 s.
const _WRENCH_LONG_OPTS = { timeout: API_TIMEOUT_WRENCH }

const wrenchService = {
  // ── Config ───────────────────────────────────────────────────────────────
  /** Retrieve the current (safe) configuration – no credentials returned */
  getConfig: () => apiService.get(`${BASE}/config/`),

  /**
   * Save a new Wrench configuration.
   * @param {object} payload – { base_url, svc_url?, server_id, login_name, password, organization_name, is_active }
   * The password travels over HTTPS and is Fernet-encrypted on the backend before storage.
   * On update, omit `password` to keep the existing one.
   */
  saveConfig: (payload) => apiService.post(`${BASE}/config/`, payload),

  /** Test connectivity – performs a real Wrench login to validate credentials */
  verifyConnection: () => apiService.post(`${BASE}/config/verify/`),

  /**
   * Auto-detect the Wrench DocumentSearch SVC URL by probing common patterns.
   * @param {object} overrides – optional { base_url, svc_url } to probe before saving.
   * Returns { recommended: string|null, candidates: [{url, reachable, status_code, note}] }
   */
  discoverSvcUrl: (overrides = {}) =>
    apiService.post(`${BASE}/config/discover-svc-url/`, overrides),

  /** Delete the active config (super admin only) */
  deleteConfig: (id) => apiService.delete(`${BASE}/config/${id}/`),

  // ── Sync ─────────────────────────────────────────────────────────────────
  /** List recent sync logs */
  getSyncLogs: () => apiService.get(`${BASE}/sync/`),

  /** Get a single sync log */
  getSyncLog: (id) => apiService.get(`${BASE}/sync/${id}/`),

  /**
   * Trigger a sync run.
   * @param {string} direction     – 'wrench_to_radai' | 'radai_to_wrench'
   * @param {string} entity_type  – 'project' | 'document' | 'transmittal' | 'user' | 'all'
   */
  triggerSync: (direction = 'wrench_to_radai', entity_type = 'all') =>
    apiService.post(`${BASE}/sync/trigger/`, { direction, entity_type }),

  // ── Document Search ───────────────────────────────────────────────────────
  /**
   * Search the Wrench document repository via SearchObject API.
   * @param {object} filters – {
   *   discipline?: string,
   *   doc_no?: string,
   *   date_from?: string,  // 'YYYY/MM/DD HH:MM'
   *   date_to?: string,    // 'YYYY/MM/DD HH:MM'
   *   page?: number,
   *   page_size?: number,
   * }
   * Returns { total, documents: [{DOC_NO, DOC_DESCRIPTION, ORDER_NO, ...}] }
   */
  searchDocuments: (filters = {}) =>
    apiService.post(`${BASE}/sync/search-documents/`, filters, _WRENCH_LONG_OPTS),

  /**
   * Fetch unique discipline codes and document numbers from a sample search.
   * Used to populate dropdowns in the Document Search UI.
   * Returns { disciplines: string[], doc_numbers: string[] }
   */
  getDocumentChoices: () => apiService.get(`${BASE}/sync/document-choices/`),

  /**
   * List transmittals from Wrench via the REST WebAPI.
   * @param {number} page
   * @param {number} pageSize
   */
  listTransmittals: (page = 1, pageSize = 100) =>
    apiService.get(`${BASE}/sync/list-transmittals/`, {
      params:  { page, page_size: pageSize },
      timeout: API_TIMEOUT_WRENCH,
    }),

  /**
   * Fetch documents linked to a transmittal via its ORDER_NO (and optionally TRANS_ID).
   * Backend tries transmittal-specific REST paths first, then GenericDocumentList, then DocumentSearch.
   * No SVC URL required for the first two strategies.
   * @param {string} orderNo   – the ORDER_NO field from the transmittal row
   * @param {string} [transId] – the TRANS_ID field (sent as fallback identifier)
   * @param {number} page
   * @param {number} pageSize
   */
  getTransmittalDocuments: (orderNo, transId = '', page = 1, pageSize = 200) =>
    apiService.get(`${BASE}/sync/trans-documents/`, {
      params: {
        order_no:  orderNo,
        ...(transId ? { trans_id: transId } : {}),
        page,
        page_size: pageSize,
      },
      timeout: API_TIMEOUT_WRENCH,
    }),

  /**
   * Run a soft-coded diagnostic for the "empty documents" state of a project.
   * Returns a structured verdict explaining whether the project genuinely has
   * no documents in Wrench, or the empty result is a config/endpoint issue.
   */
  verifyTransmittalDocuments: (orderNo) =>
    apiService.get(`${BASE}/sync/trans-documents/verify/`, {
      params:  { order_no: orderNo },
      timeout: API_TIMEOUT_WRENCH,
    }),

  /**
   * AI-assisted P&ID document recommendation for a project.
   * Backend uses soft-coded pattern scoring (no LLM call).
   * Either orderNo or projectName must be provided.
   */
  getPIDRecommendations: ({ orderNo = '', projectName = '', drawingHint = '', top = 5 } = {}) =>
    apiService.get(`${BASE}/sync/pid-recommendations/`, {
      params: {
        ...(orderNo     ? { order_no:     orderNo }     : {}),
        ...(projectName ? { project_name: projectName } : {}),
        ...(drawingHint ? { drawing_hint: drawingHint } : {}),
        top,
      },
      timeout: API_TIMEOUT_WRENCH,
    }),

  /**
   * Deduplicated Wrench project list for dropdowns (cached on the backend).
   * Pass `{ refresh: true }` to bypass the server-side cache.
   * Returns { total, cached, projects: [{ order_no, order_description, label }] }
   */
  listWrenchProjects: ({ refresh = false } = {}) =>
    apiService.get(`${BASE}/sync/projects/`, {
      params:  refresh ? { refresh: 1 } : {},
      timeout: API_TIMEOUT_WRENCH,
    }),

  // ── S3 Export ─────────────────────────────────────────────────────────────
  /** List S3 export jobs (last 50) */
  getS3Jobs: () => apiService.get(`${BASE}/s3-sync/`),

  /** Get a single S3 job */
  getS3Job: (id) => apiService.get(`${BASE}/s3-sync/${id}/`),

  /**
   * Start a Wrench → S3 export job.
   * @param {object} payload – { mode: 'batch'|'realtime', entity_type: 'transmittals'|'documents'|'all', s3_prefix?: string }
   */
  startS3Sync: (payload) => apiService.post(`${BASE}/s3-sync/start/`, payload),

  /** Stop a running real-time S3 export job */
  stopS3Job: (id) => apiService.post(`${BASE}/s3-sync/${id}/stop/`),

  // ── Project Document Mirror (Wrench → S3, actual file bytes) ──────────────
  /**
   * Start a Wrench → S3 mirror that copies actual document bytes of a project.
   * @param {object} payload – { order_no: string, mode?: 'batch'|'realtime', s3_prefix?: string }
   */
  startProjectExport: (payload) =>
    apiService.post(`${BASE}/s3-sync/project-export/`, payload),

  // ── Library Mirror Watcher (continuous, change-driven sync) ───────────────
  /**
   * Start a continuous Wrench → S3 library mirror for a project.
   * Mirrors the Wrench library hierarchy and re-syncs added/changed docs every tick.
   * @param {object} payload – { order_no: string, s3_prefix?: string }
   */
  startLibraryWatcher: (payload) =>
    apiService.post(`${BASE}/s3-sync/library-watch/start/`, payload),

  /** List recent library watchers, optionally filtered by order_no */
  getLibraryWatchers: (orderNo) =>
    apiService.get(`${BASE}/s3-sync/library-watch/status/`, {
      params: orderNo ? { order_no: orderNo } : undefined,
    }),

  // ── Token Injection ───────────────────────────────────────────────────────
  /**
   * Save a pre-shared Wrench session token directly — bypasses username/password login.
   * Once saved, the backend uses this token for all Wrench API calls; the rolling-token
   * refresh from each Wrench response keeps it current automatically.
   * @param {string} token – raw Wrench session token string
   */
  injectToken: (token) => apiService.post(`${BASE}/config/inject-token/`, { token }),

  // ── Document Download ─────────────────────────────────────────────────────
  /**
   * Download a Wrench document file (proxied through the backend for auth).
   * Backend tries multiple Wrench download endpoints and streams the binary back.
   * @param {string} idocId  – IDOC_ID of the document (required)
   * @param {string} [docNo] – DOC_NO used as fallback filename hint (optional)
   * Returns a blob response for direct save-as in the browser.
   */
  downloadDocument: (idocId, docNo) =>
    apiService.get(`${BASE}/sync/document-download/`, {
      params: { idoc_id: idocId, ...(docNo ? { doc_no: docNo } : {}) },
      responseType: 'blob',
    }),
}

export default wrenchService

