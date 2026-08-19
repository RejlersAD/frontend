import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';

/**
 * S3 Document Management Dashboard
 * View and manage documents stored in AWS S3
 */
const S3Management = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, [projectFilter]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const params = projectFilter ? `?project_code=${projectFilter}` : '';
      const response = await apiClient.get(`/pfd/s3/stats/${params}`);
      
      if (response.data.success) {
        setStats(response.data.stats);
      } else {
        setError(response.data.message || 'Failed to load stats');
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load S3 statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!projectFilter) {
      setError('Please enter a project code to view documents');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.get(`/pfd/s3/documents/?project_code=${projectFilter}`);
      
      if (response.data.success) {
        setDocuments(response.data.documents);
      } else {
        setError(response.data.error || 'Failed to load documents');
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AWS S3 Document Management
          </h1>
          <p className="text-gray-600 mt-2">Manage PFD and Philosophy documents in AWS S3 buckets</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Storage Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">PFD Documents</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{stats.pfd_count}</p>
                  <p className="text-sm text-gray-500 mt-1">{stats.pfd_size_mb} MB</p>
                </div>
                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Philosophy Docs</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{stats.philosophy_count}</p>
                  <p className="text-sm text-gray-500 mt-1">{stats.philosophy_size_mb} MB</p>
                </div>
                <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Storage</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.total_size_mb}</p>
                  <p className="text-sm text-gray-500 mt-1">MB used</p>
                </div>
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Filter */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Documents</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Enter project code (e.g., ABC123)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={loadDocuments}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Load Documents
            </button>
            <button
              onClick={loadStats}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors"
            >
              Refresh Stats
            </button>
          </div>
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Documents for Project: {projectFilter}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Modified
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.key.split('/').pop()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatFileSize(doc.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(doc.last_modified).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default S3Management;
