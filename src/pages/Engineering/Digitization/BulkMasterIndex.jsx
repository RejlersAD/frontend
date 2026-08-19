/**
 * BulkMasterIndex — NONTEF Master Index bulk digitization (expert UX).
 *
 * Single-screen "drop & go" flow (no wizard). Drop a folder, watch extraction
 * run, review/edit the grid, export Excel — all on one page.
 *
 * All UX rules below are soft-coded constants so we can tune without touching
 * component logic. Backend endpoints and behaviour are unchanged.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  FolderOpenIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import axios from 'axios';

// ---------------------------------------------------------------------------
// SOFT-CODED constants
// ---------------------------------------------------------------------------

const BULK_API = '/non-teff/batch';
const POLL_INTERVAL_MS = 2500;
const MAX_CELL_WIDTH_PX = 320;
const PAGE_SIZE = 100;

// Columns whose value is a comma-joined list — rendered as a chip
// grid instead of a single truncated line. Soft-coded:
//   • `columnKeys`     opt-in column allow-list
//   • `columnsPerRow`  per-column override of how many chips fit per row
//                      (CSS grid — chips share equal-width tracks so the
//                      cell height stays compact for short numeric values
//                      like Unit while still wrapping cleanly for long
//                      alpha-num Tag tokens).
//   • `maxVisible`     per-column overflow threshold; remainder collapses
//                      into a "+N more" pill (tooltip lists the rest).
//   • `cellWidthPx`    per-column max cell width.
const MULTI_VALUE_DISPLAY = {
  enabled: true,
  columnKeys: ['tag', 'unit', 'contractor_ref'],
  separator: /\s*,\s*/,
  // Defaults applied when a column-specific override is absent.
  defaults: {
    columnsPerRow: 1,          // 1 = flex-wrap (legacy behaviour)
    maxVisible:    12,
    cellWidthPx:   360,
  },
  // Per-column tuning. Unit values are short (≤5 digits) so 5 per row
  // collapses the column height dramatically without truncating any
  // value. Tag values are long & variable-width so we let them flex.
  // Contractor Doc References are mid-length codes (e.g.
  // "5610Y-STC-01-1381-026") — 2 per row keeps cells compact without
  // wrapping any individual reference.
  perColumn: {
    unit:           { columnsPerRow: 5, maxVisible: 25, cellWidthPx: 220 },
    tag:            { columnsPerRow: 1, maxVisible: 12, cellWidthPx: 360 },
    contractor_ref: { columnsPerRow: 2, maxVisible: 12, cellWidthPx: 380 },
  },
  chipClass:
    'inline-flex items-center justify-center px-1.5 py-0.5 rounded ' +
    'bg-emerald-50 text-emerald-800 border border-emerald-200 ' +
    'text-[11px] font-medium leading-tight whitespace-nowrap',
};

// ─── Upload tuning (soft-coded) ──────────────────────────────────────────
// Big folders would blow past axios' default 120s global timeout, so we:
//   1. Split the upload into chunks (count-based OR size-based, whichever hits first)
//   2. Upload chunks sequentially — backend appends items to the same batch
//   3. Compute a DYNAMIC per-request timeout from payload size + file count
//   4. Retry transient failures with exponential backoff
const UPLOAD_CHUNK_FILES   = 20;                // files per POST
const UPLOAD_CHUNK_BYTES   = 80 * 1024 * 1024;  // or ≈80 MB per POST, whichever is smaller
const UPLOAD_RETRY_COUNT   = 2;                 // retry a failed chunk before aborting

// Dynamic timeout formula per chunk — tuned for slow uplinks and server-side
// SHA-256 + disk writes. Can be overridden via window.__BULK_UPLOAD_TUNING__.
// Final timeout = clamp(base + bytes/throughput + files*perFile, min, max)
const UPLOAD_TIMEOUT_TUNING = {
  baseMs:             30 * 1000,         // 30 s setup budget
  minMs:              2  * 60 * 1000,    // 2 min floor (never less than this)
  maxMs:              60 * 60 * 1000,    // 60 min ceiling (per chunk)
  bytesPerSecondMin:  256 * 1024,        // assume ≥256 KB/s effective (very pessimistic)
  perFileMs:          1500,              // ≈1.5 s/file server overhead (hash + write + insert)
};

// Compute dynamic timeout for one chunk based on its actual size+count.
const computeChunkTimeout = (fileCount, byteCount) => {
  const t = (typeof window !== 'undefined' && window.__BULK_UPLOAD_TUNING__) || UPLOAD_TIMEOUT_TUNING;
  const transferMs = (byteCount / t.bytesPerSecondMin) * 1000;
  const serverMs   = fileCount * t.perFileMs;
  const raw        = t.baseMs + transferMs + serverMs;
  return Math.min(t.maxMs, Math.max(t.minMs, Math.round(raw)));
};

// ─── Direct-to-S3 presigned upload (large-file path) ─────────────────────
// Railway's edge proxy caps request bodies at ~100-500 MB and request
// duration at ~5-10 min. A 2 GB multipart POST is architecturally
// impossible — the edge kills the upload mid-flight and the browser
// surfaces the missing CORS headers as a "CORS policy" error.
//
// Solution: for any file ≥ NONTEFF_PRESIGNED.minSizeBytes, we ask the
// backend for a presigned PUT URL, upload the blob STRAIGHT TO S3
// (bypassing Railway entirely), then call /upload/complete/ with the
// staged S3 keys so the backend ingests them like a normal upload.
//
// Soft-coded — override via Vite env without code change:
//   VITE_NONTEFF_PRESIGNED_UPLOAD   "false" to disable (forces legacy path)
//   VITE_NONTEFF_PRESIGNED_MIN_MB   threshold MB (default 50)
//   VITE_NONTEFF_PUT_TIMEOUT_MS     S3 PUT timeout per file (default 60 min)
const _ntEnvNum = (raw, fallback) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const _ntEnvFlag = (raw, fallback) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase());
};
const NONTEFF_PRESIGNED = {
  enabled:       _ntEnvFlag(import.meta.env?.VITE_NONTEFF_PRESIGNED_UPLOAD, true),
  minSizeBytes:  _ntEnvNum(import.meta.env?.VITE_NONTEFF_PRESIGNED_MIN_MB, 50) * 1024 * 1024,
  putTimeoutMs:  _ntEnvNum(import.meta.env?.VITE_NONTEFF_PUT_TIMEOUT_MS, 60 * 60 * 1000),
  endpoints: {
    presign:  (bid) => `${BULK_API}/${bid}/upload/presign/`,
    complete: (bid) => `${BULK_API}/${bid}/upload/complete/`,
  },
};

