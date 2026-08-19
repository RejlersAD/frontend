import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

const ElectricalDatasheetPage = () => {
  const [datasheets, setDatasheets] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [datasheetsRes, typesRes, statsRes] = await Promise.all([
        apiClient.get('/electrical-datasheet/datasheets/'),
        apiClient.get('/electrical-datasheet/equipment-types/'),
        apiClient.get('/electrical-datasheet/datasheets/statistics/')
      ]);
      
      setDatasheets(datasheetsRes.data?.results || datasheetsRes.data || []);
      setEquipmentTypes(typesRes.data?.results || typesRes.data || []);
      setStatistics(statsRes.data || null);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
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
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload PDF or image files only (PDF, PNG, JPG, JPEG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUploadAndValidate = async (e) => {
    e.preventDefault();
    
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
      setShowUploadModal(false);
      setShowResultModal(true);
      loadData(); // Refresh data
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
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

  const resetUpload = () => {
    setShowUploadModal(false);
    setShowResultModal(false);
    setSelectedFile(null);
    setSelectedType('');
    setValidationResult(null);
    setError(null);
    setUploadProgress(0);
  };

  const filteredDatasheets = datasheets.filter(sheet => {
    const matchesSearch = !searchQuery || 
      sheet.equipment_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.tag_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || sheet.status === statusFilter;
    const matchesEquipment = equipmentFilter === 'all' || sheet.equipment_type === parseInt(equipmentFilter);
    
    return matchesSearch && matchesStatus && matchesEquipment;
  });

  const getStatusColor = (status) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800',
      'validated': 'bg-blue-100 text-blue-800',
      'in_review': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getComplianceColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading datasheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <BoltIcon className="w-10 h-10 text-yellow-600" />
            Electrical Datasheets
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            AI-Powered ADNOC Standards Verification & Validation
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
        >
          <CloudArrowUpIcon className="w-5 h-5" />
          Upload & Validate
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <DocumentTextIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Datasheets</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.total || datasheets.length}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.approved || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">In Review</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.in_review || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <SparklesIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Compliance</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{statistics.avg_compliance || 0}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search datasheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>

            {/* Equipment Type Filter */}
            <select
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="all">All Equipment</option>
              {equipmentTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="validated">Validated</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datasheets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDatasheets.map(sheet => (
          <div key={sheet.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {sheet.equipment_name || 'Unnamed Equipment'}
                  </h3>
                  {sheet.tag_number && (
                    <p className="text-sm text-gray-500">Tag: {sheet.tag_number}</p>
                  )}
                  {sheet.equipment_type_name && (
                    <p className="text-xs text-gray-400 mt-1">Type: {sheet.equipment_type_name}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(sheet.status)}`}>
                  {sheet.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Compliance Score */}
              {sheet.compliance_score !== undefined && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>ADNOC Compliance</span>
                    <span className={`font-bold ${getComplianceColor(sheet.compliance_score).split(' ')[0]}`}>
                      {sheet.compliance_score}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        sheet.compliance_score >= 90 ? 'bg-green-600' :
                        sheet.compliance_score >= 70 ? 'bg-yellow-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${sheet.compliance_score}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Specifications */}
              <div className="mb-4 space-y-2">
                {sheet.voltage && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Voltage:</span>
                    <span className="font-medium text-gray-900">{sheet.voltage}</span>
                  </div>
                )}
                {sheet.current && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Current:</span>
                    <span className="font-medium text-gray-900">{sheet.current}</span>
                  </div>
                )}
                {sheet.power && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Power:</span>
                    <span className="font-medium text-gray-900">{sheet.power}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/engineering/electrical/datasheet/${sheet.id}`}
                  className="flex-1 text-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                >
                  View Details
                </Link>
                
                {sheet.has_validation && (
                  <button
                    onClick={() => {
                      setValidationResult(sheet.validation_data);
                      setShowResultModal(true);
                    }}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                  >
                    📊 Results
                  </button>
                )}
              </div>

              {/* Timestamps */}
              {sheet.created_at && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Created: {new Date(sheet.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredDatasheets.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <BoltIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No datasheets found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by uploading and validating an electrical diagram.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 shadow-lg text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-yellow-600 to-orange-600 hover:shadow-xl transition-all"
            >
              <CloudArrowUpIcon className="w-5 h-5" />
              Upload & Validate
            </button>
          </div>
        </div>
      )}

      {/* Upload & Validate Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-7 h-7" />
                    AI-Powered Diagram Validation
                  </h2>
                  <p className="text-yellow-100 text-sm">
                    Upload electrical diagram for instant ADNOC standards verification
                  </p>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleUploadAndValidate} className="p-6">
              {/* Equipment Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  ⚡ Select Equipment Type *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {equipmentTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedType(type.id)}
                      className={`p-4 border-2 rounded-lg transition-all text-left ${
                        selectedType === type.id
                          ? 'border-yellow-600 bg-yellow-50 shadow-md'
                          : 'border-gray-200 hover:border-yellow-400 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="text-3xl mr-3">{type.icon || '⚡'}</div>
                        <div>
                          <p className="font-semibold text-gray-900">{type.name}</p>
                          <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Upload Section */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  📄 Upload Diagram (PDF or Image) *
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    dragActive
                      ? 'border-yellow-600 bg-yellow-50'
                      : 'border-gray-300 hover:border-yellow-500 bg-gray-50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileInput}
                    required
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {!selectedFile ? (
                    <div>
                      <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-semibold text-yellow-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        PDF, PNG, JPG, JPEG up to 10MB
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <DocumentTextIcon className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
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
                
                {/* Info Banner */}
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-900">
                      <p className="font-semibold mb-1">AI Validation Process:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Extract all technical specifications automatically</li>
                        <li>Validate against ADNOC-AGES standards</li>
                        <li>Identify missing critical parameters</li>
                        <li>Provide intelligent recommendations</li>
                        <li>Generate comprehensive Excel report</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-200">
                  <div className="flex items-start gap-3">
                    <XCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetUpload}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || !selectedType || uploading}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    !selectedFile || !selectedType || uploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:shadow-lg hover:scale-105'
                  }`}
                >
                  {uploading ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      Validating... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5" />
                      Validate with AI
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validation Results Modal */}
      {showResultModal && validationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    ✅ Validation Complete
                  </h2>
                  <p className="text-green-100 text-sm">
                    {validationResult.equipment_type} • ADNOC Standards Analysis
                  </p>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Compliance Score Banner */}
            <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-b border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overall Compliance Score</p>
                  <p className="text-5xl font-bold text-green-600 mt-2">
                    {validationResult.compliance_score}%
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleExportToExcel}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-md"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Export to Excel
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Extracted Data */}
              {validationResult.extracted_data && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-6 h-6 text-blue-600" />
                    Extracted Parameters
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(validationResult.extracted_data).map(([key, value]) => {
                        if (key === 'additional_specs') return null;
                        return (
                          <div key={key} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 font-medium uppercase">{key.replace('_', ' ')}</p>
                            <p className={`text-lg font-semibold mt-1 ${value === 'NOT FOUND' ? 'text-red-600' : 'text-gray-900'}`}>
                              {value === 'NOT FOUND' ? 'Not Found' : value}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Missing Parameters */}
              {validationResult.missing_data && validationResult.missing_data.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
                    Missing Parameters & Recommendations
                  </h3>
                  <div className="space-y-3">
                    {validationResult.missing_data.map((item, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-gray-900">{item.parameter}</p>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            item.criticality === 'HIGH' ? 'bg-red-100 text-red-700' :
                            item.criticality === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.criticality}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Suggested:</span> {item.suggested_default}
                        </p>
                        <p className="text-xs text-gray-500">{item.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Results */}
              {validationResult.validation_results && validationResult.validation_results.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                    ADNOC Standards Validation
                  </h3>
                  <div className="space-y-2">
                    {validationResult.validation_results.map((item, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        item.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{item.parameter}</p>
                            <div className="mt-2 text-sm">
                              <p className="text-gray-600">
                                <span className="font-medium">Expected:</span> {item.expected}
                              </p>
                              <p className="text-gray-600">
                                <span className="font-medium">Found:</span> {item.found}
                              </p>
                              {item.recommendation && (
                                <p className="text-gray-700 mt-1">
                                  <span className="font-medium">→</span> {item.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                          {item.passed ? (
                            <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {validationResult.ai_analysis && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <SparklesIcon className="w-6 h-6 text-indigo-600" />
                    Comprehensive Analysis
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                      {validationResult.ai_analysis}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectricalDatasheetPage;
