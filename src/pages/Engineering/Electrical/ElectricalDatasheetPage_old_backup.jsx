import React, { useState, useEffect } from 'react';
import apiClient from '../../../services/api.service';
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BoltIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const ElectricalDatasheetPage = () => {
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEquipmentTypes();
  }, []);

  const fetchEquipmentTypes = async () => {
    try {
      const response = await apiClient.get('/electrical-datasheet/equipment-types/');
      const data = response.data?.results || response.data || [];
      setEquipmentTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching equipment types:', err);
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload PDF or image files only (PDF, PNG, JPG, JPEG)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setValidationResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType) {
      setError('Please select equipment type and file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('equipment_type_id', selectedType);

      setUploadProgress(30);

      const response = await apiClient.post(
        '/electrical-datasheet/datasheets/validate_diagram/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUploadProgress(100);
      setValidationResult(response.data);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setSelectedType('');
    setValidationResult(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleExportToExcel = async () => {
    try {
      const response = await apiClient.post(
        '/electrical-datasheet/datasheets/export-validation/',
        validationResult,
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `electrical_validation_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export to Excel. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center">
            <BoltIcon className="w-10 h-10 text-yellow-600 mr-4" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Electrical Diagram Validation</h1>
              <p className="text-sm text-gray-600 mt-1 flex items-center">
                <SparklesIcon className="w-4 h-4 mr-1" />
                AI-Powered ADNOC Standards Verification
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!validationResult ? (
          <>
            {/* Equipment Type Selection */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Equipment Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipmentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-6 border-2 rounded-lg transition-all ${
                      selectedType === type.id
                        ? 'border-yellow-600 bg-yellow-50 shadow-md'
                        : 'border-gray-200 hover:border-yellow-400 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="text-4xl mr-4">{type.icon}</div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{type.name}</p>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Diagram</h2>
              
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  dragActive
                    ? 'border-yellow-600 bg-yellow-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {selectedFile ? (
                  <div className="space-y-4">
                    <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFile(null);
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        Drag and drop your diagram here
                      </p>
                      <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      Supports PDF, PNG, JPG, JPEG (Max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Upload Button */}
              <div className="mt-6">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedType || uploading}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all ${
                    !selectedFile || !selectedType || uploading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center">
                      <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                      Validating... {uploadProgress}%
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <SparklesIcon className="w-5 h-5 mr-2" />
                      Validate with AI
                    </span>
                  )}
                </button>
              </div>

              {/* Info Banner */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex">
                  <DocumentTextIcon className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">AI-Powered Validation</p>
                    <p>Your diagram will be automatically validated against ADNOC standards using OpenAI GPT-4. The system will check:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Technical specifications compliance</li>
                      <li>Safety standards adherence</li>
                      <li>Design parameters verification</li>
                      <li>Documentation completeness</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Validation Results */
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Validation Results</h2>
              <div className="flex space-x-3">
                <button
                  onClick={handleExportToExcel}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center shadow-md transition-all"
                >
                  <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                  Export to Excel
                </button>
                <button
                  onClick={resetUpload}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Upload New Diagram
                </button>
              </div>
            </div>

            {/* Validation Score */}
            <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                  <p className="text-4xl font-bold text-green-600 mt-2">
                    {validationResult.compliance_score}%
                  </p>
                </div>
                {validationResult.compliance_score >= 80 ? (
                  <CheckCircleIcon className="w-16 h-16 text-green-600" />
                ) : validationResult.compliance_score >= 60 ? (
                  <ExclamationTriangleIcon className="w-16 h-16 text-yellow-600" />
                ) : (
                  <XCircleIcon className="w-16 h-16 text-red-600" />
                )}
              </div>
            </div>

            {/* Validation Details */}
            <div className="space-y-6">
              {/* Extracted Data Section */}
              {validationResult.extracted_data && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Extracted Data</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(validationResult.extracted_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 capitalize">{key.replace('_', ' ')}:</span>
                          <span className={`text-sm ${value === 'NOT FOUND' ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                            {typeof value === 'object' ? JSON.stringify(value) : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Missing Data with Intelligent Defaults */}
              {validationResult.missing_data && validationResult.missing_data.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Missing Parameters & AI Recommendations</h3>
                  <div className="space-y-3">
                    {validationResult.missing_data.map((item, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          item.criticality === 'HIGH'
                            ? 'bg-red-50 border-red-300'
                            : item.criticality === 'MEDIUM'
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <ExclamationTriangleIcon 
                            className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                              item.criticality === 'HIGH'
                                ? 'text-red-600'
                                : item.criticality === 'MEDIUM'
                                ? 'text-yellow-600'
                                : 'text-gray-600'
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-gray-900">{item.parameter}</p>
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                item.criticality === 'HIGH'
                                  ? 'bg-red-100 text-red-800'
                                  : item.criticality === 'MEDIUM'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {item.criticality}
                              </span>
                            </div>
                            <div className="bg-white rounded px-3 py-2 mb-2">
                              <p className="text-sm text-gray-600">
                                <span className="font-semibold text-green-700">AI Suggested Default: </span>
                                {item.suggested_default}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 italic">
                              💡 Reasoning: {item.reasoning}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Results */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">ADNOC Standards Validation</h3>
                {validationResult.validation_results && (
                  <div className="space-y-3">
                    {validationResult.validation_results.map((result, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          result.passed
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start">
                          {result.passed ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircleIcon className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{result.parameter}</p>
                            {result.expected && (
                              <p className="text-xs text-gray-500 mt-1">
                                Expected: {result.expected} | Found: {result.found || 'MISSING'}
                              </p>
                            )}
                            <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                            {result.recommendation && (
                              <p className="text-sm text-blue-600 mt-2">
                                💡 {result.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* AI Analysis */}
              {validationResult.ai_analysis && (
                <div className="mt-6 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    AI Analysis
                  </h4>
                  <p className="text-sm text-purple-800 whitespace-pre-line">
                    {validationResult.ai_analysis}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ElectricalDatasheetPage;
