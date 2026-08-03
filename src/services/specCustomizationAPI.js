/**
 * Spec Customization API Service
 * ───────────────────────────────
 * Paper Spec PDF Extraction endpoints, fully soft-coded.
 *
 * Adjust `SPEC_API_CONFIG` to retune endpoints, polling cadence, or limits
 * without touching any UI component.
 */
import apiClient from './api.service';
import axios from 'axios';
import { API_TIMEOUT_UPLOAD } from '../config/api.config';

// ─── Soft-coded upload tuning ───────────────────────────────────────────────
// Override at runtime via Vite env vars without code change:
//   VITE_SPEC_UPLOAD_TIMEOUT_MS    → axios timeout for the upload request (ms)
//   VITE_SPEC_MAX_FILE_MB          → maximum accepted file size (MB)
//   VITE_SPEC_PRESIGNED_UPLOAD     → "off" to force legacy multipart path
//   VITE_SPEC_PRESIGNED_MIN_MB     → only use presigned path for files ≥ this (MB);
//                                    default 50 — tiny files stay on the fast path
// Falls back to the centralized API_TIMEOUT_UPLOAD (environments.json) for the
// timeout, and to 1024 MB (1 GB) for the size cap.
const _envNum = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const _envFlag = (raw, fallback) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase());
};
const SPEC_UPLOAD_TIMEOUT_MS = _envNum(
  import.meta.env?.VITE_SPEC_UPLOAD_TIMEOUT_MS,
  API_TIMEOUT_UPLOAD,
);
const SPEC_MAX_FILE_MB = _envNum(
  import.meta.env?.VITE_SPEC_MAX_FILE_MB,
  1024,
);
const SPEC_PRESIGNED_ENABLED = _envFlag(
  import.meta.env?.VITE_SPEC_PRESIGNED_UPLOAD,
  true,
);
const SPEC_PRESIGNED_MIN_MB = _envNum(
  import.meta.env?.VITE_SPEC_PRESIGNED_MIN_MB,
  50,
);

export const SPEC_API_CONFIG = {
  prefix:           '/spec-customization',
  // Endpoints
  uploadPath:       '/paper-spec/upload/',
  uploadPresignPath:  '/paper-spec/upload/presign/',
  uploadCompletePath: '/paper-spec/upload/complete/',
  jobsPath:         '/paper-spec/jobs/',
  jobDetailPath:    (id) => `/paper-spec/jobs/${id}/`,
  jobClassesPath:   (id) => `/paper-spec/jobs/${id}/classes/`,
  jobCancelPath:    (id) => `/paper-spec/jobs/${id}/cancel/`,
  jobExportPath:    (id, fmt = 'xlsx') => `/paper-spec/jobs/${id}/export/?format=${fmt}`,
  // SmartPlant 3D bulk-load exports (two separate workbooks)
  jobExportSpecPath: (id) => `/paper-spec/jobs/${id}/export-spec/`,
  jobExportCatPath:  (id) => `/paper-spec/jobs/${id}/export-cat/`,
  // Workbook canvas — cross-check & edit SPEC/CAT data before download.
  jobWorkbookPath:     (id) => `/paper-spec/jobs/${id}/workbook/`,
  jobWorkbookCellPath: (id) => `/paper-spec/jobs/${id}/workbook/cell/`,
  jobWorkbookBatchSavePath: (id) => `/paper-spec/jobs/${id}/workbook/batch-save/`,
  jobWorkbookDeleteRowPath: (id) => `/paper-spec/jobs/${id}/workbook/delete-row/`,
  jobWorkbookBulkDeletePath: (id) => `/paper-spec/jobs/${id}/workbook/bulk-delete/`,
  classDetailPath:  (id) => `/paper-spec/classes/${id}/`,
  configPath:       '/config/',

  // Field name expected by the backend `upload_paper_spec` view
  fileFieldName:    'file',

  // Polling cadence for job status (ms)
  pollIntervalMs:   2500,

  // Frontend file limits — superset of formats the backend can normalise to PDF.
  // The authoritative list lives in backend `file_normalizer.SUPPORTED_FORMATS`
  // and is mirrored at runtime via /config/ → `accepted_extensions`.
  acceptedExts:     [
    'pdf',
    'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp', 'gif',
    'docx', 'doc', 'xlsx', 'xlsm', 'xls',
    'txt', 'csv', 'log',
  ],
  // Soft-coded — large engineering PDFs/scans can reach ~1 GB.
  // Override via VITE_SPEC_MAX_FILE_MB env var without redeploy.
  maxFileSizeMB:    SPEC_MAX_FILE_MB,

  // Soft-coded axios timeout for the upload POST. Defaults to the centralized
  // API_TIMEOUT_UPLOAD (frontend/src/config/environments.json → timeout_upload).
  uploadTimeoutMs:  SPEC_UPLOAD_TIMEOUT_MS,

  // Direct-to-S3 presigned-upload feature flags (client-side prefs).
  // Backend authoritatively gates the feature via /config/.presigned_upload.
  presignedUpload: {
    enabled:        SPEC_PRESIGNED_ENABLED,
    minSizeBytes:   SPEC_PRESIGNED_MIN_MB * 1024 * 1024,
  },

  // Soft-coded UI metadata for each format group (icon + label).
  formatGroups: {
    pdf:    { label: 'PDF',         badge: 'bg-rose-100 text-rose-700',     hint: 'Native — fastest path.' },
    image:  { label: 'Image',       badge: 'bg-amber-100 text-amber-700',   hint: 'Scanned page — AI vision will read it.' },
    office: { label: 'Office',      badge: 'bg-sky-100 text-sky-700',       hint: 'Word/Excel — auto-converted to PDF.' },
    text:   { label: 'Text',        badge: 'bg-slate-100 text-slate-700',   hint: 'Plain text — rendered to PDF.' },
  },
  extToGroup: {
    pdf: 'pdf',
    png: 'image', jpg: 'image', jpeg: 'image', tif: 'image', tiff: 'image',
    bmp: 'image', webp: 'image', gif: 'image',
    docx: 'office', doc: 'office', xlsx: 'office', xlsm: 'office', xls: 'office',
    txt: 'text', csv: 'text', log: 'text',
  },
};

