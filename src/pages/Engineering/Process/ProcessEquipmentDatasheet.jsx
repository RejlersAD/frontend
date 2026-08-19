/**
 * Process Equipment Datasheet Generator
 * SOFT-CODED: P&ID upload page for automatic equipment detection and datasheet generation
 * Features:
 * - Single or multiple P&ID file upload
 * - Drag & drop interface
 * - AI-powered equipment detection
 * - Automatic datasheet generation
 * - Excel export functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import PROCESS_EQUIPMENT_UPLOAD_CONFIG, {
  validateFileSize,
  validateFileFormat,
  getEquipmentTypeById,
  getColorScheme,
  getApiEndpoint,
  handleApiError,
  retryRequest
} from '../../../config/processEquipmentUpload.config';

const ProcessEquipmentDatasheet = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { page, upload, equipmentTypes, analysisOptions, projectFields, messages, theme } = PROCESS_EQUIPMENT_UPLOAD_CONFIG;

  // State management
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [selectedOptionsState, setSelectedOptionsState] = useState({
    extract_tags: true,
    detect_types: true,
    extract_specs: true,
    generate_datasheets: false,
    identify_connections: true
  });

  const [formData, setFormData] = useState({
    drawing_number: '',
    drawing_title: '',
    revision: projectFields.revision.default,
    project_name: '',
    project_code: '',
    area: '',
    discipline: projectFields.discipline.default
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  // File handling
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const validatedFiles = [];
    const errors = [];

    newFiles.forEach(file => {
      // Validate format
      if (!validateFileFormat(file)) {
        errors.push(`${file.name}: ${messages.errors.invalidFormat} ${upload.supportedFormats.join(', ')}`);
        return;
      }

      // Validate size
      if (!validateFileSize(file)) {
        errors.push(`${file.name}: ${messages.errors.fileTooLarge.replace('{size}', upload.maxFileSize)}`);
        return;
      }

      // Check if file already added
      if (files.some(f => f.name === file.name && f.size === file.size)) {
        errors.push(`${file.name}: File already added`);
        return;
      }

      // Check max files limit
      if (files.length + validatedFiles.length >= upload.maxFiles) {
        errors.push(messages.errors.tooManyFiles.replace('{max}', upload.maxFiles));
        return;
      }

      validatedFiles.push({
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      });
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setError('');
    }

    if (validatedFiles.length > 0) {
      setFiles(prev => [...prev, ...validatedFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
    setError('');
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  // Upload handler
  const handleUpload = async () => {
    if (files.length === 0) {
      setError(messages.errors.noFile);
      return;
    }

    // Validate required fields
    if (!formData.drawing_number) {
      setError('Drawing Number is required');
      return;
    }

    // Validate at least one analysis option is selected
    const hasSelectedOption = Object.values(selectedOptionsState).some(value => value === true);
    if (!hasSelectedOption) {
      setError('Please select at least one analysis option');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setWarning('');
    setAnalysisStage('Uploading P&ID drawings...');

    const uploadFormData = new FormData();

    // Add files
    files.forEach((fileObj, index) => {
      uploadFormData.append(`files`, fileObj.file);
    });

    // Add metadata
    uploadFormData.append('drawing_number', formData.drawing_number);
    uploadFormData.append('drawing_title', formData.drawing_title || 'Process Equipment Analysis');
    uploadFormData.append('revision', formData.revision);
    uploadFormData.append('project_name', formData.project_name);
    uploadFormData.append('project_code', formData.project_code);
    uploadFormData.append('area', formData.area);
    uploadFormData.append('discipline', formData.discipline);

    // Add analysis options
    Object.keys(selectedOptionsState).forEach(key => {
      uploadFormData.append(key, selectedOptionsState[key]);
    });

    uploadFormData.append('file_count', files.length);

    try {
      console.log('[Process Equipment] Starting P&ID upload...', {
        fileCount: files.length,
        options: selectedOptionsState
      });

      setAnalysisStage(`Uploading ${files.length} P&ID file(s)...`);

      // Determine endpoint based on number of files
      const endpoint = files.length === 1 
        ? getApiEndpoint('analyze')
        : getApiEndpoint('multiAnalyze');

      console.log(`[Process Equipment] Using endpoint: ${endpoint}`);

      // Make API call with retry logic
      const response = await retryRequest(
        async () => {
          return await apiClient.post(endpoint, uploadFormData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: files.length > 1 
              ? PROCESS_EQUIPMENT_UPLOAD_CONFIG.processing.multiFileTimeout 
              : PROCESS_EQUIPMENT_UPLOAD_CONFIG.processing.timeout,
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(Math.min(percentCompleted, 95)); // Reserve 5% for processing
              
              // Update stage based on progress
              if (percentCompleted > 30 && percentCompleted <= 60) {
                setAnalysisStage('Extracting equipment tags...');
              } else if (percentCompleted > 60 && percentCompleted <= 90) {
                setAnalysisStage('Detecting equipment types...');
              } else if (percentCompleted > 90) {
                setAnalysisStage('Generating datasheets...');
              }
            },
          });
        },
        PROCESS_EQUIPMENT_UPLOAD_CONFIG.processing.retryAttempts,
        PROCESS_EQUIPMENT_UPLOAD_CONFIG.processing.retryDelay
      );

      // Handle successful response
      if (response.data && response.data.success !== false) {
        const resultData = response.data;
        
        setUploadResult({
          success: true,
          upload_id: resultData.upload_id || resultData.id,
          files_processed: resultData.files_processed || files.length,
          equipment_detected: resultData.equipment_count || resultData.total_equipment || 0,
          equipment_summary: resultData.equipment_summary || resultData.equipment_by_type || {},
          processing_time: resultData.processing_time || 0,
          confidence_score: resultData.confidence_score || resultData.average_confidence || 0,
          drawings: resultData.drawings || [],
          equipment_list: resultData.equipment_list || resultData.equipment || []
        });
        
        // Check for warning conditions
        const confidenceScore = resultData.confidence_score || resultData.average_confidence || 0;
        const filesProcessed = resultData.files_processed || files.length;
        const equipmentCount = resultData.equipment_count || resultData.total_equipment || 0;
        
        // Low confidence warning
        if (confidenceScore > 0 && confidenceScore < 0.7) {
          setWarning(`Analysis completed with ${Math.round(confidenceScore * 100)}% confidence. Results may need manual verification.`);
        }
        
        // Partial processing warning
        if (filesProcessed < files.length) {
          setWarning(`Only ${filesProcessed} of ${files.length} files were processed successfully. Some files may have errors.`);
        }
        
        // No equipment detected warning
        if (equipmentCount === 0) {
          setWarning('No equipment was detected in the uploaded P&ID drawings. Please verify the file quality and try again.');
        }
        
        // Warnings from API response
        if (resultData.warnings && resultData.warnings.length > 0) {
          setWarning(resultData.warnings.join('\n'));
        }
        
        setUploadProgress(100);
        setAnalysisStage('Analysis complete!');
        
        console.log('[Process Equipment] Analysis complete:', resultData);
        
      } else {
        throw new Error(response.data.message || messages.errors.analysisFailed);
      }

    } catch (err) {
      console.error('[Process Equipment] Upload error:', err);
      
      // Use soft-coded error handling
      const errorMessage = handleApiError(err, PROCESS_EQUIPMENT_UPLOAD_CONFIG);
      setError(errorMessage);
      
      // Log detailed error for debugging
      console.error('[Process Equipment] Detailed error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
    } finally {
      setUploading(false);
      if (!error) {
        setUploadProgress(100);
      }
    }
  };

  const handleDownloadExcel = async () => {
    if (!uploadResult || !uploadResult.upload_id) {
      setError(messages.errors.noData);
      return;
    }

    try {
      console.log('[Process Equipment] Downloading Excel for upload_id:', uploadResult.upload_id);
      
      // Show downloading message
      const originalStage = analysisStage;
      setAnalysisStage(messages.info.processing);

      // Get endpoint with upload_id
      const endpoint = getApiEndpoint('downloadExcel', { 
        upload_id: uploadResult.upload_id 
      });

      // Make API call to download Excel
      const response = await apiClient.get(endpoint, {
        responseType: 'blob',
        timeout: PROCESS_EQUIPMENT_UPLOAD_CONFIG.processing.timeout,
      });

      // Create download link
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const drawingNumber = projectMetadata.drawingNumber || 'equipment';
      link.download = `${drawingNumber}_equipment_${timestamp}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // Show success message
      setAnalysisStage(messages.success.downloadComplete);
      setTimeout(() => setAnalysisStage(originalStage), 3000);
      
      console.log('[Process Equipment] Excel download complete');
      
    } catch (err) {
      console.error('[Process Equipment] Download error:', err);
      const errorMessage = handleApiError(err, PROCESS_EQUIPMENT_UPLOAD_CONFIG);
      setError(errorMessage);
    }
  };

  const handleReset = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setUploadResult(null);
    setError('');
    setWarning('');
    setUploadProgress(0);
    setAnalysisStage('');
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  /* ── Redesigned UI ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">

      {/* Ambient glow orbs */}
      <div className="pointer-events-none select-none" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-72 h-72 bg-blue-600/6 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto p-6">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <button
            onClick={() => navigate(page.backRoute)}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-emerald-400 mb-6 transition-colors text-sm font-medium group"
          >
            <ArrowLeftIcon className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            {page.backText}
          </button>

          <div className="flex items-start gap-5 mb-6">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <SparklesIcon className="h-8 w-8 text-white" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/30 animate-ping" style={{ animationDuration: '2.5s' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white tracking-tight">{page.title}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                  AI-Powered
                </span>
              </div>
              <p className="text-slate-400 text-sm">{page.subtitle}</p>
            </div>
          </div>

          {/* Capability pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: '🔍', label: 'Tag Extraction' },
              { icon: '⚙️', label: 'Equipment Detection' },
              { icon: '📋', label: 'Auto Datasheets' },
              { icon: '🔗', label: 'Connection Mapping' },
              { icon: '📊', label: 'Excel Export' },
            ].map(cap => (
              <span key={cap.label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
                <span>{cap.icon}</span>{cap.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Main Grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left Column: Upload + Project Info */}
          <div className="lg:col-span-2 space-y-5">

            {/* Upload Zone */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
              <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                <DocumentArrowUpIcon className="h-5 w-5 text-emerald-400" />
                Upload P&amp;ID Drawings
              </h2>

              <div
                className={[
                  'relative rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200',
                  dragActive ? 'border-emerald-400 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/50 hover:border-emerald-600 hover:bg-emerald-500/5',
                  uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer',
                ].join(' ')}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" multiple accept={upload.acceptString} onChange={handleFileChange} className="hidden" />

                <div className={`mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center transition-all ${dragActive ? 'bg-emerald-500/20 scale-110' : 'bg-slate-800'}`}>
                  <CloudArrowUpIcon className={`h-10 w-10 transition-colors ${dragActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                </div>

                <p className="text-slate-200 font-semibold text-base mb-1">
                  {upload.allowMultiple ? upload.dragDropTextMultiple : upload.dragDropText}
                </p>
                <p className="text-slate-500 text-sm mb-4">
                  {upload.supportedFormats.join(', ')} &middot; Max {upload.maxFileSize} MB &middot; Up to {upload.maxFiles} files
                </p>

                <button
                  type="button"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/40"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  Browse Files
                </button>
              </div>

              {files.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Queued Files ({files.length})
                  </p>
                  <div className="space-y-2">
                    {files.map((fileObj, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                            <DocumentTextIcon className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{fileObj.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(fileObj.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(idx)}
                          disabled={uploading}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 hover:text-red-400 text-slate-600 transition-colors disabled:opacity-40"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Project Information */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
              <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-emerald-400" />
                Project Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'drawing_number', field: projectFields.drawing_number, required: true },
                  { key: 'drawing_title',  field: projectFields.drawing_title },
                  { key: 'revision',       field: projectFields.revision },
                  { key: 'project_name',   field: projectFields.project_name },
                  { key: 'area',           field: projectFields.area },
                ].map(({ key, field, required }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      {field.label}{required && <span className="text-emerald-400 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      value={formData[key]}
                      onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={field.placeholder}
                      disabled={uploading}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors disabled:opacity-50"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {projectFields.discipline.label}
                  </label>
                  <select
                    value={formData.discipline}
                    onChange={(e) => setFormData(prev => ({ ...prev, discipline: e.target.value }))}
                    disabled={uploading}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors disabled:opacity-50 appearance-none"
                  >
                    {projectFields.discipline.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Analysis Options + Equipment Types */}
          <div className="lg:col-span-1 space-y-5">

            {/* AI Analysis Modules */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Cog6ToothIcon className="h-5 w-5 text-emerald-400" />
                Analysis Modules
              </h2>
              <div className="space-y-2.5">
                {Object.entries(analysisOptions).map(([key, option]) => {
                  const checked = selectedOptionsState[option.id];
                  return (
                    <label
                      key={key}
                      className={[
                        'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                        checked ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-800/60 border-slate-700 hover:border-slate-600',
                        uploading ? 'opacity-50 pointer-events-none' : '',
                      ].join(' ')}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setSelectedOptionsState(prev => ({ ...prev, [option.id]: e.target.checked }))}
                        disabled={uploading}
                        className="sr-only"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-base leading-none">{option.icon}</span>
                          <span className={`text-sm font-semibold ${checked ? 'text-emerald-300' : 'text-slate-300'}`}>{option.label}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Equipment Coverage */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
              <h2 className="text-base font-semibold text-white mb-4">Equipment Coverage</h2>
              <div className="grid grid-cols-2 gap-2">
                {equipmentTypes.slice(0, 6).map((type) => (
                  <div key={type.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                    <span className="text-xl leading-none">{type.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{type.name}</p>
                      <p className="text-xs text-slate-500">{type.code}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 text-center mt-3">
                +{equipmentTypes.length - 6} more types supported
              </p>
            </div>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mt-5 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300 mb-1">Error</p>
                <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
                {(error.includes('network') || error.includes('timeout') || error.includes('server')) && (
                  <button
                    onClick={() => { setError(''); uploadResult ? handleDownloadExcel() : files.length > 0 && handleUpload(); }}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-sm rounded-lg transition-colors"
                  >
                    <ArrowPathIcon className="h-4 w-4" /> Retry
                  </button>
                )}
              </div>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-300 transition-colors" aria-label="Dismiss">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Warning ────────────────────────────────────────────────────────── */}
        {warning && (
          <div className="mt-5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-amber-300 whitespace-pre-wrap">{warning}</p>
              <button onClick={() => setWarning('')} className="text-amber-500 hover:text-amber-300 transition-colors" aria-label="Dismiss">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Analyse Button ─────────────────────────────────────────────────── */}
        {!uploading && !uploadResult && files.length > 0 && (
          <div className="mt-5">
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-base shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <SparklesIcon className="h-5 w-5" />
              {files.length === 1
                ? upload.uploadButtonTextSingle
                : upload.uploadButtonTextMultiple.replace('{count}', files.length)}
            </button>
          </div>
        )}

        {/* ── Processing Panel ───────────────────────────────────────────────── */}
        {uploading && (
          <div className="mt-5 rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">AI Analysis in Progress</p>
                <p className="text-slate-500 text-xs truncate">{analysisStage}</p>
              </div>
              <span className="ml-auto text-emerald-400 font-mono text-sm font-semibold">{uploadProgress}%</span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <div className="flex justify-between mt-3">
              {['Upload', 'Extract Tags', 'Detect Types', 'Generate'].map((stage, i) => {
                const threshold = [0, 30, 60, 90][i];
                const active = uploadProgress >= threshold;
                return (
                  <div key={stage} className="flex flex-col items-center gap-1">
                    <div className={`w-2 h-2 rounded-full transition-colors ${active ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                    <span className={`text-xs ${active ? 'text-emerald-400' : 'text-slate-600'}`}>{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Results Panel ──────────────────────────────────────────────────── */}
        {uploadResult && !uploading && (
          <div className="mt-5 rounded-2xl bg-slate-900 border border-emerald-500/30 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white">{messages.success.uploadComplete}</h2>
                <p className="text-slate-400 text-sm">
                  {messages.success.filesProcessed.replace('{count}', uploadResult.files_processed)}&nbsp;&middot;&nbsp;
                  {messages.success.equipmentDetected.replace('{count}', uploadResult.equipment_detected)}
                </p>
              </div>
              {uploadResult.confidence_score > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-emerald-400">{Math.round(uploadResult.confidence_score * 100)}%</p>
                  <p className="text-xs text-slate-500">Confidence</p>
                </div>
              )}
            </div>

            {Object.keys(uploadResult.equipment_summary).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {Object.entries(uploadResult.equipment_summary).map(([key, count]) => {
                  const type = getEquipmentTypeById(key);
                  if (!type) return null;
                  return (
                    <div key={key} className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="text-2xl font-bold text-white">{count}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{type.name}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadExcel}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
              >
                <DocumentArrowUpIcon className="h-5 w-5" />
                Download Excel Datasheet
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-semibold text-sm transition-colors"
              >
                Upload More
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProcessEquipmentDatasheet;
