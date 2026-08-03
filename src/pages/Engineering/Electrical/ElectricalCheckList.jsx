/**
 * Electrical Check List Page
 * SOFT-CODED: Professional project-based checklist management
 * Version: 3.0.0 - Project-Based with AWS S3 Integration
 * 
 * Features:
 * - Project management (create, select, view)
 * - Multi-file PDF upload with project context
 * - AWS S3 storage integration
 * - AI extraction (OCR + optional Vision AI)
 * - Real-time extraction progress
 * - Excel export with S3 download
 * - Team collaboration and statistics
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentCheckIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowPathIcon,
  FolderOpenIcon,
  PlusCircleIcon,
  FolderPlusIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import { CHECKLIST_TEMPLATE, EXTRACTION_CONFIG, UI_CONFIG, PROJECT_NAME_MIN_LENGTH, PROJECT_NAME_MAX_LENGTH } from '../../../config/electricalChecklist.config';
import { PROJECT_ENDPOINTS, PROJECT_TEMPLATES } from '../../../config/electricalChecklistProject.config';
import { 
  TEMPLATE_SECTIONS, 
  TEMPLATE_COLUMNS, 
  SECTION_COLORS,
  FIELD_INPUT_CONFIG,
  getEmptyTemplateData 
} from '../../../config/electricalChecklistTemplate.config';

// SOFT-CODED: Page Configuration
const PAGE_CONFIG = {
  title: 'Electrical Checklist Projects',
  subtitle: 'Professional project-based checklist management with AWS S3 storage',
  backRoute: '/engineering/electrical',
  backText: 'Back to Electrical Engineering',
  showProjectSelector: true,
  enableQuickUpload: true
};

// SOFT-CODED: number of decimal places shown for the OpenAI Vision API cost
// (backend computes the exact value from real token usage; kept to 4 places
// since per-job cost is typically well under $1).
const CHECKLIST_COST_DECIMAL_PLACES = 4;

const formatChecklistCost = (costUsd) => {
  const cost = Number(costUsd) || 0;
  if (cost <= 0) return 'Free (OCR)';
  return `$${cost.toFixed(CHECKLIST_COST_DECIMAL_PLACES)}`;
};

const ElectricalCheckList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Project state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [newProjectData, setNewProjectData] = useState({
    project_name: '',
    description: '',
    location: '',
    client_name: '',
    template_id: 'ups_battery_standard',
    settings: {
      extract_signatures: true,
      require_approval: false,
      auto_generate_excel: true,
      s3_storage: true
    },
    tags: []
  });

  // Upload state management
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionStage, setExtractionStage] = useState('');
  const [extractionResult, setExtractionResult] = useState(null);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);

  // Checklist history — previously extracted/saved checklists for the
  // selected project so an inspection engineer can revisit and download them.
  const [projectChecklists, setProjectChecklists] = useState([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [viewingHistoryJobId, setViewingHistoryJobId] = useState(null);

  // BYOK — user-supplied OpenAI API key (optional). Never sent anywhere except
  // to our own /extract-handwriting/ endpoint; never persisted server-side.
  const [userApiKey, setUserApiKey] = useState(() => {
    try {
      const cfg = EXTRACTION_CONFIG.handwriting;
      if (cfg?.allowUserApiKey && cfg?.apiKeyStorage === 'session') {
        return sessionStorage.getItem(cfg.apiKeyStorageKey) || '';
      }
    } catch (_) { /* ignore */ }
    return '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [engineerName, setEngineerName] = useState('');
  // Optional label so an inspection engineer can tell checklists apart in
  // project history (e.g. "Q1 Site Visit"). Backend falls back to an
  // auto-generated name (Checklist #<id> — <date>) when left blank.
  const [checklistName, setChecklistName] = useState('');

  // Soft-coded extraction mode (Fast / Balanced / Deep / Vision-Only).
  // Persisted per-browser via localStorage so user's preference sticks.
  const [extractionMode, setExtractionMode] = useState(() => {
    try {
      const cfg = EXTRACTION_CONFIG.handwriting || {};
      const stored = localStorage.getItem(cfg.modeStorageKey);
      const validIds = (cfg.modes || []).map(m => m.id);
      if (stored && validIds.includes(stored)) return stored;
      return cfg.defaultMode || 'balanced';
    } catch (_) {
      return 'balanced';
    }
  });

  // Checklist data state
  const [checklistData, setChecklistData] = useState({});
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'
  const [expandedSections, setExpandedSections] = useState({});
  const [saving, setSaving] = useState(false);

  // Initialize checklist data on mount
  useEffect(() => {
    try {
      setChecklistData(getEmptyTemplateData());
    } catch (error) {
      console.error('Error initializing checklist data:', error);
      setChecklistData({});
    }
  }, []);

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Expand first section when switching to detailed view
  useEffect(() => {
    if (viewMode === 'detailed' && TEMPLATE_SECTIONS.length > 0) {
      // Expand first section by default if none are expanded
      if (Object.keys(expandedSections).length === 0) {
        setExpandedSections({ [TEMPLATE_SECTIONS[0].id]: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Fetch the checklist history (previously extracted/saved jobs) for a project.
  // Soft-coded: reuses PROJECT_ENDPOINTS.checklists (already routes to the
  // existing GET /projects/{id}/checklists/ backend action — no new endpoint).
  const fetchProjectChecklists = async (projectId) => {
    if (!projectId) return;
    try {
      setLoadingChecklists(true);
      const response = await apiClient.get(`${PROJECT_ENDPOINTS.checklists}${projectId}/checklists/`);
      if (response.data.success) {
        setProjectChecklists(response.data.checklists || []);
      }
    } catch (err) {
      console.error('Error loading checklist history:', err);
    } finally {
      setLoadingChecklists(false);
    }
  };

  // Load project history whenever a project is opened.
  useEffect(() => {
    if (selectedProject?.id) {
      fetchProjectChecklists(selectedProject.id);
    } else {
      setProjectChecklists([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  // Open a previously extracted/saved checklist from history into the detail view.
  const handleViewHistoryChecklist = async (job) => {
    try {
      setError(null);
      setViewingHistoryJobId(job.id);
      const response = await apiClient.get(`${EXTRACTION_CONFIG.endpoints.result}${job.id}/result/`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to load checklist');
      }

      const result = response.data.result || {};
      const summary = result.summary || {};

      setJobId(job.id);
      setExtractionResult({
        fields_extracted:   summary.fields_extracted   ?? job.fields_extracted   ?? 0,
        sections_completed: summary.sections_completed ?? 0,
        signatures_found:   summary.signatures_found   ?? job.signatures_found   ?? 0,
        confidence_score:   summary.confidence_score   ?? job.confidence_score   ?? 0,
        checklist_data:     result.checklist_data || {},
        sources:            result.sources,
        key_source:         result.key_source,
        key_status:         result.key_status,
        summary,
      });
      setChecklistData(prev => ({ ...prev, ...(result.checklist_data || {}) }));
      setChecklistName(result.checklist_name || job.checklist_name || '');
      setViewMode('detailed');
    } catch (err) {
      console.error('Error opening historical checklist:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load checklist history');
    } finally {
      setViewingHistoryJobId(null);
    }
  };

  // Download Excel for a specific historical job without first opening it.
  const handleDownloadHistoryExcel = async (job) => {
    await handleDownloadExcel(job.id);
  };

  // Fetch user's projects
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await apiClient.get(PROJECT_ENDPOINTS.list);
      
      if (response.data.success) {
        setProjects(response.data.projects);
        
        // Auto-select first project if available
        if (response.data.projects.length > 0 && !selectedProject) {
          setSelectedProject(response.data.projects[0]);
        }
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Create new project
  const handleCreateProject = async () => {
    const trimmedName = newProjectData.project_name.trim();
    if (!trimmedName) {
      setError('Project name is required');
      return;
    }
    if (trimmedName.length < PROJECT_NAME_MIN_LENGTH) {
      setError(`Project name must be at least ${PROJECT_NAME_MIN_LENGTH} characters long`);
      return;
    }
    if (trimmedName.length > PROJECT_NAME_MAX_LENGTH) {
      setError(`Project name cannot exceed ${PROJECT_NAME_MAX_LENGTH} characters`);
      return;
    }

    try {
      const response = await apiClient.post(PROJECT_ENDPOINTS.create, { ...newProjectData, project_name: trimmedName });
      
      if (response.data.success) {
        setProjects(prev => [response.data.project, ...prev]);
        setSelectedProject(response.data.project);
        setShowCreateProject(false);
        setNewProjectData({
          project_name: '',
          description: '',
          location: '',
          client_name: '',
          template_id: 'ups_battery_standard',
          settings: {
            extract_signatures: true,
            require_approval: false,
            auto_generate_excel: true,
            s3_storage: true
          },
          tags: []
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error creating project:', err);
      const fieldErrors = err.response?.data?.errors;
      const firstFieldError = fieldErrors && Object.values(fieldErrors)[0]?.[0];
      setError(firstFieldError || err.response?.data?.message || 'Failed to create project');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'application/pdf'
    );
    
    if (files.length === 0) {
      setError('Please upload PDF files only');
      return;
    }
    
    if (files.length > EXTRACTION_CONFIG.upload.maxFiles) {
      setError(`Maximum ${EXTRACTION_CONFIG.upload.maxFiles} files allowed`);
      return;
    }
    
    setSelectedFiles(files);
    setError(null);
    setExtractionResult(null);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(file => 
      file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      setSelectedFiles(files);
      setError(null);
      setExtractionResult(null);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // AI Extraction handler
  const handleExtract = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    if (!selectedProject) {
      setError('Please select a project first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setExtractionStage(UI_CONFIG.extractionStages[0]);

    // Soft-coded: use handwriting pipeline (synchronous) when enabled, else legacy async endpoint.
    const hwCfg = EXTRACTION_CONFIG.handwriting || {};
    const useHandwriting = hwCfg.enabled === true;

    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      formData.append('template_id', CHECKLIST_TEMPLATE.id);
      formData.append('extract_signatures', EXTRACTION_CONFIG.ocr.extractSignatures);
      formData.append('project_id', selectedProject.id);
      if (checklistName?.trim()) {
        formData.append('checklist_name', checklistName.trim());
      }

      if (useHandwriting) {
        if (engineerName?.trim()) {
          formData.append('engineer_name', engineerName.trim());
        }
        // Soft-coded extraction mode (fast / balanced / deep / vision_only).
        if (extractionMode) {
          formData.append('extraction_mode', extractionMode);
          try { localStorage.setItem(hwCfg.modeStorageKey, extractionMode); } catch (_) {}
        }
        // BYOK — only sent if user provided a key AND config allows it.
        if (hwCfg.allowUserApiKey && userApiKey?.trim()) {
          formData.append('openai_api_key', userApiKey.trim());
          if (hwCfg.apiKeyStorage === 'session') {
            try { sessionStorage.setItem(hwCfg.apiKeyStorageKey, userApiKey.trim()); } catch (_) {}
          }
        }
      }

      setExtractionStage(UI_CONFIG.extractionStages[1]);
      setUploadProgress(20);

      const endpoint = useHandwriting
        ? EXTRACTION_CONFIG.endpoints.uploadHandwriting
        : EXTRACTION_CONFIG.endpoints.upload;

      const response = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(Math.min(progress, 90));
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Extraction failed');
      }

      setJobId(response.data.job_id);

      // Handwriting endpoint is synchronous — result is in the response body.
      if (useHandwriting && response.data.checklist_data) {
        setUploadProgress(100);
        setExtractionStage(UI_CONFIG.extractionStages[UI_CONFIG.extractionStages.length - 1]);

        const summary = response.data.summary || {};
        setExtractionResult({
          fields_extracted:   summary.fields_extracted   || 0,
          sections_completed: summary.sections_completed || 0,
          signatures_found:   summary.signatures_found   || 0,
          confidence_score:   summary.confidence_score   || 0,
          checklist_data:     response.data.checklist_data,
          sources:            response.data.sources,
          key_source:         response.data.key_source,
          key_status:         response.data.key_status,
          summary,
        });

        // Auto-populate the 6-column detailed template with extracted values.
        setChecklistData(prev => ({ ...prev, ...response.data.checklist_data }));
        setViewMode('detailed');

        setUploading(false);
        setExtractionStage('');

        if (selectedProject) {
          fetchProjects();
          fetchProjectChecklists(selectedProject.id);
        }
      } else {
        // Legacy async path — poll for status.
        pollExtractionStatus(response.data.job_id);
      }

    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to extract checklist data');
      setUploading(false);
      setExtractionStage('');
    }
  };

  // Poll extraction status
  const pollExtractionStatus = async (jobId) => {
    let attempts = 0;
    const maxAttempts = EXTRACTION_CONFIG.polling.maxAttempts;

    const poll = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        clearInterval(poll);
        setError('Extraction timeout - please try again');
        setUploading(false);
        setExtractionStage('');
        return;
      }

      try {
        const response = await apiClient.get(`${EXTRACTION_CONFIG.endpoints.status}${jobId}/status/`);
        
        if (response.data.status === 'completed') {
          clearInterval(poll);
          setExtractionStage(UI_CONFIG.extractionStages[5]);
          setUploadProgress(100);
          setExtractionResult(response.data.result);
          setUploading(false);
          setExtractionStage('');
          
          // Refresh project statistics
          if (selectedProject) {
            fetchProjects();
          }
        } else if (response.data.status === 'failed') {
          clearInterval(poll);
          setError(response.data.error || 'Extraction failed');
          setUploading(false);
          setExtractionStage('');
        } else {
          // Update stage based on progress
          const stageIndex = Math.min(
            Math.floor((response.data.progress / 100) * UI_CONFIG.extractionStages.length),
            UI_CONFIG.extractionStages.length - 1
          );
          setExtractionStage(UI_CONFIG.extractionStages[stageIndex]);
          setUploadProgress(response.data.progress);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(poll);
        setError('Failed to check extraction status');
        setUploading(false);
        setExtractionStage('');
      }
    }, EXTRACTION_CONFIG.polling.intervalMs);
  };

  // Download Excel
  // SOFT-CODED: the backend may respond in two shapes depending on whether S3
  // storage is enabled for the project:
  //  1) Binary .xlsx bytes (S3 disabled / upload failed → direct FileResponse)
  //  2) JSON { success, download_url, ... } (S3 enabled → presigned URL)
  // We detect which one we got from the blob's content-type and handle both,
  // instead of assuming the raw response body is always the spreadsheet.
  //
  // Accepts an optional `targetJobId` so the checklist history list can
  // trigger a download for any past job without first "opening" it into the
  // detail view. Falls back to the currently open job's id (existing usage).
  const handleDownloadExcel = async (targetJobId) => {
    const downloadJobId = targetJobId || jobId;
    if (!downloadJobId) return;

    try {
      const response = await apiClient.get(
        `${EXTRACTION_CONFIG.endpoints.download}${downloadJobId}/download-excel/`,
        { responseType: 'blob' }
      );

      const blob = response.data;
      const contentType = (blob?.type || response.headers?.['content-type'] || '').toLowerCase();

      if (contentType.includes('application/json')) {
        // Backend returned a presigned S3 URL as JSON, not the file itself.
        const text = await blob.text();
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (parseErr) {
          throw new Error('Server returned an unexpected response while preparing the Excel file');
        }

        if (!payload.success || !payload.download_url) {
          throw new Error(payload.error || payload.message || 'Failed to prepare Excel file');
        }

        const link = document.createElement('a');
        link.href = payload.download_url;
        link.setAttribute('download', `checklist_${downloadJobId}.xlsx`);
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      // Raw binary .xlsx — download directly.
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `checklist_${downloadJobId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download Excel file');
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedFiles([]);
    setExtractionResult(null);
    setError(null);
    setJobId(null);
    setUploadProgress(0);
    setExtractionStage('');
    setViewMode('summary');
    setChecklistData(getEmptyTemplateData());
    setChecklistName('');
  };

  // Update checklist field value
  const updateFieldValue = (fieldId, column, value) => {
    setChecklistData(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [column]: value
      }
    }));
  };

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Expand all sections
  const expandAllSections = () => {
    const allExpanded = {};
    TEMPLATE_SECTIONS.forEach(section => {
      allExpanded[section.id] = true;
    });
    setExpandedSections(allExpanded);
  };

  // Collapse all sections
  const collapseAllSections = () => {
    setExpandedSections({});
  };

  // Save checklist data
  const handleSaveChecklist = async () => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }
    if (!jobId) {
      alert('No extraction job to save yet — please extract data first');
      return;
    }

    try {
      setSaving(true);

      // NOTE: PROJECT_ENDPOINTS.detail is a base path string (not a function) —
      // append the project id + action, matching the pattern used across this file.
      const response = await apiClient.post(
        `${PROJECT_ENDPOINTS.detail}${selectedProject.id}/save-checklist/`,
        {
          checklist_data: checklistData,
          job_id: jobId,
          checklist_name: checklistName?.trim() || undefined
        }
      );

      if (response.data.success) {
        alert('Checklist saved successfully!');
        if (selectedProject) fetchProjectChecklists(selectedProject.id);
      } else {
        alert(response.data.message || 'Failed to save checklist');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert(err.response?.data?.message || 'Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };

  // Render field input based on type
  const renderFieldInput = (field, fieldId, column, value) => {
    if (!TEMPLATE_COLUMNS.find(col => col.key === column)?.editable) {
      // Non-editable column (field_name)
      return <span className="font-medium text-gray-900">{value}</span>;
    }

    const inputConfig = FIELD_INPUT_CONFIG[field.type] || FIELD_INPUT_CONFIG.text;
    const inputProps = inputConfig.props || {};
    
    if (inputConfig.component === 'select' && field.options) {
      return (
        <select
          value={value || ''}
          onChange={(e) => updateFieldValue(fieldId, column, e.target.value)}
          {...inputProps}
        >
          <option value="">Select...</option>
          {field.options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    } else if (inputConfig.component === 'textarea') {
      return (
        <textarea
          value={value || ''}
          onChange={(e) => updateFieldValue(fieldId, column, e.target.value)}
          {...inputProps}
        />
      );
    } else {
      return (
        <input
          value={value || ''}
          onChange={(e) => updateFieldValue(fieldId, column, e.target.value)}
          {...inputProps}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-yellow-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(PAGE_CONFIG.backRoute)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            {PAGE_CONFIG.backText}
          </button>

          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg">
              <DocumentCheckIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {PAGE_CONFIG.title}
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                {PAGE_CONFIG.subtitle}
              </p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <SparklesIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">AI-Powered Extraction</h3>
                <p className="text-sm text-blue-800">
                  Upload inspection checklist PDFs and let AI extract all field data automatically.
                  Template: <span className="font-semibold">{CHECKLIST_TEMPLATE.name}</span>
                </p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                    {CHECKLIST_TEMPLATE.sections.length} Sections
                  </span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                    Signature Detection
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                    Excel Export
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Project Modal */}
        {showCreateProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <FolderPlusIcon className="h-7 w-7 text-yellow-500" />
                    Create New Checklist Project
                  </h2>
                  <button
                    onClick={() => setShowCreateProject(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Project Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProjectData.project_name}
                    onChange={(e) => setNewProjectData({ ...newProjectData, project_name: e.target.value })}
                    placeholder="e.g., Al-Ruwais UPS Inspection Q3 2026"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProjectData.description}
                    onChange={(e) => setNewProjectData({ ...newProjectData, description: e.target.value })}
                    placeholder="Describe the project scope and objectives..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>

                {/* Location & Client */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={newProjectData.location}
                      onChange={(e) => setNewProjectData({ ...newProjectData, location: e.target.value })}
                      placeholder="e.g., Abu Dhabi, UAE"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={newProjectData.client_name}
                      onChange={(e) => setNewProjectData({ ...newProjectData, client_name: e.target.value })}
                      placeholder="e.g., ADNOC"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Project Template
                  </label>
                  <select
                    value={newProjectData.template_id}
                    onChange={(e) => setNewProjectData({ ...newProjectData, template_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  >
                    {PROJECT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500">
                    {PROJECT_TEMPLATES.find(t => t.id === newProjectData.template_id)?.description}
                  </p>
                </div>

                {/* Settings */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Project Settings
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={newProjectData.settings.extract_signatures}
                        onChange={(e) => setNewProjectData({
                          ...newProjectData,
                          settings: { ...newProjectData.settings, extract_signatures: e.target.checked }
                        })}
                        className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-700">Extract signatures from checklists</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={newProjectData.settings.require_approval}
                        onChange={(e) => setNewProjectData({
                          ...newProjectData,
                          settings: { ...newProjectData.settings, require_approval: e.target.checked }
                        })}
                        className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-700">Require approval for extracted data</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={newProjectData.settings.auto_generate_excel}
                        onChange={(e) => setNewProjectData({
                          ...newProjectData,
                          settings: { ...newProjectData.settings, auto_generate_excel: e.target.checked }
                        })}
                        className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-700">Auto-generate Excel reports</span>
                    </label>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., UPS, Battery, Inspection"
                    onChange={(e) => {
                      const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                      setNewProjectData({ ...newProjectData, tags });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <XCircleIcon className="h-5 w-5" />
                      <span className="font-medium">{error}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-4">
                <button
                  onClick={() => setShowCreateProject(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Management Section */}
        {!selectedProject ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FolderOpenIcon className="h-8 w-8 text-yellow-500" />
                My Checklist Projects
              </h2>
              <button
                onClick={() => setShowCreateProject(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
              >
                <FolderPlusIcon className="h-5 w-5" />
                Create New Project
              </button>
            </div>

            {loadingProjects ? (
              <div className="text-center py-12">
                <ArrowPathIcon className="h-12 w-12 text-yellow-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpenIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Projects Yet</h3>
                <p className="text-gray-500 mb-6">Create your first checklist project to get started</p>
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  <PlusCircleIcon className="h-5 w-5" />
                  Create First Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-br from-white to-gray-50"
                    onClick={() => setSelectedProject(project)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-yellow-100 rounded-lg">
                        <FolderOpenIcon className="h-6 w-6 text-yellow-600" />
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        project.status === 'active' ? 'bg-green-100 text-green-700' :
                        project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                        project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{project.project_name}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{project.description || 'No description'}</p>
                    
                    <div className="space-y-2 mb-4">
                      {project.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Location:</span>
                          <span>{project.location}</span>
                        </div>
                      )}
                      {project.client_name && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Client:</span>
                          <span>{project.client_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">{project.total_checklists || 0}</div>
                        <div className="text-xs text-gray-500">Checklists</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{project.total_fields_extracted || 0}</div>
                        <div className="text-xs text-gray-500">Fields</div>
                      </div>
                    </div>

                    {project.tags && project.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {project.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Project Header */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                  </button>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <FolderOpenIcon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedProject.project_name}</h2>
                    <p className="text-sm text-gray-600">{selectedProject.project_code}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total Checklists</div>
                    <div className="text-2xl font-bold text-yellow-600">{selectedProject.total_checklists || 0}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Fields Extracted</div>
                    <div className="text-2xl font-bold text-blue-600">{selectedProject.total_fields_extracted || 0}</div>
                  </div>
                  {selectedProject.total_signatures_found > 0 && (
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Signatures</div>
                      <div className="text-2xl font-bold text-purple-600">{selectedProject.total_signatures_found}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist History — previously extracted/saved checklists for this
                project. Lets an inspection engineer revisit or download past
                records instead of only being able to start a brand new upload. */}
            {!extractionResult && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-yellow-500" />
                    Checklist History
                  </h3>
                  <button
                    onClick={() => fetchProjectChecklists(selectedProject.id)}
                    className="text-sm text-yellow-700 hover:text-yellow-900 flex items-center gap-1"
                    disabled={loadingChecklists}
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${loadingChecklists ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingChecklists ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Loading history...</div>
                ) : projectChecklists.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No checklists extracted yet for this project. Upload a PDF below to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-2 pr-4 font-medium">Name</th>
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium">Engineer</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 pr-4 font-medium">Fields</th>
                          <th className="py-2 pr-4 font-medium">Confidence</th>
                          <th className="py-2 pr-4 font-medium">Cost</th>
                          <th className="py-2 pr-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectChecklists.map((job) => (
                          <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 pr-4 font-medium text-gray-900 max-w-[220px] truncate" title={job.checklist_name}>
                              {job.checklist_name || `Checklist #${job.id}`}
                            </td>
                            <td className="py-3 pr-4 whitespace-nowrap">
                              {job.created_at ? new Date(job.created_at).toLocaleString() : '-'}
                            </td>
                            <td className="py-3 pr-4">{job.user_name || '-'}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                job.status === 'failed'    ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="py-3 pr-4">{job.fields_extracted ?? 0}</td>
                            <td className="py-3 pr-4">{job.confidence_score ? `${job.confidence_score}%` : '-'}</td>
                            <td className="py-3 pr-4 whitespace-nowrap" title="Exact OpenAI Vision API cost for this checklist (based on real token usage)">
                              {formatChecklistCost(job.cost_usd)}
                            </td>
                            <td className="py-3 pr-4 text-right">
                              {job.status === 'completed' ? (
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => handleViewHistoryChecklist(job)}
                                    disabled={viewingHistoryJobId === job.id}
                                    className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all font-medium text-xs disabled:opacity-50"
                                  >
                                    {viewingHistoryJobId === job.id ? 'Opening...' : 'View'}
                                  </button>
                                  <button
                                    onClick={() => handleDownloadHistoryExcel(job)}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium text-xs"
                                  >
                                    Download
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">{job.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Main Content */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              {!extractionResult ? (
                <>
                  {/* Upload Area */}
                  <div
                    className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all ${
                      selectedFiles.length > 0
                        ? 'border-green-500 bg-green-50'
                        : 'border-yellow-300 bg-yellow-50/30 hover:border-yellow-500 hover:bg-yellow-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={EXTRACTION_CONFIG.upload.acceptedFormats}
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />

                {selectedFiles.length === 0 ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    <CloudArrowUpIcon className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                      {UI_CONFIG.uploadArea.title}
                    </h3>
                    <p className="text-gray-600 mb-2">
                      {UI_CONFIG.uploadArea.subtitle}
                    </p>
                    <p className="text-sm text-gray-500">
                      {UI_CONFIG.uploadArea.helperText}
                    </p>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center mb-4">
                      <CheckCircleIcon className="h-16 w-16 text-green-600" />
                    </div>
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200"
                      >
                        <div className="flex items-center gap-3">
                          <DocumentTextIcon className="h-6 w-6 text-green-600" />
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        {!uploading && (
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <XCircleIcon className="h-6 w-6" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                  </div>

              {/* Error Message */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <XCircleIcon className="h-5 w-5" />
                    <span className="font-medium">{error}</span>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{extractionStage}</span>
                    <span className="text-sm font-medium text-yellow-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedFiles.length > 0 && !uploading && (
                <>
                  {/* Extraction mode selector (soft-coded from EXTRACTION_CONFIG.handwriting.modes) */}
                  {EXTRACTION_CONFIG.handwriting?.enabled && EXTRACTION_CONFIG.handwriting?.modes?.length > 0 && (
                    <div className="mt-6 p-4 border border-gray-200 rounded-xl bg-gradient-to-br from-white to-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-semibold text-gray-800">
                          Extraction Accuracy Mode
                        </label>
                        <span className="text-xs text-gray-500">
                          Selected: <span className="font-medium text-gray-800">{extractionMode}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {EXTRACTION_CONFIG.handwriting.modes.map((mode) => {
                          const isSelected = extractionMode === mode.id;
                          const isDisabled = mode.requiresApiKey && !userApiKey?.trim();
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setExtractionMode(mode.id)}
                              className={[
                                'text-left p-3 rounded-lg border-2 transition-all',
                                isSelected
                                  ? 'border-yellow-500 bg-yellow-50 shadow-md ring-2 ring-yellow-200'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm',
                                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                              ].join(' ')}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className={`text-sm font-semibold ${isSelected ? 'text-yellow-900' : 'text-gray-900'}`}>
                                  {mode.label}
                                </span>
                                {mode.recommended && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded uppercase font-bold">
                                    Rec
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mb-2">{mode.tagline}</p>
                              <p className="text-xs text-gray-600 leading-snug mb-2">{mode.description}</p>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-mono text-gray-500">{mode.cost}</span>
                                <span className="text-gray-500">{mode.accuracy}</span>
                              </div>
                              {isDisabled && (
                                <p className="mt-2 text-[10px] text-red-500 italic">
                                  Provide an OpenAI key below to enable
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Inspector attribution + optional user API key (BYOK) */}
                  <div className="mt-4 p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Checklist Name <span className="text-gray-400 font-normal">(optional — helps tell checklists apart in history)</span>
                      </label>
                      <input
                        type="text"
                        value={checklistName}
                        onChange={(e) => setChecklistName(e.target.value)}
                        placeholder="e.g. Q1 Site Visit — Substation A"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inspection Engineer <span className="text-gray-400 font-normal">(optional \u2014 for attribution)</span>
                      </label>
                      <input
                        type="text"
                        value={engineerName}
                        onChange={(e) => setEngineerName(e.target.value)}
                        placeholder="e.g. Habil, Shayad Abdul Razaq"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                      />
                    </div>

                    {EXTRACTION_CONFIG.handwriting?.allowUserApiKey && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                          <span>
                            Your OpenAI API Key <span className="text-gray-400 font-normal">(optional \u2014 BYOK)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowApiKey(v => !v)}
                            className="text-xs text-yellow-700 hover:text-yellow-900"
                          >
                            {showApiKey ? 'Hide' : 'Show'}
                          </button>
                        </label>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={userApiKey}
                          onChange={(e) => setUserApiKey(e.target.value)}
                          placeholder="sk-... (leave empty to use platform key)"
                          autoComplete="off"
                          spellCheck={false}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm font-mono ${
                            userApiKey.trim() && !/^sk-[A-Za-z0-9_\-]{18,}$/.test(userApiKey.trim())
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-300'
                          }`}
                        />
                        {userApiKey.trim() && !/^sk-[A-Za-z0-9_\-]{18,}$/.test(userApiKey.trim()) && (
                          <p className="mt-1 text-xs text-red-600 font-medium">
                            This does not look like an OpenAI API key. Valid keys start with <code>sk-</code> and are 20+ characters. Your key will be ignored and the platform key will be used instead.
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          Your key is used according to the accuracy mode above (Fast = never, Balanced = only if OCR is weak, Deep / Vision-Only = every page). Held in your browser session and never stored on our servers.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={handleExtract}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
                    >
                      <SparklesIcon className="h-6 w-6" />
                      Extract Data with AI
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-semibold"
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Extraction Results */
            <div className="space-y-6">
              {/* BYOK key rejected warning (surfaced from backend key_status) */}
              {extractionResult.key_status?.user_rejected && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">Your OpenAI API key was not used</p>
                    <p className="text-amber-800 mt-1">
                      {extractionResult.key_status.reason || 'The key you provided was invalid.'}
                      {' '}Extraction ran with the platform key instead. To use your own key, paste a valid one that starts with <code className="font-mono bg-white px-1 rounded">sk-</code>.
                    </p>
                  </div>
                </div>
              )}

              {/* Success Banner with View Toggle */}
              <div className="flex items-center justify-between p-6 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-4">
                  <CheckCircleIcon className="h-12 w-12 text-green-600" />
                  <div>
                    <h3 className="text-xl font-bold text-green-900">Extraction Complete!</h3>
                    <p className="text-green-700">
                      Successfully extracted {extractionResult.fields_extracted} fields from {selectedFiles.length} file(s)
                    </p>
                    <input
                      type="text"
                      value={checklistName}
                      onChange={(e) => setChecklistName(e.target.value)}
                      placeholder={`Checklist #${jobId} — name it to find it later`}
                      title="Checklist name — shown in the project's Checklist History"
                      className="mt-2 w-72 max-w-full px-2 py-1 text-sm bg-white/70 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                    <button
                      onClick={() => setViewMode('summary')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        viewMode === 'summary'
                          ? 'bg-green-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => setViewMode('detailed')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        viewMode === 'detailed'
                          ? 'bg-green-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Detailed View
                    </button>
                  </div>
                  <button
                    onClick={() => handleDownloadExcel()}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Download Excel
                  </button>
                </div>
              </div>

              {viewMode === 'summary' ? (
                /* Summary View */
                <>
                  {/* Extracted Data Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="text-3xl font-bold text-blue-900 mb-1">
                        {extractionResult.sections_completed}
                      </div>
                      <div className="text-sm text-blue-700">Sections Completed</div>
                    </div>
                    <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="text-3xl font-bold text-purple-900 mb-1">
                        {extractionResult.signatures_found || 0}
                      </div>
                      <div className="text-sm text-purple-700">Signatures Detected</div>
                    </div>
                    <div className="p-6 bg-yellow-50 rounded-xl border border-yellow-200">
                      <div className="text-3xl font-bold text-yellow-900 mb-1">
                        {extractionResult.confidence_score}%
                      </div>
                      <div className="text-sm text-yellow-700">Average Confidence</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                      Extract Another Checklist
                    </button>
                  </div>
                </>
              ) : (
                /* Detailed Checklist View - 6 Column Table */
                <>
                  {/* Toolbar */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={expandAllSections}
                        className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={collapseAllSections}
                        className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        Collapse All
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveChecklist}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold"
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Checklist Sections */}
                  <div className="space-y-4">
                    {TEMPLATE_SECTIONS && TEMPLATE_SECTIONS.length > 0 ? (
                      TEMPLATE_SECTIONS.map((section) => {
                        const sectionColors = SECTION_COLORS[section.color] || SECTION_COLORS.blue;
                        const isExpanded = expandedSections[section.id];

                      return (
                        <div key={section.id} className={`rounded-xl border-2 ${sectionColors.border} overflow-hidden`}>
                          {/* Section Header */}
                          <button
                            onClick={() => toggleSection(section.id)}
                            className={`w-full p-4 ${sectionColors.bg} flex items-center justify-between hover:opacity-90 transition-all`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 ${sectionColors.badge} rounded-lg font-bold`}>
                                {section.number}
                              </span>
                              <div className="text-left">
                                <h3 className={`text-lg font-bold ${sectionColors.text}`}>
                                  {section.title}
                                  {section.subtitle && <span className="ml-2 text-sm font-normal">{section.subtitle}</span>}
                                </h3>
                                <p className="text-sm text-gray-600">{section.description}</p>
                              </div>
                            </div>
                            <svg
                              className={`w-6 h-6 ${sectionColors.icon} transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Section Content - Table */}
                          {isExpanded && (
                            <div className="bg-white">
                              {/* Table Header */}
                              <div className="grid grid-cols-6 gap-2 p-4 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">
                                {TEMPLATE_COLUMNS.map((col) => (
                                  <div key={col.key} className="px-2">
                                    {col.label}
                                    {col.description && (
                                      <p className="text-xs text-gray-500 font-normal mt-1">{col.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Table Rows */}
                              <div className="divide-y divide-gray-200">
                                {section.fields.map((field) => {
                                  const fieldData = checklistData[field.id] || {};
                                  
                                  return (
                                    <div key={field.id} className="grid grid-cols-6 gap-2 p-4 hover:bg-gray-50 transition-colors">
                                      {TEMPLATE_COLUMNS.map((col) => (
                                        <div key={`${field.id}-${col.key}`} className="px-2">
                                          {col.key === 'field_name' 
                                            ? renderFieldInput(field, field.id, col.key, field.name)
                                            : renderFieldInput(field, field.id, col.key, fieldData[col.key] || '')
                                          }
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <p>No template sections available. Please check the configuration.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  </div>
  );
};

export default ElectricalCheckList;