/**
 * Upload ONE file directly to S3 via a presigned PUT URL.
 * Returns the {s3_key, file_name, relative_path, size} record needed by
 * the `/upload/complete/` endpoint. Throws on any failure so the caller
 * can fall back to the legacy multipart path.
 *
 * The S3 PUT uses a fresh `axios` instance (NOT `apiClient`) so the JWT
 * Authorization header isn't sent — S3 would reject the signature otherwise.
 * `transformRequest: [(d) => d]` keeps axios from JSON-stringifying the Blob.
 */
const _uploadOneFileToS3 = async (batchId, file, onProgress) => {
  const presignRes = await apiClient.post(
    NONTEFF_PRESIGNED.endpoints.presign(batchId),
    {
      filename:      file.name,
      content_type:  file.type || 'application/octet-stream',
      size:          file.size,
      relative_path: file.webkitRelativePath || file.name,
    },
    { timeout: 30000 },
  );

  const p = presignRes?.data || {};
  if (!p.enabled || !p.upload_url || !p.s3_key) {
    const reason = p.reason || 'presign disabled';
    const err = new Error(`presign not available: ${reason}`);
    err.code = 'PRESIGN_DISABLED';
    throw err;
  }

  await axios.put(p.upload_url, file, {
    headers: p.headers || { 'Content-Type': file.type || 'application/octet-stream' },
    timeout: NONTEFF_PRESIGNED.putTimeoutMs,
    transformRequest: [(d) => d],            // do not stringify the Blob
    transitional: { clarifyTimeoutError: true },
    onUploadProgress: (ev) => {
      if (!ev?.total) return;
      onProgress?.(Math.min(ev.loaded, ev.total));
    },
  });

  return {
    s3_key:        p.s3_key,
    file_name:     file.name,
    relative_path: file.webkitRelativePath || file.name,
    size:          file.size,
    content_type:  file.type || 'application/octet-stream',
  };
};

// Only this field is required before upload; everything else is optional and
// can be edited later in the review grid via bulk-apply.
const REQUIRED_FIELDS = ['plant'];

// Advanced defaults panel — collapsed by default.
const ADVANCED_FIELDS = [
  'adnoc_project_no', 'project_title', 'project_location', 'source_folder',
  'originator', 'to', 'agreement_no', 'agreement_desc',
  'transmittal_no', 'class_review', 'category', 'author',
];

// When a folder is dropped, auto-fill these defaults from the folder tree.
// Rule `top_folder_name` = name of the topmost directory of the upload.
// Auto-derive never overwrites a value the user has already typed.
const AUTO_DERIVE_RULES = {
  project_title: 'top_folder_name',
  source_folder: 'top_folder_name',
};

const ACCEPTED_EXT = ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.dwg', '.dxf'];

// ─── Coverage / Completeness banner (soft-coded) ─────────────────────────
// Mirrors the backend completeness_analyzer thresholds so the UI rating
// stays consistent with the JSON report.
const COVERAGE_CONFIG = {
  enabled:   true,
  endpoints: {
    coverage:  (id) => `/non-teff/batch/${id}/coverage/`,
    reconcile: (id) => `/non-teff/batch/${id}/reconcile/`,
  },
  // Same numbers as backend COMPLETENESS_CONFIG.coverage_thresholds.
  thresholds: { good: 0.85, fair: 0.65 },
  ratingStyles: {
    good: { bg: '#ecfdf5', border: '#34d399', fg: '#047857', label: 'High coverage' },
    fair: { bg: '#fffbeb', border: '#fbbf24', fg: '#b45309', label: 'Partial coverage' },
    poor: { bg: '#fef2f2', border: '#f87171', fg: '#b91c1c', label: 'Low coverage' },
  },
  // How many weakest items to render under the banner.
  weakestVisible: 5,
  // Auto-refresh interval after a reconcile run (single fire-once delay).
  refreshAfterMs: 500,
};

// ─── Direct-link config (record ↔ drawing → exact location) ──────────────
// Soft-coded so we can tune without touching component code.  Two endpoints:
//   * `file/`     — streams the original drawing/record blob (PDF, image, etc.)
//   * `location/` — JSON metadata (relative_path, mime, size) for tooltip use
const LINK_CONFIG = {
  enabled: true,
  endpoints: {
    file:     (bid, iid) => `/non-teff/batch/${bid}/items/${iid}/file/`,
    location: (bid, iid) => `/non-teff/batch/${bid}/items/${iid}/location/`,
  },
  // Field keys (in priority order) whose cell content should also be a clickable
  // record-link.  Whichever key exists in the current template wins.
  recordKeyPriority: [
    'document_no', 'document_number', 'tag', 'instrument_tag_no',
    'equipment_no', 'line_number',
  ],
  // Open the original file in a new browser tab.  Passing the auth token via
  // header is impossible for `target=_blank`, so we fetch as blob and open
  // an object URL — same trick already used by DocumentSearchCanvas for page
  // images.  Object URL is revoked after a generous TTL so the new tab has
  // time to render large PDFs.
  blobUrlTtlMs: 5 * 60 * 1000,
  // CSS color tokens (kept in sync with COVERAGE_CONFIG so the UI feels of one).
  styles: {
    recordLink: { color: '#0f766e', textDecoration: 'underline dotted' },
    openPill:   'text-sky-600 hover:text-sky-800 text-[10px] font-semibold underline decoration-dotted',
    pathPill:   'text-slate-500 text-[10px] font-mono truncate max-w-[260px]',
  },
};

// Open the original drawing/record in a new browser tab.  Returns false if
// blocked (popup-blocker) or the file is missing — caller can show a toast.
const openItemFileInNewTab = async (apiClient, batch_id, item_id) => {
  try {
    const url = LINK_CONFIG.endpoints.file(batch_id, item_id);
    const res = await apiClient.get(url, { responseType: 'blob' });
    const blob = res?.data;
    if (!(blob instanceof Blob)) return false;
    const objectUrl = URL.createObjectURL(blob);
    const win = window.open(objectUrl, '_blank', 'noopener');
    // Revoke later so the new tab finishes rendering first.
    setTimeout(() => URL.revokeObjectURL(objectUrl), LINK_CONFIG.blobUrlTtlMs);
    return !!win;
  } catch (err) {
    // Fall through — caller will surface the error message.
    if (err?.response?.status === 404) {
      throw new Error('Original file is not on the server anymore.');
    }
    throw err;
  }
};

