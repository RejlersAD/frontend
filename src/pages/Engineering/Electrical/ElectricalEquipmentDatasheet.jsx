/**
 * Electrical Equipment Datasheet Generator
 * SOFT-CODED: SLD upload page OR Transformer document upload
 * Features:
 * - Equipment type selection (SLD or Transformer)
 * - For SLD: Single or multiple file upload with AI detection
 * - For Transformer: Upload MV/LV Trafo Calculation, Criteria, Formula documents
 * - Drag & drop interface
 * - Automatic datasheet generation
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  DocumentTextIcon, 
  CloudArrowUpIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  BoltIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import apiClient from '../../../services/api.service';
import ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG, {
  validateFileSize,
  validateFileFormat,
  getEquipmentTypeById,
  getColorScheme,
  getApiEndpoint,
  handleApiError
} from '../../../config/electricalEquipmentUpload.config';

// Equipment-specific document types configuration
const EQUIPMENT_DOC_TYPES = {
  edg: [
    {
      id: 'edg_load_list',
      label: 'EDG Load List',
      description: 'Emergency Diesel Generator Load List Document',
      icon: '📊'
    },
    {
      id: 'dg_calculation',
      label: 'DG Calculation',
      description: 'Diesel Generator Sizing Calculation Document',
      icon: '🔢'
    }
  ],
  switchgear_11kv: [
    {
      id: 'switchgear_sld',
      label: 'Switchgear SLD',
      description: '11kV Switchgear Single Line Diagram',
      icon: '⚡'
    },
    {
      id: 'switchgear_schedule',
      label: 'Switchgear Schedule',
      description: '11kV Switchgear Equipment Schedule',
      icon: '📋'
    }
  ],
  transformer: [
    {
      id: 'transformer_calculation',
      label: 'Transformer Sizing Calculation',
      description: 'Transformer Sizing Calculation (Power and Distribution)',
      icon: '⚡'
    }
  ]
};

const ElectricalEquipmentDatasheet = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { page, upload, equipmentTypes, datasheetTypes, analysisOptions, projectFields, messages, theme } = ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG;
  
  // NEW: Equipment Type Selection
  const [equipmentType, setEquipmentType] = useState('edg'); // 'edg', 'switchgear_11kv', or 'transformer'
  
  // State management
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  
  // NEW: Equipment-specific document files state
  const [equipmentDocs, setEquipmentDocs] = useState({});
  const [transformerDatasheet, setTransformerDatasheet] = useState(null);
  const [verificationResults, setVerificationResults] = useState(null);
  const [verifying, setVerifying] = useState(false);
  
  const [selectedOptionsState, setSelectedOptionsState] = useState({
    extract_tags: true,
    detect_types: true,
    extract_specs: true,
    generate_datasheets: false,
    identify_connections: true
  });

  const [multiSelectMode, setMultiSelectMode] = useState(false);

  const [selectedDatasheetTypes, setSelectedDatasheetTypes] = useState({
    transformer: true,
    diesel_generator: false,
    switchgear_11kv: false
  });

  const [formData, setFormData] = useState({
    drawing_number: '',
    drawing_title: '',
    revision: projectFields.revision.default,
    project_name: '',
    project_code: '',
    area: '',
    discipline: projectFields.discipline.default,
    voltage_level: '',
    selectedDatasheetType: 'transformer'
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

  // File handling for SLD
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  // NEW: Handle equipment document upload
  const handleEquipmentDocChange = (docType, e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file
      if (!validateFileFormat(file)) {
        setError('Invalid file format for ' + docType + '. Supported: PDF, Excel');
        return;
      }
      if (!validateFileSize(file)) {
        setError('File too large for ' + docType + '. Max size: ' + upload.maxFileSize);
        return;
      }
      
      setEquipmentDocs(prev => ({
        ...prev,
        [docType]: file
      }));
      setError('');
    }
  };



  const handleVerifyTransformer = async () => {
    if (!transformerDatasheet) {
      setError('Please upload the transformer datasheet Excel file');
      return;
    }

    if (!equipmentDocs.transformer_calculation) {
      setError('Please upload the Transformer Sizing Calculation PDF');
      return;
    }

    setVerifying(true);
    setError('');
    setAnalysisStage('Verifying transformer datasheet...');

    try {
      const formData = new FormData();
      formData.append('transformer_datasheet', transformerDatasheet);
      formData.append('transformer_calculation', equipmentDocs.transformer_calculation);

      const response = await apiClient.post(
        '/electrical/datasheets/verify-transformer/',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      );

      setVerificationResults(response.data);
      setAnalysisStage('');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.response?.data?.error || 'Verification failed. Please try again.');
      setAnalysisStage('');
    } finally {
      setVerifying(false);
      setUploadProgress(0);
    }
  };

  
  // Export verification results to Excel
  const handleExportToExcel = () => {
    if (!verificationResults || !verificationResults.verification_results) return;
    
    const excelData = verificationResults.verification_results.map(result => ({
      'Parameter': result.parameter || '',
      'Datasheet Value': result.datasheet_value || '',
      'Document Value': result.document_value || '',
      'Status': result.status || '',
      'Explanation': result.explanation || '',
      'Confidence': result.confidence || '',
      'Source': result.source_document || ''
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 },  // Parameter
      { wch: 20 },  // Datasheet Value
      { wch: 20 },  // Document Value
      { wch: 12 },  // Status
      { wch: 60 },  // Explanation
      { wch: 12 },  // Confidence
      { wch: 25 }   // Source
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Verification Results');
    
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, 'Transformer_Datasheet_Verification_' + timestamp + '.xlsx');
  };  // NEW: Remove equipment document
  const removeEquipmentDoc = (docType) => {
    setEquipmentDocs(prev => ({
      ...prev,
      [docType]: null
    }));
  };

  const addFiles = (newFiles) => {
    const validatedFiles = [];
    const errors = [];

    newFiles.forEach(file => {
      if (!validateFileFormat(file)) {
                errors.push(file.name + ': ' + messages.errors.invalidFormat + ' ' + upload.supportedFormats.join(', '));
        return;
      }
      if (!validateFileSize(file)) {
        errors.push(file.name + ': ' + messages.errors.fileTooLarge.replace('{size}', upload.maxFileSize));
        return;
      }
      if (files.length + validatedFiles.length >= upload.maxFiles) {
        errors.push(messages.errors.tooManyFiles.replace('{max}', upload.maxFiles));
        return;
      }

      const fileWithPreview = Object.assign(file, {
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        id: Date.now() + '-' + Math.random()
      });
      validatedFiles.push(fileWithPreview);
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (validatedFiles.length > 0) {
      setFiles(prev => [...prev, ...validatedFiles]);
      setError('');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Handle upload
  const handleUpload = async () => {
    setError('');
    setWarning('');

    // For equipment types with specific documents (edg, switchgear_11kv, transformer)
    if (['edg', 'switchgear_11kv', 'transformer'].includes(equipmentType)) {
      // Check if at least one document is uploaded
      const uploadedDocs = Object.values(equipmentDocs).filter(doc => doc !== null);
      if (uploadedDocs.length === 0) {
        setError('Please upload at least one document.');
        return;
      }

      const equipmentLabels = {
        edg: 'Emergency Diesel Generator',
        switchgear_11kv: '11kV Switchgear',
        transformer: 'Transformer'
      };

      try {
        setUploading(true);
        setUploadProgress(20);
        setAnalysisStage('Uploading ' + equipmentLabels[equipmentType] + ' documents...');

        const formDataToSend = new FormData();
        formDataToSend.append('equipment_type', equipmentType);
        formDataToSend.append('project_name', formData.project_name);
        formDataToSend.append('drawing_number', formData.drawing_number);
        formDataToSend.append('area', formData.area);

        // Append each document with its type
        Object.entries(equipmentDocs).forEach(([docType, file]) => {
          if (file) {
            formDataToSend.append('files', file);
            formDataToSend.append('doc_type_' + file.name, docType);
          }
        });

        setUploadProgress(50);

        const response = await apiClient.post(
          '/api/v1/electrical-datasheet/smart-sld/process/',
          formDataToSend,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 300000
          }
        );

        setUploadProgress(100);
        setAnalysisStage('Upload complete!');

        if (response.data.success) {
          setUploadResult({
            success: true,
            message: response.data.message,
            documents_uploaded: response.data.documents_uploaded,
            job_id: response.data.job_id
          });
          setEquipmentDocs({});
        }

        setUploading(false);
      } catch (err) {
        console.error('Upload error:', err);
        setError(err.response?.data?.error || 'Failed to upload ' + equipmentLabels[equipmentType] + ' documents. Please try again.');
        setUploading(false);
        setUploadProgress(0);
        setAnalysisStage('');
      }
      return;
    }
  };

  // Reset form
  const handleReset = () => {
    setFiles([]);
    setEquipmentDocs({});
    setTransformerDatasheet(null);
    setVerificationResults(null);
    setVerifying(false);
    setUploadResult(null);
    setError('');
    setWarning('');
    setUploadProgress(0);
    setAnalysisStage('');
    setUploading(false);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(page.backRoute)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            {page.backText}
          </button>

          <div className="flex items-center gap-4 mb-3">
            <div className={`p-3 bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} rounded-xl`}>
              <BoltIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{page.title}</h1>
              <p className="text-gray-600 mt-1">{page.subtitle}</p>
            </div>
          </div>

          {/* NEW: Equipment Type Selector */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Equipment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  setEquipmentType('edg');
                  setEquipmentDocs({});
                  setError('');
                  setWarning('');
                }}
                className={`p-4 border-2 rounded-lg transition-all ${
                  equipmentType === 'edg'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-3xl ${equipmentType === 'edg' ? 'scale-110' : ''}`}>⚙️</div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Emergency Diesel Generator</div>
                    <div className="text-xs text-gray-600">Upload EDG Load List and DG Calculation</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setEquipmentType('switchgear_11kv');
                  setEquipmentDocs({});
                  setError('');
                  setWarning('');
                }}
                className={`p-4 border-2 rounded-lg transition-all ${
                  equipmentType === 'switchgear_11kv'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-3xl ${equipmentType === 'switchgear_11kv' ? 'scale-110' : ''}`}>🔌</div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">11kV Switchgear</div>
                    <div className="text-xs text-gray-600">Upload Switchgear SLD and Schedule</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setEquipmentType('transformer');
                  setEquipmentDocs({});
                  setError('');
                  setWarning('');
                }}
                className={`p-4 border-2 rounded-lg transition-all ${
                  equipmentType === 'transformer'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-3xl ${equipmentType === 'transformer' ? 'scale-110' : ''}`}>🔋</div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Transformer (Power & Distribution)</div>
                    <div className="text-xs text-gray-600">Upload MV/LV calculations and formulas</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <BoltIcon className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-600" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-1 text-blue-900">
                  {equipmentType === 'edg' && 'Emergency Diesel Generator Document Upload'}
                  {equipmentType === 'switchgear_11kv' && '11kV Switchgear Document Upload'}
                  {equipmentType === 'transformer' && 'Transformer Document Upload'}
                </h3>
                <p className="text-sm text-blue-800">
                  {equipmentType === 'edg' && 'Upload EDG Load List and DG Calculation documents for diesel generator specifications'}
                  {equipmentType === 'switchgear_11kv' && 'Upload 11kV Switchgear SLD and Equipment Schedule documents'}
                  {equipmentType === 'transformer' && 'Upload MV Trafo Calculation, Criteria, Formula, and LV Trafo Calculation documents'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload & Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Information Form */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Cog6ToothIcon className="h-6 w-6 text-blue-600" />
                Project Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {projectFields.drawing_number.label}
                  </label>
                  <input
                    type="text"
                    value={formData.drawing_number}
                    onChange={(e) => setFormData({ ...formData, drawing_number: e.target.value })}
                    placeholder={projectFields.drawing_number.placeholder}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {projectFields.project_name.label}
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    placeholder={projectFields.project_name.placeholder}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {projectFields.area.label}
                  </label>
                  <input
                    type="text"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder={projectFields.area.placeholder}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Equipment Document Upload Section */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DocumentArrowUpIcon className="h-6 w-6 text-blue-600" />
                Upload {equipmentType === 'edg' && 'Emergency Diesel Generator'}
                {equipmentType === 'switchgear_11kv' && '11kV Switchgear'}
                {equipmentType === 'transformer' && 'Transformer'} Documents
              </h2>

              <div className="space-y-4">
            {/* Excel Datasheet Upload - Only for Transformer */}
            {equipmentType === 'transformer' && (
              <div className="border-2 border-dashed border-blue-400 rounded-lg p-4 bg-blue-50 mb-4">
                <div className="flex items-start gap-3 mb-3">
                  <DocumentTextIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">📊 Transformer Datasheet (Excel) *</h4>
                    <p className="text-xs text-blue-800">Upload the transformer datasheet Excel file to verify against the documents below</p>
                  </div>
                </div>

                {transformerDatasheet ? (
                  <div className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{transformerDatasheet.name}</div>
                        <div className="text-xs text-gray-600">{formatFileSize(transformerDatasheet.size)}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setTransformerDatasheet(null)}
                      className="p-1 hover:bg-red-100 rounded-full transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="transformer-datasheet-upload"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setTransformerDatasheet(e.target.files[0]);
                          setError('');
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="transformer-datasheet-upload"
                      className="block w-full px-4 py-3 border-2 border-dashed border-blue-400 rounded-lg text-center cursor-pointer hover:border-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <CloudArrowUpIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <span className="text-sm font-medium text-blue-700">Click to upload Excel datasheet</span>
                    </label>
                  </div>
                )}
              </div>
            )}


                {EQUIPMENT_DOC_TYPES[equipmentType]?.map((docType) => (
                  <div key={docType.id} className="border border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{docType.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{docType.label}</div>
                          <div className="text-xs text-gray-600">{docType.description}</div>
                        </div>
                      </div>
                    </div>

                    {equipmentDocs[docType.id] ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{equipmentDocs[docType.id].name}</div>
                            <div className="text-xs text-gray-600">{formatFileSize(equipmentDocs[docType.id].size)}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeEquipmentDoc(docType.id)}
                          className="p-1 hover:bg-red-100 rounded-full transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5 text-red-600" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`upload-${docType.id}`}
                          accept=".pdf,.xlsx,.xls"
                          onChange={(e) => handleEquipmentDocChange(docType.id, e)}
                          className="hidden"
                        />
                        <label
                          htmlFor={`upload-${docType.id}`}
                          className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <CloudArrowUpIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <span className="text-sm text-gray-600">Click to upload {docType.label}</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {equipmentType === 'transformer' ? (
                <button
                  onClick={handleVerifyTransformer}
                  disabled={verifying || !transformerDatasheet || !equipmentDocs.transformer_calculation}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                    verifying || !transformerDatasheet || Object.keys(equipmentDocs).length < 4
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {verifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Verifying... {uploadProgress}%
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircleIcon className="h-5 w-5" />
                      Verify Datasheet
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleUpload}
                  disabled={uploading || Object.values(equipmentDocs).every(doc => doc === null)}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                    uploading || Object.values(equipmentDocs).every(doc => doc === null)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Processing... {uploadProgress}%
                    </span>
                  ) : (
                    <>Upload Documents</>
                  )}
                </button>
              )}

              <button
                onClick={handleReset}
                disabled={uploading || verifying}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>

          {/* Verification Results */}
          {verificationResults && equipmentType === 'transformer' && (
            <div className="mt-6 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <p className="text-xs text-gray-600 mb-1">Total</p>
                  <p className="text-xl font-bold text-gray-900">{verificationResults.summary.total_parameters}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-green-200 p-3">
                  <p className="text-xs text-gray-600 mb-1">Valid</p>
                  <p className="text-xl font-bold text-green-600">{verificationResults.summary.valid}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-3">
                  <p className="text-xs text-gray-600 mb-1">Mismatch</p>
                  <p className="text-xl font-bold text-yellow-600">{verificationResults.summary.mismatch}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-red-200 p-3">
                  <p className="text-xs text-gray-600 mb-1">Incorrect</p>
                  <p className="text-xl font-bold text-red-600">{verificationResults.summary.incorrect}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <p className="text-xs text-gray-600 mb-1">Missing</p>
                  <p className="text-xl font-bold text-gray-600">{verificationResults.summary.missing}</p>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    Verification Results
                  </h3>
                  <button
                    onClick={handleExportToExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download Excel
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datasheet</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Explanation</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {verificationResults.verification_results.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{result.parameter}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{result.datasheet_value}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{result.document_value}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              result.status === 'Valid' ? 'bg-green-100 text-green-800' :
                              result.status === 'Mismatch' ? 'bg-yellow-100 text-yellow-800' :
                              result.status === 'Incorrect' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">{result.explanation}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              result.confidence === 'High' ? 'bg-green-100 text-green-700' :
                              result.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {result.confidence}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{result.source_document}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

            {/* Progress and Status */}
            {uploading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin" />
                  <span className="font-medium text-blue-900">{analysisStage}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Result */}
            {uploadResult && uploadResult.success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 mb-1">Upload Successful!</h3>
                    <p className="text-sm text-green-800">{uploadResult.message}</p>
                    {uploadResult.documents_uploaded && (
                      <p className="text-xs text-green-700 mt-2">
                        Documents uploaded: {uploadResult.documents_uploaded} • Job ID: {uploadResult.job_id}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                    <p className="text-sm text-red-800 whitespace-pre-line">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning Messages */}
            {warning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 mb-1">Notice</h3>
                    <p className="text-sm text-yellow-800 whitespace-pre-line">{warning}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Info & Help */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Required Documents</h3>
              {equipmentType === 'edg' && (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>Upload the following Emergency Diesel Generator documents:</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>EDG Load List</strong> - Emergency diesel generator load list and calculations</li>
                    <li><strong>DG Calculation</strong> - Diesel generator sizing and specification calculations</li>
                  </ul>
                  <p className="text-xs text-gray-600 mt-4">
                    Documents will be securely stored and associated with your project.
                  </p>
                </div>
              )}
              {equipmentType === 'switchgear_11kv' && (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>Upload the following 11kV Switchgear documents:</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Switchgear SLD</strong> - 11kV switchgear single line diagram</li>
                    <li><strong>Switchgear Schedule</strong> - Equipment schedule and specifications</li>
                  </ul>
                  <p className="text-xs text-gray-600 mt-4">
                    Documents will be securely stored and associated with your project.
                  </p>
                </div>
              )}
              {equipmentType === 'transformer' && (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>Upload the following transformer calculation and specification documents:</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>MV Trafo Calculation</strong> - Medium voltage transformer sizing and calculations</li>
                    <li><strong>Criteria</strong> - Selection criteria and specifications</li>
                    <li><strong>Formula</strong> - Design formulas and calculations</li>
                    <li><strong>LV Trafo Calculation</strong> - Low voltage transformer sizing</li>
                  </ul>
                  <p className="text-xs text-gray-600 mt-4">
                    Documents will be securely stored and associated with your project.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-700 mb-4">
                Upload PDF or Excel documents containing equipment calculations, specifications, and design documents.
              </p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                View Documentation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectricalEquipmentDatasheet;
