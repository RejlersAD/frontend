/**
 * CRS Multiple Revision - AI-Powered Revision Chain Management
 * Tracks document revisions, links comments across revisions, provides AI insights
 * Feature 2.2: CRS Multiple Revision (Classic Version - Redesigned)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api.config';
import { STORAGE_KEYS } from '../config/app.config';
import { withDashboardControls } from '../hoc/withPageControls';
import { PageControlButtons } from '../components/PageControlButtons';

const CRSMultipleRevision = ({ pageControls, refetch }) => {
  // State Management
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  
  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load data function
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (!token) {
        setError('Authentication required. Please log in.');
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (riskFilter && riskFilter !== 'all') params.append('risk_level', riskFilter);
      if (searchQuery) params.append('search', searchQuery);

      // Fetch chains and statistics
      const [chainsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/crs/revision-chains/?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/crs/revision-chains/dashboard_summary/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (chainsRes.ok) {
        const chainsData = await chainsRes.json();
        setChains(Array.isArray(chainsData) ? chainsData : chainsData.results || []);
      } else {
        const errorData = await chainsRes.json().catch(() => ({}));
        console.error('Error loading chains:', chainsRes.status, errorData);
        
        // Extract meaningful error message
        let errorMsg = `Failed to load chains (${chainsRes.status})`;
        if (errorData.detail) errorMsg = errorData.detail;
        else if (errorData.errors) errorMsg = JSON.stringify(errorData.errors);
        
        setError(errorMsg);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData);
      } else {
        console.error('Error loading statistics:', statsRes.status);
        // Don't show error for stats failure, it's not critical
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh integration
  useEffect(() => {
    if (refetch) {
      loadData();
    }
  }, [refetch, loadData]);

  // Helper functions
  const getRiskLevelColor = (riskLevel) => {
    const colors = {
      'low': 'bg-green-100 text-green-800 border border-green-200',
      'medium': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      'high': 'bg-orange-100 text-orange-800 border border-orange-200',
      'critical': 'bg-red-100 text-red-800 border border-red-200'
    };
    return colors[riskLevel] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-blue-100 text-blue-800 border border-blue-200',
      'on_hold': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      'approved': 'bg-green-100 text-green-800 border border-green-200',
      'rejected': 'bg-red-100 text-red-800 border border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // Loading State
  if (loading && !chains.length) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading revision chains...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 pb-8">
      {/* Main Container */}
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-4 lg:py-6 mt-20 sm:mt-16 lg:mt-6">
        
        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-5 mb-6">
          {/* Title Row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 leading-tight break-words">
                CRS Multi-Revision Workflow
              </h1>
              <p className="text-xs text-gray-600 leading-tight mt-0.5">
                AI-powered revision chain management system
              </p>
            </div>
          </div>

          {/* Action Buttons Row - Separate Row */}
          <div className="flex flex-wrap items-center gap-2">
            <PageControlButtons controls={pageControls} />
            <button
              onClick={loadData}
              title="Refresh Data"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all font-semibold shadow-sm hover:shadow-md text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Chains */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total Chains</p>
              <p className="text-3xl font-bold text-gray-900">{statistics.total_chains || 0}</p>
            </div>

            {/* Critical Chains */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                {(statistics.critical_chains?.length || 0) > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">ALERT</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Critical Chains</p>
              <p className="text-3xl font-bold text-red-600">{statistics.critical_chains?.length || 0}</p>
            </div>

            {/* Near Rejection */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                {(statistics.near_rejection?.length || 0) > 0 && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">WARNING</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Near Rejection</p>
              <p className="text-3xl font-bold text-yellow-600">{statistics.near_rejection?.length || 0}</p>
            </div>

            {/* Active Chains */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Active Chains</p>
              <p className="text-3xl font-bold text-green-600">{statistics.by_status?.['Active'] || 0}</p>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-5 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter & Search
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <input
                type="text"
                placeholder="Search by chain ID, project, document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>
          </div>
        </div>

        {/* Chains Table/List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          {chains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="p-6 bg-blue-50 rounded-full mb-4">
                <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Revision Chains Found</h3>
              <p className="text-gray-600 text-center">No chains match your current filters. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Chain Info
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Project / Document
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Risk / Status
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chains.map((chain) => (
                    <tr key={chain.id} className="hover:bg-blue-50/50 transition-colors">
                      {/* Chain Info */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-lg">{chain.current_revision_number || 0}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{chain.chain_id}</p>
                            <p className="text-xs text-gray-500">{chain.document_number}</p>
                          </div>
                        </div>
                      </td>

                      {/* Project / Document */}
                      <td className="px-4 sm:px-6 py-4">
                        <div className="max-w-xs">
                          <p className="text-sm font-semibold text-gray-900">{chain.project_name}</p>
                          <p className="text-sm text-gray-600 truncate">{chain.document_title}</p>
                          {chain.contractor_name && (
                            <p className="text-xs text-gray-500 mt-1">👤 {chain.contractor_name}</p>
                          )}
                        </div>
                      </td>

                      {/* Progress */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold text-blue-600">{chain.current_revision_number || 0}</span>
                            <span className="text-gray-400">/</span>
                            <span className="text-lg text-gray-600">{chain.max_allowed_revisions || 5}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (chain.risk_percentage || 0) >= 80 ? 'bg-red-500' :
                                (chain.risk_percentage || 0) >= 60 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${chain.risk_percentage || 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{chain.risk_percentage || 0}% Complete</p>
                        </div>
                      </td>

                      {/* Risk / Status */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getRiskLevelColor(chain.risk_level)}`}>
                            {chain.risk_level === 'low' && '🟢'}
                            {chain.risk_level === 'medium' && '🟡'}
                            {chain.risk_level === 'high' && '🟠'}
                            {chain.risk_level === 'critical' && '🔴'}
                            {' '}{chain.risk_level?.toUpperCase() || 'UNKNOWN'}
                          </span>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(chain.status)}`}>
                            {chain.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          to={`/crs/chain/${chain.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm hover:shadow-md"
                        >
                          <span>View Details</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export with Dashboard Controls HOC
export default withDashboardControls(CRSMultipleRevision, {
  enableAutoRefresh: true,
  autoRefreshInterval: 30000, // 30 seconds
  enableFullscreen: true,
  enableHideNavbar: true,
  storageKey: 'crsMultipleRevisionPageControls',
  pageTitle: 'CRS Multiple Revision',
});
