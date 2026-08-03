/**
 * DatasheetGeneratorTemplate
 * ==========================
 * Shared "Upload + Generate Excel" page based on the working MOV Equipment
 * Datasheet Generator design.  Every visual + behavioural detail (file
 * slots, drag/drop, adaptive polling, success card, download, sidebar
 * info, html preview) is preserved from MOV — only the labels, endpoints
 * and accent colour are driven by the `config` prop.
 *
 * This component does NOT touch any backend logic; each consuming page
 * supplies its own endpoints + form-field names so the working APIs
 * (Pump Hydraulic, Pressure Instrument, SDV) keep their existing
 * contracts.
 *
 * Soft-coded contract — `config` shape:
 *   {
 *     pageTitle:        string,
 *     pageSubtitle:     string,
 *     headerIcon:       LucideIcon,
 *     accent:           'blue' | 'purple' | 'red' | 'emerald' | 'indigo',
 *     backRoute:        string,
 *     mode:             'sync' | 'async',
 *     endpoints: {
 *       analyze:        string,                       // POST
 *       jobStatus?:     (jobId) => string,            // GET (async only)
 *     },
 *     documents: [
 *       {
 *         key:          string,        // form-field name on the API
 *         label:        string,        // visible heading
 *         required:     boolean,
 *         hint?:        string,
 *         accent?:      'blue'|'indigo'|'purple'|'red'|'emerald',
 *       },
 *       …
 *     ],
 *     extraFormFields?:  Record<string, string>,      // sent on every POST
 *     resultFilename?:   string,                      // override download name
 *     // Sidebar copy
 *     whatThisDoes:      string[],                    // bullet list
 *     sections?: [                                    // optional checklist
 *       { name: string, status: 'auto' | 'manual', note: string },
 *       …
 *     ],
 *     // Adaptive polling (async only)
 *     pollPhases?: [{ upToSeconds: number, intervalMs: number }],
 *     pollMaxTotalMs?: number,
 *     // Sync-only response shape (single file in, JSON out)
 *     syncResponseAdapter?: (responseData) => {
 *       success: boolean,
 *       html_preview?: string,
 *       excel_base64?: string,
 *       excel_filename?: string,
 *       message?: string,
 *       error?: string,
 *     },
 *   }
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader,
  ArrowLeft,
  FileCheck,
  Download,
  Plus,
} from 'lucide-react';
import apiClient from '../../../services/api.service';

// ─── SOFT-CODED DEFAULTS ────────────────────────────────────────────────
const DEFAULT_POLL_PHASES = [
  { upToSeconds: 120, intervalMs: 3000 },   // 0–2 min  → every 3 s
  { upToSeconds: 360, intervalMs: 5000 },   // 2–6 min  → every 5 s
  { upToSeconds: 900, intervalMs: 8000 },   // 6–15 min → every 8 s
];
const DEFAULT_POLL_MAX_TOTAL_MS = 15 * 60 * 1000;
const MAX_FILE_SIZE_MB = 50;
const ALLOWED_EXTENSIONS = ['PDF'];

// Accent → Tailwind class lookup. Soft-coded so any page can add a new colour
// just by extending this map.
const ACCENT_CLASSES = {
  blue:    { btnBg: 'from-blue-500 to-blue-600',       btnHoverBg: 'hover:from-blue-600 hover:to-blue-700',       text: 'text-blue-600',    bgSoft: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-500',    ringHover: 'hover:border-blue-400 dark:hover:border-blue-500',    progressBar: 'from-blue-500 to-blue-600' },
  indigo:  { btnBg: 'from-indigo-500 to-indigo-600',   btnHoverBg: 'hover:from-indigo-600 hover:to-indigo-700',   text: 'text-indigo-600',  bgSoft: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-500',  ringHover: 'hover:border-indigo-400 dark:hover:border-indigo-500', progressBar: 'from-indigo-500 to-indigo-600' },
  purple:  { btnBg: 'from-purple-500 to-purple-600',   btnHoverBg: 'hover:from-purple-600 hover:to-purple-700',   text: 'text-purple-600',  bgSoft: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-500',  ringHover: 'hover:border-purple-400 dark:hover:border-purple-500', progressBar: 'from-purple-500 to-purple-600' },
  red:     { btnBg: 'from-red-500 to-red-600',         btnHoverBg: 'hover:from-red-600 hover:to-red-700',         text: 'text-red-600',     bgSoft: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-500',     ringHover: 'hover:border-red-400 dark:hover:border-red-500',      progressBar: 'from-red-500 to-red-600' },
  emerald: { btnBg: 'from-emerald-500 to-emerald-600', btnHoverBg: 'hover:from-emerald-600 hover:to-emerald-700', text: 'text-emerald-600', bgSoft: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-500', ringHover: 'hover:border-emerald-400 dark:hover:border-emerald-500', progressBar: 'from-emerald-500 to-emerald-600' },
};
// ────────────────────────────────────────────────────────────────────────

const DatasheetGeneratorTemplate = ({ config }) => {
  const navigate = useNavigate();
  const HeaderIcon = config.headerIcon;
  const accent = ACCENT_CLASSES[config.accent] || ACCENT_CLASSES.blue;
  const docAccent = (key) =>
    ACCENT_CLASSES[config.documents.find(d => d.key === key)?.accent] || accent;

  // file refs / file state — keyed by document.key
  const inputRefs   = useRef({});
  const [files, setFiles]               = useState({});       // { key: File }
  const [dragActive, setDragActive]     = useState({});       // { key: bool }
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage]   = useState('');
  const [error, setError]                   = useState('');
  const [uploadResult, setUploadResult]     = useState(null);
  const [htmlPreview, setHtmlPreview]       = useState('');
  const [excelData, setExcelData]           = useState(null);

  // cleanup blobs on unmount
  useEffect(() => {
    return () => {
      Object.values(files).forEach(f => f && URL.revokeObjectURL(URL.createObjectURL(f)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── file validation + setters (soft-coded extension/size limit) ──────
  const validateAndSetFile = (file, key, label) => {
    const ext = file.name.split('.').pop().toUpperCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`${label} must be ${ALLOWED_EXTENSIONS.join('/')} format`);
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setError(`${label} exceeds ${MAX_FILE_SIZE_MB}MB limit`);
      return;
    }
    setFiles(prev => ({ ...prev, [key]: file }));
    setError('');
    setUploadResult(null);
  };

  const handleDrag = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [key]: e.type === 'dragenter' || e.type === 'dragover' }));
  };

  const handleDrop = (e, key, label) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [key]: false }));
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSetFile(dropped, key, label);
  };

  const handleReset = () => {
    setFiles({});
    setUploadResult(null);
    setHtmlPreview('');
    setExcelData(null);
    setError('');
    setUploadProgress(0);
    setAnalysisStage('');
  };

  // ── upload + dispatch ────────────────────────────────────────────────
  const requiredDocs = useMemo(
    () => config.documents.filter(d => d.required),
    [config.documents]
  );

  const allRequiredPresent = requiredDocs.every(d => !!files[d.key]);

  const handleUpload = async () => {
    if (!allRequiredPresent) {
      const missing = requiredDocs.filter(d => !files[d.key]).map(d => d.label).join(', ');
      setError(`Please select: ${missing}`);
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);
    setHtmlPreview('');
    setExcelData(null);
    setAnalysisStage('Uploading files...');

    try {
      const fd = new FormData();
      config.documents.forEach(d => {
        if (files[d.key]) fd.append(d.key, files[d.key]);
      });
      Object.entries(config.extraFormFields || {}).forEach(([k, v]) => fd.append(k, v));

      setUploadProgress(10);

      const resp = await apiClient.post(config.endpoints.analyze, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' },
        responseType: config.mode === 'sync_blob' ? 'blob' : 'json',
        timeout: 5 * 60 * 1000,
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded * 100) / e.total);
            setUploadProgress(Math.min(pct, 90));
            if (pct < 100) setAnalysisStage(`Uploading: ${pct}%`);
          }
        },
      });

      // ── async branch: wait for job_id and poll ──
      if (config.mode === 'async' && resp.data?.job_id) {
        pollJobStatus(resp.data.job_id);
        return;
      }

      // ── async branch (alternate shape: upload_id + external results/download) ──
      if (config.mode === 'async_external' && resp.data?.upload_id) {
        pollExternalJob(resp.data.upload_id);
        return;
      }

      // ── sync branch: adapter normalises payload shape ──
      const adapter = config.syncResponseAdapter || defaultSyncAdapter;
      const normalised = adapter(resp.data);

      if (!normalised.success) {
        throw new Error(normalised.error || 'Analysis failed');
      }

      if (normalised.html_preview) setHtmlPreview(normalised.html_preview);
      if (normalised.excel_base64) {
        setExcelData({
          base64:   normalised.excel_base64,
          filename: normalised.excel_filename || config.resultFilename || 'datasheet.xlsx',
        });
      } else if (normalised.customDownload) {
        setExcelData({
          customDownload: normalised.customDownload,
          filename: normalised.excel_filename || config.resultFilename || 'datasheet.xlsx',
        });
      }
      setUploadResult({ success: true, message: normalised.message });
      setUploadProgress(100);
      setAnalysisStage('Complete!');
      setUploading(false);
    } catch (err) {
      console.error('[DatasheetGenerator] upload error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Upload failed.');
      setUploadResult({ success: false });
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  // ── adaptive polling (async only) ────────────────────────────────────
  const pollJobStatus = (jobId) => {
    const phases = config.pollPhases || DEFAULT_POLL_PHASES;
    const maxTotal = config.pollMaxTotalMs || DEFAULT_POLL_MAX_TOTAL_MS;
    const startTime = Date.now();

    const intervalFor = () => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      for (const phase of phases) {
        if (elapsedSec <= phase.upToSeconds) return phase.intervalMs;
      }
      return phases[phases.length - 1].intervalMs;
    };

    const tick = async () => {
      try {
        const statusUrl = config.endpoints.jobStatus(jobId);
        const r = await apiClient.get(statusUrl);
        const { status, progress, stage, result, error: jobError } = r.data;

        setUploadProgress(progress || 0);
        setAnalysisStage(stage || 'Processing...');

        if (status === 'completed' && result) {
          if (result.success) {
            if (result.html_preview) setHtmlPreview(result.html_preview);
            if (result.excel_file) {
              setExcelData({
                base64:   result.excel_file,
                filename: result.filename || config.resultFilename || 'datasheet.xlsx',
              });
            }
            setUploadResult({ success: true, message: result.message });
            setUploadProgress(100);
            setAnalysisStage('Complete!');
          } else {
            throw new Error(result.error || 'Processing failed');
          }
          setUploading(false);
          return;
        }
        if (status === 'failed') throw new Error(jobError || 'Processing failed');

        const elapsed = Date.now() - startTime;
        if (elapsed >= maxTotal) {
          throw new Error(`Processing exceeded ${Math.round(maxTotal / 60000)} min — please retry.`);
        }
        const elMin = Math.floor(elapsed / 60000);
        const elSec = Math.floor((elapsed % 60000) / 1000);
        setAnalysisStage(stage || `Processing... (${elMin}m ${elSec}s)`);
        setTimeout(tick, intervalFor());
      } catch (err) {
        console.error('[DatasheetGenerator] poll error:', err);
        setError(err.message || 'Failed to retrieve results.');
        setUploadResult({ success: false });
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 2000);
      }
    };
    tick();
  };

  // ── async-external polling (upload_id → status → results → download URL) ──
  const pollExternalJob = (uploadId) => {
    const phases = config.pollPhases || DEFAULT_POLL_PHASES;
    const maxTotal = config.pollMaxTotalMs || DEFAULT_POLL_MAX_TOTAL_MS;
    const startTime = Date.now();

    const intervalFor = () => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      for (const phase of phases) {
        if (elapsedSec <= phase.upToSeconds) return phase.intervalMs;
      }
      return phases[phases.length - 1].intervalMs;
    };

    const tick = async () => {
      try {
        const r = await apiClient.get(config.endpoints.status(uploadId));
        const { status, progress, message } = r.data;

        setUploadProgress(progress || 0);
        setAnalysisStage(message || 'Processing...');

        if (status === 'completed') {
          // Pull results JSON for the preview/count
          let resultsData = null;
          if (config.endpoints.results) {
            try {
              const rr = await apiClient.get(config.endpoints.results(uploadId));
              resultsData = rr.data;
            } catch (resErr) {
              console.warn('[DatasheetGenerator] results fetch failed:', resErr);
            }
          }

          const messageText = config.buildSuccessMessage
            ? config.buildSuccessMessage(resultsData)
            : `Successfully extracted ${resultsData?.total ?? '?'} item(s).`;

          // Soft-coded hook so a parent page can map extracted data into a
          // local form (no backend change required).
          if (typeof config.onResults === 'function' && resultsData) {
            try { config.onResults(resultsData); }
            catch (cbErr) { console.warn('[DatasheetGenerator] onResults callback failed:', cbErr); }
          }

          setUploadResult({ success: true, message: messageText });
          setExcelData({
            downloadUrl: config.endpoints.download
              ? config.endpoints.download(uploadId)
              : null,
            filename: config.resultFilename || 'datasheet.xlsx',
          });
          setUploadProgress(100);
          setAnalysisStage('Complete!');
          setUploading(false);
          return;
        }
        if (status === 'failed' || status === 'not_found') {
          throw new Error(message || 'Processing failed');
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= maxTotal) {
          throw new Error(`Processing exceeded ${Math.round(maxTotal / 60000)} min — please retry.`);
        }
        setTimeout(tick, intervalFor());
      } catch (err) {
        console.error('[DatasheetGenerator] external-poll error:', err);
        setError(err.response?.data?.error || err.message || 'Failed to retrieve results.');
        setUploadResult({ success: false });
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 2000);
      }
    };
    tick();
  };

  // ── download (base64 → blob, OR external URL, OR custom fn) ─────────
  const handleDownloadExcel = async () => {
    if (!excelData) return;
    try {
      let blob;
      if (excelData.customDownload) {
        // Page supplied a custom downloader (e.g. POST with cached payload)
        blob = await excelData.customDownload();
      } else if (excelData.downloadUrl) {
        // Async-external pattern: fetch binary directly from API
        const r = await apiClient.get(excelData.downloadUrl, { responseType: 'blob' });
        blob = r.data;
      } else if (excelData.base64) {
        const bin = window.atob(excelData.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      } else {
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = excelData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download Excel file');
    }
  };

  // ── render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(config.backRoute || '/engineering/process/datasheet')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Process Datasheets
          </button>

          <div className="flex items-center gap-3 mb-2">
            {HeaderIcon && <HeaderIcon className={`w-8 h-8 ${accent.text}`} />}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {config.pageTitle}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{config.pageSubtitle}</p>
        </div>

        {/* Body grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Files
              </h2>

              {config.documents.map((doc) => {
                const dAccent = docAccent(doc.key);
                const file = files[doc.key];
                const active = dragActive[doc.key];
                return (
                  <div className="mb-4 last:mb-0" key={doc.key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {doc.label} {doc.required ? '(Required)' : '(Optional)'}
                    </label>
                    <div
                      onDragEnter={(e) => handleDrag(e, doc.key)}
                      onDragLeave={(e) => handleDrag(e, doc.key)}
                      onDragOver={(e)  => handleDrag(e, doc.key)}
                      onDrop={(e)      => handleDrop(e, doc.key, doc.label)}
                      onClick={()      => inputRefs.current[doc.key]?.click()}
                      className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200
                        ${active
                          ? `${dAccent.border} ${dAccent.bgSoft}`
                          : `border-gray-300 dark:border-gray-600 ${dAccent.ringHover}`}
                        ${file ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}`}
                    >
                      <input
                        ref={(el) => { inputRefs.current[doc.key] = el; }}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) validateAndSetFile(e.target.files[0], doc.key, doc.label);
                        }}
                      />
                      {!file ? (
                        <>
                          {doc.required ? (
                            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          ) : (
                            <Plus className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          )}
                          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                            Drop {doc.label} here or click to browse
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.hint || `PDF format (max ${MAX_FILE_SIZE_MB}MB)`}
                          </p>
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>

            {/* Auto-analysis info card */}
            {config.autoAnalysisCard && (
              <div className={`rounded-xl shadow-lg p-6 border-2 ${accent.bgSoft} ${accent.border}`}>
                <h2 className={`text-xl font-semibold mb-3 flex items-center gap-2 ${accent.text}`}>
                  <FileCheck className="w-5 h-5" />
                  {config.autoAnalysisCard.title}
                </h2>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                  {config.autoAnalysisCard.body}
                </p>
                {config.autoAnalysisCard.note && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <CheckCircle className={`w-4 h-4 ${accent.text}`} />
                    <span className="text-gray-700 dark:text-gray-200">{config.autoAnalysisCard.note}</span>
                  </div>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleUpload}
              disabled={!allRequiredPresent || uploading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-3
                ${uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${accent.btnBg} ${accent.btnHoverBg} shadow-lg hover:shadow-xl`}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {uploading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {analysisStage || 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {config.submitLabel || 'Generate Datasheet'}
                </>
              )}
            </button>

            {/* Progress */}
            {uploading && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Processing Progress</span>
                  <span className={`font-semibold ${accent.text}`}>{uploadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${accent.progressBar} transition-all duration-300`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success card */}
            {uploadResult && uploadResult.success && !uploading && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-500">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {config.successTitle || 'Datasheet Generated Successfully!'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {uploadResult.message || config.successBody || 'Your datasheet is ready for download.'}
                    </p>

                    {excelData && (
                      <button
                        onClick={handleDownloadExcel}
                        className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700
                                   text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200
                                   flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download Excel Datasheet
                      </button>
                    )}

                    <button
                      onClick={handleReset}
                      className="w-full mt-3 py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                                 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all duration-200"
                    >
                      Upload New Files
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HTML preview */}
            {htmlPreview && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Preview</h3>
                <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: htmlPreview }} />
              </div>
            )}
          </div>

          {/* Right column / sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                What This Tool Does
              </h2>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                {(config.whatThisDoes || []).map((b, i) => (
                  <div className="flex items-start gap-2" key={i}>
                    <span className={`font-bold ${accent.text}`}>•</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {Array.isArray(config.sections) && config.sections.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Datasheet Sections
                </h2>
                <div className="space-y-3">
                  {config.sections.map((s, i) => {
                    const auto = s.status === 'auto';
                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${auto
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {auto
                            ? <CheckCircle className="w-4 h-4 text-green-600" />
                            : <AlertCircle  className="w-4 h-4 text-gray-500" />}
                          <span className={`text-sm font-semibold ${auto ? 'text-green-900 dark:text-green-100' : 'text-gray-700 dark:text-gray-300'}`}>
                            {s.name}
                          </span>
                        </div>
                        <p className={`text-xs ${auto ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                          {s.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={`rounded-xl shadow-lg p-6 text-white bg-gradient-to-br ${accent.btnBg}`}>
              <h3 className="font-semibold mb-2">💡 AI-Powered Detection</h3>
              <p className="text-sm opacity-95">
                {config.aiCardBody ||
                  'Our system extracts technical specifications and generates professional datasheets ready for engineering review.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── default sync adapter — most JSON shapes already comply ──────────────
function defaultSyncAdapter(data) {
  if (!data) return { success: false, error: 'Empty response' };
  return {
    success:        data.success !== false && !data.error,
    html_preview:   data.html_preview,
    excel_base64:   data.excel_file || data.excel_base64,
    excel_filename: data.filename || data.excel_filename,
    message:        data.message,
    error:          data.error,
  };
}

export default DatasheetGeneratorTemplate;
