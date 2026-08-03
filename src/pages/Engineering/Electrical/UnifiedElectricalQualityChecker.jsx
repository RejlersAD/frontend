import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SparklesIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';

/**
 * Unified Electrical Quality Checker
 * Single smart tool for AI-powered quality checking of ALL electrical equipment types
 * GPT-4 powered | ADNOC standards | Universal design
 */
const UnifiedElectricalQualityChecker = () => {
  const navigate = useNavigate();
  
  // State Management
  const [datasheets, setDatasheets] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  
  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  
  // Quality Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [qualityReport, setQualityReport] = useState(null);
  
  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [datasheetToDelete, setDatasheetToDelete] = useState(null);
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    checked: 0,
    unchecked: 0,
    averageScore: 0,
    excellent: 0,
    good: 0,
    acceptable: 0,
    needsWork: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [datasheetsRes, typesRes] = await Promise.all([
        apiClient.get('/electrical-datasheet/datasheets/'),
        apiClient.get('/electrical-datasheet/equipment-types/')
      ]);
      
      const sheets = datasheetsRes.data?.results || datasheetsRes.data || [];
      setDatasheets(sheets);
      setEquipmentTypes(typesRes.data?.results || typesRes.data || []);
      
      // Calculate statistics
      calculateStats(sheets);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load datasheets');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (sheets) => {
    const checked = sheets.filter(s => s.compliance_score !== null && s.compliance_score !== undefined);
    const unchecked = sheets.filter(s => s.compliance_score === null || s.compliance_score === undefined);
    
    const avgScore = checked.length > 0
      ? checked.reduce((sum, s) => sum + parseFloat(s.compliance_score || 0), 0) / checked.length
      : 0;
    
    setStats({
      total: sheets.length,
      checked: checked.length,
      unchecked: unchecked.length,
      averageScore: avgScore.toFixed(1),
      excellent: checked.filter(s => s.compliance_score >= 90).length,
      good: checked.filter(s => s.compliance_score >= 70 && s.compliance_score < 90).length,
      acceptable: checked.filter(s => s.compliance_score >= 50 && s.compliance_score < 70).length,
      needsWork: checked.filter(s => s.compliance_score < 50).length
    });
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
    const allowedTypes = [
      'application/pdf', 
      'image/png', 
      'image/jpeg', 
      'image/jpg',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.sheet.macroenabled.12' // Lowercase variant for browser compatibility
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload PDF, Excel, or image files (PDF, PNG, JPG, XLSX, XLS, XLSM)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile || !selectedType) {
      setError('Please select equipment type and file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setQualityReport(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('equipment_type_id', selectedType);
      formData.append('tag_number', `DS-${Date.now()}`);

      setUploadProgress(30);

      // Use new unified endpoint
      const response = await apiClient.post(
        '/electrical-datasheet/datasheets/upload-and-check/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUploadProgress(100);
      
      // Extract quality report from response
      const report = response.data.quality_report;
      
      // Show quality report modal
      setQualityReport({
        ...report,
        datasheet_id: response.data.datasheet_id,
        tag_number: response.data.tag_number,
        equipment_type: response.data.equipment_type,
        equipment_code: response.data.equipment_code,
        file_name: response.data.file_name
      });
      
      setShowReportModal(true);
      
      // Close upload modal
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedType('');
      
      // Refresh data
      await loadData();
      
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.data?.error || 'Upload failed. Please try again.';
      const errorDetails = err.response?.data?.details || '';
      setError(`${errorMessage}${errorDetails ? '\n\n' + errorDetails : ''}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const runQualityCheck = async (datasheetId) => {
    try {
      await apiClient.post(`/electrical-datasheet/datasheets/${datasheetId}/ai-quality-check/`);
      await loadData(); // Refresh to show new scores
    } catch (err) {
      console.error('Quality check error:', err);
      alert('Failed to run quality check. Please try again.');
    }
  };

  const handleDeleteClick = (datasheet) => {
    setDatasheetToDelete(datasheet);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!datasheetToDelete) return;
    
    try {
      await apiClient.delete(`/electrical-datasheet/datasheets/${datasheetToDelete.id}/`);
      await loadData(); // Refresh the list
      setShowDeleteModal(false);
      setDatasheetToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete datasheet. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDatasheetToDelete(null);
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreBadge = (score) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-500' };
    if (score >= 70) return { label: 'Good', color: 'bg-blue-500' };
    if (score >= 50) return { label: 'Acceptable', color: 'bg-yellow-500' };
    return { label: 'Needs Work', color: 'bg-red-500' };
  };

  const filteredDatasheets = datasheets.filter(sheet => {
    const matchesSearch = !searchQuery || 
      sheet.equipment_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.tag_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.equipment_type_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEquipment = equipmentFilter === 'all' || sheet.equipment_type === parseInt(equipmentFilter);
    
    const matchesQuality = qualityFilter === 'all' || 
      (qualityFilter === 'checked' && sheet.compliance_score !== null && sheet.compliance_score !== undefined) ||
      (qualityFilter === 'unchecked' && (sheet.compliance_score === null || sheet.compliance_score === undefined)) ||
      (qualityFilter === 'excellent' && sheet.compliance_score >= 90) ||
      (qualityFilter === 'good' && sheet.compliance_score >= 70 && sheet.compliance_score < 90) ||
      (qualityFilter === 'needswork' && sheet.compliance_score < 70);
    
    return matchesSearch && matchesEquipment && matchesQuality;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            {/* Icon & Title */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6">
              <SparklesIcon className="w-12 h-12 text-white" />
            </div>
            
            <h1 className="text-5xl font-bold text-white mb-4">
              Unified AI Quality Checker
            </h1>
            
            <p className="text-xl text-purple-100 mb-2">
              Smart validation for all electrical equipment types
            </p>
            
            <p className="text-sm text-purple-200 max-w-2xl mx-auto">
              GPT-4 powered • ADNOC standards compliant • Works for motors, transformers, cables, switchgear, and more
            </p>
            
            {/* Quick Action Button */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-8 inline-flex items-center gap-3 px-8 py-4 bg-white text-purple-700 rounded-2xl font-bold text-lg hover:bg-purple-50 transition-all shadow-2xl hover:shadow-3xl hover:scale-105 transform"
            >
              <CloudArrowUpIcon className="w-7 h-7" />
              Upload & Validate Datasheet
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {/* Total */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-indigo-500">
            <div className="text-4xl font-bold text-indigo-600 mb-1">{stats.total}</div>
            <div className="text-sm text-gray-600 font-medium">Total Datasheets</div>
          </div>
          
          {/* Checked */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500">
            <div className="text-4xl font-bold text-green-600 mb-1">{stats.checked}</div>
            <div className="text-sm text-gray-600 font-medium">Quality Checked</div>
          </div>
          
          {/* Unchecked */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-gray-500">
            <div className="text-4xl font-bold text-gray-600 mb-1">{stats.unchecked}</div>
            <div className="text-sm text-gray-600 font-medium">Not Checked</div>
          </div>
          
          {/* Average Score */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500">
            <div className="text-4xl font-bold text-purple-600 mb-1">{stats.averageScore}%</div>
            <div className="text-sm text-gray-600 font-medium">Average Score</div>
          </div>
          
          {/* Excellent */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500">
            <div className="text-4xl font-bold text-green-600 mb-1">{stats.excellent}</div>
            <div className="text-sm text-gray-600 font-medium">Excellent (90+)</div>
          </div>
          
          {/* Good */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500">
            <div className="text-4xl font-bold text-blue-600 mb-1">{stats.good}</div>
            <div className="text-sm text-gray-600 font-medium">Good (70-89)</div>
          </div>
          
          {/* Needs Work */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-orange-500">
            <div className="text-4xl font-bold text-orange-600 mb-1">{stats.needsWork + stats.acceptable}</div>
            <div className="text-sm text-gray-600 font-medium">Needs Work (&lt;70)</div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by tag, name, or equipment type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Equipment Type Filter */}
            <div className="relative">
              <FunnelIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={equipmentFilter}
                onChange={(e) => setEquipmentFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none transition-all"
              >
                <option value="all">All Equipment Types</option>
                {equipmentTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            {/* Quality Filter */}
            <div>
              <select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none transition-all"
              >
                <option value="all">All Quality Levels</option>
                <option value="checked">✓ Quality Checked</option>
                <option value="unchecked">⏳ Not Checked</option>
                <option value="excellent">⭐ Excellent (90+)</option>
                <option value="good">👍 Good (70-89)</option>
                <option value="needswork">⚠️ Needs Work (&lt;70)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Datasheets Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="text-center py-20">
            <ArrowPathIcon className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading datasheets...</p>
          </div>
        ) : filteredDatasheets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <BoltIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No datasheets found</h3>
            <p className="text-gray-600 mb-6">Upload a datasheet to get started with AI quality checking</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-lg"
            >
              <CloudArrowUpIcon className="w-5 h-5" />
              Upload First Datasheet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDatasheets.map((sheet) => {
              const hasScore = sheet.compliance_score !== null && sheet.compliance_score !== undefined;
              const scoreBadge = hasScore ? getScoreBadge(sheet.compliance_score) : null;
              
              return (
                <div
                  key={sheet.id}
                  className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-purple-300 group"
                >
                  {/* Header with Score */}
                  <div className={`p-4 ${hasScore ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-mono text-gray-500 mb-1">
                          {sheet.equipment_type_name || 'Equipment'}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 truncate">
                          {sheet.tag_number || sheet.equipment_name || 'Untitled'}
                        </h3>
                      </div>
                      
                      {hasScore && (
                        <div className="ml-3">
                          <div className={`text-3xl font-bold ${getScoreColor(sheet.compliance_score).split(' ')[0]}`}>
                            {sheet.compliance_score}%
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {hasScore && scoreBadge && (
                      <div className="mt-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${scoreBadge.color}`}>
                          {scoreBadge.label}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    {sheet.equipment_name && sheet.equipment_name !== sheet.tag_number && (
                      <p className="text-sm text-gray-600 mb-4">{sheet.equipment_name}</p>
                    )}
                    
                    {/* Quality Progress Bar */}
                    {hasScore && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-600 mb-2">
                          <span>Quality Score</span>
                          <span className="font-semibold">{sheet.compliance_score}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${scoreBadge.color} transition-all duration-500`}
                            style={{ width: `${sheet.compliance_score}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Last Check Date */}
                    {sheet.last_quality_check && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                        <ClockIcon className="w-4 h-4" />
                        Last checked: {new Date(sheet.last_quality_check).toLocaleDateString()}
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/engineering/electrical/datasheet/${sheet.id}`)}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm"
                      >
                        View Details
                      </button>
                      
                      {!hasScore && (
                        <button
                          onClick={() => runQualityCheck(sheet.id)}
                          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all font-semibold text-sm flex items-center gap-2"
                        >
                          <SparklesIcon className="w-4 h-4" />
                          Check
                        </button>
                      )}
                      
                      {/* Download Report Button - Only show if quality check has been run */}
                      {hasScore && (
                        <button
                          onClick={() => {
                            const url = `${apiClient.defaults.baseURL}/electrical-datasheet/datasheets/${sheet.id}/download-quality-report-excel/`;
                            window.location.href = url;
                          }}
                          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all font-semibold text-sm flex items-center gap-2"
                          title="Download Excel Report"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteClick(sheet)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-semibold text-sm flex items-center gap-2"
                        title="Delete Datasheet"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CloudArrowUpIcon className="w-7 h-7" />
                    Upload & Validate
                  </h2>
                  <p className="text-purple-100 text-sm mt-1">
                    AI will automatically validate your datasheet against ADNOC standards
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setSelectedType('');
                    setError(null);
                  }}
                  className="text-white hover:text-purple-200 transition-colors"
                >
                  <XCircleIcon className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleUpload} className="p-6">
              {/* Equipment Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Equipment Type *
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Select equipment type...</option>
                  {equipmentTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Datasheet File *
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    dragActive
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-400'
                  }`}
                >
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleFileInput}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.xlsm"
                  />
                  
                  {selectedFile ? (
                    <div className="text-center">
                      <DocumentTextIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="mt-3 text-sm text-red-600 hover:text-red-700"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-2">
                        Drag and drop your file here, or
                      </p>
                      <label
                        htmlFor="file-upload"
                        className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-all"
                      >
                        Browse Files
                      </label>
                      <p className="text-xs text-gray-500 mt-3">
                        PDF, Excel (XLS, XLSX, XLSM), or Images (PNG, JPG) • Max 20MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Uploading and validating...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedFile || !selectedType || uploading}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <ArrowPathIcon className="w-6 h-6 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-6 h-6" />
                    Upload & Run AI Quality Check
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quality Report Modal */}
      {showReportModal && qualityReport && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Report Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white p-8 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <SparklesIcon className="w-8 h-8" />
                    {qualityReport.equipment_type} Quality Analysis Report
                  </h2>
                  <p className="text-blue-100 text-lg">{qualityReport.equipment_type} ({qualityReport.equipment_code}) • AI-Powered Assessment</p>
                  <p className="text-blue-200 text-sm mt-1">Document: {qualityReport.file_name}</p>
                  <p className="text-blue-200 text-sm">Tag Number: {qualityReport.tag_number}</p>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-white hover:text-gray-200 transition-colors p-2"
                  aria-label="Close"
                >
                  <XCircleIcon className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Report Body */}
            <div className="p-8">
              {/* Overall Score */}
              <div className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {qualityReport.equipment_type} Compliance Score
                    </p>
                    <p className="text-5xl font-bold text-purple-600">{qualityReport.overall_score}%</p>
                    <p className="text-sm text-gray-500 mt-2">Status: {qualityReport.status}</p>
                    {qualityReport.method && (
                      <p className="text-xs text-gray-400 mt-1">Method: {qualityReport.method}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`inline-block px-6 py-3 rounded-full text-lg font-bold ${
                      qualityReport.overall_score >= 90 ? 'bg-green-100 text-green-700' :
                      qualityReport.overall_score >= 75 ? 'bg-blue-100 text-blue-700' :
                      qualityReport.overall_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {qualityReport.overall_score >= 90 ? 'Excellent' :
                       qualityReport.overall_score >= 75 ? 'Good' :
                       qualityReport.overall_score >= 60 ? 'Acceptable' :
                       'Needs Work'}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {qualityReport.summary && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                    {qualityReport.equipment_type} Analysis Summary
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                      {qualityReport.summary}
                    </div>
                  </div>
                </div>
              )}

              {/* Issues */}
              {qualityReport.issues && qualityReport.issues.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <XCircleIcon className="w-6 h-6 text-red-600" />
                    {qualityReport.equipment_type} Critical Issues ({qualityReport.issues.length})
                  </h3>
                  <div className="space-y-2">
                    {qualityReport.issues.map((issue, idx) => {
                      const issueText = typeof issue === 'string' ? issue : 
                                       issue.message || issue.description || 
                                       `[${issue.category || 'Issue'}] ${issue.affected_fields || ''}`.trim() ||
                                       JSON.stringify(issue);
                      return (
                        <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-red-600 font-bold">❌</span>
                            <div className="flex-1">
                              <p className="text-red-800 text-sm font-medium">{issueText}</p>
                              {typeof issue === 'object' && issue.severity && (
                                <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">
                                  {issue.severity}
                                </span>
                              )}
                              {typeof issue === 'object' && issue.remediation && (
                                <p className="text-red-700 text-xs mt-2">💡 {issue.remediation}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {qualityReport.warnings && qualityReport.warnings.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
                    Warnings ({qualityReport.warnings.length})
                  </h3>
                  <div className="space-y-2">
                    {qualityReport.warnings.map((warning, idx) => {
                      const warningText = typeof warning === 'string' ? warning : 
                                         warning.message || warning.description || 
                                         warning.type || 
                                         JSON.stringify(warning);
                      return (
                        <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-yellow-600 font-bold">⚠️</span>
                            <div className="flex-1">
                              <p className="text-yellow-800 text-sm font-medium">{warningText}</p>
                              {typeof warning === 'object' && warning.suggestion && (
                                <p className="text-yellow-700 text-xs mt-2">💡 {warning.suggestion}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {qualityReport.recommendations && qualityReport.recommendations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-6 h-6 text-green-600" />
                    {qualityReport.equipment_type} Improvement Recommendations ({qualityReport.recommendations.length})
                  </h3>
                  <div className="space-y-2">
                    {qualityReport.recommendations.map((rec, idx) => {
                      const recText = typeof rec === 'string' ? rec : 
                                     rec.recommendation || rec.message || rec.description ||
                                     JSON.stringify(rec);
                      return (
                        <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-green-600 font-bold">💡</span>
                            <div className="flex-1">
                              <p className="text-green-800 text-sm font-medium">{recText}</p>
                              {typeof rec === 'object' && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                  {rec.priority && (
                                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">
                                      Priority: {rec.priority}
                                    </span>
                                  )}
                                  {rec.benefit && (
                                    <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                                      Benefit: {rec.benefit}
                                    </span>
                                  )}
                                  {rec.effort && (
                                    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">
                                      Effort: {rec.effort}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    // Download Excel report
                    const url = `${apiClient.defaults.baseURL}/electrical-datasheet/datasheets/${qualityReport.datasheet_id}/download-quality-report-excel/`;
                    window.location.href = url;
                  }}
                  className="flex-1 px-6 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Download Excel Report
                </button>
                <button
                  onClick={() => {
                    // Download PDF report
                    const url = `${apiClient.defaults.baseURL}/electrical-datasheet/datasheets/${qualityReport.datasheet_id}/download-quality-report-pdf/`;
                    window.location.href = url;
                  }}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Download PDF Report
                </button>
                <button
                  onClick={() => navigate(`/engineering/electrical/datasheet/${qualityReport.datasheet_id}`)}
                  className="flex-1 px-6 py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <DocumentTextIcon className="w-5 h-5" />
                  View Full Datasheet
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-6 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the datasheet for{' '}
              <span className="font-semibold text-gray-900">
                {datasheetToDelete?.equipment_type_name} ({datasheetToDelete?.tag_number})
              </span>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium flex items-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedElectricalQualityChecker;