// ─── SmartPlant Foundation push (soft-coded) ──────────────────────────────
// One-click handover from the finished master file to SmartPlant Foundation
// (or any compatible document-control system).  All transports, mappings and
// retry behaviour live server-side in `config/smartplant_config.json`; this
// block only handles the UI plumbing.  The default backend mode is `dry_run`
// so the button works end-to-end before SPF credentials exist.
const SMARTPLANT_CONFIG = {
  enabled: true,
  endpoints: {
    status: (bid) => (bid
      ? `/non-teff/batch/${bid}/smartplant/status/`
      : `/non-teff/smartplant/status/`),
    push:   (bid) => `/non-teff/batch/${bid}/smartplant/push/`,
  },
  // Modes the user can pick from in the modal.  Server still validates this.
  modes: [
    { value: 'dry_run',        label: 'Dry run (no transmission)', tone: 'slate' },
    { value: 'rest_api',       label: 'SPF REST API',              tone: 'emerald' },
    { value: 'webhook',        label: 'Webhook (Power Automate / n8n)', tone: 'sky' },
    { value: 's3_dropzone',    label: 'S3 dropzone',               tone: 'amber' },
    { value: 'local_dropzone', label: 'Server folder (SPF Adapter)', tone: 'violet' },
  ],
  // How long to keep the result toast visible.
  resultStickyMs: 12_000,
  // CSS classes for the button (kept in sync with the Export Excel pill).
  styles: {
    button: 'flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clsx = (...xs) => xs.filter(Boolean).join(' ');
const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);

const topFolderOf = (files) => {
  for (const f of files) {
    const rel = f.webkitRelativePath || '';
    const first = rel.split('/')[0];
    if (first) return first;
  }
  return '';
};

// Walk a DataTransferItem directory entry recursively, populating `out`.
const walkEntry = (entry, prefix, out) => new Promise((resolve) => {
  if (entry.isFile) {
    entry.file((f) => {
      try { Object.defineProperty(f, 'webkitRelativePath', { value: prefix + f.name }); }
      catch { /* read-only in some browsers — safe to ignore */ }
      out.push(f);
      resolve();
    }, () => resolve());
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const readAll = () => reader.readEntries(async (batch) => {
      if (!batch.length) return resolve();
      await Promise.all(batch.map((e) => walkEntry(e, prefix + entry.name + '/', out)));
      readAll();
    }, () => resolve());
    readAll();
  } else {
    resolve();
  }
});

const useTemplate = () => {
  const [tpl, setTpl] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    apiClient.get(`${BULK_API}/template/`)
      .then((r) => setTpl(r.data))
      .catch((e) => setError(e?.response?.data?.error || e.message));
  }, []);
  return { tpl, error };
};

