/**
 * CRS Documents History Page
 * Displays user's upload and export history from S3 storage
 * 
 * Features:
 * - View all uploaded files
 * - View all exported files
 * - Activity timeline
 * - Download files from history
 * - User storage profile stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { STORAGE_KEYS } from '../config/app.config';
import { API_BASE_URL } from '../config/api.config';

const CRSDocumentsHistory = () => {
  const { user } = useSelector((state) => state.auth);
  
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data states
  const [profile, setProfile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [exports, setExports] = useState([]);
  const [activities, setActivities] = useState([]);
  
  // Fetch history overview
  const fetchHistoryOverview = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crs/documents/history/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.success) {
        setProfile(response.data.data.profile);
        setUploads(response.data.data.recent_uploads || []);
        setExports(response.data.data.recent_exports || []);
        setActivities(response.data.data.recent_activity || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.response?.data?.error || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch all uploads
  const fetchAllUploads = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crs/documents/history/uploads/?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.success) {
        setUploads(response.data.uploads || []);
      }
    } catch (err) {
      console.error('Error fetching uploads:', err);
    }
  }, []);
  
  // Fetch all exports
  const fetchAllExports = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crs/documents/history/exports/?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.success) {
        setExports(response.data.exports || []);
      }
    } catch (err) {
      console.error('Error fetching exports:', err);
    }
  }, []);
  
  // Fetch all activities
  const fetchAllActivities = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crs/documents/history/activity/?days=30`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.success) {
        setActivities(response.data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }, []);
  
  // Download file from history
  const downloadFromHistory = async (s3Key, filename) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crs/documents/history/download/?key=${encodeURIComponent(s3Key)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };
  
  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchHistoryOverview();
    } else if (activeTab === 'uploads') {
      fetchAllUploads();
    } else if (activeTab === 'exports') {
      fetchAllExports();
    } else if (activeTab === 'activity') {
      fetchAllActivities();
    }
  }, [activeTab, fetchHistoryOverview, fetchAllUploads, fetchAllExports, fetchAllActivities]);
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };
  
  // Get format icon
  const getFormatIcon = (format) => {
    const icons = {
      'xlsx': '📊',
      'csv': '📄',
      'json': '🔧',
      'pdf': '📕',
      'docx': '📝',
    };
    return icons[format] || '📁';
  };
  
  // Get action icon
  const getActionIcon = (action) => {
    const icons = {
      'upload': '⬆️',
      'export': '⬇️',
      'download': '💾',
      'view': '👁️',
    };
    return icons[action] || '📋';
  };

  // Tab button component
  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 font-medium text-sm rounded-t-lg flex items-center gap-2 ${
        activeTab === id
          ? 'bg-white text-indigo-600 border-t border-l border-r border-gray-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📚 Document History</h1>
          <p className="mt-2 text-gray-600">
            View your uploaded documents and exported files
          </p>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Profile Stats Card */}
        {profile && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  👤 {profile.username || user?.username || 'User'}
                </h2>
                <p className="text-gray-500 text-sm">
                  Member since: {formatDate(profile.created_at)}
                </p>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">
                    {profile.total_uploads || 0}
                  </div>
                  <div className="text-sm text-gray-500">Uploads</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {profile.total_exports || 0}
                  </div>
                  <div className="text-sm text-gray-500">Exports</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-0">
          <TabButton id="overview" label="Overview" icon="📊" />
          <TabButton id="uploads" label="Uploads" icon="⬆️" />
          <TabButton id="exports" label="Exports" icon="⬇️" />
          <TabButton id="activity" label="Activity" icon="📋" />
        </div>
        
        {/* Tab Content */}
        <div className="bg-white rounded-b-lg rounded-tr-lg shadow-md p-6 border border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-500">Loading...</span>
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
                        ⬆️ Recent Uploads
                      </h3>
                      {uploads.length > 0 ? (
                        <ul className="space-y-2">
                          {uploads.slice(0, 5).map((file, idx) => (
                            <li 
                              key={idx}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <span>📄</span>
                                <div>
                                  <div className="font-medium text-sm truncate max-w-[200px]">
                                    {file.filename}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formatFileSize(file.size)}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => downloadFromHistory(file.s3_key, file.filename)}
                                className="text-indigo-600 hover:text-indigo-800 text-sm"
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
                    
                    {/* Recent Exports */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        ⬇️ Recent Exports
                      </h3>
                      {exports.length > 0 ? (
                        <ul className="space-y-2">
                          {exports.slice(0, 5).map((file, idx) => (
                            <li 
                              key={idx}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <span>{getFormatIcon(file.format)}</span>
                                <div>
                                  <div className="font-medium text-sm truncate max-w-[200px]">
                                    {file.filename}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formatFileSize(file.size)} • {file.format?.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => downloadFromHistory(file.s3_key, file.filename)}
                                className="text-indigo-600 hover:text-indigo-800 text-sm"
                              >
                                Download
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-sm">No exports yet</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Recent Activity */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      📋 Recent Activity
                    </h3>
                    {activities.length > 0 ? (
                      <div className="space-y-2">
                        {activities.slice(0, 10).map((activity, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <span className="text-xl">{getActionIcon(activity.action)}</span>
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {activity.action === 'upload' && 'Uploaded file'}
                                {activity.action === 'export' && 'Exported document'}
                                {activity.action === 'download' && 'Downloaded file'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {activity.details?.filename || activity.details?.s3_key?.split('/').pop()}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatDate(activity.timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No activity yet</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Uploads Tab */}
              {activeTab === 'uploads' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    All Uploaded Files
                  </h3>
                  {uploads.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              File
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Size
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {uploads.map((file, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className="mr-2">📄</span>
                                  <span className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
                                    {file.filename}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatFileSize(file.size)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(file.last_modified)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => downloadFromHistory(file.s3_key, file.filename)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Download
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
                      <p>No uploaded files yet</p>
                      <p className="text-sm mt-2">
                        Upload a PDF document to get started
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Exports Tab */}
              {activeTab === 'exports' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    All Exported Files
                  </h3>
                  {exports.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              File
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Format
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Size
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {exports.map((file, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className="mr-2">{getFormatIcon(file.format)}</span>
                                  <span className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
                                    {file.filename}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  file.format === 'xlsx' ? 'bg-green-100 text-green-800' :
                                  file.format === 'pdf' ? 'bg-red-100 text-red-800' :
                                  file.format === 'docx' ? 'bg-blue-100 text-blue-800' :
                                  file.format === 'csv' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {file.format?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatFileSize(file.size)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(file.last_modified)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => downloadFromHistory(file.s3_key, file.filename)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Download
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <span className="text-4xl mb-4 block">📤</span>
                      <p>No exported files yet</p>
                      <p className="text-sm mt-2">
                        Process a document and export it to see it here
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Activity Timeline (Last 30 Days)
                  </h3>
                  {activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity, idx) => (
                        <div 
                          key={idx}
                          className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border-l-4 border-indigo-400"
                        >
                          <div className="text-2xl">{getActionIcon(activity.action)}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 capitalize">
                                {activity.action}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatDate(activity.timestamp)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {activity.details?.filename || activity.details?.s3_key?.split('/').pop() || 'Unknown file'}
                            </div>
                            {activity.details?.format && (
                              <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                                {activity.details.format.toUpperCase()}
                              </span>
                            )}
                            {activity.details?.size && (
                              <span className="inline-block mt-2 ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                                {formatFileSize(activity.details.size)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <span className="text-4xl mb-4 block">📋</span>
                      <p>No activity recorded yet</p>
                      <p className="text-sm mt-2">
                        Your actions will be tracked here
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Back to Documents Link */}
        <div className="mt-6 text-center">
          <a 
            href="/crs/documents"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            ← Back to CRS Documents
          </a>
        </div>
      </div>
    </div>
  );
};

export default CRSDocumentsHistory;