const path = (p) => `${SPEC_API_CONFIG.prefix}${p}`;

const specCustomizationAPI = {
  /**
   * Upload a Paper Spec source document and queue an extraction job.
   *
   * Smart dispatcher (soft-coded):
   *   1. If presigned-upload is enabled client-side AND the file is ≥ the
   *      configured minimum, ask the backend for a presigned PUT URL.
   *   2. If the backend says yes, PUT directly to S3 (bypassing Railway's
   *      edge body-size cap) with real upload progress, then notify the
   *      backend to ingest the staged object.
   *   3. Any failure in steps 1–2 (feature disabled, S3 not configured,
   *      presign error, network blip) silently falls back to the legacy
   *      multipart upload below — UX stays identical.
   */
  async upload({ file, projectId, title, documentNumber, engineerName, userOpenaiApiKey, onUploadProgress } = {}) {
    // ── Path A: direct-to-S3 (presigned) ─────────────────────────────
    const wantsPresign =
      SPEC_API_CONFIG.presignedUpload.enabled &&
      file?.size >= SPEC_API_CONFIG.presignedUpload.minSizeBytes;

    if (wantsPresign) {
      try {
        const presigned = await this._tryPresignedUpload({
          file, projectId, title, documentNumber, engineerName, userOpenaiApiKey, onUploadProgress,
        });
        if (presigned) return presigned;
        // presigned === null → backend signalled `enabled: false`; fall through.
      } catch (err) {
        // Network/S3 hiccup — don't fail the user, fall back to multipart.
        // eslint-disable-next-line no-console
        console.warn('[SpecUpload] presigned path failed, falling back:', err?.message || err);
      }
    }

    // ── Path B: legacy multipart upload (default) ────────────────────
    const fd = new FormData();
    fd.append(SPEC_API_CONFIG.fileFieldName, file);
    if (projectId)         fd.append('project_id', projectId);
    if (title)             fd.append('title', title);
    if (documentNumber)    fd.append('document_number', documentNumber);
    if (engineerName)      fd.append('engineer_name', engineerName);              // BYOK attribution
    if (userOpenaiApiKey)  fd.append('user_openai_api_key', userOpenaiApiKey);   // BYOK user API key
    const { data } = await apiClient.post(path(SPEC_API_CONFIG.uploadPath), fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
      // Override the default 120s API timeout — large files (up to ~1 GB)
      // legitimately need many minutes on slow uplinks. Soft-coded above.
      timeout: SPEC_API_CONFIG.uploadTimeoutMs,
      // Lift axios body size cap so multipart payloads aren't truncated.
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });
    return data;
  },

  /**
   * Internal: attempt the 3-step presigned flow.
   * Resolves to the ingest response on success, or ``null`` when the backend
   * explicitly says the feature is unavailable (so the caller knows to fall
   * back rather than retry).
   */
  async _tryPresignedUpload({ file, projectId, title, documentNumber, engineerName, userOpenaiApiKey, onUploadProgress }) {
    // Step 1 — ask backend for a presigned PUT URL.
    const presignResp = await apiClient.post(
      path(SPEC_API_CONFIG.uploadPresignPath),
      {
        filename:     file.name,
        size:         file.size,
        content_type: file.type || 'application/octet-stream',
      },
    );
    const presign = presignResp.data || {};
    if (!presign.enabled) return null;  // backend says no — caller falls back

    // Step 2 — PUT the raw file straight to S3. Use a fresh axios instance
    // (NOT apiClient) so our auth interceptors don't attach Authorization
    // headers, which would invalidate the presigned signature.
    await axios.put(presign.upload_url, file, {
      headers: presign.headers || { 'Content-Type': file.type || 'application/octet-stream' },
      onUploadProgress,
      timeout:          SPEC_API_CONFIG.uploadTimeoutMs,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      // Don't transform; we're sending raw bytes.
      transformRequest: [(data) => data],
    });

    // Step 3 — tell the backend to ingest the staged object.
    const completeResp = await apiClient.post(
      path(SPEC_API_CONFIG.uploadCompletePath),
      {
        s3_key:               presign.s3_key,
        filename:             file.name,
        project_id:           projectId || null,
        title:                title || '',
        document_number:      documentNumber || '',
        engineer_name:        engineerName || '',             // BYOK attribution
        user_openai_api_key:  userOpenaiApiKey || '',        // BYOK user API key
      },
      { timeout: SPEC_API_CONFIG.uploadTimeoutMs },
    );
    return completeResp.data;
  },

  async listJobs() {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobsPath));
    return data;
  },

  async getJob(jobId) {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobDetailPath(jobId)));
    return data;
  },

  async getJobClasses(jobId) {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobClassesPath(jobId)));
    return data;
  },

  async cancelJob(jobId) {
    const { data } = await apiClient.post(path(SPEC_API_CONFIG.jobCancelPath(jobId)));
    return data;
  },

  async getClass(classId) {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.classDetailPath(classId)));
    return data;
  },

  /** Returns a Blob for XLSX, or parsed JSON for JSON exports. */
  async exportJob(jobId, format = 'xlsx') {
    const isBlob = format === 'xlsx';
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobExportPath(jobId, format)), {
      responseType: isBlob ? 'blob' : 'json',
    });
    return data;
  },

  /** SmartPlant 3D — SPEC workbook (piping spec rules). Returns a Blob. */
  async exportSmartplantSpec(jobId) {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobExportSpecPath(jobId)), {
      responseType: 'blob',
    });
    return data;
  },

  /** SmartPlant 3D — CAT workbook (component catalog). Returns a Blob. */
  async exportSmartplantCat(jobId) {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobExportCatPath(jobId)), {
      responseType: 'blob',
    });
    return data;
  },

  /**
   * Workbook canvas — fetch SPEC or CAT contents as JSON
   * (with any cell-level overrides already merged in).
   */
  async getWorkbookPreview(jobId, workbook = 'spec') {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.jobWorkbookPath(jobId)), {
      params: { workbook },
    });
    return data;
  },

  /** Save a single cell override. */
  async saveWorkbookCell(jobId, { workbook, sheet_name, row_key, column_name, value }) {
    const { data } = await apiClient.post(
      path(SPEC_API_CONFIG.jobWorkbookCellPath(jobId)),
      { workbook, sheet_name, row_key, column_name, value },
    );
    return data;
  },

  /** Clear a single cell override (revert to extracted value). */
  async clearWorkbookCell(jobId, { workbook, sheet_name, row_key, column_name }) {
    const { data } = await apiClient.delete(
      path(SPEC_API_CONFIG.jobWorkbookCellPath(jobId)),
      { data: { workbook, sheet_name, row_key, column_name } },
    );
    return data;
  },

  /**
   * Batch save multiple cell overrides at once.
   * 
   * @param {string} jobId - Job ID
   * @param {Array} cells - Array of {workbook, sheet_name, row_key, column_name, value}
   * @returns {Promise<{saved_count, created, updated, s3_snapshot}>}
   */
  async batchSaveWorkbookCells(jobId, cells) {
    const { data } = await apiClient.post(
      path(SPEC_API_CONFIG.jobWorkbookBatchSavePath(jobId)),
      { cells },
    );
    return data;
  },

  /**
   * Delete all cell overrides for a specific row.
   * 
   * @param {string} jobId - Job ID
   * @param {object} params - {workbook, sheet_name, row_key}
   * @returns {Promise<{deleted_count, row_key, columns_deleted}>}
   */
  async deleteWorkbookRow(jobId, { workbook, sheet_name, row_key }) {
    const { data } = await apiClient.delete(
      path(SPEC_API_CONFIG.jobWorkbookDeleteRowPath(jobId)),
      { data: { workbook, sheet_name, row_key } },
    );
    return data;
  },

  /**
   * Delete multiple rows at once.
   * 
   * @param {string} jobId - Job ID
   * @param {object} params - {workbook, sheet_name, row_keys: Array}
   * @returns {Promise<{deleted_rows, deleted_cells, row_keys}>}
   */
  async bulkDeleteWorkbookRows(jobId, { workbook, sheet_name, row_keys }) {
    const { data } = await apiClient.delete(
      path(SPEC_API_CONFIG.jobWorkbookBulkDeletePath(jobId)),
      { data: { workbook, sheet_name, row_keys } },
    );
    return data;
  },

  /**
   * List extraction jobs for a project (for history table).
   * Mirrors electrical_checklist pattern.
   * 
   * @param {string} projectId - Project UUID
   * @param {object} params - {status?, page?, page_size?}
   * @returns {Promise<{success, jobs, pagination}>}
   */
  async listProjectJobs(projectId, params = {}) {
    const { data } = await apiClient.get(`/spec-customization/projects/${projectId}/jobs/`, {
      params,
    });
    return data;
  },

  async getConfig() {
    const { data } = await apiClient.get(path(SPEC_API_CONFIG.configPath));
    return data;
  },
};

export default specCustomizationAPI;
