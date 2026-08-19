/**
 * MOV Equipment P&ID Upload Page
 * Allows P&ID + HMB upload for Motor Operated Valve (MOV) datasheet generation
 * - Upload P&ID diagrams + HMB
 * - Optional third document upload
 * - Automatic MOV detection and classification
 * - Datasheet population (Section 1 & 2 only)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  ArrowLeft,
  Settings2,
  FileCheck,
  Download,
  Plus
} from 'lucide-react';
import apiClient from '../../services/api.service';

const MOVEquipmentPage = () => {
  const navigate = useNavigate();
  const pidInputRef = useRef(null);
  const hmbInputRef = useRef(null);
  const otherInputRef = useRef(null);

  // State management
  const [pidFile, setPidFile] = useState(null);
  const [hmbFile, setHmbFile] = useState(null);
  const [otherFile, setOtherFile] = useState(null);
  const [pidDragActive, setPidDragActive] = useState(false);
  const [hmbDragActive, setHmbDragActive] = useState(false);
  const [otherDragActive, setOtherDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [htmlPreview, setHtmlPreview] = useState('');
  const [excelData, setExcelData] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pidFile) URL.revokeObjectURL(URL.createObjectURL(pidFile));
      if (hmbFile) URL.revokeObjectURL(URL.createObjectURL(hmbFile));
      if (otherFile) URL.revokeObjectURL(URL.createObjectURL(otherFile));
    };
  }, [pidFile, hmbFile, otherFile]);

  // File validation and setter
  const validateAndSetFile = (file, setter, label) => {
    const fileExtension = file.name.split('.').pop().toUpperCase();
    if (!['PDF'].includes(fileExtension)) {
      setError(`${label} must be PDF format`);
      return;
    }
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      setError(`${label} file exceeds 50MB limit`);
      return;
    }
    setter(file);
    setError('');
    setUploadResult(null);
  };

  // File change handlers
  const handlePidFileChange = (e) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0], setPidFile, 'P&ID');
  };

  const handleHmbFileChange = (e) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0], setHmbFile, 'HMB');
  };

  const handleOtherFileChange = (e) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0], setOtherFile, 'Other document');
  };

  // Drag handlers
  const handleDrag = (e, setActive) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e, setter, label, setActive) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0], setter, label);
    }
  };

  // Upload and analyze
  const handleUpload = async () => {
    if (!pidFile) {
      setError('Please select a P&ID file');
      return;
    }

    if (!hmbFile) {
      setError('Please select an HMB file');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);
    setHtmlPreview('');
    setExcelData(null);
    setAnalysisStage('Uploading files...');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('pid_file', pidFile);
      formDataToSend.append('hmb_file', hmbFile);
      if (otherFile) formDataToSend.append('other_doc', otherFile);
      formDataToSend.append('equipment_type', 'mov_equipment');

      setUploadProgress(10);
      setAnalysisStage('Uploading files...');

      // Call MOV equipment analysis endpoint (async)
      const response = await apiClient.post(
        '/process-datasheet/datasheets/extract-mov-equipment/',
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
          },
          responseType: 'json',
        }
      );

      const responseData = response.data;

      // Start polling for results
      if (responseData.job_id) {
        pollJobStatus(responseData.job_id);
      } else if (responseData.success) {
        // Immediate response (fallback)
        setHtmlPreview(responseData.html_preview);
        setExcelData({
          base64: responseData.excel_file,
          filename: responseData.filename
        });
        setUploadResult({ success: true });
        setUploadProgress(100);
        setAnalysisStage('Complete!');
        setUploading(false);
      } else {
        throw new Error(responseData.error || 'Analysis failed');
      }

    } catch (err) {
      console.error('MOV equipment upload error:', err);
      setError(err.response?.data?.error || err.message || 'Upload failed. Please try again.');
      setUploadResult({ success: false });
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  // ── Soft-coded polling config ──────────────────────────────────────────────
  // Adaptive intervals: fast at first, slows down to reduce server load.
  // Total timeout = sum of all intervals across phases.
  // Increase POLL_PHASES entries or POLL_MAX_TOTAL_MS to allow longer jobs.
  const POLL_PHASES = [
    { upToSeconds: 120, intervalMs: 3000 },   // 0–2 min  : every 3 s
    { upToSeconds: 360, intervalMs: 5000 },   // 2–6 min  : every 5 s
    { upToSeconds: 900, intervalMs: 8000 },   // 6–15 min : every 8 s
  ];
  const POLL_MAX_TOTAL_MS = 15 * 60 * 1000;  // 15 minutes absolute max
  // Per-request timeout for the *status* poll. The endpoint is a tiny cache
  // read on the backend, so 25 s is more than enough — failing fast here lets
  // us simply retry on the next interval instead of hogging axios for 120 s
  // when a gunicorn worker is briefly tied up by the extraction thread.
  const POLL_REQUEST_TIMEOUT_MS = 25000;
  // Number of consecutive transient poll failures (timeout / network / 5xx)
  // we tolerate before surfacing an error. The background job keeps running
  // on the server regardless of our poll failing — we just retry the cheap
  // status read until either it succeeds or we cross the absolute max.
  const POLL_MAX_CONSECUTIVE_ERRORS = 8;
  // Transient errors that should NOT abort the polling loop.
  const isTransientPollError = (err) => {
    if (!err) return false;
    if (err.isTimeout || err.isNetworkError) return true;
    if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true;
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('network')) return true;
    const sc = err.response?.status;
    if (sc === 502 || sc === 503 || sc === 504 || sc === 408 || sc === 429) return true;
    return false;
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Poll job status
  const pollJobStatus = async (jobId) => {
    const startTime = Date.now();
    let consecutiveErrors = 0;

    const getInterval = () => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      for (const phase of POLL_PHASES) {
        if (elapsedSec <= phase.upToSeconds) return phase.intervalMs;
      }
      return POLL_PHASES[POLL_PHASES.length - 1].intervalMs;
    };

    const poll = async () => {
      try {
        const statusResponse = await apiClient.get(
          `/process-datasheet/mov-job-status/${jobId}/`,
          { timeout: POLL_REQUEST_TIMEOUT_MS }
        );
        const { status, progress, stage, result, error: jobError } = statusResponse.data;

        // Success — reset the transient-error counter
        consecutiveErrors = 0;

        setUploadProgress(progress || 0);
        setAnalysisStage(stage || 'Processing...');

        if (status === 'completed' && result) {
          if (result.success) {
            setHtmlPreview(result.html_preview);
            setExcelData({
              base64: result.excel_file,
              filename: result.filename
            });
            setUploadResult({ success: true });
            setUploadProgress(100);
            setAnalysisStage('Complete!');
          } else {
            throw new Error(result.error || 'Processing failed');
          }
          setUploading(false);
        } else if (status === 'failed') {
          throw new Error(jobError || 'Processing failed');
        } else if (status === 'processing' || status === 'not_found') {
          // 'not_found' can occur for a brief window right after job start
          // before the worker writes its first cache key — treat as in-flight.
          const elapsed = Date.now() - startTime;
          if (elapsed < POLL_MAX_TOTAL_MS) {
            const elapsedMin = Math.floor(elapsed / 60000);
            const elapsedSec = Math.floor((elapsed % 60000) / 1000);
            setAnalysisStage(stage || `Processing... (${elapsedMin}m ${elapsedSec}s)`);
            setTimeout(poll, getInterval());
          } else {
            throw new Error(`Processing is taking longer than expected (>${POLL_MAX_TOTAL_MS / 60000} min). Please try again.`);
          }
        }

      } catch (err) {
        // Transient network / timeout / 5xx — keep polling, the background
        // job is still running server-side. Only abort after N consecutive
        // failures, or once we exceed the absolute polling budget.
        if (isTransientPollError(err)) {
          consecutiveErrors += 1;
          const elapsed = Date.now() - startTime;
          console.warn(
            `[MOV Poll] Transient error (${consecutiveErrors}/${POLL_MAX_CONSECUTIVE_ERRORS}) — retrying:`,
            err.message
          );
          if (
            consecutiveErrors < POLL_MAX_CONSECUTIVE_ERRORS &&
            elapsed < POLL_MAX_TOTAL_MS
          ) {
            const elapsedMin = Math.floor(elapsed / 60000);
            const elapsedSec = Math.floor((elapsed % 60000) / 1000);
            setAnalysisStage(
              `Processing... (${elapsedMin}m ${elapsedSec}s) — reconnecting`
            );
            setTimeout(poll, getInterval());
            return;
          }
          // Exhausted retries — fall through to error handling
        }

        console.error('Job status polling error:', err);
        setError(err.message || 'Failed to retrieve results');
        setUploadResult({ success: false });
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 2000);
      }
    };

    poll();
  };

  const handleDownloadExcel = () => {
    if (!excelData) return;

    try {
      const binaryString = window.atob(excelData.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
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

  const handleReset = () => {
    setPidFile(null);
    setHmbFile(null);
    setOtherFile(null);
    setUploadResult(null);
    setHtmlPreview('');
    setExcelData(null);
    setError('');
    setUploadProgress(0);
    setAnalysisStage('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/engineering/process/datasheet')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Process Datasheets
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Settings2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              MOV Equipment Datasheet Generator
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Upload P&ID + HMB → AI detects MOV valves → Download "MOV Equipment Data Sheet.xlsx"
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Upload & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload Areas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Files
              </h2>

              {/* P&ID Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  P&ID Drawing (Required)
                </label>
                <div
                  onDragEnter={(e) => handleDrag(e, setPidDragActive)}
                  onDragLeave={(e) => handleDrag(e, setPidDragActive)}
                  onDragOver={(e) => handleDrag(e, setPidDragActive)}
                  onDrop={(e) => handleDrop(e, setPidFile, 'P&ID', setPidDragActive)}
                  onClick={() => pidInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    transition-all duration-200
                    ${pidDragActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    }
                    ${pidFile ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}
                  `}
                >
                  <input
                    ref={pidInputRef}
                    type="file"
                    onChange={handlePidFileChange}
                    accept=".pdf"
                    className="hidden"
                  />

                  {!pidFile ? (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Drop P&ID file here or click to browse
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF format (max 50MB)
                      </p>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {pidFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(pidFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* HMB Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  HMB Document (Required)
                </label>
                <div
                  onDragEnter={(e) => handleDrag(e, setHmbDragActive)}
                  onDragLeave={(e) => handleDrag(e, setHmbDragActive)}
                  onDragOver={(e) => handleDrag(e, setHmbDragActive)}
                  onDrop={(e) => handleDrop(e, setHmbFile, 'HMB', setHmbDragActive)}
                  onClick={() => hmbInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    transition-all duration-200
                    ${hmbDragActive
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
                    }
                    ${hmbFile ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}
                  `}
                >
                  <input
                    ref={hmbInputRef}
                    type="file"
                    onChange={handleHmbFileChange}
                    accept=".pdf"
                    className="hidden"
                  />

                  {!hmbFile ? (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Drop HMB file here or click to browse
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF format (max 50MB)
                      </p>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {hmbFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(hmbFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Optional Document Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Document (Optional)
                </label>
                <div
                  onDragEnter={(e) => handleDrag(e, setOtherDragActive)}
                  onDragLeave={(e) => handleDrag(e, setOtherDragActive)}
                  onDragOver={(e) => handleDrag(e, setOtherDragActive)}
                  onDrop={(e) => handleDrop(e, setOtherFile, 'Other document', setOtherDragActive)}
                  onClick={() => otherInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    transition-all duration-200
                    ${otherDragActive
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
                    }
                    ${otherFile ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : ''}
                  `}
                >
                  <input
                    ref={otherInputRef}
                    type="file"
                    onChange={handleOtherFileChange}
                    accept=".pdf"
                    className="hidden"
                  />

                  {!otherFile ? (
                    <>
                      <Plus className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Drop additional file here (optional)
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF format (max 50MB)
                      </p>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {otherFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(otherFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>

            {/* Quick Info Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl shadow-lg p-6 border-2 border-blue-200 dark:border-blue-700">
              <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Auto-Analysis Enabled
              </h2>
              <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                Upload your P&ID and HMB files, and our AI will automatically detect all Motor Operated Valves (MOV).
                The results will be downloaded as <strong>"MOV Equipment Data Sheet.xlsx"</strong> with Section 1 (General Data) and Section 2 (Operating Conditions) populated.
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-700 dark:text-blue-300">Sections 1 & 2 auto-filled • Sections 3 & 4 for manual input</span>
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!pidFile || !hmbFile || uploading}
              className={`
                w-full py-4 px-6 rounded-xl font-semibold text-white
                transition-all duration-200 flex items-center justify-center gap-3
                ${uploading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {uploading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {analysisStage || 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Generate MOV Equipment Datasheets
                </>
              )}
            </button>

            {/* Upload Progress */}
            {uploading && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Processing Progress</span>
                  <span className="font-semibold text-blue-600">{uploadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Result */}
            {uploadResult && uploadResult.success && !uploading && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-green-500">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      MOV Datasheets Generated Successfully!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Your MOV equipment datasheets are ready for download.
                    </p>

                    {/* Download Button */}
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

                    {/* Reset Button */}
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

            {/* HTML Preview */}
            {htmlPreview && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Preview</h3>
                <div
                  className="overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: htmlPreview }}
                />
              </div>
            )}
          </div>

          {/* Right Panel - Info */}
          <div className="space-y-6">
            {/* What This Tool Does */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                What This Tool Does
              </h2>

              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Automatically detects all Motor Operated Valves (MOV) in P&ID</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Extracts HMB process conditions: temperature, pressure, fluid properties</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Populates Section 1 (General Data) from P&ID and Section 2 (Operating Conditions) from HMB</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Leaves Section 3 (Valve Details) and Section 4 (Actuator Details) blank for manual input</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Generates professional Excel datasheets ready for engineering review</span>
                </div>
              </div>
            </div>

            {/* Datasheet Sections */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Datasheet Sections
              </h2>

              <div className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900 dark:text-green-100">Section 1: General Data</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Auto-populated from P&ID (Tag, Service, Line No, etc.)
                  </p>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900 dark:text-green-100">Section 2: Operating Conditions</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Auto-populated from HMB (Pressure, Temperature)
                  </p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Section 3: Valve Details</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Left blank for manual engineering input
                  </p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Section 4: Actuator Details</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Left blank for manual engineering input
                  </p>
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
              <h3 className="font-semibold mb-2">💡 AI-Powered Detection</h3>
              <p className="text-sm text-blue-100">
                Our system automatically identifies MOV valves, extracts technical specifications,
                and generates professional datasheets ready for engineering review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MOVEquipmentPage;
