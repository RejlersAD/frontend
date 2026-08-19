/**
 * Generic Analysis History Component
 * Reusable history viewer for PID and PFD analyses
 * 
 * Features:
 * - View all uploads
 * - View all analyses/conversions
 * - Download files and reports
 * - Delete old files
 * - Activity timeline
 * - User statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { STORAGE_KEYS } from '../config/app.config';
import { API_BASE_URL } from '../config/api.config';

/**
 * Generic Analysis History Component
 * 
 * @param {Object} props
 * @param {string} props.type - 'pid' or 'pfd'
 * @param {string} props.title - Display title (e.g., "P&ID Analysis History")
 * @param {string} props.uploadLabel - Label for uploads (e.g., "P&ID Drawings")
 * @param {string} props.analysisLabel - Label for analyses (e.g., "Analyses" or "Conversions")
 */
const AnalysisHistory = ({ 
  type = 'pid', 
  title = 'Analysis History',
  uploadLabel = 'Uploads',
  analysisLabel = 'Analyses'
}) => {
  const { user } = useSelector((state) => state.auth);
  
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data states
  const [profile, setProfile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50 });

  // API Base URLs
  const API_PATHS = {
    pid: {
      overview: `${API_BASE_URL}/pid/history/`,
      uploads: `${API_BASE_URL}/pid/history/uploads/`,
      analyses: `${API_BASE_URL}/pid/history/analyses/`,
      downloadFile: (id) => `${API_BASE_URL}/pid/history/download/drawing/${id}/`,
      downloadReport: (id) => `${API_BASE_URL}/pid/history/download/report/${id}/`,
      deleteFile: (id) => `${API_BASE_URL}/pid/history/delete/drawing/${id}/`
    },
    pfd: {
      overview: `${API_BASE_URL}/pfd/history/`,
      uploads: `${API_BASE_URL}/pfd/history/uploads/`,
      analyses: `${API_BASE_URL}/pfd/history/conversions/`,
      downloadFile: (id) => `${API_BASE_URL}/pfd/history/download/pfd/${id}/`,
      downloadReport: (id) => `${API_BASE_URL}/pfd/history/download/pid/${id}/`,
      deleteFile: (id) => `${API_BASE_URL}/pfd/history/delete/pfd/${id}/`
    }
  };

  const api = API_PATHS[type];

  // Fetch history overview
  const fetchHistoryOverview = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(api.overview, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setProfile(response.data.data.profile);
        setUploads(response.data.data.recent_uploads || []);
        setAnalyses(response.data.data[type === 'pid' ? 'recent_analyses' : 'recent_conversions'] || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.response?.data?.error || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [type, api.overview]);

  // Fetch all uploads
  const fetchAllUploads = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    setLoading(true);
    
    try {
      const response = await axios.get(api.uploads, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { page: pagination.page, limit: pagination.limit }
      });
      
      if (response.data.success) {
        setUploads(response.data.data.uploads);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching uploads:', err);
      setError(err.response?.data?.error || 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }, [api.uploads, pagination.page, pagination.limit]);

  // Fetch all analyses
  const fetchAllAnalyses = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    setLoading(true);
    
    try {
      const response = await axios.get(api.analyses, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { page: pagination.page, limit: pagination.limit }
      });
      
      if (response.data.success) {
        setAnalyses(response.data.data[type === 'pid' ? 'analyses' : 'conversions']);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching analyses:', err);
      setError(err.response?.data?.error || 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, [type, api.analyses, pagination.page, pagination.limit]);

  // Download file
  const downloadFile = async (id, filename) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    try {
      const response = await axios.get(api.downloadFile(id), {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Failed to download file');
    }
  };

  // Download report
  const downloadReport = async (id, filename, format = 'pdf') => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    try {
      const response = await axios.get(api.downloadReport(id), {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { format },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to download report');
    }
  };

  // Delete file
  const deleteFile = async (id) => {
    if (!window.confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }
    
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    try {
      await axios.delete(api.deleteFile(id), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      alert('File deleted successfully');
      // Refresh data based on active tab
      if (activeTab === 'overview') fetchHistoryOverview();
      else if (activeTab === 'uploads') fetchAllUploads();
      else if (activeTab === 'analyses') fetchAllAnalyses();
    } catch (err) {
      console.error('Error deleting file:', err);
      alert(err.response?.data?.error || 'Failed to delete file');
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchHistoryOverview();
    } else if (activeTab === 'uploads') {
      fetchAllUploads();
    } else if (activeTab === 'analyses') {
      fetchAllAnalyses();
    }
  }, [activeTab, fetchHistoryOverview, fetchAllUploads, fetchAllAnalyses]);

  // Helper functions
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      uploaded: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800'
    };
    return badges[status] || badges.pending;
  };

  // Tab button component
  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-6 py-3 font-medium rounded-t-lg transition-colors ${
        activeTab === id
          ? 'bg-white text-indigo-600 border-t-2 border-l-2 border-r-2 border-indigo-600'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">View and manage your analysis history</p>
      </div>

      {/* Profile Card */}
      {profile && (
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{profile.username}</h2>
              <p className="text-indigo-100">{profile.email}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold">{profile.total_uploads || 0}</div>
                <div className="text-sm text-indigo-100">{uploadLabel}</div>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {type === 'pid' ? profile.total_analyses : profile.total_conversions || 0}
                </div>
                <div className="text-sm text-indigo-100">{analysisLabel}</div>
              </div>
              {type === 'pid' ? (
                <div>
                  <div className="text-3xl font-bold">{profile.total_issues_found || 0}</div>
                  <div className="text-sm text-indigo-100">Issues Found</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl font-bold">{profile.avg_confidence_score || 0}%</div>
                  <div className="text-sm text-indigo-100">Avg Confidence</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-0">
        <TabButton id="overview" label="Overview" icon="📊" />
        <TabButton id="uploads" label={uploadLabel} icon="⬆️" />
        <TabButton id="analyses" label={analysisLabel} icon="🔍" />
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg rounded-tr-lg shadow-md p-6 border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-500">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <span className="text-4xl mb-4 block">⚠️</span>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recent Uploads */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      ⬆️ Recent {uploadLabel}
                    </h3>
                    {uploads.length > 0 ? (
                      <ul className="space-y-2">
                        {uploads.slice(0, 5).map((file, idx) => (
                          <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span>📄</span>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {file.original_filename || file.document_number}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {file.drawing_title || file.document_title}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => downloadFile(file.id, file.original_filename || `${file.document_number}.pdf`)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
                            >
                              Download
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No uploads yet</p>
                    )}
                  </div>

                  {/* Recent Analyses */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      🔍 Recent {analysisLabel}
                    </h3>
                    {analyses.length > 0 ? (
                      <ul className="space-y-2">
                        {analyses.slice(0, 5).map((analysis, idx) => (
                          <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span>📊</span>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {analysis.drawing_number || analysis.document_number}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {type === 'pid' 
                                    ? `${analysis.total_issues} issues`
                                    : `${analysis.confidence_score}% confidence`
                                  }
                                </div>
                              </div>
                            </div>
                            {analysis.can_download && (
                              <button
                                onClick={() => downloadReport(
                                  analysis.id, 
                                  `${analysis.drawing_number || analysis.document_number}_report.pdf`
                                )}
                                className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
                              >
                                Download
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No {analysisLabel.toLowerCase()} yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Uploads Tab */}
            {activeTab === 'uploads' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  All {uploadLabel}
                </h3>
                {uploads.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploads.map((file) => (
                          <tr key={file.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <span className="mr-2">📄</span>
                                <div>
                                  <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                                    {file.original_filename || file.document_number}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {file.drawing_number || file.document_title}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {file.project_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(file.status)}`}>
                                {file.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {formatDate(file.uploaded_at)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm">
                              <button
                                onClick={() => downloadFile(file.id, file.original_filename || `${file.document_number}.pdf`)}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => deleteFile(file.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-4 block">📂</span>
                    <p>No {uploadLabel.toLowerCase()} yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Analyses Tab */}
            {activeTab === 'analyses' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  All {analysisLabel}
                </h3>
                {analyses.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {type === 'pid' ? 'Issues' : 'Confidence'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analyses.map((analysis) => (
                          <tr key={analysis.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <span className="mr-2">📊</span>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {analysis.drawing_number || analysis.document_number}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {analysis.drawing_title || analysis.document_title}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {analysis.project_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {type === 'pid' 
                                ? `${analysis.total_issues} issues`
                                : `${analysis.confidence_score}%`
                              }
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {formatDate(analysis.created_at)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm">
                              {analysis.can_download && (
                                <>
                                  <button
                                    onClick={() => downloadReport(
                                      analysis.id, 
                                      `${analysis.drawing_number || analysis.document_number}_report.pdf`,
                                      'pdf'
                                    )}
                                    className="text-indigo-600 hover:text-indigo-900 mr-2"
                                  >
                                    PDF
                                  </button>
                                  {type === 'pid' && (
                                    <button
                                      onClick={() => downloadReport(
                                        analysis.id, 
                                        `${analysis.drawing_number}_report.xlsx`,
                                        'excel'
                                      )}
                                      className="text-green-600 hover:text-green-900"
                                    >
                                      Excel
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-4 block">📊</span>
                    <p>No {analysisLabel.toLowerCase()} yet</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnalysisHistory;