// Split an array of File into chunks bounded by BOTH file count AND byte size.
const chunkFiles = (files, maxFiles, maxBytes) => {
  const out = [];
  let cur = [];
  let bytes = 0;
  for (const f of files) {
    if (cur.length >= maxFiles || (bytes + f.size > maxBytes && cur.length > 0)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(f);
    bytes += f.size;
  }
  if (cur.length) out.push(cur);
  return out;
};

// Sleep helper for retry backoff
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BulkMasterIndex = ({ loadBatchId = null, onSelectItem = null } = {}) => {
  const { tpl, error: tplError } = useTemplate();

  // Batch / files / progress
  const [batch, setBatch] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [counts, setCounts] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Review grid
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [bulkValue, setBulkValue] = useState({ colKey: '', value: '' });

  const [error, setError] = useState(null);

  // ── Coverage / Completeness banner state ───────────────────────────────
  const [coverage, setCoverage] = useState(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [reconcileBusy, setReconcileBusy] = useState(false);

  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const columns = tpl?.template?.columns || [];
  const reviewReady = batch && ['ready', 'exported', 'failed'].includes(batch.status);


  // Pre-fill defaults from template hints
  useEffect(() => {
    if (tpl?.template?.batch_default_hints) {
      setDefaults((prev) => ({ ...tpl.template.batch_default_hints, ...prev }));
    }
  }, [tpl]);

  // ── Re-open from History ────────────────────────────────────────────────
  // When the parent passes a `loadBatchId`, hydrate the bulk view by fetching
  // the batch status and item list — exactly the same data flow as a fresh
  // extraction would produce, so columns/template stay in sync.
  useEffect(() => {
    if (!loadBatchId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`${BULK_API}/${loadBatchId}/status/`);
        if (cancelled) return;
        if (res.data?.batch) {
          setBatch(res.data.batch);
          if (res.data.batch.batch_defaults) setDefaults((prev) => ({ ...prev, ...res.data.batch.batch_defaults }));
        }
        const itemsRes = await apiClient.get(`${BULK_API}/${loadBatchId}/items/`, {
          params: { page: 1, page_size: PAGE_SIZE },
        });
        if (cancelled) return;
        setItems(itemsRes.data.items || []);
        setTotal(itemsRes.data.total || 0);
        setPage(1);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.error || e.message || 'Failed to load batch from history.');
      }
    })();
    return () => { cancelled = true; };
  }, [loadBatchId]);

  // --- File acceptance -----------------------------------------------------
  const acceptFiles = useCallback((list) => {
    if (!list.length) return;
    setFiles(list);
    const top = topFolderOf(list);
    if (top) {
      setDefaults((prev) => {
        const next = { ...prev };
        for (const [field, rule] of Object.entries(AUTO_DERIVE_RULES)) {
          if (!next[field] && rule === 'top_folder_name') next[field] = top;
        }
        return next;
      });
    }
  }, []);

  const onPickFolder = (e) => acceptFiles(Array.from(e.target.files || []));
  const onPickFiles = (e) => acceptFiles([...files, ...Array.from(e.target.files || [])]);

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = [];
    const dt = e.dataTransfer;
    if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
      const walks = [];
      for (const item of dt.items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) walks.push(walkEntry(entry, '', dropped));
      }
      await Promise.all(walks);
    } else {
      for (const f of dt.files) dropped.push(f);
    }
    const allowed = dropped.filter((f) => {
      const name = (f.name || '').toLowerCase();
      return ACCEPTED_EXT.some((ext) => name.endsWith(ext));
    });
    acceptFiles(allowed);
  };

  // --- Launch: implicit batch create + upload + start ----------------------
  const launch = async () => {
    if (!files.length) return;
    for (const f of REQUIRED_FIELDS) {
      if (!defaults[f]) {
        setError(`Please fill the "${f}" field before uploading.`);
        setShowAdvanced(true);
        return;
      }
    }
    setError(null);

    let currentBatch = batch;
    if (!currentBatch) {
      try {
        const payload = {
          name: defaults.project_title || topFolderOf(files) || `Batch ${new Date().toISOString().slice(0, 10)}`,
          plant: defaults.plant,
          batch_defaults: defaults,
        };
        const res = await apiClient.post(`${BULK_API}/create/`, payload);
        currentBatch = res.data;
        setBatch(currentBatch);
      } catch (e) {
        setError(e?.response?.data?.error || e.message);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      // Chunk the payload — big folders blow past any single-request timeout.
      const chunks = chunkFiles(files, UPLOAD_CHUNK_FILES, UPLOAD_CHUNK_BYTES);
      const totalBytes = files.reduce((s, f) => s + f.size, 0) || 1;
      let sentBytes = 0;

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];

        // ── Smart dispatcher: large files go direct-to-S3 (presigned PUT),
        //    small files stay on the legacy multipart path. Falls back to
        //    multipart for any large file whose presign fails — production
        //    remains safe even if S3 / boto3 / env vars regress.
        const largeFiles = NONTEFF_PRESIGNED.enabled
          ? chunk.filter((f) => f.size >= NONTEFF_PRESIGNED.minSizeBytes)
          : [];
        const smallFiles = chunk.filter((f) => !largeFiles.includes(f));
        const stagedRefs = [];           // {s3_key, file_name, ...} per success
        const fallbackToMultipart = [];  // large files whose presign failed

        // 1) Direct-to-S3 PUT for each large file (sequential to keep memory
        //    + bandwidth predictable on slow uplinks). Progress updates are
        //    relative to the global byte counter so the bar stays smooth.
        for (let li = 0; li < largeFiles.length; li++) {
          const f = largeFiles[li];
          let lastReported = 0;
          try {
            const ref = await _uploadOneFileToS3(
              currentBatch.batch_id,
              f,
              (loaded) => {
                const delta = loaded - lastReported;
                lastReported = loaded;
                sentBytes += delta;
                setUploadProgress(
                  Math.min(100, Math.round((sentBytes / totalBytes) * 100)),
                );
              },
            );
            // Make sure we end up exactly at file.size for this file even if
            // S3 didn't report a final progress event.
            const tail = f.size - lastReported;
            if (tail > 0) {
              sentBytes += tail;
              setUploadProgress(
                Math.min(100, Math.round((sentBytes / totalBytes) * 100)),
              );
            }
            stagedRefs.push(ref);
          } catch (err) {
            // Roll back the progress we partially counted, then fall back.
            sentBytes -= lastReported;
            // eslint-disable-next-line no-console
            console.warn(
              '[BulkUpload] presigned path failed for',
              f.name,
              '— falling back to multipart:',
              err?.message || err,
            );
            fallbackToMultipart.push(f);
          }
        }

        // 2) Notify backend about all S3-staged files in one batched call.
        if (stagedRefs.length > 0) {
          await apiClient.post(
            NONTEFF_PRESIGNED.endpoints.complete(currentBatch.batch_id),
            { items: stagedRefs },
            { timeout: 5 * 60 * 1000 },   // server may stream-download — give it room
          );
        }

        // 3) Anything that didn't go direct (small + fallback) → legacy
        //    multipart POST through Django, unchanged behaviour.
        const multipartFiles = smallFiles.concat(fallbackToMultipart);
        if (multipartFiles.length === 0) {
          continue;
        }

        const chunkBytes = multipartFiles.reduce((s, f) => s + f.size, 0);
        const fd = new FormData();
        multipartFiles.forEach((f) => {
          fd.append('files', f);
          fd.append('relative_paths', f.webkitRelativePath || f.name);
        });

        // Dynamic timeout for THIS chunk (not a fixed global value)
        const chunkTimeout = computeChunkTimeout(multipartFiles.length, chunkBytes);

        // Retry loop — network hiccups or a single slow chunk shouldn't abort
        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            // AbortController lets us enforce our own dynamic deadline
            // (axios' own timeout is also set, so whichever fires first wins).
            const controller = new AbortController();
            const deadline = setTimeout(() => controller.abort(), chunkTimeout);

            // Extend the deadline if the chunk is actively making progress —
            // gives slow but steady uploads room to finish without aborting.
            let lastLoaded = 0;
            let lastProgressAt = Date.now();
            const STALL_GRACE_MS = 45 * 1000; // 45 s with zero progress ⇒ stall

            await apiClient.post(
              `${BULK_API}/${currentBatch.batch_id}/upload/`,
              fd,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: chunkTimeout,
                signal: controller.signal,
                onUploadProgress: (ev) => {
                  if (!ev.total) return;
                  const chunkLoaded = Math.min(ev.loaded, ev.total);
                  const pct = Math.min(
                    100,
                    Math.round(((sentBytes + chunkLoaded) / totalBytes) * 100),
                  );
                  setUploadProgress(pct);

                  // Active-progress detection: reset deadline if bytes keep flowing
                  if (chunkLoaded > lastLoaded) {
                    lastLoaded = chunkLoaded;
                    lastProgressAt = Date.now();
                  } else if (Date.now() - lastProgressAt > STALL_GRACE_MS) {
                    controller.abort(); // hard stall — abort & retry
                  }
                },
              },
            );
            clearTimeout(deadline);
            break; // success
          } catch (err) {
            attempt += 1;
            if (attempt > UPLOAD_RETRY_COUNT) throw err;
            // Exponential backoff before retry
            await sleep(1500 * Math.pow(2, attempt - 1));
          }
        }

        sentBytes += chunkBytes;
        setUploadProgress(Math.round((sentBytes / totalBytes) * 100));
      }

      await apiClient.post(`${BULK_API}/${currentBatch.batch_id}/start/`);
      setUploading(false);
      setExtracting(true);
    } catch (e) {
      setUploading(false);
      const msg = e?.response?.data?.error
        || (e?.code === 'ECONNABORTED'
            ? 'Upload timed out. Try a smaller batch or retry — the server may still be processing.'
            : e.message);
      setError(msg);
    }
  };

  // --- Poll extraction status ---------------------------------------------
  useEffect(() => {
    if (!extracting || !batch) return;
    const tick = async () => {
      try {
        const res = await apiClient.get(`${BULK_API}/${batch.batch_id}/status/`);
        setCounts(res.data.counts || {});
        setBatch(res.data.batch);
        const done = ['ready', 'exported', 'failed'].includes(res.data.batch.status);
        if (done) {
          setExtracting(false);
          await loadItems(1);
        }
      } catch { /* keep polling */ }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracting, batch?.batch_id]);

  // --- Review grid data ---------------------------------------------------
  const loadItems = useCallback(async (p = page) => {
    if (!batch) return;
    try {
      const res = await apiClient.get(`${BULK_API}/${batch.batch_id}/items/`, {
        params: { page: p, page_size: PAGE_SIZE, status: statusFilter || undefined },
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || p);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  }, [batch, page, statusFilter]);

  useEffect(() => {
    if (reviewReady) loadItems(1);
    // eslint-disable-next-line
  }, [statusFilter]);

  const saveCell = async (itemId, colKey, value) => {
    try {
      await apiClient.patch(`${BULK_API}/${batch.batch_id}/items/${itemId}/`, {
        fields: { [colKey]: value },
      });
      setItems((prev) => prev.map((it) =>
        it.item_id === itemId ? { ...it, fields: { ...it.fields, [colKey]: value } } : it,
      ));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setEditingCell(null);
    }
  };

  const applyBulk = async () => {
    if (!bulkValue.colKey || selectedIds.size === 0) return;
    try {
      await apiClient.post(`${BULK_API}/${batch.batch_id}/bulk-update/`, {
        item_ids: Array.from(selectedIds),
        fields: { [bulkValue.colKey]: bulkValue.value },
      });
      await loadItems(page);
      setBulkValue({ colKey: '', value: '' });
      setSelectedIds(new Set());
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  // ── Coverage report fetch + Reconcile action ───────────────────────────
  const fetchCoverage = useCallback(async () => {
    if (!COVERAGE_CONFIG.enabled || !batch?.batch_id) return;
    setCoverageLoading(true);
    try {
      const res = await apiClient.get(COVERAGE_CONFIG.endpoints.coverage(batch.batch_id));
      setCoverage(res?.data?.report || null);
    } catch (e) {
      // Non-fatal — hide banner instead of blocking the page.
      setCoverage(null);
    } finally {
      setCoverageLoading(false);
    }
  }, [batch?.batch_id]);

  // Refresh coverage whenever review becomes ready or items change count.
  useEffect(() => {
    if (reviewReady) fetchCoverage();
  }, [reviewReady, total, fetchCoverage]);

  const runReconcile = async () => {
    if (!batch?.batch_id || reconcileBusy) return;
    setReconcileBusy(true);
    try {
      const res = await apiClient.post(COVERAGE_CONFIG.endpoints.reconcile(batch.batch_id));
      const applied = res?.data?.applied_cells || 0;
      const touched = res?.data?.touched_items || 0;
      if (applied > 0) {
        // Reload the items grid so the user sees the back-filled values.
        await loadItems(page);
      }
      setError(applied > 0
        ? `Reconciled ${applied} cell(s) across ${touched} row(s).`
        : 'Nothing to reconcile — coverage already maximised for constant-across-batch columns.');
      setTimeout(fetchCoverage, COVERAGE_CONFIG.refreshAfterMs);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Reconcile failed');
    } finally {
      setReconcileBusy(false);
    }
  };

  const exportExcel = async () => {
    if (!batch) return;
    try {
      // Use apiClient so the JWT Authorization header is attached.
      // window.open() would open a new tab without auth → backend returns
      // 401/redirect to login instead of streaming the .xlsx file.
      const res = await apiClient.get(
        `${BULK_API}/${batch.batch_id}/export/`,
        { responseType: 'blob', timeout: 60000 }
      );
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      // Derive filename from Content-Disposition when the server provides it.
      let filename = `Master_Index_${(batch.plant || 'BATCH').replace(/\s+/g, '_')}.xlsx`;
      const cd = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'];
      if (cd) {
        const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
        if (m && m[1]) filename = decodeURIComponent(m[1]);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Export failed');
    }
  };

  // ─── SmartPlant Foundation push ─────────────────────────────────────────
  const [spfStatus, setSpfStatus] = useState(null);     // { enabled, mode, missing_env_vars }
  const [spfModalOpen, setSpfModalOpen] = useState(false);
  const [spfMode, setSpfMode] = useState('');           // user-selected override
  const [spfBusy, setSpfBusy] = useState(false);
  const [spfResult, setSpfResult] = useState(null);

  // Pull connector status whenever a batch is loaded so the button reflects
  // current readiness.  Cheap call — pure config inspection on the backend.
  useEffect(() => {
    if (!SMARTPLANT_CONFIG.enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(SMARTPLANT_CONFIG.endpoints.status(batch?.batch_id));
        if (!cancelled) {
          setSpfStatus(res.data || null);
          setSpfMode((res.data?.mode || '').toLowerCase());
        }
      } catch (e) {
        if (!cancelled) setSpfStatus({ enabled: false, mode: 'disabled' });
      }
    })();
    return () => { cancelled = true; };
  }, [batch?.batch_id]);

  // Auto-clear the result toast after the configured TTL.
  useEffect(() => {
    if (!spfResult) return;
    const t = setTimeout(() => setSpfResult(null), SMARTPLANT_CONFIG.resultStickyMs);
    return () => clearTimeout(t);
  }, [spfResult]);

  const pushToSmartPlant = async () => {
    if (!batch) return;
    setSpfBusy(true);
    setSpfResult(null);
    try {
      const res = await apiClient.post(
        SMARTPLANT_CONFIG.endpoints.push(batch.batch_id),
        spfMode ? { mode: spfMode } : {},
        { timeout: 120000 },
      );
      setSpfResult(res.data || { status: 'ok', message: 'Done.' });
      setSpfModalOpen(false);
    } catch (e) {
      setSpfResult({
        status:  'error',
        mode:    spfMode || (spfStatus?.mode || 'unknown'),
        message: e?.response?.data?.message
              || e?.response?.data?.error
              || e.message
              || 'SmartPlant push failed',
      });
    } finally {
      setSpfBusy(false);
    }
  };

  const resetBatch = () => {
    setBatch(null);
    setFiles([]);
    setItems([]);
    setCounts({});
    setUploadProgress(0);
    setUploading(false);
    setExtracting(false);
    setSelectedIds(new Set());
    setEditingCell(null);
    setStatusFilter('');
    setPage(1);
    setError(null);
  };

  // --- Derived UI ----------------------------------------------------------
  const totalSizeMB = useMemo(
    () => formatMB(files.reduce((s, f) => s + f.size, 0)),
    [files],
  );
  const progressPct = useMemo(() => {
    const t = batch?.total_files || 0;
    if (!t) return 0;
    return Math.round(((counts.ready || 0) + (counts.failed || 0)) / t * 100);
  }, [counts, batch]);

  const phase = extracting ? 'extracting'
              : uploading  ? 'uploading'
              : reviewReady ? 'ready'
              : files.length ? 'staged'
              : 'idle';

  // ------------------------------------------------------------------------
  if (tplError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        Failed to load template: {tplError}
      </div>
    );
  }
  if (!tpl) {
    return (
      <div className="p-6 text-center text-slate-500">
        <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-emerald-600 mb-2" />
        Loading Master Index template…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <DocumentDuplicateIcon className="h-6 w-6 text-emerald-600" />
            Bulk Master Index
          </h2>
          <p className="text-sm text-slate-500">
            Drop a folder → auto-extract → review → export · {columns.length} columns · {tpl.template.template_name} v{tpl.template.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {batch && (
            <button
              onClick={resetBatch}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              New batch
            </button>
          )}
          <button
            onClick={exportExcel}
            disabled={!reviewReady}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Excel
          </button>
          {SMARTPLANT_CONFIG.enabled && spfStatus?.enabled && (
            <button
              onClick={() => setSpfModalOpen(true)}
              disabled={!reviewReady || spfBusy}
              title={`Push to SmartPlant Foundation (mode: ${spfStatus.mode})`}
              className={SMARTPLANT_CONFIG.styles.button}
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {spfBusy ? 'Pushing…' : 'Push to SmartPlant'}
            </button>
          )}
        </div>
      </div>

      {/* SmartPlant push result toast */}
      {spfResult && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${
          spfResult.status === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {spfResult.status === 'ok'
            ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            : <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="font-semibold">
              SmartPlant {spfResult.status === 'ok' ? 'push succeeded' : 'push failed'}
              {spfResult.mode ? ` · ${spfResult.mode}` : ''}
              {typeof spfResult.document_count === 'number' ? ` · ${spfResult.document_count} document(s)` : ''}
            </div>
            <div className="text-xs opacity-90 break-words">{spfResult.message || ''}</div>
            {spfResult.transmittal_id && (
              <div className="text-[10px] font-mono opacity-70 mt-0.5">
                transmittal: {spfResult.transmittal_id}
              </div>
            )}
          </div>
          <button
            onClick={() => setSpfResult(null)}
            className="text-xs font-medium opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SmartPlant mode-picker modal */}
      {spfModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 flex items-center justify-center p-4"
          onClick={() => !spfBusy && setSpfModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <PaperAirplaneIcon className="h-5 w-5 text-indigo-600" />
                Push to SmartPlant Foundation
              </h3>
              <button
                onClick={() => !spfBusy && setSpfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Choose how the master file should reach SmartPlant. The connector mode,
              endpoints and field mapping are server-side soft-coded — no code changes
              are required to add a new transport.
            </p>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Transport mode</span>
              <select
                value={spfMode}
                onChange={(e) => setSpfMode(e.target.value)}
                disabled={spfBusy}
                className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {SMARTPLANT_CONFIG.modes
                  .filter((m) => (spfStatus?.supported_modes || []).includes(m.value))
                  .map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
              </select>
            </label>

            {Array.isArray(spfStatus?.missing_env_vars) && spfStatus.missing_env_vars.length > 0 && spfMode !== 'dry_run' && (
              <div className="text-xs px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded">
                Missing environment variables: {spfStatus.missing_env_vars.join(', ')}.
                Use Dry run, or set these on the backend before pushing.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => !spfBusy && setSpfModalOpen(false)}
                disabled={spfBusy}
                className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={pushToSmartPlant}
                disabled={spfBusy}
                className={SMARTPLANT_CONFIG.styles.button}
              >
                {spfBusy
                  ? <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  : <PaperAirplaneIcon className="h-4 w-4" />}
                {spfBusy ? 'Pushing…' : 'Push now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xs font-medium">Dismiss</button>
        </div>
      )}

      {/* Coverage / Completeness banner — read-only summary + reconcile CTA */}
      {COVERAGE_CONFIG.enabled && reviewReady && coverage && coverage.items_total > 0 && (() => {
        const style = COVERAGE_CONFIG.ratingStyles[coverage.rating] || COVERAGE_CONFIG.ratingStyles.poor;
        const pct = Math.round((coverage.overall_pct || 0) * 100);
        const planRows = coverage.reconcile_plan || [];
        const fillable = planRows.reduce((a, p) => a + (p.fillable_rows || 0), 0);
        return (
          <div
            className="rounded-xl border px-4 py-3"
            style={{ background: style.bg, borderColor: style.border }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex flex-col items-center justify-center rounded-lg px-3 py-2 font-bold"
                  style={{ background: 'white', color: style.fg, border: `2px solid ${style.border}`, minWidth: 78 }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{pct}%</span>
                  <span style={{ fontSize: 9, letterSpacing: 0.6, fontWeight: 700, opacity: 0.8 }}>COVERAGE</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: style.fg }}>{style.label}</span>
                    <span className="text-xs text-slate-500">
                      {coverage.items_full}/{coverage.items_total} rows fully extracted
                    </span>
                    {coverage.items_weak > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                        {coverage.items_weak} weak
                      </span>
                    )}
                  </div>
                  {(coverage.suggestions || []).slice(0, 2).map((s, i) => (
                    <div key={i} className="text-xs text-slate-600 mt-0.5">{s}</div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchCoverage}
                  disabled={coverageLoading}
                  className="px-3 py-1.5 text-xs border border-slate-300 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1"
                  title="Refresh coverage report"
                >
                  <ArrowPathIcon className={clsx('h-3.5 w-3.5', coverageLoading && 'animate-spin')} />
                  Refresh
                </button>
                <button
                  onClick={runReconcile}
                  disabled={reconcileBusy || planRows.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white inline-flex items-center gap-1 disabled:opacity-40"
                  style={{ background: planRows.length > 0 ? '#0d9488' : '#94a3b8' }}
                  title={planRows.length === 0 ? 'No reconcilable fields detected' : `Back-fill ${fillable} cell(s) across ${planRows.length} column(s)`}
                >
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {reconcileBusy ? 'Reconciling…' : `Reconcile ${fillable > 0 ? `(${fillable})` : ''}`}
                </button>
              </div>
            </div>

            {/* Per-column fill bars — show top 6 weakest important columns */}
            {(coverage.per_column || []).filter((c) => c.weight >= 2).slice(0, 6).length > 0 && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                {(coverage.per_column || []).filter((c) => c.weight >= 2).slice(0, 6).map((c) => {
                  const p = Math.round((c.pct || 0) * 100);
                  const barColor = p >= 85 ? '#10b981' : p >= 65 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={c.key} className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-slate-700 truncate" style={{ minWidth: 110 }} title={c.label}>
                        {c.label}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: barColor }} />
                      </div>
                      <span className="text-[10px] text-slate-500 tabular-nums" style={{ minWidth: 28, textAlign: 'right' }}>
                        {p}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Plant quick-input — the single required field, always visible */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <span className="text-sm font-medium text-slate-700 w-20">Plant *</span>
        <input
          type="text"
          value={defaults.plant || ''}
          onChange={(e) => setDefaults((d) => ({ ...d, plant: e.target.value }))}
          placeholder="e.g. Habshan-1"
          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-emerald-700 font-medium"
        >
          <ChevronDownIcon className={clsx('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
          Advanced defaults
        </button>
      </div>

      {/* Collapsible advanced defaults */}
      {showAdvanced && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-3">
            Optional — applied to every file in this batch. You can also set these in bulk after extraction.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ADVANCED_FIELDS.map((key) => {
              const col = columns.find((c) => c.key === key);
              if (!col) return null;
              return (
                <label key={key} className="block">
                  <span className="text-[11px] font-medium text-slate-600 mb-1 block">{col.label}</span>
                  <input
                    type="text"
                    value={defaults[key] ?? ''}
                    onChange={(e) => setDefaults((d) => ({ ...d, [key]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Drop zone / progress — reactive by phase */}
      {(phase === 'idle' || phase === 'staged') && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={clsx(
            'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all',
            dragOver
              ? 'border-emerald-500 bg-emerald-50/60'
              : files.length
                ? 'border-emerald-300 bg-white'
                : 'border-slate-300 bg-slate-50/60 hover:bg-white',
          )}
        >
          <FolderOpenIcon className="h-14 w-14 text-emerald-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            {files.length
              ? `${files.length} file(s) ready · ${totalSizeMB} MB`
              : 'Drop a project folder here'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {files.length
              ? 'Review below and click "Start extraction" to begin'
              : `or use the buttons below · ${ACCEPTED_EXT.join(', ')}`}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-emerald-500 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50"
            >
              <FolderOpenIcon className="h-4 w-4 inline mr-1" />
              Pick folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              <CloudArrowUpIcon className="h-4 w-4 inline mr-1" />
              Pick files
            </button>
            {files.length > 0 && (
              <>
                <button
                  onClick={launch}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 shadow-sm"
                >
                  Start extraction ▶
                </button>
                <button
                  onClick={() => setFiles([])}
                  className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
              </>
            )}
          </div>

          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={onPickFolder}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXT.join(',')}
            className="hidden"
            onChange={onPickFiles}
          />
        </div>
      )}

      {(phase === 'uploading' || phase === 'extracting') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <ArrowPathIcon className="h-10 w-10 text-emerald-600 mx-auto animate-spin mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            {phase === 'uploading' ? `Uploading… ${uploadProgress}%` : 'Extracting metadata…'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {phase === 'uploading'
              ? `${files.length} file(s) · ${totalSizeMB} MB`
              : `${(counts.ready || 0) + (counts.failed || 0)} / ${batch?.total_files || 0} processed · ${counts.ready || 0} ready · ${counts.failed || 0} failed`}
          </p>
          <div className="w-full max-w-lg mx-auto bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${phase === 'uploading' ? uploadProgress : progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Review grid — appears on same screen once ready */}
      {reviewReady && (
        <ReviewGrid
          columns={columns}
          items={items}
          total={total}
          page={page}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          editingCell={editingCell}
          setEditingCell={setEditingCell}
          bulkValue={bulkValue}
          setBulkValue={setBulkValue}
          applyBulk={applyBulk}
          saveCell={saveCell}
          loadItems={loadItems}
          counts={counts}
          batch={batch}
          onSelectItem={onSelectItem}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Review grid
// ---------------------------------------------------------------------------

const ReviewGrid = ({
  columns, items, total, page, statusFilter, setStatusFilter,
  selectedIds, setSelectedIds, editingCell, setEditingCell,
  bulkValue, setBulkValue, applyBulk, saveCell, loadItems, counts,
  batch, onSelectItem,
}) => {
  const toggleId = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds((prev) =>
    prev.size === items.length ? new Set() : new Set(items.map((i) => i.item_id)),
  );

  // Soft-coded "record key" — first key from LINK_CONFIG.recordKeyPriority
  // that exists in the active template; that column's cells double as
  // clickable shortcuts to the canvas locator.
  const recordKey = useMemo(() => {
    if (!LINK_CONFIG.enabled) return '';
    const colKeys = new Set(columns.map((c) => c.key));
    return LINK_CONFIG.recordKeyPriority.find((k) => colKeys.has(k)) || '';
  }, [columns]);

  // Open the original drawing/record for an item in a new browser tab.
  const handleOpenOriginal = useCallback(async (it) => {
    const bid = it.batch_id || (batch && batch.batch_id);
    if (!bid || !it?.item_id) return;
    try {
      await openItemFileInNewTab(apiClient, bid, it.item_id);
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(err?.message || 'Could not open the original file.');
    }
  }, [batch]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-medium text-slate-700">
            {total} items · {counts.ready || 0} ready · {counts.failed || 0} failed · {selectedIds.size} selected
          </span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-300 rounded px-2 py-1"
        >
          <option value="">All statuses</option>
          <option value="ready">Ready</option>
          <option value="failed">Failed</option>
        </select>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <select
              value={bulkValue.colKey}
              onChange={(e) => setBulkValue((v) => ({ ...v, colKey: e.target.value }))}
              className="text-xs border border-slate-300 rounded px-2 py-1"
            >
              <option value="">Bulk apply column…</option>
              {columns.filter((c) => c.class !== 'auto_serial' && c.class !== 'derived').map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={bulkValue.value}
              onChange={(e) => setBulkValue((v) => ({ ...v, value: e.target.value }))}
              placeholder="value"
              className="text-xs border border-slate-300 rounded px-2 py-1 w-32"
            />
            <button
              onClick={applyBulk}
              disabled={!bulkValue.colKey}
              className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              Apply to {selectedIds.size}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
        <table className="text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 border-b border-slate-200">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.size === items.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-2 py-2 border-b border-slate-200 text-left font-semibold text-slate-600">Status</th>
              {columns.map((col) => (
                <th key={col.key}
                    className="px-3 py-2 border-b border-slate-200 text-left font-semibold text-slate-600 whitespace-nowrap"
                    style={{ minWidth: (col.width || 14) * 7 }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.item_id} className={clsx(
                'hover:bg-emerald-50/40',
                selectedIds.has(it.item_id) && 'bg-emerald-50',
              )}>
                <td className="px-2 py-1.5 border-b border-slate-100 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(it.item_id)}
                    onChange={() => toggleId(it.item_id)}
                  />
                </td>
                <td className="px-2 py-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-1">
                    <span className={clsx(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                      it.status === 'ready' && 'bg-emerald-100 text-emerald-700',
                      it.status === 'failed' && 'bg-red-100 text-red-700',
                      it.status === 'extracting' && 'bg-amber-100 text-amber-700',
                    )}>
                      {it.status}
                    </span>
                    {onSelectItem && it.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => onSelectItem({
                          batch_id: it.batch_id || (batch && batch.batch_id),
                          item_id:  it.item_id,
                          file_name: it.file_name,
                          // Best initial query: tag, then doc number, then file name.
                          query: (it.fields?.tag || it.fields?.document_number || it.file_name || '').trim(),
                          fields: it.fields || {},
                        })}
                        title="Locate in canvas"
                        className="text-violet-600 hover:text-violet-800 text-[10px] font-semibold underline decoration-dotted"
                      >
                        locate
                      </button>
                    )}
                    {LINK_CONFIG.enabled && it.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => handleOpenOriginal(it)}
                        title={`Open original drawing — ${it.relative_path || it.file_name || ''}`}
                        className={LINK_CONFIG.styles.openPill}
                      >
                        open
                      </button>
                    )}
                  </div>
                </td>
                {columns.map((col) => {
                  const value = it.fields?.[col.key] ?? '';
                  const isEditing = editingCell?.itemId === it.item_id && editingCell?.colKey === col.key;
                  const editable = col.class !== 'auto_serial' && col.class !== 'derived';
                  const isRecordCell = LINK_CONFIG.enabled
                    && col.key === recordKey
                    && it.status === 'ready'
                    && value
                    && value !== 'NA'
                    && !!onSelectItem;
                  // Soft-coded multi-value columns (Tag, Unit, …): render
                  // as a vertical chip stack so every value is visible
                  // instead of getting truncated. Inline-edit still works
                  // on click — when editing we fall back to a flat input
                  // so the user can change the entire comma-list.
                  const isMultiCell = MULTI_VALUE_DISPLAY.enabled
                    && MULTI_VALUE_DISPLAY.columnKeys.includes(col.key)
                    && !isEditing
                    && value
                    && value !== 'NA'
                    && typeof value === 'string'
                    && MULTI_VALUE_DISPLAY.separator.test(value);
                  return (
                    <td key={col.key}
                        className="px-3 py-1.5 border-b border-slate-100 align-top"
                        style={{ maxWidth: isMultiCell
                          ? ((MULTI_VALUE_DISPLAY.perColumn[col.key] || MULTI_VALUE_DISPLAY.defaults).cellWidthPx)
                          : MAX_CELL_WIDTH_PX }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={value}
                          onBlur={(e) => saveCell(it.item_id, col.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full px-1 py-0.5 border border-emerald-400 rounded text-xs"
                        />
                      ) : isRecordCell ? (
                        <button
                          type="button"
                          onClick={() => onSelectItem({
                            batch_id: it.batch_id || (batch && batch.batch_id),
                            item_id:  it.item_id,
                            file_name: it.file_name,
                            query: (value || it.fields?.tag || it.file_name || '').trim(),
                            fields: it.fields || {},
                          })}
                          onDoubleClick={(e) => {
                            // Preserve double-click-to-edit on the record cell.
                            e.preventDefault();
                            if (editable) setEditingCell({ itemId: it.item_id, colKey: col.key });
                          }}
                          title={`Open in canvas — ${it.relative_path || it.file_name || value}`}
                          style={LINK_CONFIG.styles.recordLink}
                          className="truncate text-left w-full font-medium hover:opacity-80"
                        >
                          {value}
                        </button>
                      ) : isMultiCell ? (
                        (() => {
                          const cfg = {
                            ...MULTI_VALUE_DISPLAY.defaults,
                            ...(MULTI_VALUE_DISPLAY.perColumn[col.key] || {}),
                          };
                          const parts = value.split(MULTI_VALUE_DISPLAY.separator)
                            .map((p) => p.trim()).filter(Boolean);
                          const visible = parts.slice(0, cfg.maxVisible);
                          const overflow = parts.length - visible.length;
                          // columnsPerRow > 1 → CSS grid with equal-width
                          // tracks (compact heights for short tokens like
                          // unit codes). Otherwise → flex-wrap so long
                          // variable-width tokens like tags pack naturally.
                          const useGrid = cfg.columnsPerRow > 1;
                          const containerStyle = useGrid
                            ? { display: 'grid',
                                gridTemplateColumns: `repeat(${cfg.columnsPerRow}, minmax(0, 1fr))`,
                                gap: '4px' }
                            : undefined;
                          const containerClass = useGrid
                            ? clsx(editable && 'cursor-text hover:bg-emerald-50/40 rounded')
                            : clsx('flex flex-wrap gap-1', editable && 'cursor-text hover:bg-emerald-50/40 rounded');
                          return (
                            <div
                              onClick={() => editable && setEditingCell({ itemId: it.item_id, colKey: col.key })}
                              className={containerClass}
                              style={containerStyle}
                              title={editable ? `Click to edit — ${value}` : value}
                            >
                              {visible.map((p, i) => (
                                <span key={`${p}-${i}`} className={MULTI_VALUE_DISPLAY.chipClass}>{p}</span>
                              ))}
                              {overflow > 0 && (
                                <span
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium leading-tight whitespace-nowrap"
                                  title={parts.slice(cfg.maxVisible).join(', ')}
                                >+{overflow} more</span>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div
                          onClick={() => editable && setEditingCell({ itemId: it.item_id, colKey: col.key })}
                          className={clsx(
                            'truncate',
                            editable && 'cursor-text hover:bg-emerald-50',
                            value === 'NA' && 'text-slate-400 italic',
                          )}
                          title={editable ? `Click to edit — ${value}` : value}
                        >
                          {value || '—'}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 text-xs text-slate-600">
        <span>Page {page} of {pageCount}</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => loadItems(page - 1)}
            className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
          >←</button>
          <button
            disabled={page >= pageCount}
            onClick={() => loadItems(page + 1)}
            className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
          >→</button>
        </div>
      </div>
    </div>
  );
};

export default BulkMasterIndex;
