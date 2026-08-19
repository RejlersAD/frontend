import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';
import wrenchService from '../services/wrench.service';

/**
 * Data Mining Platform - Innovative Edition
 * Tableau Prep-style data integration with modern UI/UX
 * Features:
 * - Glassmorphism design with animated gradients
 * - Interactive 3D card effects
 * - Visual pipeline flow builder
 * - Wrench project & document selection
 * - Soft-coded transformation operations
 * - Master file generation with live preview
 */

// ─── Soft-coded transformation operation templates ───────────────────────────
const TRANSFORMATION_OPERATIONS = [
  {
    type: 'join',
    name: 'Join',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-300',
    hoverBorder: 'hover:border-blue-500',
    description: 'Merge datasets by key',
    detail: 'Combine multiple data sources using common identifiers',
    configTemplate: {
      join_type: 'inner',
      left_key: '',
      right_key: '',
      right_input: '',
    }
  },
  {
    type: 'filter',
    name: 'Filter',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-300',
    hoverBorder: 'hover:border-green-500',
    description: 'Filter rows by conditions',
    detail: 'Remove unwanted data based on custom rules',
    configTemplate: {
      conditions: [],
      logic: 'and'
    }
  },
  {
    type: 'aggregate',
    name: 'Aggregate',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-50 to-pink-50',
    borderColor: 'border-purple-300',
    hoverBorder: 'hover:border-purple-500',
    description: 'Group & summarize',
    detail: 'Calculate statistics by grouping categories',
    configTemplate: {
      group_by: [],
      aggregations: []
    }
  },
  {
    type: 'clean',
    name: 'Clean',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    gradient: 'from-orange-500 to-red-500',
    bgGradient: 'from-orange-50 to-red-50',
    borderColor: 'border-orange-300',
    hoverBorder: 'hover:border-orange-500',
    description: 'Clean data',
    detail: 'Remove duplicates and handle missing values',
    configTemplate: {
      remove_duplicates: false,
      drop_null_rows: [],
      fill_null_value: {}
    }
  },
  {
    type: 'derive',
    name: 'Derive',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    gradient: 'from-pink-500 to-rose-500',
    bgGradient: 'from-pink-50 to-rose-50',
    borderColor: 'border-pink-300',
    hoverBorder: 'hover:border-pink-500',
    description: 'Create columns',
    detail: 'Add calculated fields and formulas',
    configTemplate: {
      new_columns: []
    }
  },
  {
    type: 'union',
    name: 'Union',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
      </svg>
    ),
    gradient: 'from-indigo-500 to-purple-500',
    bgGradient: 'from-indigo-50 to-purple-50',
    borderColor: 'border-indigo-300',
    hoverBorder: 'hover:border-indigo-500',
    description: 'Stack datasets',
    detail: 'Combine data vertically from multiple sources',
    configTemplate: {
      inputs: [],
      align_columns: true
    }
  },
  {
    type: 'rename',
    name: 'Rename',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    gradient: 'from-teal-500 to-cyan-500',
    bgGradient: 'from-teal-50 to-cyan-50',
    borderColor: 'border-teal-300',
    hoverBorder: 'hover:border-teal-500',
    description: 'Rename columns',
    detail: 'Update field names for clarity',
    configTemplate: {
      column_mapping: {}
    }
  },
  {
    type: 'select',
    name: 'Select',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradient: 'from-cyan-500 to-blue-500',
    bgGradient: 'from-cyan-50 to-blue-50',
    borderColor: 'border-cyan-300',
    hoverBorder: 'hover:border-cyan-500',
    description: 'Select columns',
    detail: 'Choose specific fields to keep',
    configTemplate: {
      columns: []
    }
  },
];

