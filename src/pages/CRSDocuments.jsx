/**
 * CRS Documents Page - Comment Resolution Sheet
 * Professional PDF comment extraction and Google Sheets integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import crsService from '../services/crsService';
import { API_BASE_URL } from '../config/api.config';
import { STORAGE_KEYS } from '../config/app.config';
import { withDashboardControls } from '../hoc/withPageControls';
import { PageControlButtons } from '../components/PageControlButtons';

const CRSDocuments = ({ pageControls, refetch }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states - NEW: Upload-based workflow
  const [uploadFile, setUploadFile] = useState(null);
  const [fileMetadata, setFileMetadata] = useState({
    project_name: '',
    document_number: '',
    revision: '',
    contractor: '',
    department: '',
    project_type: '', // NEW: ADNOC Onshore/Offshore
    template_key: '', // NEW: Selected S3 template
  });
  
  // NEW: Template management states
  const [projectTypes, setProjectTypes] = useState([]);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Department options - loaded from API config
  const [departmentOptions, setDepartmentOptions] = useState([
    // Default fallback options
    { id: 'process_control_hse', name: 'Process Control and HSE', code: 'PCH' },
    { id: 'ict', name: 'I&CT', code: 'ICT' },
    { id: 'structure_civil', name: 'Structure and Civil', code: 'SC' },
  ]);
  const [processing, setProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [pdfFile, setPdfFile] = useState(null); // For old upload modal

  useEffect(() => {
    loadData();
    loadConfig(); // Load configuration including departments
    loadProjectTypes(); // Load project types from backend
  }, []);

  // NEW: Load project types from backend
  const loadProjectTypes = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const response = await fetch(
        `${API_BASE_URL}/crs/templates/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.project_types) {
          setProjectTypes(data.project_types);
        }
      }
    } catch (error) {
      console.error('Error loading project types:', error);
    }
  };

  // NEW: Load templates when project type changes
  const handleProjectTypeChange = async (projectType) => {
    setFileMetadata({ ...fileMetadata, project_type: projectType, template_key: '' });
    setAvailableTemplates([]);
    
    if (!projectType) return;
    
    try {
      setLoadingTemplates(true);
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const response = await fetch(
        `${API_BASE_URL}/crs/templates/?project_type=${projectType}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.templates) {
          setAvailableTemplates(data.templates);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load soft-coded configuration from backend
  const loadConfig = async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const response = await fetch(
        `${API_BASE_URL}/crs/documents/config/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.config?.departments) {
          setDepartmentOptions(data.config.departments);
        }
      }
    } catch (error) {
      console.log('Using default department options');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [docsResponse, statsResponse] = await Promise.all([
        crsService.fetchCRSDocuments(),
        crsService.getCRSStatistics()
      ]);
      
      setDocuments(Array.isArray(docsResponse) ? docsResponse : docsResponse.results || []);
      setStatistics(statsResponse);
    } catch (error) {
      console.error('Error loading CRS data:', error);
      alert('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // NEW: State for preview mode
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const handleUploadAndProcess = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a file to upload');
      return;
    }
    
    setProcessing(true);
    setUploadResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('project_name', fileMetadata.project_name);
      formData.append('document_number', fileMetadata.document_number);
      formData.append('revision', fileMetadata.revision);
      formData.append('contractor', fileMetadata.contractor);
      formData.append('department', fileMetadata.department);
      formData.append('preview', 'true'); // Request preview mode first
      
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      // Call unified upload endpoint in preview mode
      const response = await fetch(
        `${API_BASE_URL}/crs/documents/upload-and-process/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      // Preview mode returns JSON with comments data
      const data = await response.json();
      
      if (data.preview && data.comments) {
        // Smart filtering: Remove comments with "Not Provided" or empty reviewers (client-side fallback)
        const notProvidedPatterns = ['not provided', 'not_provided', 'unknown', 'n/a', 'na', ''];
        const filteredComments = data.comments.filter(comment => {
          const reviewer = (comment.reviewer_name || '').toLowerCase().trim();
          return !notProvidedPatterns.includes(reviewer) && reviewer.length > 0;
        });
        
        // Recalculate statistics based on filtered comments
        const adjustedStatistics = {
          ...data.statistics,
          total: filteredComments.length,
          filtered_count: data.comments.length - filteredComments.length
        };
        
        // Store preview data and show preview modal
        setPreviewData({
          ...data,
          comments: filteredComments, // Use filtered comments
          statistics: adjustedStatistics, // Use adjusted statistics
          file: uploadFile,
          fileMetadata: { ...fileMetadata }
        });
        setShowCreateModal(false);
        setShowPreviewModal(true);
        setUploadResult({
          success: true,
          message: `Extracted ${filteredComments.length} comments${adjustedStatistics.filtered_count > 0 ? ` (filtered ${adjustedStatistics.filtered_count} without reviewer attribution)` : ''}. Review below and choose download format.`
        });
      } else {
        // Fallback for non-preview response
        setUploadResult({
          success: true,
          message: data.message || 'File processed successfully',
          data: data
        });
      }
      
    } catch (error) {
      console.error('Error:', error);
      setUploadResult({
        success: false,
        message: error.message || 'Failed to process file'
      });
    } finally {
      setProcessing(false);
    }
  };

  // NEW: Generate and download Excel directly from preview data
  const handleDownload = async (format) => {
    if (!previewData || !previewData.comments || previewData.comments.length === 0) {
      alert('No comment data available for download');
      return;
    }

    setDownloadingFormat(format);

    try {
      const docNumber = previewData.fileMetadata?.document_number || 'Document';
      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'xlsx') {
        // Create Excel workbook using xlsx library
        const wb = XLSX.utils.book_new();
        
        // Define headers matching CRS template
        const headers = ['Page', 'Reviewer', 'Comment', 'Type', 'Discipline', 'Drawing Ref', 'Status'];
        
        // Map comment data to Excel rows
        const wsData = [
          headers,
          ...previewData.comments.map(comment => [
            comment.page_number || 'N/A',
            comment.reviewer_name || 'N/A',
            comment.comment_text || '',
            (comment.type || 'General').toUpperCase() === 'HOLD' ? 'HOLD' : 'General',
            comment.discipline || 'N/A',
            comment.drawing_reference || 'N/A',
            comment.status || 'Open'
          ])
        ];
        
        // Create worksheet with data
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Set column widths for readability
        ws['!cols'] = [
          {wch: 8},  // Page
          {wch: 20}, // Reviewer
          {wch: 50}, // Comment
          {wch: 12}, // Type
          {wch: 15}, // Discipline
          {wch: 20}, // Drawing Ref
          {wch: 10}  // Status
        ];
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'CRS Comments');
        
        // Generate Excel file and download
        XLSX.writeFile(wb, `CRS_${docNumber}_${timestamp}.xlsx`);
        
      } else if (format === 'csv') {
        // Create CSV data
        const headers = ['Page', 'Reviewer', 'Comment', 'Type', 'Discipline', 'Drawing Ref', 'Status'];
        const rows = previewData.comments.map(comment => [
          comment.page_number || 'N/A',
          comment.reviewer_name || 'N/A',
          `"${(comment.comment_text || '').replace(/"/g, '""')}"`, // Escape quotes
          (comment.type || 'General').toUpperCase() === 'HOLD' ? 'HOLD' : 'General',
          comment.discipline || 'N/A',
          comment.drawing_reference || 'N/A',
          comment.status || 'Open'
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CRS_${docNumber}_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
      } else if (format === 'json') {
        // Create JSON data
        const jsonData = {
          metadata: previewData.fileMetadata || {},
          statistics: previewData.statistics || {},
          comments: previewData.comments,
          exported_at: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CRS_${docNumber}_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
      } else if (format === 'pdf' || format === 'docx') {
        // Call backend API to generate PDF or DOCX from the preview data
        const formData = new FormData();
        formData.append('file', previewData.file);
        formData.append('project_name', previewData.fileMetadata.project_name);
        formData.append('document_number', previewData.fileMetadata.document_number);
        formData.append('revision', previewData.fileMetadata.revision);
        formData.append('contractor', previewData.fileMetadata.contractor);
        formData.append('department', previewData.fileMetadata.department);
        formData.append('format', format); // Specify PDF or DOCX format
        
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        
        const response = await fetch(
          `${API_BASE_URL}/crs/documents/upload-and-process/`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `${format.toUpperCase()} generation failed`);
        }
        
        // Backend returns the file as binary
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CRS_${docNumber}_${timestamp}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      
    } catch (error) {
      console.error('Error generating download:', error);
      alert('Failed to generate download: ' + error.message);
    } finally {
      setDownloadingFormat(null);
    }
  };  // NEW: Close preview and reset
  const handleClosePreview = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
    setUploadFile(null);
    setFileMetadata({
      project_name: '',
      document_number: '',
      revision: '',
      contractor: '',
      department: '',
    });
    setUploadResult(null);
    loadData();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (validTypes.includes(file.type)) {
        setUploadFile(file);
        setUploadResult(null);
      } else {
        alert('Please select a valid PDF or Excel file');
        e.target.value = '';
      }
    }
  };

  const handleUploadPDF = async (e) => {
    e.preventDefault();
    if (!pdfFile || !selectedDocument) return;
    
    setProcessing(true);
    
    try {
      // Upload PDF
      await crsService.uploadPDFDocument(selectedDocument.id, pdfFile);
      
      // Extract comments automatically
      const extractResult = await crsService.extractPDFComments(selectedDocument.id, {
        autoCreate: true,
        debug: false
      });
      
      alert(`✅ PDF uploaded and processed!\n\nExtracted ${extractResult.data.total_comments} comments:\n- 🔴 Red comments: ${extractResult.data.red_comments}\n- 🟡 Yellow boxes: ${extractResult.data.yellow_boxes}\n- 📌 Other: ${extractResult.data.other_annotations}`);
      
      setShowUploadModal(false);
      setPdfFile(null);
      setSelectedDocument(null);
      loadData();
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExportToSheets = async (document) => {
    if (!document.google_sheet_id) {
      const sheetId = prompt('Enter Google Sheet ID:');
      if (!sheetId) return;
      
      try {
        setProcessing(true);
        await crsService.exportToGoogleSheets(document.id, { sheetId });
        alert('✅ Exported to Google Sheets successfully!');
        loadData();
      } catch (error) {
        console.error('Error exporting:', error);
        alert('Failed to export. Please ensure Google Sheets API is configured.');
      } finally {
        setProcessing(false);
      }
    } else {
      try {
        setProcessing(true);
        await crsService.exportToGoogleSheets(document.id);
        alert('✅ Exported to Google Sheets successfully!');
        loadData();
      } catch (error) {
        console.error('Error exporting:', error);
        alert('Failed to export. Please try again.');
      } finally {
        setProcessing(false);
      }
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesSearch = !searchQuery || 
      doc.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.document_number && doc.document_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.project_name && doc.project_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-gray-100 text-gray-800',
      'in_review': 'bg-blue-100 text-blue-800',
      'processing': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'archived': 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'Pending',
      'in_review': 'In Review',
      'processing': 'Processing',
      'completed': 'Completed',
      'archived': 'Archived',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            📋 CRS Documents - Comment Resolution Sheet
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Professional PDF comment extraction and Google Sheets integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PageControlButtons controls={pageControls} />
          <Link
            to="/crs/documents/history"
            className="inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors whitespace-nowrap"
          >
            📚 View History
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Documents</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.total_documents}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Comments</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.total_comments}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Open Comments</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.comments_by_status?.open || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Resolved</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.comments_by_status?.resolved || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Upload & Process Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            📤 Upload & Process CRS
          </button>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocuments.map(doc => (
          <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {doc.document_name}
                  </h3>
                  {doc.document_number && (
                    <p className="text-sm text-gray-500">Doc #: {doc.document_number}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                  {getStatusLabel(doc.status)}
                </span>
              </div>

              {/* Project Info */}
              {doc.project_name && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Project:</span> {doc.project_name}
                  </p>
                  {doc.contractor_name && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Contractor:</span> {doc.contractor_name}
                    </p>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span className="font-medium">{doc.completion_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${doc.completion_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-2xl font-bold text-gray-900">{doc.total_comments}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="bg-yellow-50 rounded p-2">
                  <p className="text-2xl font-bold text-yellow-600">{doc.pending_comments}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <p className="text-2xl font-bold text-green-600">{doc.resolved_comments}</p>
                  <p className="text-xs text-gray-500">Resolved</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/crs/documents/${doc.id}`}
                  className="flex-1 text-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  View Details
                </Link>
                
                {!doc.pdf_file && (
                  <button
                    onClick={() => {
                      setSelectedDocument(doc);
                      setShowUploadModal(true);
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                  >
                    📤 Upload PDF
                  </button>
                )}
                
                {doc.total_comments > 0 && (
                  <button
                    onClick={() => handleExportToSheets(doc)}
                    disabled={processing}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    📊 Export
                  </button>
                )}
              </div>

              {/* Google Sheet Link */}
              {doc.google_sheet_url && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <a
                    href={doc.google_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in Google Sheets
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredDocuments.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by uploading and processing a CRS file.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 shadow-lg text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              📤 Upload & Process CRS
            </button>
          </div>
        </div>
      )}

      {/* Upload & Process Modal - NEW WORKFLOW */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    📋 Upload Comment Resolution Sheet
                  </h2>
                  <p className="text-indigo-100 text-sm">
                    Upload PDF or Excel file - Get standardized CRS template instantly
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setUploadFile(null);
                    setUploadResult(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleUploadAndProcess} className="p-6">
              {/* File Upload Section */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  📄 Select File (PDF or Excel) *
                </label>
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-all bg-gray-50">
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    onChange={handleFileSelect}
                    required
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {!uploadFile ? (
                    <div>
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        PDF, Excel (.xlsx, .xls) up to 50MB
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        {uploadFile.type.includes('pdf') ? (
                          <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                          </svg>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{uploadFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                        }}
                        className="ml-4 text-red-600 hover:text-red-800"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-blue-900">
                      <p className="font-semibold mb-1">What happens next?</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>System extracts all comments from your file</li>
                        <li>Data is validated and cleaned automatically</li>
                        <li>Standardized CRS template (CRS template.xlsx) is populated</li>
                        <li>Ready-to-use Excel file downloads instantly</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata Section */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Document Information
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={fileMetadata.project_name}
                      onChange={(e) => setFileMetadata({...fileMetadata, project_name: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                      placeholder="e.g., Plant Expansion Phase 2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document Number
                    </label>
                    <input
                      type="text"
                      value={fileMetadata.document_number}
                      onChange={(e) => setFileMetadata({...fileMetadata, document_number: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                      placeholder="e.g., DOC-12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Revision
                    </label>
                    <input
                      type="text"
                      value={fileMetadata.revision}
                      onChange={(e) => setFileMetadata({...fileMetadata, revision: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                      placeholder="e.g., R1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contractor
                    </label>
                    <input
                      type="text"
                      value={fileMetadata.contractor}
                      onChange={(e) => setFileMetadata({...fileMetadata, contractor: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                      placeholder="e.g., XYZ Engineering"
                    />
                  </div>
                </div>

                {/* Department Selection */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <select
                    value={fileMetadata.department}
                    onChange={(e) => setFileMetadata({...fileMetadata, department: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">Select Department...</option>
                    {departmentOptions.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* NEW: Project Type Selection */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fileMetadata.project_type}
                    onChange={(e) => handleProjectTypeChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                    required
                  >
                    <option value="">Select Project Type...</option>
                    {projectTypes.map((type) => (
                      <option key={type.code} value={type.code}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* NEW: Template Selection */}
                {fileMetadata.project_type && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CRS Template
                    </label>
                    {loadingTemplates ? (
                      <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                        Loading templates...
                      </div>
                    ) : availableTemplates.length > 0 ? (
                      <select
                        value={fileMetadata.template_key}
                        onChange={(e) => setFileMetadata({...fileMetadata, template_key: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      >
                        <option value="">Use Default Template</option>
                        {availableTemplates.map((template) => (
                          <option key={template.key} value={template.key}>
                            📄 {template.filename} ({(template.size / 1024).toFixed(1)} KB)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full px-4 py-2.5 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
                        ⚠️ No custom templates found. Default template will be used.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Result Message */}
              {uploadResult && (
                <div className={`mb-6 p-4 rounded-xl border-2 ${
                  uploadResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      uploadResult.success ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {uploadResult.success ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold ${uploadResult.success ? 'text-green-900' : 'text-red-900'}`}>
                        {uploadResult.success ? '✅ Success!' : '❌ Error'}
                      </p>
                      <p className={`text-sm mt-1 ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {uploadResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setUploadFile(null);
                    setUploadResult(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || processing}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    !uploadFile || processing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                  }`}
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload & Process
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal - Shows extracted comments before download */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    ✅ Comment Extraction Complete
                  </h2>
                  <p className="text-green-100 text-sm">
                    {previewData.statistics?.total || previewData.comments?.length || 0} comments extracted • Review and download in your preferred format
                  </p>
                </div>
                <button
                  onClick={handleClosePreview}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Statistics Summary */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-3xl font-bold text-indigo-600">{previewData.statistics?.total || previewData.comments?.length || 0}</p>
                  <p className="text-sm text-gray-500">Total Comments</p>
                </div>
                {previewData.statistics?.by_type && Object.keys(previewData.statistics.by_type).length > 0 && (
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-1">By Type</p>
                    <div className="text-xs text-gray-600">
                      {Object.entries(previewData.statistics.by_type).slice(0, 3).map(([type, count]) => (
                        <span key={type} className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-1 mb-1">
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {previewData.statistics?.by_discipline && Object.keys(previewData.statistics.by_discipline).length > 0 && (
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-1">By Discipline</p>
                    <div className="text-xs text-gray-600">
                      {Object.entries(previewData.statistics.by_discipline).slice(0, 3).map(([disc, count]) => (
                        <span key={disc} className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded mr-1 mb-1">
                          {disc}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {previewData.statistics?.by_reviewer && Object.keys(previewData.statistics.by_reviewer).length > 0 && (
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm font-semibold text-gray-700 mb-1">By Reviewer</p>
                    <div className="text-xs text-gray-600">
                      {Object.entries(previewData.statistics.by_reviewer).slice(0, 3).map(([reviewer, count]) => (
                        <span key={reviewer} className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded mr-1 mb-1">
                          {reviewer}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Table */}
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Page</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Reviewer</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.comments && previewData.comments.map((comment, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{comment.page_number || comment.page || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            (comment.comment_type || comment.type) === 'HOLD' ? 'bg-red-100 text-red-800' :
                            (comment.comment_type || comment.type) === 'ADEQUACY' ? 'bg-yellow-100 text-yellow-800' :
                            (comment.comment_type || comment.type) === 'RECOMMENDATION' ? 'bg-blue-100 text-blue-800' :
                            (comment.comment_type || comment.type) === 'CLARIFICATION' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {comment.comment_type || comment.type || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                          <div className="truncate" title={comment.comment_text || comment.content}>
                            {comment.comment_text || comment.content || comment.text || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{comment.reviewer_name || comment.reviewer || comment.author || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {(!previewData.comments || previewData.comments.length === 0) && (
                  <div className="p-8 text-center text-gray-500">
                    <p>No comments found in the document.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Download Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                  Choose your preferred download format:
                </p>
                <div className="flex flex-wrap gap-3">
                  {/* Excel Download */}
                  <button
                    onClick={() => handleDownload('xlsx')}
                    disabled={downloadingFormat !== null}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                      downloadingFormat === 'xlsx' 
                        ? 'bg-green-400 text-white cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
                    }`}
                  >
                    {downloadingFormat === 'xlsx' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                        </svg>
                        📊 Excel (.xlsx)
                      </>
                    )}
                  </button>

                  {/* CSV Download */}
                  <button
                    onClick={() => handleDownload('csv')}
                    disabled={downloadingFormat !== null}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                      downloadingFormat === 'csv' 
                        ? 'bg-blue-400 text-white cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                    }`}
                  >
                    {downloadingFormat === 'csv' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                        </svg>
                        📄 CSV
                      </>
                    )}
                  </button>

                  {/* JSON Download */}
                  <button
                    onClick={() => handleDownload('json')}
                    disabled={downloadingFormat !== null}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                      downloadingFormat === 'json' 
                        ? 'bg-purple-400 text-white cursor-wait'
                        : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg'
                    }`}
                  >
                    {downloadingFormat === 'json' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                        </svg>
                        🔧 JSON
                      </>
                    )}
                  </button>

                  {/* PDF Download */}
                  <button
                    onClick={() => handleDownload('pdf')}
                    disabled={downloadingFormat !== null}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                      downloadingFormat === 'pdf' 
                        ? 'bg-red-400 text-white cursor-wait'
                        : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg'
                    }`}
                  >
                    {downloadingFormat === 'pdf' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                        </svg>
                        📕 PDF
                      </>
                    )}
                  </button>

                  {/* DOCX Download */}
                  <button
                    onClick={() => handleDownload('docx')}
                    disabled={downloadingFormat !== null}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                      downloadingFormat === 'docx' 
                        ? 'bg-indigo-400 text-white cursor-wait'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                    }`}
                  >
                    {downloadingFormat === 'docx' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" />
                        </svg>
                        📝 Word
                      </>
                    )}
                  </button>

                  {/* Cancel/Close */}
                  <button
                    onClick={handleClosePreview}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Old Upload PDF Modal - Keep for backward compatibility */}
      {showUploadModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Upload PDF for {selectedDocument.document_name}</h3>
            <form onSubmit={handleUploadPDF}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select PDF File
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files[0])}
                  required
                  className="w-full"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedDocument(null);
                    setPdfFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {processing ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component to provide refetch functionality
const CRSDocumentsWithRefresh = (props) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  return <CRSDocuments {...props} refetch={refetch} key={refreshTrigger} />;
};

export default withDashboardControls(CRSDocumentsWithRefresh, {
  autoRefreshInterval: 30000, // 30 seconds
  storageKey: 'crsDocumentsPageControls',
});
