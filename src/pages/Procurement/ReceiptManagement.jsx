import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  BeakerIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  CubeIcon,
  CalendarIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { PROCUREMENT_CONFIG, getCategoryByCode, getStatusConfig } from '../../config/procurement.config';
import AIReceiptCreator from './AIReceiptCreator';

const ReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterQuality, setFilterQuality] = useState('all');
  const [showAICreator, setShowAICreator] = useState(false);
  const [orders, setOrders] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/procurement/receipts/');
      const data = response.data;
      
      // Soft-coded data normalization - ensure array
      let normalizedData = [];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === 'object') {
        normalizedData = [data];
      }
      
      setReceipts(normalizedData);
      
      // AI-powered receipt analytics
      generateAIInsights(normalizedData);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load goods receipts: ${error.message}`,
        action: () => fetchReceipts()
      });
      setReceipts([]); // Ensure array even on error
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get('/procurement/orders/');
      const data = response.data;
      // Filter only sent/acknowledged orders (ready for receipt)
      const readyOrders = (Array.isArray(data.results) ? data.results : [])
        .filter(o => o.status === 'sent' || o.status === 'acknowledged');
      setOrders(readyOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  useEffect(() => {
    fetchReceipts();
    fetchOrders();
  }, [pageControls.isRefreshing]);

  /**
   * AI Feature: Generate receipt insights and quality alerts
   */
  const generateAIInsights = (receiptList) => {
    if (!Array.isArray(receiptList) || receiptList.length === 0) return;

    // Soft-coded AI analytics
    const insights = [];
    
    // Quality inspection alerts
    const pendingInspection = receiptList.filter(r => 
      r.status === 'pending' || !r.quality_check_passed
    );
    
    if (pendingInspection.length > 0) {
      insights.push({
        type: 'quality_pending',
        title: '🔍 Quality Inspections Pending',
        count: pendingInspection.length,
        message: `${pendingInspection.length} receipt${pendingInspection.length > 1 ? 's' : ''} awaiting quality inspection`,
        priority: 'high'
      });
    }

    // Failed quality checks
    const qualityFailed = receiptList.filter(r => 
      r.dimensional_check_passed === false || 
      r.visual_inspection_passed === false || 
      r.material_verification_passed === false
    );
    
    if (qualityFailed.length > 0) {
      insights.push({
        type: 'quality_failed',
        title: '❌ Quality Issues Detected',
        count: qualityFailed.length,
        message: `${qualityFailed.length} receipt${qualityFailed.length > 1 ? 's' : ''} failed quality checks - immediate action required`,
        priority: 'urgent'
      });
    }

    // NDT requirements
    const ndtPending = receiptList.filter(r => 
      r.ndt_required && (!r.ndt_performed || !r.ndt_results)
    );
    
    if (ndtPending.length > 0) {
      insights.push({
        type: 'ndt_pending',
        title: '🧪 NDT Testing Required',
        count: ndtPending.length,
        message: `${ndtPending.length} item${ndtPending.length > 1 ? 's' : ''} pending Non-Destructive Testing`,
        priority: 'high'
      });
    }

    // Certification compliance
    const certMissing = receiptList.filter(r => 
      !r.certificates_received || (r.certificates_received && r.certificates_received.length === 0)
    );
    
    if (certMissing.length > 0) {
      insights.push({
        type: 'cert_missing',
        title: '📋 Certifications Missing',
        count: certMissing.length,
        message: `${certMissing.length} receipt${certMissing.length > 1 ? 's' : ''} missing required material certificates`,
        priority: 'high'
      });
    }

    // Material traceability
    const traceabilityIssues = receiptList.filter(r => 
      !r.heat_numbers || (Array.isArray(r.heat_numbers) && r.heat_numbers.length === 0)
    );
    
    if (traceabilityIssues.length > 0) {
      insights.push({
        type: 'traceability',
        title: '🔢 Material Traceability Gaps',
        count: traceabilityIssues.length,
        message: `${traceabilityIssues.length} item${traceabilityIssues.length > 1 ? 's' : ''} missing heat numbers for traceability`,
        priority: 'medium'
      });
    }

    // Acceptance rate
    const accepted = receiptList.filter(r => r.status === 'accepted').length;
    const acceptanceRate = receiptList.length > 0 ? ((accepted / receiptList.length) * 100).toFixed(1) : 0;
    
    insights.push({
      type: 'acceptance_rate',
      title: '✅ Acceptance Rate',
      percentage: acceptanceRate,
      message: `${acceptanceRate}% of receipts accepted (${accepted} out of ${receiptList.length})`,
      priority: acceptanceRate < 80 ? 'medium' : 'info'
    });

    setAiInsights(insights);
  };

  // Soft-coded filter logic with safe array handling
  const filteredReceipts = Array.isArray(receipts) ? receipts.filter(receipt => {
    // Soft-coded field access with fallbacks
    const grNumber = receipt?.gr_number || '';
    const poNumber = receipt?.po_number || '';
    const status = receipt?.status || '';
    const qualityPassed = receipt?.quality_check_passed;
    
    const matchesSearch = grNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         poNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesQuality = filterQuality === 'all' || 
                          (filterQuality === 'passed' && qualityPassed === true) ||
                          (filterQuality === 'failed' && qualityPassed === false) ||
                          (filterQuality === 'pending' && qualityPassed === null);
    return matchesSearch && matchesStatus && matchesQuality;
  }) : [];

  const handleReceiptCreated = async (receiptData) => {
    console.log('Creating receipt with AI data:', receiptData);
    // After successful creation, refresh receipt list
    await fetchReceipts();
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig('receipt', status);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  const getQualityBadge = (receipt) => {
    if (receipt?.quality_check_passed === true) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Quality Passed
        </span>
      );
    } else if (receipt?.quality_check_passed === false) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Quality Failed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
          <ClockIcon className="h-3 w-3 mr-1" />
          Inspection Pending
        </span>
      );
    }
  };

  const ReceiptStats = () => {
    // Soft-coded stats calculation with safe array handling
    const safeReceipts = Array.isArray(receipts) ? receipts : [];
    const stats = {
      total: safeReceipts.length,
      pending: safeReceipts.filter(r => r?.status === 'pending').length,
      accepted: safeReceipts.filter(r => r?.status === 'accepted').length,
      rejected: safeReceipts.filter(r => r?.status === 'rejected').length,
      qualityPassed: safeReceipts.filter(r => r?.quality_check_passed === true).length,
      qualityFailed: safeReceipts.filter(r => r?.quality_check_passed === false).length,
      ndtPending: safeReceipts.filter(r => r?.ndt_required && !r?.ndt_performed).length
    };

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <ArchiveBoxIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total GRs</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.pending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Accepted</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.accepted}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <XCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.rejected}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-[#00a896] rounded-md p-3">
                <ShieldCheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">QC Passed</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.qualityPassed}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-500 rounded-md p-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">QC Failed</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.qualityFailed}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <BeakerIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">NDT Pending</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.ndtPending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <ArchiveBoxIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Goods Receipts
              </h1>
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <SparklesIcon className="h-4 w-4 mr-1 text-purple-500" />
                AI-powered receipt management with quality inspection and material traceability
              </p>
            </div>
            
            <PageControlButtons 
              isFullscreen={pageControls.isFullscreen}
              toggleFullscreen={pageControls.toggleFullscreen}
              sidebarVisible={pageControls.sidebarVisible}
              toggleSidebar={pageControls.toggleSidebar}
              autoRefreshEnabled={pageControls.autoRefreshEnabled}
              toggleAutoRefresh={pageControls.toggleAutoRefresh}
              isRefreshing={pageControls.isRefreshing}
              manualRefresh={pageControls.manualRefresh}
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <ReceiptStats />
        </div>

        {/* AI Insights */}
        {aiInsights && aiInsights.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border-2 border-purple-200">
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">AI Quality Insights & Alerts</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className={`bg-white rounded-lg p-4 border-2 hover:shadow-md transition-shadow ${
                    insight.priority === 'urgent' ? 'border-red-300' : 
                    insight.priority === 'high' ? 'border-yellow-300' : 
                    insight.priority === 'medium' ? 'border-orange-300' :
                    'border-purple-200'
                  }`}>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{insight.title}</h4>
                    <p className="text-sm text-gray-600">{insight.message}</p>
                    {insight.percentage && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 90%</span>
                          <span className="font-semibold text-indigo-600">{insight.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${parseFloat(insight.percentage) >= 90 ? 'bg-green-500' : parseFloat(insight.percentage) >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(parseFloat(insight.percentage), 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className={`rounded-md p-4 ${error.type === 'auth' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.type === 'auth' ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${error.type === 'auth' ? 'text-yellow-800' : 'text-red-800'}`}>
                    {error.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5 flex">
                    {error.action && (
                      <button
                        type="button"
                        onClick={error.action}
                        className={`inline-flex rounded-md p-1.5 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className={`inline-flex rounded-md p-1.5 ml-2 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Goods Receipts
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Search by GR or PO number..."
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {/* Quality Filter */}
              <div>
                <label htmlFor="quality" className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Check
                </label>
                <select
                  id="quality"
                  value={filterQuality}
                  onChange={(e) => setFilterQuality(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Quality</option>
                  <option value="passed">✓ Passed</option>
                  <option value="failed">✗ Failed</option>
                  <option value="pending">⏱ Pending</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Showing {filteredReceipts.length} of {Array.isArray(receipts) ? receipts.length : 0} goods receipts
              </p>
              <button
                type="button"
                onClick={() => setShowAICreator(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <SparklesIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Record with AI Quality Check
              </button>
            </div>
          </div>
        </div>

        {/* Receipts List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading goods receipts...</p>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No goods receipts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== 'all' || filterQuality !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by recording a new goods receipt.'}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowAICreator(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Record with AI Quality Check
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReceipts.map((receipt) => (
                <div key={receipt.id} className="bg-white overflow-hidden shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-200 border-2 border-transparent hover:border-indigo-500">
                  <div className="p-6">
                    {/* Receipt Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <ArchiveBoxIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {receipt.gr_number || `GR-${receipt.id}`}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          PO: {receipt.po_number || 'N/A'}
                        </p>
                      </div>
                      {getStatusBadge(receipt.status)}
                    </div>

                    {/* Quality Badge */}
                    <div className="mb-4">
                      {getQualityBadge(receipt)}
                    </div>

                    {/* Receipt Details */}
                    <div className="space-y-3">
                      {receipt.received_date && (
                        <div className="flex items-center text-sm text-gray-600">
                          <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>Received: {new Date(receipt.received_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {receipt.inspector_name && (
                        <div className="flex items-center text-sm text-gray-600">
                          <UserGroupIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>Inspector: {receipt.inspector_name}</span>
                        </div>
                      )}
                      {receipt.certificates_received && receipt.certificates_received.length > 0 && (
                        <div className="flex items-start text-sm text-gray-600">
                          <DocumentCheckIcon className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                          <span className="text-xs">
                            {receipt.certificates_received.length} Certificate{receipt.certificates_received.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quality Indicators */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className={`text-center p-2 rounded ${receipt.dimensional_check_passed ? 'bg-green-50 text-green-700' : receipt.dimensional_check_passed === false ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-medium">Dimensional</div>
                          <div>{receipt.dimensional_check_passed === true ? '✓' : receipt.dimensional_check_passed === false ? '✗' : '—'}</div>
                        </div>
                        <div className={`text-center p-2 rounded ${receipt.visual_inspection_passed ? 'bg-green-50 text-green-700' : receipt.visual_inspection_passed === false ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-medium">Visual</div>
                          <div>{receipt.visual_inspection_passed === true ? '✓' : receipt.visual_inspection_passed === false ? '✗' : '—'}</div>
                        </div>
                        <div className={`text-center p-2 rounded ${receipt.material_verification_passed ? 'bg-green-50 text-green-700' : receipt.material_verification_passed === false ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-medium">Material</div>
                          <div>{receipt.material_verification_passed === true ? '✓' : receipt.material_verification_passed === false ? '✗' : '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex space-x-3">
                      <button className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        View Details
                      </button>
                      {receipt.status === 'pending' && (
                        <button className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Accept
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Receipt Creator Modal */}
      <AIReceiptCreator
        isOpen={showAICreator}
        onClose={() => setShowAICreator(false)}
        onReceiptCreated={handleReceiptCreated}
        orders={orders}
      />
    </div>
  );
};

export default ReceiptManagement;