const DataMiningPlatform = () => {
  const navigate = useNavigate();
  
  // State management
  const [activeTab, setActiveTab] = useState('projects'); // projects | documents | pipeline | execute
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Wrench integration
  const [wrenchProjects, setWrenchProjects] = useState([]);
  const [selectedWrenchProject, setSelectedWrenchProject] = useState('');
  const [wrenchDocuments, setWrenchDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  
  // Pipeline builder
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [selectedOperation, setSelectedOperation] = useState(null);
  
  // Execution
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  
  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [draggedStep, setDraggedStep] = useState(null);
  
  // Load projects on mount
  useEffect(() => {
    loadProjects();
    loadWrenchProjects();
  }, []);
  
  // Auto-dismiss notifications
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  
  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/data-mining/projects/');
      // Soft-coded response handling: support both paginated and non-paginated responses
      const projectsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data.results || []);
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };
  
  const loadWrenchProjects = async () => {
    try {
      setLoading(true);
      // Soft-coded: Use centralized wrenchService for consistent project fetching
      const response = await wrenchService.listWrenchProjects({ refresh: false });
      const projectsData = response.data.projects || [];
      setWrenchProjects(projectsData);
      
      if (response.data.is_stale) {
        console.log('[Data Mining] Wrench projects cache is stale, consider refreshing');
      }
    } catch (err) {
      console.error('Failed to load Wrench projects:', err);
      setError('Failed to load Wrench projects. Please check Wrench integration configuration.');
    } finally {
      setLoading(false);
    }
  };
  
  const searchWrenchDocuments = async () => {
    if (!selectedWrenchProject) {
      setError('Please select a Wrench project first');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Soft-coded: Use centralized wrenchService to fetch transmittal documents
      // Strategy: Get documents for the selected project (ORDER_NO)
      const response = await wrenchService.getTransmittalDocuments(
        selectedWrenchProject,  // order_no
        '',                     // trans_id (optional)
        1,                      // page
        200                     // page_size (soft-coded limit)
      );
      
      const rawDocuments = response.data.documents || [];
      
      // Soft-coded field mapping: Wrench API uses uppercase keys (DOC_NO, DOC_DESCRIPTION)
      // Map them to lowercase for consistent frontend usage
      const normalizedDocuments = rawDocuments.map((doc, index) => ({
        // Generate a unique ID for checkbox selection (Wrench docs don't have native IDs)
        id: doc.DOC_NO || doc.Doc_No || doc.doc_no || `doc-${index}`,
        doc_number: doc.DOC_NO || doc.Doc_No || doc.doc_no || '',
        doc_title: doc.DOC_DESCRIPTION || doc.Doc_Description || doc.doc_description || doc.DOC_TITLE || '',
        revision: doc.DOC_REVISION || doc.Doc_Revision || doc.doc_revision || doc.REVISION || '',
        transmittal_id: doc.ORDER_NO || doc.Order_No || doc.order_no || selectedWrenchProject,
        // Keep original Wrench fields for reference
        _raw: doc
      }));
      
      setWrenchDocuments(normalizedDocuments);
      
      if (normalizedDocuments.length === 0) {
        setError(`No documents found for project ${selectedWrenchProject}. The project may have no documents in Wrench.`);
      } else {
        setSuccess(`Found ${normalizedDocuments.length} document(s) in project ${selectedWrenchProject}`);
      }
    } catch (err) {
      console.error('Failed to search Wrench documents:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to search Wrench documents';
      setError(errorMsg);
      setWrenchDocuments([]);
    } finally {
      setLoading(false);
    }
  };
  
  const createNewProject = async () => {
    if (!newProjectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    
    if (!selectedWrenchProject) {
      setError('Please select a Wrench project first');
      return;
    }
    
    const wrenchProjectData = wrenchProjects.find(p => p.order_no === selectedWrenchProject);
    
    try {
      setLoading(true);
      const response = await apiClient.post('/data-mining/projects/', {
        name: newProjectName,
        wrench_project_number: selectedWrenchProject,
        wrench_project_name: wrenchProjectData?.order_description || '',
        master_file_format: 'excel'
      });
      
      setSelectedProject(response.data);
      setProjects([...projects, response.data]);
      setSuccess('Project created successfully!');
      setShowCreateModal(false);
      setNewProjectName('');
      setActiveTab('documents');
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };
  
  const addDocumentsToProject = async () => {
    if (!selectedProject || selectedDocuments.length === 0) {
      setError('Please select documents to add');
      return;
    }
    
    try {
      setLoading(true);
      const wrenchDocsData = selectedDocuments.map(docId => {
        const doc = wrenchDocuments.find(d => d.id === docId);
        return {
          doc_number: doc?.doc_number || '',
          doc_title: doc?.doc_title || '',
          doc_revision: doc?.revision || '',
          transmittal_id: doc?.transmittal_id || ''
        };
      });
      
      await apiClient.post(`/data-mining/projects/${selectedProject.id}/add_documents/`, {
        wrench_documents: wrenchDocsData
      });
      
      // Reload project
      const response = await apiClient.get(`/data-mining/projects/${selectedProject.id}/`);
      setSelectedProject(response.data);
      setSuccess(`Added ${selectedDocuments.length} documents successfully!`);
      setActiveTab('pipeline');
    } catch (err) {
      console.error('Failed to add documents:', err);
      setError('Failed to add documents');
    } finally {
      setLoading(false);
    }
  };
  
  const addPipelineStep = (operation) => {
    const newStep = {
      step_name: `${operation.name} ${pipelineSteps.length + 1}`,
      operation_type: operation.type,
      config: { ...operation.configTemplate },
      sequence_order: pipelineSteps.length
    };
    
    setPipelineSteps([...pipelineSteps, newStep]);
    setSuccess(`${operation.name} step added to pipeline`);
  };
  
  const removePipelineStep = (index) => {
    const updatedSteps = pipelineSteps.filter((_, i) => i !== index);
    // Reorder sequence
    const reorderedSteps = updatedSteps.map((step, idx) => ({
      ...step,
      sequence_order: idx
    }));
    setPipelineSteps(reorderedSteps);
  };
  
  const executePipeline = async () => {
    if (!selectedProject) return;
    
    try {
      setExecuting(true);
      setError('');
      
      // First, extract data from documents
      await apiClient.post(`/data-mining/projects/${selectedProject.id}/extract_data/`);
      
      // Then execute pipeline
      const response = await apiClient.post(`/data-mining/projects/${selectedProject.id}/execute_pipeline/`);
      setExecutionResult(response.data);
      setSuccess('Pipeline executed successfully!');
      setActiveTab('execute');
    } catch (err) {
      console.error('Pipeline execution failed:', err);
      setError(err.response?.data?.error || 'Pipeline execution failed');
    } finally {
      setExecuting(false);
    }
  };
  
  const getStepNumber = () => {
    const steps = ['projects', 'documents', 'pipeline', 'execute'];
    return steps.indexOf(activeTab) + 1;
  };
  
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex">
      {/* Vertical Sidebar Navigation */}
      <div className="w-80 bg-white border-r-2 border-gray-200 shadow-xl flex flex-col min-h-screen">
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-all duration-300"
          >
            <svg className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Data Mining
          </h1>
          <p className="text-sm text-gray-600">Transform & consolidate</p>
          
          <button
            onClick={() => {
              setShowCreateModal(true);
              loadWrenchProjects();
            }}
            className="mt-4 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="p-6 border-b-2 border-gray-200 space-y-3">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 font-medium mb-1">Total Projects</p>
                <p className="text-2xl font-bold text-blue-900">{projects.length}</p>
              </div>
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-700 font-medium mb-1">Pipeline Steps</p>
                <p className="text-2xl font-bold text-purple-900">{pipelineSteps.length}</p>
              </div>
              <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium mb-1">Documents</p>
                <p className="text-2xl font-bold text-green-900">{selectedProject?.total_documents || 0}</p>
              </div>
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Vertical Workflow Steps */}
        <div className="flex-1 p-6 space-y-3 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Workflow Steps</div>
          
          {[
            { id: 'projects', label: 'Select Project', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', num: 1 },
            { id: 'documents', label: 'Add Documents', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', num: 2 },
            { id: 'pipeline', label: 'Build Pipeline', icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z', num: 3 },
            { id: 'execute', label: 'Execute & Export', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z', num: 4 }
          ].map((step) => {
            const isActive = activeTab === step.id;
            const stepIndex = ['projects', 'documents', 'pipeline', 'execute'].indexOf(step.id);
            const activeIndex = ['projects', 'documents', 'pipeline', 'execute'].indexOf(activeTab);
            const isCompleted = activeIndex > stepIndex;
            
            return (
              <button
                key={step.id}
                onClick={() => setActiveTab(step.id)}
                className={`w-full group flex items-center p-4 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105' 
                    : isCompleted
                    ? 'bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg font-bold mr-4 transition-all ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? '✓' : step.num}
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-bold ${isActive ? 'text-white' : ''}`}>{step.label}</div>
                </div>
                <svg className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={step.icon} />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="container mx-auto px-8 py-8">
          <div className="max-w-6xl mx-auto">
          
          {/* Notifications */}
          {(error || success) && (
            <div className={`mb-6 animate-slide-down ${error ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'} rounded-2xl p-4 border-2`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {error ? (
                    <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <p className={`font-medium ${error ? 'text-red-800' : 'text-green-800'}`}>
                    {error || success}
                  </p>
                </div>
                <button 
                  onClick={() => { setError(''); setSuccess(''); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* Main Content Card */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="p-8">
              {/* Tab Content */}
              {activeTab === 'projects' && (
                <div>
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Data Mining Projects</h2>
                      <p className="text-gray-600">Select an existing project or create a new one</p>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <span className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        New Project
                      </span>
                    </button>
                  </div>
                  
                  {/* Wrench Project Selector */}
                  <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                    <div className="flex items-center mb-4">
                      <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      <h3 className="text-xl font-bold text-gray-900">Select Wrench Project</h3>
                    </div>
                    <select
                      value={selectedWrenchProject}
                      onChange={(e) => setSelectedWrenchProject(e.target.value)}
                      className="w-full px-6 py-4 bg-white border-2 border-green-200 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    >
                      <option value="">-- Select Wrench Project --</option>
                      {wrenchProjects.map((proj) => (
                        <option key={proj.order_no} value={proj.order_no}>
                          {proj.label || `${proj.order_no} - ${proj.order_description}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Project Grid */}
                  {loading ? (
                    <div className="flex justify-center items-center py-20">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                      </div>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-20">
                      <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">No Projects Yet</h3>
                      <p className="text-gray-600">Create your first data mining project to get started</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {projects.map((project) => (
                        <div
                          key={project.id}
                          onClick={() => {
                            setSelectedProject(project);
                            setActiveTab('documents');
                          }}
                          className="group relative bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 cursor-pointer overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full transform translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform duration-500"></div>
                          
                          <div className="relative z-10">
                            <div className="flex items-start justify-between mb-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
                                📊
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                project.status === 'completed' ? 'bg-green-100 text-green-700 border-2 border-green-300' :
                                project.status === 'executing' ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' :
                                'bg-gray-100 text-gray-700 border-2 border-gray-300'
                              }`}>
                                {project.status}
                              </span>
                            </div>
                            
                            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                              {project.name}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 font-mono">
                              {project.wrench_project_number}
                            </p>
                            
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center text-gray-600">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>{project.total_documents} docs</span>
                              </div>
                              <svg className="w-5 h-5 text-blue-500 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            
            {activeTab === 'documents' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Documents from Wrench</h2>
                  <p className="text-gray-600">Choose documents to include in your data mining project</p>
                </div>
                
                {selectedProject && (
                  <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Current Project</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedProject.name}</p>
                        <p className="text-sm text-blue-600 font-mono mt-1">{selectedProject.wrench_project_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Selected</p>
                        <p className="text-3xl font-bold text-gray-900">{selectedDocuments.length}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-6">
                  <button
                    onClick={searchWrenchDocuments}
                    disabled={!selectedWrenchProject || loading}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Searching...
                      </span>
                    ) : 'Search Wrench Documents'}
                  </button>
                </div>
                
                {/* Document List */}
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto custom-scrollbar">
                  {wrenchDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className="group flex items-center p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-102"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDocuments([...selectedDocuments, doc.id]);
                          } else {
                            setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                          }
                        }}
                        className="w-5 h-5 mr-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 mb-1">{doc.doc_number}</p>
                        <p className="text-sm text-gray-600">{doc.doc_title}</p>
                      </div>
                      <svg className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </label>
                  ))}
                </div>
                
                {selectedDocuments.length > 0 && (
                  <button
                    onClick={addDocumentsToProject}
                    disabled={loading}
                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
                  >
                    Add {selectedDocuments.length} Document{selectedDocuments.length > 1 ? 's' : ''} to Project
                  </button>
                )}
              </div>
            )}
            
            {activeTab === 'pipeline' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Build Transformation Pipeline</h2>
                  <p className="text-gray-600">Design your data transformation workflow step by step</p>
                </div>
                
                {/* Operation Palette */}
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-6 mb-8 border-2 border-gray-200">
                  <div className="flex items-center mb-6">
                    <svg className="w-7 h-7 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                    </svg>
                    <h3 className="text-2xl font-bold text-gray-900">Transformation Toolkit</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {TRANSFORMATION_OPERATIONS.map((op) => (
                      <button
                        key={op.type}
                        onClick={() => addPipelineStep(op)}
                        className={`group relative p-5 bg-gradient-to-r ${op.bgGradient} rounded-xl border-2 ${op.borderColor} ${op.hoverBorder} transition-all duration-300 transform hover:scale-105 overflow-hidden flex items-center`}
                      >
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${op.gradient} opacity-10 rounded-full transform translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-500`}></div>
                        
                        <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${op.gradient} text-white mr-4 shadow-lg transform group-hover:rotate-6 transition-transform duration-300 flex-shrink-0`}>
                          {op.icon}
                        </div>
                        
                        <div className="relative z-10 text-left flex-1">
                          <div className="text-lg font-bold text-gray-900 mb-1">{op.name}</div>
                          <div className="text-sm text-gray-600">{op.description}</div>
                        </div>
                        
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Pipeline Steps */}
                {pipelineSteps.length === 0 ? (
                  <div className="text-center py-16">
                    <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">No Steps Added Yet</h3>
                    <p className="text-gray-600">Click on transformation operations above to build your pipeline</p>
                  </div>
                ) : (
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center mb-4">
                      <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="text-2xl font-bold text-gray-900">Pipeline Steps ({pipelineSteps.length})</h3>
                    </div>
                    
                    {pipelineSteps.map((step, idx) => {
                      const opConfig = TRANSFORMATION_OPERATIONS.find(op => op.type === step.operation_type);
                      return (
                        <div key={idx} className="group relative bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300">
                          <div className={`absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl bg-gradient-to-b ${opConfig?.gradient || 'from-gray-500 to-gray-600'}`}></div>
                          
                          <div className="flex items-center justify-between ml-4">
                            <div className="flex items-center flex-1">
                              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg mr-4 shadow-lg">
                                {idx + 1}
                              </div>
                              
                              <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${opConfig?.gradient || 'from-gray-500 to-gray-600'} text-white mr-4`}>
                                {opConfig?.icon}
                              </div>
                              
                              <div className="flex-1">
                                <p className="text-xl font-bold text-gray-900 mb-1">{step.step_name}</p>
                                <p className="text-sm text-gray-600 capitalize">{step.operation_type} operation</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => removePipelineStep(idx)}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all duration-300 transform hover:scale-105"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {pipelineSteps.length > 0 && (
                  <button
                    onClick={executePipeline}
                    disabled={executing}
                    className="w-full px-8 py-5 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
                  >
                    <span className="flex items-center justify-center">
                      {executing ? (
                        <>
                          <svg className="animate-spin h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Executing Pipeline...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Execute Pipeline
                        </>
                      )}
                    </span>
                  </button>
                )}
              </div>
            )}
            
            {activeTab === 'execute' && executionResult && (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Execution Results</h2>
                  <p className="text-gray-600">Your data transformation pipeline completed successfully</p>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-8 mb-8 border-2 border-green-200">
                  <div className="flex items-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-4xl mr-4">
                      ✅
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Pipeline Completed Successfully</h3>
                      <p className="text-green-700">Your master dataset is ready</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl p-6 border-2 border-green-200 shadow-lg">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium">Rows Processed</p>
                      </div>
                      <p className="text-4xl font-bold text-gray-900">{executionResult.rows_processed?.toLocaleString()}</p>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 border-2 border-green-200 shadow-lg">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium">Execution Time</p>
                      </div>
                      <p className="text-4xl font-bold text-gray-900">{executionResult.execution_time?.toFixed(2)}s</p>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 border-2 border-green-200 shadow-lg">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium">Master File</p>
                      </div>
                      <p className="text-sm font-mono text-gray-900 truncate">{executionResult.master_file?.split('/').pop()}</p>
                    </div>
                  </div>
                </div>
                
                {/* Data Preview */}
                {executionResult.preview && (
                  <div className="bg-white rounded-3xl overflow-hidden mb-8 border-2 border-gray-200 shadow-lg">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-5 border-b-2 border-gray-200">
                      <div className="flex items-center">
                        <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <h3 className="text-xl font-bold text-gray-900">Data Preview (First 20 Rows)</h3>
                      </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {executionResult.preview.columns.map((col, idx) => (
                              <th key={idx} className="px-6 py-4 text-left text-xs font-bold text-blue-600 uppercase tracking-wider">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {executionResult.preview.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4">
                  <button
                    onClick={() => window.open(executionResult.master_file, '_blank')}
                    className="flex-1 px-8 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 transition-all duration-300 transform hover:scale-105 flex items-center justify-center group"
                  >
                    <svg className="w-6 h-6 mr-3 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Master File
                  </button>
                  <button
                    onClick={() => {
                      setExecutionResult(null);
                      setPipelineSteps([]);
                      setActiveTab('projects');
                    }}
                    className="px-8 py-5 bg-white/10 backdrop-blur border border-white/20 text-white rounded-2xl font-bold hover:bg-white/20 transition-all duration-300 transform hover:scale-105"
                  >
                    Create New Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
      
      {/* Create Project Modal */}
      {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl animate-scale-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-3xl font-bold text-white">Create New Project</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wrench Project
                  </label>
                  <select
                    value={selectedWrenchProject}
                    onChange={(e) => setSelectedWrenchProject(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">-- Select Wrench Project --</option>
                    {wrenchProjects.map((proj) => (
                      <option key={proj.order_no} value={proj.order_no}>
                        {proj.label || `${proj.order_no} - ${proj.order_description}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={createNewProject}
                    disabled={!newProjectName.trim() || !selectedWrenchProject || loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                  >
                    {loading ? 'Creating...' : 'Create Project'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewProjectName('');
                    }}
                    className="px-6 py-3 bg-white/10 backdrop-blur border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
};

export default DataMiningPlatform;
