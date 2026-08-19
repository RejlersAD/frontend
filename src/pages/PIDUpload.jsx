/**

 * P&ID Upload with Project Management & Reference Documents

 * SOFT-CODED: Following PFD Verification design pattern

 * - Project creation and selection

 * - Reference document uploads (ISO standards, legends, datasheets)

 * - Document upload within project context

 * - Preserves core P&ID verification logic

 */



import { useState, useEffect, useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import {

  Package, FolderPlus, Edit, Trash2, X, CheckCircle, Loader,

  ArrowLeft, Upload as UploadIcon, FileText, Database,

  Activity, Zap, Shield, Layers, Clock, ChevronRight,

  BarChart2, AlertTriangle, Cpu, BookOpen, GitBranch

} from 'lucide-react';

import apiClient from '../services/api.service';

import { STORAGE_KEYS } from '../config/app.config';



const PIDUpload = () => {

  const navigate = useNavigate();

  

  // SOFT-CODED: Reference documents configuration for P&ID verification

  const referenceDocuments = [

    { key: 'equipment_list', label: 'Equipment Datasheet', icon: FileText, color: 'orange', required: false, description: 'Equipment specifications for cross-verification with P&ID equipment tags' },

    { key: 'line_list', label: 'Line List', icon: FileText, color: 'blue', required: false, description: 'Piping line specifications for verification against P&ID line numbers' },

    { key: 'critical_stress_list', label: 'Critical Stress Line List', icon: FileText, color: 'yellow', required: false, description: 'Stress-critical piping lines requiring flexibility, anchor, and support annotation verification' },

    { key: 'alarm_trip_schedule', label: 'Alarm & Trip Schedule', icon: FileText, color: 'red', required: false, description: 'Alarm and trip setpoints for instrument verification' },

    { key: 'instrument_datasheet', label: 'Instrument Datasheet', icon: FileText, color: 'indigo', required: false, description: 'Instrument specifications for verification' },

    { key: 'legends_symbols', label: 'Legend P&ID', icon: FileText, color: 'purple', required: false, description: 'Symbol and abbreviation definitions' }

  ];

  

  // Project management state

  const [selectedProject, setSelectedProject] = useState(null);

  const [projects, setProjects] = useState([]);

  const [loadingProjects, setLoadingProjects] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newProjectName, setNewProjectName] = useState('');

  const [newProjectDescription, setNewProjectDescription] = useState('');

  const [creatingProject, setCreatingProject] = useState(false);

  

  // Reference documents state

  const [referenceFiles, setReferenceFiles] = useState({});

  

  // SOFT-CODED: DesignIQ Line List import state

  const [showDesignIQModal, setShowDesignIQModal] = useState(false);

  const [designIQProjects, setDesignIQProjects] = useState([]);

  const [loadingDesignIQProjects, setLoadingDesignIQProjects] = useState(false);

  const [importingLineList, setImportingLineList] = useState(false);

  const [importedLineListJson, setImportedLineListJson] = useState(null);  // structured JSON from DesignIQ

  const [importedLineListLabel, setImportedLineListLabel] = useState('');  // display label



  // SOFT-CODED: DesignIQ Critical Stress Line List import state

  const [showCSSDesignIQModal, setShowCSSDesignIQModal] = useState(false);

  const [importingCSSList, setImportingCSSList] = useState(false);

  const [importedCSSJson, setImportedCSSJson] = useState(null);

  const [importedCSSLabel, setImportedCSSLabel] = useState('');

  

  // Edit/Delete modals

  const [showEditModal, setShowEditModal] = useState(false);

  const [editingProject, setEditingProject] = useState(null);

  const [editProjectName, setEditProjectName] = useState('');

  const [editProjectDescription, setEditProjectDescription] = useState('');

  const [updatingProject, setUpdatingProject] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [deletingProject, setDeletingProject] = useState(null);

  const [isDeleting, setIsDeleting] = useState(false);

  

  // Upload state (existing logic preserved)

  const [file, setFile] = useState(null);

  const [formData, setFormData] = useState({

    drawing_number: '',

    drawing_title: '',

    revision: '',

    project_name: '',

    auto_analyze: true,

    analysis_mode: 'standard',   // 'standard' = drawing-only | 'premium' = with RAD/external refs

    // Structured drawing number fields

    area: '',

    p_area: '',

    doc_code: '',

    serial_number: '',

    rev: '',

    sheet_number: '',

    total_sheets: ''

  });

  const [useStructuredNumber, setUseStructuredNumber] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [analysisStage, setAnalysisStage] = useState('');

  const [error, setError] = useState('');

  const [message, setMessage] = useState({ type: '', text: '' });

  const [dragActive, setDragActive] = useState(false);

  const uploadTimeoutRef = useRef(null);

  

  // Fetch projects on mount

  useEffect(() => {

    fetchProjects();

  }, []);

  

  // Cleanup timeout on unmount

  useEffect(() => {

    return () => {

      if (uploadTimeoutRef.current) {

        clearTimeout(uploadTimeoutRef.current);

      }

    };

  }, []);



  // ── SOFT-CODED: 8-pass analysis stage tracker (mirrors services.py pass count) ──

  const PASS_STAGES = [

    { pass: 1, label: 'OCR Extraction',       icon: '📄' },

    { pass: 2, label: 'Reference Processing', icon: '📚' },

    { pass: 3, label: 'Vision Analysis',      icon: '👁️' },

    { pass: 4, label: 'Cross-Validation',     icon: '🔗' },

    { pass: 5, label: 'Second Review',        icon: '🔍' },

    { pass: 6, label: 'Eng. Compliance',      icon: '⚙️' },

    { pass: 7, label: 'Line Size Check',      icon: '📐' },

    { pass: 8, label: 'Smart QC',             icon: '✅' },

  ];



  // SOFT-CODED: Engineering facts displayed during the analysis wait – keeps the user engaged

  const OIL_GAS_FACTS = [

    { icon: '⚙️', text: 'P&ID drawings are the single source of truth for process plant construction, operation, and maintenance documentation.' },

    { icon: '🛡️', text: 'PSV set pressure must never exceed equipment design pressure — a fundamental requirement per API 521/520.' },

    { icon: '🔬', text: 'NACE MR0175 specifies material requirements for H₂S sour service to prevent sulfide stress cracking (SSC) in oil & gas equipment.' },

    { icon: '🌡️', text: 'LTCS (Low Temperature Carbon Steel) is mandatory below −29 °C to prevent brittle fracture — critical for LNG and LPG services.' },

    { icon: '📐', text: 'API 6D requires trunnion-mounted ball valves on NPS ≥ 6″ isolating duty to prevent excessive stem torque and seat deformation.' },

    { icon: '⚡', text: 'ISA-5.1 standardises instrument identification — a common language for engineers, operators, and inspectors worldwide.' },

    { icon: '🔧', text: 'OS&Y (Outside Screw and Yoke) annotation is mandatory on gate valves NPS ≥ 2″ per API 600 for visible open/closed status.' },

    { icon: '📊', text: 'A complete control loop on a P&ID must show: process element → transmitter → controller → final control element.' },

    { icon: '💧', text: 'Gravity-drain lines require slope annotation ≥ 1:100 and low-point drain valves to ensure full drainage during maintenance.' },

    { icon: '🏭', text: 'AIFlow\'s 8-pass AI engine checks 40+ engineering compliance domains per drawing — covering instruments, piping, valves, and safety.' },

    { icon: '⚠️', text: 'Specification-break symbols (filled triangle) are mandatory at every pipe-class transition to avoid construction ambiguity.' },

    { icon: '🔴', text: 'Critical Stress Lines require anchor points (△), line guides, and expansion loops when operating above 120 °C.' },

  ];



  const [tickerIdx, setTickerIdx] = useState(0);



  // Rotate engineering facts during upload/analysis

  useEffect(() => {

    if (!uploading) return;

    const id = setInterval(() => setTickerIdx(p => (p + 1) % OIL_GAS_FACTS.length), 4500);

    return () => clearInterval(id);

  }, [uploading]);



  // Derived: which pass is currently active based on overall progress (soft-coded – tied to PASS_STAGES length)

  const activePass = Math.min(PASS_STAGES.length, Math.max(1, Math.ceil((uploadProgress / 100) * PASS_STAGES.length)));



  

  // ========== PROJECT MANAGEMENT FUNCTIONS ==========

  const fetchProjects = async () => {

    setLoadingProjects(true);

    try {

      const response = await apiClient.get('/pid/projects/');

      setProjects(response.data.projects || response.data.results || response.data || []);

    } catch (error) {

      console.error('Error fetching projects:', error);

      setMessage({ type: 'error', text: 'Failed to load projects' });

    } finally {

      setLoadingProjects(false);

    }

  };



  const handleCreateProject = async (e) => {

    e.preventDefault();

    

    if (!newProjectName.trim()) {

      setMessage({ type: 'error', text: 'Please enter a project name' });

      return;

    }



    setCreatingProject(true);

    try {

      const response = await apiClient.post('/pid/projects/', {

        name: newProjectName,

        description: newProjectDescription

      });



      const newProject = response.data.project || response.data;

      setSelectedProject(newProject);

      setShowCreateModal(false);

      setNewProjectName('');

      setNewProjectDescription('');

      

      // Update form with project name

      setFormData(prev => ({

        ...prev,

        project_name: newProject.project_name || newProject.name

      }));

      

      fetchProjects();

      setMessage({ type: 'success', text: `Project "${newProject.project_name || newProject.name}" created successfully!` });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {

      console.error('Error creating project:', error);

      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create project' });

    } finally {

      setCreatingProject(false);

    }

  };



  const handleEditClick = (e, project) => {

    e.stopPropagation();

    setEditingProject(project);

    setEditProjectName(project.project_name || project.name);

    setEditProjectDescription(project.description || '');

    setShowEditModal(true);

  };



  const handleUpdateProject = async (e) => {

    e.preventDefault();

    

    if (!editProjectName.trim()) {

      setMessage({ type: 'error', text: 'Please enter a project name' });

      return;

    }



    setUpdatingProject(true);

    try {

      await apiClient.put(`/pid/projects/${editingProject.id}/`, {

        project_name: editProjectName,

        description: editProjectDescription

      });



      fetchProjects();

      setShowEditModal(false);

      setEditingProject(null);

      setMessage({ type: 'success', text: 'Project updated successfully!' });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {

      setMessage({ type: 'error', text: 'Failed to update project' });

    } finally {

      setUpdatingProject(false);

    }

  };



  const handleDeleteClick = (e, project) => {

    e.stopPropagation();

    setDeletingProject(project);

    setShowDeleteConfirm(true);

  };



  const confirmDelete = async () => {

    setIsDeleting(true);

    try {

      await apiClient.delete(`/pid/projects/${deletingProject.id}/`);

      fetchProjects();

      setShowDeleteConfirm(false);

      setDeletingProject(null);

      setMessage({ type: 'success', text: 'Project deleted successfully' });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {

      setMessage({ type: 'error', text: 'Failed to delete project' });

    } finally {

      setIsDeleting(false);

    }

  };

  

  const handleSelectProject = (project) => {

    setSelectedProject(project);

    setFormData(prev => ({

      ...prev,

      project_name: project.project_name || project.name

    }));

  };



  const handleBackToProjects = () => {

    setSelectedProject(null);

    setFormData({

      drawing_number: '',

      drawing_title: '',

      revision: '',

      project_name: '',

      auto_analyze: true,

      analysis_mode: 'standard',

      area: '',

      p_area: '',

      doc_code: '',

      serial_number: '',

      rev: '',

      sheet_number: '',

      total_sheets: ''

    });

    setFile(null);

    setError('');

    setMessage({ type: '', text: '' });

    setReferenceFiles({});

    setUploadProgress(0);

    setAnalysisStage('');

    setUploading(false);

    if (uploadTimeoutRef.current) {

      clearInterval(uploadTimeoutRef.current);

      uploadTimeoutRef.current = null;

    }

    fetchProjects();

  };



  // ========== REFERENCE DOCUMENT HANDLERS (SOFT-CODED) ==========

  

  const handleReferenceFileChange = (key, e) => {

    const file = e.target.files[0];

    if (file) {

      if (file.type === 'application/pdf') {

        if (file.size <= 50 * 1024 * 1024) {

          setReferenceFiles(prev => ({ ...prev, [key]: file }));

          setMessage({ type: 'success', text: `Reference document selected: ${file.name}` });

          setTimeout(() => setMessage({ type: '', text: '' }), 3000);

        } else {

          setMessage({ type: 'error', text: 'File size exceeds 50MB limit' });

          e.target.value = '';

        }

      } else {

        setMessage({ type: 'error', text: 'Please select a PDF file' });

        e.target.value = '';

      }

    }

  };



  const removeReferenceFile = (key) => {

    setReferenceFiles(prev => {

      const newFiles = { ...prev };

      delete newFiles[key];

      return newFiles;

    });

    const input = document.getElementById(`ref-${key}`);

    if (input) input.value = '';

    setMessage({ type: 'success', text: 'Reference document removed' });

    setTimeout(() => setMessage({ type: '', text: '' }), 2000);

  };



  // ========== DESIGNIQ LINE LIST IMPORT HANDLERS (SOFT-CODED) ==========



  const handleOpenDesignIQModal = async () => {

    setShowDesignIQModal(true);

    setLoadingDesignIQProjects(true);

    try {

      const response = await apiClient.get('/pid/import-linelist/');

      setDesignIQProjects(response.data.projects || []);

    } catch (err) {

      console.error('Failed to fetch DesignIQ projects:', err);

      setMessage({ type: 'error', text: 'Could not load DesignIQ line list projects' });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } finally {

      setLoadingDesignIQProjects(false);

    }

  };



  const handleImportLineList = async (projectId, projectName) => {

    setImportingLineList(true);

    try {

      const response = await apiClient.get(`/pid/import-linelist/?project_id=${projectId}`);

      const lineListData = response.data.line_list || [];

      setImportedLineListJson(lineListData);

      setImportedLineListLabel(`DesignIQ: ${projectName} (${lineListData.length} lines)`);

      setShowDesignIQModal(false);

      setMessage({ type: 'success', text: `Line list imported from DesignIQ — ${lineListData.length} lines loaded` });

      setTimeout(() => setMessage({ type: '', text: '' }), 4000);

    } catch (err) {

      console.error('Failed to import line list:', err);

      setMessage({ type: 'error', text: 'Failed to import line list from DesignIQ' });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } finally {

      setImportingLineList(false);

    }

  };



  const handleImportCSSList = async (projectId, projectName) => {

    setImportingCSSList(true);

    try {

      const response = await apiClient.get(`/pid/import-linelist/?project_id=${projectId}&list_type=critical_stress`);

      const cssData = response.data.line_list || [];

      setImportedCSSJson(cssData);

      setImportedCSSLabel(`DesignIQ: ${projectName} — Critical Stress (${cssData.length} lines)`);

      setShowCSSDesignIQModal(false);

      setMessage({ type: 'success', text: `Critical stress line list imported — ${cssData.length} lines loaded` });

      setTimeout(() => setMessage({ type: '', text: '' }), 4000);

    } catch (err) {

      console.error('Failed to import critical stress list:', err);

      setMessage({ type: 'error', text: 'Failed to import critical stress list from DesignIQ' });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } finally {

      setImportingCSSList(false);

    }

  };



  const handleRemoveImportedCSSList = () => {

    setImportedCSSJson(null);

    setImportedCSSLabel('');

    setMessage({ type: 'success', text: 'Imported critical stress list removed' });

    setTimeout(() => setMessage({ type: '', text: '' }), 2000);

  };



  const handleRemoveImportedLineList = () => {

    setImportedLineListJson(null);

    setImportedLineListLabel('');

    setMessage({ type: 'success', text: 'Imported line list removed' });

    setTimeout(() => setMessage({ type: '', text: '' }), 2000);

  };



  const getColorClasses = (color) => {

    const colors = {

      blue: 'border-blue-200 bg-blue-50',

      green: 'border-green-200 bg-green-50',

      purple: 'border-purple-200 bg-purple-50',

      orange: 'border-orange-200 bg-orange-50',

      indigo: 'border-indigo-200 bg-indigo-50',

      pink: 'border-pink-200 bg-pink-50',

      red: 'border-red-200 bg-red-50',

      gray: 'border-gray-200 bg-gray-50',

      teal: 'border-teal-200 bg-teal-50',

      yellow: 'border-yellow-200 bg-yellow-50',

    };

    return colors[color] || colors.gray;

  };



  // ========== FILE HANDLING FUNCTIONS (Preserved Core Logic) ==========

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

    

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {

      handleFileSelect(e.dataTransfer.files[0]);

    }

  };



  const handleFileSelect = (selectedFile) => {

    // Enhanced PDF validation - check both extension and MIME type

    const fileName = selectedFile.name.toLowerCase();

    const fileType = selectedFile.type.toLowerCase();

    

    console.log('[FileSelect] File name:', selectedFile.name);

    console.log('[FileSelect] File type:', selectedFile.type);

    console.log('[FileSelect] File size:', selectedFile.size);

    

    // Accept PDF files by extension or MIME type

    const isPDF = fileName.endsWith('.pdf') || 

                  fileType === 'application/pdf' || 

                  fileType === 'application/x-pdf';

    

    if (!isPDF) {

      setError(`Invalid file type. Only PDF files are accepted. Received: ${selectedFile.name} (${selectedFile.type})`);

      return;

    }

    

    if (selectedFile.size > 50 * 1024 * 1024) {

      setError('File size cannot exceed 50MB');

      return;

    }

    

    setFile(selectedFile);

    setError('');

  };



  const handleInputChange = (e) => {

    const { name, value, type, checked } = e.target;

    setFormData(prev => ({

      ...prev,

      [name]: type === 'checkbox' ? checked : value

    }));

  };



  const handleSubmit = async (e) => {

    e.preventDefault();

    

    if (!file) {

      setError('Please select a P&ID drawing file');

      return;

    }



    setUploading(true);

    setError('');

    setUploadProgress(0);

    setAnalysisStage('Preparing upload...');



    // Create FormData with proper type handling

    const formDataToSend = new FormData();

    

    // Add file first - this is critical for proper multipart encoding

    formDataToSend.append('file', file);

    

    // SOFT-CODED: Include reference documents if uploaded

    Object.keys(referenceFiles).forEach(key => {

      formDataToSend.append(`reference_${key}`, referenceFiles[key]);

    });



    // SOFT-CODED: Include DesignIQ-imported line list JSON if available

    if (importedLineListJson) {

      formDataToSend.append('line_list_json', JSON.stringify(importedLineListJson));

    }



    // SOFT-CODED: Include DesignIQ-imported critical stress line list JSON if available

    if (importedCSSJson) {

      formDataToSend.append('critical_stress_json', JSON.stringify(importedCSSJson));

    }

    

    // Only append non-empty optional fields

    if (formData.drawing_number?.trim()) {

      formDataToSend.append('drawing_number', formData.drawing_number.trim());

    }

    if (formData.drawing_title?.trim()) {

      formDataToSend.append('drawing_title', formData.drawing_title.trim());

    }

    if (formData.revision?.trim()) {

      formDataToSend.append('revision', formData.revision.trim());

    }

    if (formData.project_name?.trim()) {

      formDataToSend.append('project_name', formData.project_name.trim());

    }

    

    // CRITICAL: Convert boolean to string for DRF BooleanField

    formDataToSend.append('auto_analyze', formData.auto_analyze ? 'true' : 'false');

    // SOFT-CODED: Analysis mode — 'standard' or 'premium'

    formDataToSend.append('analysis_mode', formData.analysis_mode || 'standard');



    try {

      console.log('[DEBUG] ===== UPLOAD REQUEST =====');

      console.log('[DEBUG] File:', {

        name: file.name,

        size: file.size,

        type: file.type,

        lastModified: new Date(file.lastModified).toISOString()

      });

      console.log('[DEBUG] FormData fields:');

      for (let [key, value] of formDataToSend.entries()) {

        console.log(`  ${key}:`, typeof value === 'object' ? `[File: ${value.name}]` : value);

      }

      console.log('[DEBUG] Reference documents count:', Object.keys(referenceFiles).length);

      console.log('[DEBUG] API Endpoint:', apiClient.defaults.baseURL + '/pid/drawings/upload/');

      

      console.log('[DEBUG] Preparing API request...');

      const authToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      console.log('[DEBUG] Auth token available:', !!authToken);

      

      // SAFEGUARD: Verify token exists before making request

      if (!authToken) {

        console.error('[ERROR] No authentication token found - user may not be logged in');

        setError('Authentication token missing. Please log in again.');

        setUploading(false);

        navigate('/login');

        return;

      }

      

      // Set progress tracking stages

      setAnalysisStage('Uploading file to server...');

      setUploadProgress(10);

      

      // Simulate progress during upload (since we can't track multipart upload progress easily)

      const progressInterval = setInterval(() => {

        setUploadProgress(prev => {

          if (prev < 20) return prev + 2;

          if (prev < 40) return prev + 1;

          return prev; // Stop at 40 until we get response

        });

      }, 500);

      uploadTimeoutRef.current = progressInterval; // SOFT-CODED: track so catch can clear it

      

      const response = await apiClient.post(

        '/pid/drawings/upload/',

        formDataToSend,

        {

          headers: {

            // Authorization is set by interceptor

            // Don't set Content-Type - let browser handle multipart boundary

          },

          timeout: 600000, // 10 minutes for file upload + AI analysis

          // Ensure we don't override Content-Type set by axios for FormData

          transformRequest: [(data) => {

            // Let axios handle FormData transformation

            return data;

          }],

          onUploadProgress: (progressEvent) => {

            // Track actual upload progress if available

            if (progressEvent.total) {

              const percentCompleted = Math.round((progressEvent.loaded * 40) / progressEvent.total);

              setUploadProgress(percentCompleted);

              if (percentCompleted > 30) {

                setAnalysisStage('File uploaded, starting AI analysis...');

              }

            }

          }

        }

      );

      

      // Clear progress interval on server response

      clearInterval(progressInterval);

      if (uploadTimeoutRef.current) {

        clearInterval(uploadTimeoutRef.current);

        uploadTimeoutRef.current = null;

      }

      

      console.log('[DEBUG] ===== UPLOAD SUCCESS =====');

      console.log('[DEBUG] Response:', response.data);

      

      setUploadProgress(100);

      setAnalysisStage('Analysis complete! Redirecting...');

      

      // Validate response structure

      if (!response.data || !response.data.id) {

        throw new Error('Invalid server response: missing drawing ID');

      }

      

      // Short delay to show completion before redirect

      setUploading(false);

      setTimeout(() => {

        navigate(`/pid/report/${response.data.id}`);

      }, 500);

    } catch (err) {

      // Clear any progress intervals

      if (uploadTimeoutRef.current) {

        clearInterval(uploadTimeoutRef.current);

        uploadTimeoutRef.current = null;

      }

      

      console.error('[ERROR] ===== UPLOAD FAILED =====');

      console.error('[ERROR] Full error:', err);

      console.error('[ERROR] Response status:', err.response?.status);

      console.error('[ERROR] Response data:', err.response?.data);

      console.error('[ERROR] Request config:', err.config);

      

      setUploadProgress(0);

      setAnalysisStage('');

      

      // Handle different error scenarios with detailed messages

      let errorMessage = 'Upload failed. Please try again.';

      

      if (err.response?.status === 401) {

        errorMessage = 'Authentication failed. Please log in again.';

        // Redirect to login

        setError(errorMessage);

        setTimeout(() => navigate('/login'), 2000);

        setUploading(false);

        return;

      } else if (err.response?.status === 415) {

        errorMessage = 'Unsupported media type. Please check file format and try again.';

        console.error('[ERROR] Content-Type issue - check multipart handling');

      } else if (err.response?.status === 400) {

        // Validation error - show detailed field errors

        const validationErrors = err.response.data;

        if (typeof validationErrors === 'object') {

          const fieldErrors = Object.entries(validationErrors)

            .map(([field, errors]) => {

              const errorMsg = Array.isArray(errors) ? errors[0] : errors;

              return `${field}: ${errorMsg}`;

            })

            .join(', ');

          errorMessage = `Validation error: ${fieldErrors}`;

        } else {

          errorMessage = `Validation error: ${validationErrors}`;

        }

      } else if (err.response?.data?.error) {

        // Backend returned a specific error message

        const backendError = err.response.data.error;

        

        // Check for OpenAI-specific errors

        if (backendError.includes('OpenAI') || backendError.includes('API key')) {

          errorMessage = '⚠️ Configuration Error: OpenAI service is not configured on the server. Please contact the administrator.';

        } else if (backendError.includes('quota') || backendError.includes('credits')) {

          errorMessage = '⚠️ Service Limit: Analysis service has reached its usage limit. Please contact the administrator.';

        } else if (backendError.includes('rate limit')) {

          errorMessage = 'Analysis service is busy. Please wait a moment and try again.';

        } else {

          errorMessage = `Analysis failed: ${backendError}`;

        }

      } else if (err.response?.status === 401) {

        errorMessage = 'Authentication required. Please login again.';

        setTimeout(() => navigate('/login'), 2000);

      } else if (err.response?.status === 413) {

        errorMessage = 'File too large. Maximum size is 50MB.';

      } else if (err.response?.status === 415) {

        errorMessage = 'Invalid file type. Only PDF files are accepted.';

      } else if (err.response?.status === 500) {

        errorMessage = 'Server error. Please check the file and try again.';

      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {

        errorMessage = 'Request timeout. The analysis is taking longer than expected. This can happen with complex drawings. Please check the drawing list in a few minutes - the analysis may still complete in the background.';

      } else if (!err.response) {

        errorMessage = 'Network error. Please check your connection and try again.';

      }

      

      setError(errorMessage);

      setUploading(false);

    }

  };



  // ========== RENDER ==========



  const KEYFRAMES = `

    @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.06)} }

    @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,25px) scale(1.04)} }

    @keyframes floatC { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,35px) scale(1.05)} }

    @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

    @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

  `;



  const T = {

    bg:   'linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f0f9ff 75%, #fffbeb 100%)',

    blobs:[

      { color:'rgba(59,130,246,0.09)',  size:'520px', top:'-80px',    left:'18%',    anim:'floatA 14s ease-in-out infinite'    },

      { color:'rgba(168,85,247,0.07)',  size:'430px', top:'28%',      right:'-60px', anim:'floatB 17s ease-in-out infinite'    },

      { color:'rgba(245,158,11,0.07)',  size:'380px', bottom:'-60px', left:'32%',    anim:'floatC 12s ease-in-out infinite'    },

      { color:'rgba(6,182,212,0.06)',   size:'300px', top:'62%',      left:'-40px',  anim:'floatA 10s ease-in-out infinite 3s' },

    ],

    card:      { background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04)' },

    cardHover: { boxShadow:'0 10px 30px rgba(0,0,0,0.10),0 2px 8px rgba(0,0,0,0.05)', borderColor:'#93c5fd' },

    panel:     { background:'rgba(255,255,255,0.85)', border:'1px solid #e8edf5', backdropFilter:'blur(12px)', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },

    modal:     { background:'#ffffff', border:'1px solid #e2e8f0', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' },

    input:     { background:'#f8fafc', border:'1px solid #e2e8f0' },

  };



  const DarkBg = ({ children }) => (

    <div className="min-h-screen relative overflow-hidden" style={{ background: T.bg }}>

      <style>{KEYFRAMES}</style>

      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:'radial-gradient(circle, rgba(99,102,241,0.055) 1px, transparent 1px)', backgroundSize:'40px 40px' }} />

      {T.blobs.map((b, i) => (

        <div key={i} className="absolute rounded-full pointer-events-none"

          style={{ width:b.size, height:b.size, top:b.top, bottom:b.bottom, left:b.left, right:b.right,

            background:`radial-gradient(circle, ${b.color} 0%, transparent 70%)`, animation:b.anim }} />

      ))}

      <div className="absolute inset-x-0 top-0 h-1 pointer-events-none"

        style={{ background:'linear-gradient(90deg,#3b82f6,#6366f1,#f59e0b,#3b82f6)', backgroundSize:'200% auto', animation:'gradShift 4s linear infinite' }} />

      <div className="relative z-10">{children}</div>

    </div>

  );



  const DarkModal = ({ show, onClose, title, subtitle, iconEl, children }) =>

    show ? (

      <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ background:'rgba(15,23,42,0.45)' }}>

        <div className="rounded-2xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col" style={{ ...T.modal }}>

          <div className="flex items-center justify-between mb-4">

            <div className="flex items-center gap-3">

              {iconEl}

              <div>

                <h3 className="text-base font-bold text-slate-900">{title}</h3>

                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}

              </div>

            </div>

            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">

              <X className="w-5 h-5 text-slate-400" />

            </button>

          </div>

          {children}

        </div>

      </div>

    ) : null;



  const FlashBanner = () =>

    message.text ? (

      <div className={`mb-5 p-4 rounded-xl border flex items-center gap-3 ${

        message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'

        : message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700'

        : 'bg-blue-50 border-blue-200 text-blue-700'

      }`}>

        {message.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}

        {message.type === 'error' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}

        <span className="text-sm">{message.text}</span>

      </div>

    ) : null;



  // PROJECT SELECTION VIEW

  if (!selectedProject) {

    return (

      <DarkBg>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          <div className="mb-10" style={{ animation:'fadeUp 0.6s ease-out both' }}>

            <div className="flex items-center gap-3 mb-2">

              <div className="w-1 h-7 rounded-full" style={{ background:'linear-gradient(180deg,#3b82f6,#6366f1)' }} />

              <span className="text-blue-600 text-xs font-bold tracking-[0.3em] uppercase">AIFlow · Engineering Suite</span>

            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-3">

              P&amp;ID Verification

              <span className="block" style={{ background:'linear-gradient(90deg,#3b82f6,#6366f1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Platform</span>

            </h1>

            <p className="text-slate-500 max-w-xl text-sm sm:text-base">

              8-pass AI quality engine — 40+ engineering compliance checks per drawing. Purpose-built for oil &amp; gas IFC-stage reviews.

            </p>

            <div className="flex flex-wrap gap-2 mt-5">

              {[

                { icon:'⚙️', label:'ISA-5.1 Compliance',  cls:'bg-blue-50 border-blue-200 text-blue-700'    },

                { icon:'🛡️', label:'API / ASME Standards', cls:'bg-indigo-50 border-indigo-200 text-indigo-700'},

                { icon:'🔬', label:'NACE MR0175',          cls:'bg-purple-50 border-purple-200 text-purple-700'},

                { icon:'🤖', label:'8-Pass AI Engine',     cls:'bg-amber-50 border-amber-200 text-amber-700'  },

                { icon:'📐', label:'40+ Check Domains',    cls:'bg-emerald-50 border-emerald-200 text-emerald-700'},

              ].map(b => (

                <span key={b.label} className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-medium ${b.cls}`}>

                  <span>{b.icon}</span>{b.label}

                </span>

              ))}

            </div>

          </div>

          <FlashBanner />

          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">

            <p className="text-slate-500 text-sm">

              {projects.length > 0 ? `${projects.length} project${projects.length !== 1 ? 's' : ''} — select one to upload a drawing` : 'Create your first project to get started'}

            </p>

            <button onClick={() => setShowCreateModal(true)}

              className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all text-sm text-white hover:-translate-y-px"

              style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>

              <FolderPlus className="w-4 h-4" />New Project

            </button>

          </div>

          {loadingProjects ? (

            <div className="flex flex-col items-center justify-center py-20 gap-4">

              <div className="relative w-14 h-14">

                <div className="absolute inset-0 border-2 border-blue-100 rounded-full" />

                <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />

              </div>

              <p className="text-slate-400 text-sm">Loading projects…</p>

            </div>

          ) : projects.length === 0 ? (

            <div className="rounded-2xl p-16 text-center" style={{ background:'#ffffff', border:'1px solid #e2e8f0' }}>

              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-blue-50 border border-blue-100">

                <Package className="w-10 h-10 text-blue-400" />

              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">No Projects Yet</h3>

              <p className="text-slate-500 text-sm mb-6">Create your first project to start uploading and analysing P&amp;ID drawings</p>

              <button onClick={() => setShowCreateModal(true)}

                className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-white hover:-translate-y-px transition-all"

                style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>

                <FolderPlus className="w-5 h-5" />Create First Project

              </button>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

              {projects.map((project, idx) => (

                <div key={project.id} onClick={() => handleSelectProject(project)}

                  className="group relative rounded-2xl p-6 cursor-pointer transition-all duration-300 overflow-hidden"

                  style={{ ...T.card, animation:`fadeUp 0.5s ease-out ${idx * 0.07}s both` }}

                  onMouseEnter={e => { Object.assign(e.currentTarget.style, T.cardHover); }}

                  onMouseLeave={e => { e.currentTarget.style.boxShadow=T.card.boxShadow; e.currentTarget.style.borderColor='#e2e8f0'; }}>

                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"

                    style={{ background:'linear-gradient(90deg,#3b82f6,#6366f1)' }} />

                  <div className="flex items-start justify-between mb-4">

                    <div className="w-11 h-11 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">

                      <Layers className="w-5 h-5 text-blue-600" />

                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-300" />

                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors line-clamp-1">

                    {project.project_name || project.name}

                  </h3>

                  {project.description && <p className="text-xs text-slate-400 line-clamp-2 mb-4">{project.description}</p>}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 mb-4">

                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{project.drawing_count || 0} drawings</span>

                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{new Date(project.created_at).toLocaleDateString()}</span>

                  </div>

                  <div className="flex gap-2">

                    <button onClick={e => handleEditClick(e, project)}

                      className="flex-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-medium">

                      <Edit className="w-3.5 h-3.5" />Edit

                    </button>

                    <button onClick={e => handleDeleteClick(e, project)}

                      className="flex-1 px-3 py-1.5 bg-red-50 border border-red-100 text-red-500 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium">

                      <Trash2 className="w-3.5 h-3.5" />Delete

                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

          <DarkModal show={showCreateModal} onClose={() => { setShowCreateModal(false); setNewProjectName(''); setNewProjectDescription(''); }}

            title="Create New Project" subtitle="Set up a project context for your P&ID drawings"

            iconEl={<div className="w-9 h-9 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center"><FolderPlus className="w-4 h-4 text-blue-600" /></div>}>

            <form onSubmit={handleCreateProject} className="space-y-4 flex-1">

              <div>

                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Project Name *</label>

                <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="e.g., ADNOC Trunkline Project"

                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400/40 text-slate-900 placeholder-slate-400 text-sm outline-none transition-all" style={T.input} required autoFocus />

              </div>

              <div>

                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Description (Optional)</label>

                <textarea value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} placeholder="Brief project description…" rows="3"

                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400/40 text-slate-900 placeholder-slate-400 text-sm resize-none outline-none transition-all" style={T.input} />

              </div>

              <div className="flex gap-3 pt-1">

                <button type="button" onClick={() => { setShowCreateModal(false); setNewProjectName(''); setNewProjectDescription(''); }}

                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>

                <button type="submit" disabled={creatingProject}

                  className="flex-1 px-4 py-2.5 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm transition-all hover:-translate-y-px"

                  style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)' }}>

                  {creatingProject ? <><Loader className="w-4 h-4 animate-spin" />Creating…</> : <><CheckCircle className="w-4 h-4" />Create Project</>}

                </button>

              </div>

            </form>

          </DarkModal>

          <DarkModal show={showEditModal} onClose={() => { setShowEditModal(false); setEditingProject(null); }}

            title="Edit Project"

            iconEl={<div className="w-9 h-9 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-center"><Edit className="w-4 h-4 text-indigo-600" /></div>}>

            <form onSubmit={handleUpdateProject} className="space-y-4 flex-1">

              <div>

                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Project Name *</label>

                <input type="text" value={editProjectName} onChange={e => setEditProjectName(e.target.value)}

                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400/40 text-slate-900 text-sm outline-none transition-all" style={T.input} required />

              </div>

              <div>

                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Description</label>

                <textarea value={editProjectDescription} onChange={e => setEditProjectDescription(e.target.value)} rows="3"

                  className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400/40 text-slate-900 text-sm resize-none outline-none transition-all" style={T.input} />

              </div>

              <div className="flex gap-3 pt-1">

                <button type="button" onClick={() => { setShowEditModal(false); setEditingProject(null); }}

                  className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>

                <button type="submit" disabled={updatingProject}

                  className="flex-1 px-4 py-2.5 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm transition-all hover:-translate-y-px"

                  style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)' }}>

                  {updatingProject ? <><Loader className="w-4 h-4 animate-spin" />Updating…</> : 'Update Project'}

                </button>

              </div>

            </form>

          </DarkModal>

          <DarkModal show={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeletingProject(null); }}

            title="Delete Project"

            iconEl={<div className="w-9 h-9 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-500" /></div>}>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">

              <p className="text-sm text-slate-600 mb-1">Permanently deleting:</p>

              <p className="font-bold text-slate-900">{deletingProject?.project_name || deletingProject?.name}</p>

              <p className="text-xs text-red-500 mt-2">All associated drawings will be removed. This cannot be undone.</p>

            </div>

            <div className="flex gap-3">

              <button onClick={() => { setShowDeleteConfirm(false); setDeletingProject(null); }} disabled={isDeleting}

                className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>

              <button onClick={confirmDelete} disabled={isDeleting}

                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">

                {isDeleting ? <><Loader className="w-4 h-4 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4" />Delete</>}

              </button>

            </div>

          </DarkModal>

        </div>

      </DarkBg>

    );

  }



  // UPLOAD INTERFACE

  const REF_ICONS = {

    equipment_list:      { emoji:'🏗️', color:'orange' },

    line_list:           { emoji:'📋', color:'blue'   },

    critical_stress_list:{ emoji:'⚠️',  color:'yellow' },

    alarm_trip_schedule: { emoji:'🔔', color:'red'    },

    instrument_datasheet:{ emoji:'📊', color:'indigo' },

    legends_symbols:     { emoji:'📐', color:'purple' },

  };



  const REF_PALETTE = {

    orange:{ border:'border-orange-200', bg:'bg-orange-50', btn:'bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100' },

    blue:  { border:'border-blue-200',   bg:'bg-blue-50',   btn:'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100'       },

    yellow:{ border:'border-yellow-200', bg:'bg-yellow-50', btn:'bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100' },

    red:   { border:'border-red-200',    bg:'bg-red-50',    btn:'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'           },

    indigo:{ border:'border-indigo-200', bg:'bg-indigo-50', btn:'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100' },

    purple:{ border:'border-purple-200', bg:'bg-purple-50', btn:'bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100' },

  };



  return (

    <>

      <DarkBg>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 pt-6">

          <div className="flex items-center justify-between mb-6 flex-wrap gap-3" style={{ animation:'fadeUp 0.4s ease-out both' }}>

            <button onClick={handleBackToProjects}

              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all text-sm shadow-sm">

              <ArrowLeft className="w-4 h-4" />Projects

            </button>

            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border" style={{ background:'linear-gradient(135deg,#eff6ff,#eef2ff)', borderColor:'#bfdbfe' }}>

              <Layers className="w-4 h-4 text-blue-600" />

              <span className="text-blue-700 font-semibold text-sm truncate max-w-[180px]">{selectedProject.project_name || selectedProject.name}</span>

            </div>

            <button onClick={() => navigate('/pid/history')}

              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all text-sm shadow-sm">

              <BarChart2 className="w-4 h-4" />History

            </button>

          </div>

          <div className="mb-6" style={{ animation:'fadeUp 0.5s ease-out 0.1s both' }}>

            <div className="flex items-center gap-2 mb-1">

              <div className="w-1 h-5 rounded-full" style={{ background:'linear-gradient(180deg,#3b82f6,#6366f1)' }} />

              <span className="text-blue-600 text-xs font-bold tracking-widest uppercase">P&amp;ID Quality Review</span>

            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Design Verification Upload</h1>

            <p className="text-slate-500 text-sm mt-1">Upload your P&amp;ID PDF — 8-pass AI engine performs 40+ engineering compliance checks</p>

          </div>

          <FlashBanner />

          <div className="rounded-2xl p-5 mb-5" style={{ ...T.panel, animation:'fadeUp 0.5s ease-out 0.15s both' }}>

            <div className="flex items-center gap-3 mb-4">

              <div className="w-9 h-9 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center">

                <BookOpen className="w-4 h-4 text-blue-600" />

              </div>

              <div>

                <h2 className="text-sm font-bold text-slate-900">Reference Documents</h2>

                <p className="text-xs text-slate-500">Upload supporting docs to enhance AI cross-verification accuracy</p>

              </div>

              <span className="ml-auto text-xs text-slate-500 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">Optional</span>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

              {referenceDocuments.map(doc => {

                const ri  = REF_ICONS[doc.key] || { emoji:'📄', color:'blue' };

                const pal = REF_PALETTE[ri.color] || REF_PALETTE.blue;

                const hasFile        = !!referenceFiles[doc.key];

                const hasDesignIQLine= doc.key === 'line_list' && importedLineListJson;

                const hasDesignIQCSS = doc.key === 'critical_stress_list' && importedCSSJson;

                const isDone         = hasFile || hasDesignIQLine || hasDesignIQCSS;

                const displayLabel   = hasFile ? referenceFiles[doc.key].name : hasDesignIQLine ? importedLineListLabel : importedCSSLabel;

                const onRemove = () => hasFile ? removeReferenceFile(doc.key) : hasDesignIQLine ? handleRemoveImportedLineList() : handleRemoveImportedCSSList();

                return (

                  <div key={doc.key} className={`border rounded-xl p-3 transition-all ${isDone ? 'border-emerald-200 bg-emerald-50' : `${pal.border} ${pal.bg}`}`}>

                    <div className="flex items-center gap-2 mb-2">

                      <span className="text-base">{isDone ? '✅' : ri.emoji}</span>

                      <span className="text-xs font-semibold text-slate-700 leading-tight">{doc.label}</span>

                    </div>

                    {isDone ? (

                      <div className="flex items-center justify-between bg-white border border-emerald-100 rounded-lg px-2 py-1.5">

                        <span className="text-xs text-emerald-700 truncate flex-1 mr-1">{displayLabel}</span>

                        <button onClick={onRemove} type="button" className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>

                      </div>

                    ) : (

                      <div className="space-y-1.5">

                        <label htmlFor={`ref-${doc.key}`}>

                          <div className="border border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-2 text-center cursor-pointer transition-colors bg-white hover:bg-blue-50/50">

                            <p className="text-xs text-slate-400">+ Upload PDF</p>

                          </div>

                        </label>

                        <input type="file" id={`ref-${doc.key}`} accept=".pdf" onChange={e => handleReferenceFileChange(doc.key, e)} className="hidden" />

                        {doc.key === 'line_list' && (

                          <button type="button" onClick={handleOpenDesignIQModal} className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${pal.btn}`}>

                            <Database className="w-3 h-3" />Import from DesignIQ

                          </button>

                        )}

                        {doc.key === 'critical_stress_list' && (

                          <button type="button" onClick={() => { setShowCSSDesignIQModal(true); if (designIQProjects.length === 0) handleOpenDesignIQModal(); }} className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${pal.btn}`}>

                            <Database className="w-3 h-3" />DesignIQ CSS List

                          </button>

                        )}

                      </div>

                    )}

                  </div>

                );

              })}

            </div>

          </div>

          <div className="rounded-2xl p-5 sm:p-6" style={{ ...T.panel, animation:'fadeUp 0.5s ease-out 0.2s both' }}>

            <form onSubmit={handleSubmit} className="space-y-5">

              <div>

                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">P&amp;ID Drawing (PDF) *</label>

                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${

                  dragActive ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-200/60'

                  : file ? 'border-emerald-400 bg-emerald-50'

                  : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/40'

                }`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>

                  <input type="file" id="file-upload" accept=".pdf" onChange={e => handleFileSelect(e.target.files[0])} className="hidden" />

                  {!file ? (

                    <label htmlFor="file-upload" className="cursor-pointer block">

                      <div className={`w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all ${dragActive ? 'bg-amber-100 animate-bounce' : 'bg-blue-50 border border-blue-200'}`}>

                        <UploadIcon className={`w-7 h-7 ${dragActive ? 'text-amber-500' : 'text-blue-500'}`} />

                      </div>

                      <p className="text-sm font-semibold text-slate-700 mb-1">{dragActive ? 'Drop your P&ID here' : 'Drag & drop or click to upload'}</p>

                      <p className="text-xs text-slate-400">PDF files only · Max 50 MB</p>

                    </label>

                  ) : (

                    <div className="flex items-center justify-center gap-4">

                      <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-6 h-6 text-red-500" /></div>

                      <div className="text-left flex-1 min-w-0">

                        <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>

                        <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB · PDF</p>

                      </div>

                      <button type="button" onClick={() => setFile(null)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>

                    </div>

                  )}

                </div>

              </div>

              <div>

                <div className="flex items-center justify-between mb-2">

                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Drawing Number</label>

                  <button type="button" onClick={() => setUseStructuredNumber(!useStructuredNumber)} className="text-xs text-blue-600 hover:text-blue-500 font-medium transition-colors">

                    {useStructuredNumber ? '← Freeform' : 'Structured Format →'}

                  </button>

                </div>

                {!useStructuredNumber ? (

                  <input type="text" name="drawing_number" value={formData.drawing_number} onChange={handleInputChange} placeholder="e.g., 16-01-08-1678-1-1/1"

                    className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400/40 text-slate-900 placeholder-slate-400 text-sm outline-none transition-all" style={T.input} />

                ) : (

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">

                    {[

                      { name:'area',          label:'Area',   ph:'16',   max:'2' },

                      { name:'p_area',        label:'P/Area', ph:'01',   max:'2' },

                      { name:'doc_code',      label:'Doc',    ph:'08',   max:'2' },

                      { name:'serial_number', label:'Serial', ph:'1678', max:'4' },

                      { name:'rev',           label:'Rev',    ph:'1',    max:'1' },

                      { name:'sheet_number',  label:'Sheet',  ph:'1',    max:'1' },

                      { name:'total_sheets',  label:'Total',  ph:'1',    max:'1' },

                    ].map(f => (

                      <div key={f.name}>

                        <label className="block text-xs text-slate-500 mb-1">{f.label}</label>

                        <input type="text" name={f.name} value={formData[f.name]} onChange={handleInputChange} placeholder={f.ph} maxLength={f.max}

                          className="w-full px-2 py-1.5 text-sm rounded-lg focus:ring-1 focus:ring-blue-400/40 text-slate-900 outline-none" style={T.input} />

                      </div>

                    ))}

                    <div className="flex items-end">

                      <div className="w-full px-2 py-1.5 text-xs rounded-lg text-blue-700 font-mono bg-blue-50 border border-blue-200">

                        {formData.area||'__'}-{formData.p_area||'__'}-{formData.doc_code||'__'}-{formData.serial_number||'____'}-{formData.rev||'_'}-{formData.sheet_number||'_'}/{formData.total_sheets||'_'}

                      </div>

                    </div>

                  </div>

                )}

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {[

                  { name:'revision',      label:'Revision',     ph:'Rev 01'                   },

                  { name:'drawing_title', label:'Drawing Title', ph:'e.g., Compressor Package' },

                  { name:'project_name',  label:'Project Name', ph:'e.g., ADNOC Project XYZ'  },

                ].map(f => (

                  <div key={f.name}>

                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">{f.label}</label>

                    <input type="text" name={f.name} value={formData[f.name]} onChange={handleInputChange} placeholder={f.ph}

                      className="w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-400/40 text-slate-900 placeholder-slate-400 text-sm outline-none transition-all" style={T.input} />

                  </div>

                ))}

              </div>



              {/* ── Analysis Mode Selector ─────────────────────────────────────── */}

              <div>

                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Analysis Mode</label>

                <div className="grid grid-cols-2 gap-3">

                  {/* Standard */}

                  <button type="button"

                    onClick={() => setFormData(p => ({ ...p, analysis_mode: 'standard' }))}

                    className={`relative rounded-2xl p-4 border-2 text-left transition-all duration-200 focus:outline-none ${

                      formData.analysis_mode === 'standard'

                        ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'

                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'

                    }`}>

                    {formData.analysis_mode === 'standard' && (

                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">

                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>

                      </span>

                    )}

                    <div className="flex items-center gap-2 mb-2">

                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${

                        formData.analysis_mode === 'standard' ? 'bg-blue-500' : 'bg-slate-100'

                      }`}>

                        <Shield className={`w-4 h-4 ${formData.analysis_mode === 'standard' ? 'text-white' : 'text-slate-400'}`} />

                      </div>

                      <div>

                        <p className={`text-sm font-bold ${formData.analysis_mode === 'standard' ? 'text-blue-700' : 'text-slate-700'}`}>Standard</p>

                        <p className="text-xs text-slate-400">Drawing-only analysis</p>

                      </div>

                    </div>

                    <ul className="space-y-1 mt-1">

                      {['8-pass AI review of the uploaded drawing','OCR + Vision + Engineering checks','Fast & focused — no external files needed','Best for quick IFC checks'].map(t => (

                        <li key={t} className="flex items-start gap-1.5 text-xs text-slate-600">

                          <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{t}

                        </li>

                      ))}

                    </ul>

                  </button>



                  {/* Premium */}

                  <button type="button"

                    onClick={() => setFormData(p => ({ ...p, analysis_mode: 'premium' }))}

                    className={`relative rounded-2xl p-4 border-2 text-left transition-all duration-200 focus:outline-none ${

                      formData.analysis_mode === 'premium'

                        ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100'

                        : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30'

                    }`}>

                    {formData.analysis_mode === 'premium' && (

                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">

                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>

                      </span>

                    )}

                    <div className="flex items-center gap-2 mb-2">

                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${

                        formData.analysis_mode === 'premium' ? 'bg-violet-500' : 'bg-slate-100'

                      }`}>

                        <Layers className={`w-4 h-4 ${formData.analysis_mode === 'premium' ? 'text-white' : 'text-slate-400'}`} />

                      </div>

                      <div>

                        <p className={`text-sm font-bold ${formData.analysis_mode === 'premium' ? 'text-violet-700' : 'text-slate-700'}`}>Premium</p>

                        <p className="text-xs text-slate-400">Drawing + reference docs</p>

                      </div>

                    </div>

                    <ul className="space-y-1 mt-1">

                      {['Everything in Standard','Cross-checks against datasheets & line list','DesignIQ import + RAD document intelligence','Deep compliance against project standards'].map(t => (

                        <li key={t} className="flex items-start gap-1.5 text-xs text-slate-600">

                          <span className="text-violet-500 mt-0.5 flex-shrink-0">✦</span>{t}

                        </li>

                      ))}

                    </ul>

                    {formData.analysis_mode !== 'premium' && (

                      <p className="mt-2 text-xs text-violet-500 font-medium">Upload reference docs below to enable ↓</p>

                    )}

                  </button>

                </div>

              </div>



              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-100">

                <div onClick={() => setFormData(p => ({ ...p, auto_analyze: !p.auto_analyze }))}

                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors flex-shrink-0 ${formData.auto_analyze ? 'bg-blue-500' : 'bg-slate-300'}`}>

                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.auto_analyze ? 'translate-x-6' : 'translate-x-1'}`} />

                </div>

                <span className="text-sm text-slate-600 cursor-pointer select-none" onClick={() => setFormData(p => ({ ...p, auto_analyze: !p.auto_analyze }))}>

                  Automatically start <span className="text-blue-600 font-semibold">8-pass AI analysis</span> after upload

                </span>

                {formData.auto_analyze && <Cpu className="w-4 h-4 text-blue-500 ml-auto animate-pulse flex-shrink-0" />}

                <input type="checkbox" name="auto_analyze" id="auto_analyze" checked={formData.auto_analyze} onChange={handleInputChange} className="sr-only" />

              </div>

              {uploading && formData.auto_analyze && (

                <div className="rounded-2xl p-5 space-y-4 border border-blue-200" style={{ background:'linear-gradient(135deg,#eff6ff,#eef2ff)' }}>

                  <div>

                    <div className="flex items-center justify-between mb-2">

                      <div className="flex items-center gap-2">

                        <Activity className="w-4 h-4 text-blue-500 animate-pulse" />

                        <span className="text-sm font-bold text-slate-800 truncate">{analysisStage || 'AI Analysis in Progress…'}</span>

                      </div>

                      <span className="text-blue-600 font-mono text-sm font-bold flex-shrink-0 ml-2">{uploadProgress}%</span>

                    </div>

                    <div className="w-full bg-white rounded-full h-2.5 overflow-hidden border border-blue-100">

                      <div className="h-full rounded-full transition-all duration-700 ease-out"

                        style={{ width:`${uploadProgress}%`, background:'linear-gradient(90deg,#3b82f6,#6366f1)', boxShadow:'0 0 8px rgba(99,102,241,0.5)' }} />

                    </div>

                  </div>

                  <div className="grid grid-cols-4 gap-1.5">

                    {PASS_STAGES.map(p => {

                      const done   = p.pass < activePass;

                      const active = p.pass === activePass;

                      return (

                        <div key={p.pass} className={`rounded-xl p-2.5 border text-center transition-all ${

                          done   ? 'bg-emerald-50 border-emerald-200'

                          : active ? 'bg-white border-blue-400 shadow-md shadow-blue-100'

                          : 'bg-white/60 border-slate-200'

                        }`}>

                          <div className="text-base mb-0.5 leading-none">

                            {done ? '✅' : active ? <span className="inline-block animate-spin">⚙️</span> : p.icon}

                          </div>

                          <p className={`text-xs font-medium leading-snug ${done ? 'text-emerald-600' : active ? 'text-blue-600' : 'text-slate-400'}`}>{p.label}</p>

                        </div>

                      );

                    })}

                  </div>

                  <div className="bg-white rounded-xl p-3 flex items-center gap-3 min-h-[56px] border border-blue-100 shadow-sm">

                    <div className="w-8 h-8 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center flex-shrink-0"><BookOpen className="w-3.5 h-3.5 text-blue-500" /></div>

                    <div className="flex-1 min-w-0">

                      <p className="text-xs font-semibold text-blue-600 mb-0.5">Engineering Insight</p>

                      <p className="text-xs text-slate-600 leading-relaxed">{OIL_GAS_FACTS[tickerIdx].icon}&nbsp;{OIL_GAS_FACTS[tickerIdx].text}</p>

                    </div>

                  </div>

                  <p className="text-xs text-slate-400 text-center">Comprehensive review takes 3–8 minutes · Please keep this tab open</p>

                </div>

              )}

              {error && (

                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">

                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />

                  <p className="text-sm text-red-600">{error}</p>

                </div>

              )}

              <div className="flex gap-3 pt-1">

                <button type="submit" disabled={uploading || !file}

                  className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${

                    uploading || !file ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'

                    : 'text-white shadow-lg hover:-translate-y-px active:translate-y-0'

                  }`}

                  style={uploading || !file ? undefined : { background:'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>

                  {uploading

                    ? <><Loader className="w-4 h-4 animate-spin" />{formData.auto_analyze ? 'Uploading & Analysing…' : 'Uploading…'}</>

                    : <><Zap className="w-4 h-4" />{formData.auto_analyze

                        ? `Upload & Run ${formData.analysis_mode === 'premium' ? 'Premium' : 'Standard'} 8-Pass Analysis`

                        : 'Upload Drawing'}</>

                  }

                </button>

                <button type="button" onClick={() => navigate('/dashboard')}

                  className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-medium text-sm transition-all shadow-sm">Cancel

                </button>

              </div>

            </form>

          </div>

          <div className="mt-5 rounded-2xl p-5" style={{ ...T.panel, animation:'fadeUp 0.5s ease-out 0.3s both' }}>

            <div className="flex items-center gap-2 mb-4">

              <Shield className="w-4 h-4 text-blue-600" />

              <h3 className="text-sm font-bold text-slate-900">8-Pass AI Engine — Verification Scope</h3>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">

              {[

                '✅ ISA-5.1 instrument classification & control loops',

                '✅ PSV set pressure vs equipment design pressure',

                '✅ Trim class & pipe class consistency at nozzles',

                '✅ API 6D / ASME B16.34 / API 600 valve standards',

                '✅ NACE MR0175 sour service & PWHT requirements',

                '✅ LTCS compliance for cryogenic / LNG / LPG lines',

                '✅ Insulating gasket at dissimilar material joints',

                '✅ RO spool requirements (10D/5D straight runs)',

                '✅ Free-drain slope annotations (>= 1:100)',

                '✅ CSS / STRESS CRITICAL line annotations',

                '✅ Duplicate & near-duplicate line number detection',

                '✅ Notes & HOLDS implementation cross-verification',

                '✅ Valve size vs pipe nominal bore consistency',

                '✅ Equipment TYPE designation validation',

                '✅ Tie-in points & battery limit completeness',

                '✅ AI line size & hydraulic anomaly detection',

              ].map((item, i) => (

                <p key={i} className="text-xs text-slate-500">{item}</p>

              ))}

            </div>

          </div>

        </div>

      </DarkBg>



      <DarkModal show={showDesignIQModal} onClose={() => setShowDesignIQModal(false)}

        title="Import Line List from DesignIQ" subtitle="Cross-reference pipe class, LTCS compliance, and routing"

        iconEl={<div className="w-9 h-9 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center"><Database className="w-4 h-4 text-blue-600" /></div>}>

        <div className="flex-1 overflow-y-auto space-y-2 mt-1">

          {loadingDesignIQProjects ? (

            <div className="flex items-center justify-center py-10 gap-2"><Loader className="w-5 h-5 animate-spin text-blue-500" /><span className="text-slate-400 text-sm">Loading projects…</span></div>

          ) : designIQProjects.length === 0 ? (

            <div className="text-center py-10">

              <Database className="w-10 h-10 mx-auto mb-3 text-slate-300" />

              <p className="text-slate-500 text-sm font-medium">No line list projects found</p>

              <p className="text-slate-400 text-xs mt-1">Use the Line List extractor at /engineering/process/line-list first.</p>

            </div>

          ) : designIQProjects.map(project => (

            <div key={project.id} className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl p-4 transition-colors">

              <div className="flex items-center justify-between">

                <div className="flex-1 min-w-0">

                  <p className="font-semibold text-slate-900 text-sm truncate">{project.name}</p>

                  {project.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{project.description}</p>}

                  <p className="text-xs text-slate-400 mt-1">{new Date(project.created_at).toLocaleDateString()}</p>

                </div>

                <button type="button" onClick={() => handleImportLineList(project.id, project.name)} disabled={importingLineList}

                  className="ml-3 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50">

                  {importingLineList ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}Import

                </button>

              </div>

            </div>

          ))}

        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">

          <button onClick={() => setShowDesignIQModal(false)} className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>

        </div>

      </DarkModal>



      <DarkModal show={showCSSDesignIQModal} onClose={() => setShowCSSDesignIQModal(false)}

        title="Import Critical Stress List" subtitle="Anchor points, expansion provisions & CSS annotation check"

        iconEl={<div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center"><Database className="w-4 h-4 text-amber-600" /></div>}>

        <div className="flex-1 overflow-y-auto space-y-2 mt-1">

          {loadingDesignIQProjects ? (

            <div className="flex items-center justify-center py-10 gap-2"><Loader className="w-5 h-5 animate-spin text-amber-500" /><span className="text-slate-400 text-sm">Loading projects…</span></div>

          ) : designIQProjects.length === 0 ? (

            <div className="text-center py-10">

              <Database className="w-10 h-10 mx-auto mb-3 text-slate-300" />

              <p className="text-slate-500 text-sm font-medium">No DesignIQ projects found</p>

              <p className="text-slate-400 text-xs mt-1">Use the Critical Stress extractor at /engineering/process/critical-stress first.</p>

            </div>

          ) : designIQProjects.map(project => (

            <div key={project.id} className="bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-xl p-4 transition-colors">

              <div className="flex items-center justify-between">

                <div className="flex-1 min-w-0">

                  <p className="font-semibold text-slate-900 text-sm truncate">{project.name}</p>

                  {project.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{project.description}</p>}

                  <p className="text-xs text-slate-400 mt-1">{new Date(project.created_at).toLocaleDateString()}</p>

                </div>

                <button type="button" onClick={() => handleImportCSSList(project.id, project.name)} disabled={importingCSSList}

                  className="ml-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50">

                  {importingCSSList ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}Import

                </button>

              </div>

            </div>

          ))}

        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">

          <button onClick={() => setShowCSSDesignIQModal(false)} className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium text-sm transition-colors">Cancel</button>

        </div>

      </DarkModal>



    </>

  );

};



export default PIDUpload;

