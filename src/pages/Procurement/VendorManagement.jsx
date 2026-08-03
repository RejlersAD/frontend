import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  StarIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  SparklesIcon,
  ArrowPathIcon,
  TableCellsIcon,
  Squares2X2Icon,
  ArrowDownIcon,
  ArrowUpIcon,
  DocumentArrowDownIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { PROCUREMENT_CONFIG, getVendorRating } from '../../config/procurement.config';
import AIVendorCreator from './AIVendorCreator';

// Soft-coded layout configuration
const LAYOUT_CONFIG = {
  maxWidthDefault: 'max-w-7xl',        // Standard container width
  maxWidthTable: 'max-w-full',         // Full width for table view
  tableMinWidth: 'min-w-[1400px]',     // Minimum table width to show all columns
  cardGridCols: {
    sm: 'sm:grid-cols-2',
    lg: 'lg:grid-cols-3',
    xl: 'xl:grid-cols-4'
  },
  scrollIndicator: 'shadow-sm ring-1 ring-gray-900/5' // Visual scroll hint
};

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [showAICreator, setShowAICreator] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all vendors with large page_size to avoid pagination issues
      // Soft-coded: Use query parameter to get all records
      const response = await apiClient.get('/procurement/vendors/', {
        params: {
          page_size: 1000  // Large enough to get all vendors in one request
        }
      });
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
      
      setVendors(normalizedData);
      
      // Log for debugging
      console.log(`✅ Loaded ${normalizedData.length} vendors from API`);
      
      // AI-powered vendor analytics
      generateAIRecommendations(normalizedData);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load vendors: ${error.message}`,
        action: () => fetchVendors()
      });
      setVendors([]); // Ensure array even on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [pageControls.isRefreshing]);

  /**
   * AI Feature: Generate vendor recommendations and insights
   */
  const generateAIRecommendations = (vendorList) => {
    if (!Array.isArray(vendorList) || vendorList.length === 0) return;

    // Soft-coded AI analytics
    const recommendations = [];
    
    // Analyze vendor performance
    const topPerformers = vendorList
      .filter(v => v.rating >= 4 && v.status === 'active')
      .slice(0, 3);
    
    if (topPerformers.length > 0) {
      recommendations.push({
        type: 'top_performers',
        title: '⭐ Top Performing Vendors',
        vendors: topPerformers.map(v => v.name),
        message: `${topPerformers.length} vendors with 4+ star ratings available for new projects`
      });
    }

    // Check for vendors needing attention
    const needsReview = vendorList.filter(v => 
      v.status === 'pending' || (v.rating && v.rating < 3)
    );
    
    if (needsReview.length > 0) {
      recommendations.push({
        type: 'needs_attention',
        title: '⚠️ Vendors Requiring Attention',
        count: needsReview.length,
        message: `${needsReview.length} vendor${needsReview.length > 1 ? 's' : ''} need review or approval`
      });
    }

    // Certification compliance check
    const withoutCerts = vendorList.filter(v => 
      !v.certifications || v.certifications.length === 0
    );
    
    if (withoutCerts.length > 0) {
      recommendations.push({
        type: 'compliance',
        title: '📋 Certification Updates Needed',
        count: withoutCerts.length,
        message: `${withoutCerts.length} vendor${withoutCerts.length > 1 ? 's' : ''} missing certification documentation`
      });
    }

    setAiRecommendations(recommendations);
  };

  // Soft-coded filter logic with safe array handling
  const filteredVendors = Array.isArray(vendors) ? vendors.filter(vendor => {
    // Soft-coded field access with fallbacks
    const name = vendor?.name || '';
    const vendorCode = vendor?.vendor_code || '';
    const status = vendor?.status || '';
    const rating = vendor?.rating || 0;
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendorCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesRating = filterRating === 'all' || rating === parseInt(filterRating);
    return matchesSearch && matchesStatus && matchesRating;
  }) : [];

  const getStatusConfig = (status) => {
    return PROCUREMENT_CONFIG.statuses.vendor[status] || { label: status, color: 'gray', icon: ClockIcon };
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig(status);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  const getRatingStars = (rating) => {
    if (!rating || rating === 0) return <span className="text-gray-400 text-xs">No rating</span>;
    const config = getVendorRating(rating);
    return (
      <div className="flex items-center space-x-1">
        <span className="text-sm">{config.icon}</span>
        <span className={`text-xs font-medium text-${config.color}-600`}>{config.label}</span>
      </div>
    );
  };

  const handleVendorCreated = async (vendorData) => {
    // After successful creation, refresh vendor list
    await fetchVendors();
    setShowAICreator(false);
    setEditMode(false);
    setSelectedVendor(null);
  };

  const handleVendorUpdated = async (updatedVendor) => {
    // After successful update, refresh vendor list
    await fetchVendors();
    setShowAICreator(false);
    setEditMode(false);
    setSelectedVendor(null);
  };

  const handleEditVendor = (vendor) => {
    setSelectedVendor(vendor);
    setEditMode(true);
    setShowAICreator(true);
  };

  /**
   * Soft-coded sorting function
   */
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  /**
   * Soft-coded export to Excel function
   */
  const handleExportToExcel = () => {
    const headers = ['Vendor Code', 'Vendor Name', 'Category', 'Contact Person', 'Contact Number', 'Email', 'Location', 'ICV', 'ADNOC', 'Tenure (yrs)', 'Trade License', 'VAT Number'];
    const rows = filteredVendors.map(v => [
      v.vendor_code,
      v.name,
      Array.isArray(v.categories) ? v.categories.join(', ') : '',
      v.contact_person || '',
      v.phone || '',
      v.email || '',
      v.address || '',
      v.is_icv_certified ? 'Y' : 'N',
      v.adnoc_approved ? 'Y' : 'N',
      v.vendor_tenure_years || '',
      v.trade_license_number || '',
      v.vat_number || ''
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join('\t')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Vendors_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const VendorStats = () => {
    // Soft-coded stats calculation with safe array handling
    const safeVendors = Array.isArray(vendors) ? vendors : [];
    const stats = {
      total: safeVendors.length,
      active: safeVendors.filter(v => v?.status === 'active').length,
      pending: safeVendors.filter(v => v?.status === 'pending').length,
      topRated: safeVendors.filter(v => v?.rating >= 4).length
    };

    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <UserGroupIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Vendors</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.total}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Vendors</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.active}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending Approval</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.pending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-amber-500 rounded-md p-3">
                <StarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Top Rated (4+)</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.topRated}</dd>
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
        <div className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <UserGroupIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Vendor Management
              </h1>
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <SparklesIcon className="h-4 w-4 mr-1 text-purple-500" />
                AI-powered vendor management with smart qualification and risk assessment
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
        <div className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}>
          <VendorStats />
        </div>

        {/* AI Recommendations */}
        {aiRecommendations && aiRecommendations.length > 0 && (
          <div className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-6`}>
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border-2 border-purple-200">
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">AI Insights & Recommendations</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiRecommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-purple-200 hover:shadow-md transition-shadow">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{rec.title}</h4>
                    <p className="text-sm text-gray-600">{rec.message}</p>
                    {rec.vendors && (
                      <div className="mt-2 space-y-1">
                        {rec.vendors.map((vendor, vIdx) => (
                          <div key={vIdx} className="text-xs text-indigo-600 font-medium">
                            • {vendor}
                          </div>
                        ))}
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
          <div className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-6`}>
            <div className={`rounded-md p-4 ${error.type === 'auth' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.type === 'auth' ? (
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
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
                        className={`inline-flex rounded-md p-1.5 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${error.type === 'auth' ? 'focus:ring-yellow-500' : 'focus:ring-red-500'}`}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className={`inline-flex rounded-md p-1.5 ml-2 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${error.type === 'auth' ? 'focus:ring-yellow-500' : 'focus:ring-red-500'}`}
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
        <div className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Vendors
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
                    placeholder="Search by name or code..."
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
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-2">
                  Rating
                </label>
                <select
                  id="rating"
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                  <option value="4">⭐⭐⭐⭐ Good</option>
                  <option value="3">⭐⭐⭐ Average</option>
                  <option value="2">⭐⭐ Below Average</option>
                  <option value="1">⭐ Poor</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Showing {filteredVendors.length} of {Array.isArray(vendors) ? vendors.length : 0} vendors
              </p>
              
              <div className="flex space-x-2">
                {/* View Toggle */}
                <div className="inline-flex rounded-md shadow-sm" role="group">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-2 text-sm font-medium border ${ 
                      viewMode === 'table'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  >
                    <TableCellsIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-2 text-sm font-medium border-t border-b border-r ${
                      viewMode === 'cards'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } rounded-r-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  >
                    <Squares2X2Icon className="h-5 w-5" />
                  </button>
                </div>

                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <DocumentArrowDownIcon className="-ml-1 mr-2 h-5 w-5" />
                  Export
                </button>

                {/* AI Create Button */}
                <button
                  type="button"
                  onClick={() => setShowAICreator(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Create with AI
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Vendors List */}
        <div className={`${viewMode === 'table' ? LAYOUT_CONFIG.maxWidthTable : LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading vendors...</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No vendors found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== 'all' || filterRating !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating a new vendor.'}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            /* Table View - Full Width with Smooth Scrolling */
            <div className="bg-white shadow-xl overflow-hidden rounded-lg border border-gray-200">
              {/* Scroll hint indicator */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 border-b border-indigo-100">
                <p className="text-xs text-indigo-700 font-medium flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Scroll horizontally to view all columns • Showing {filteredVendors.length} vendors
                </p>
              </div>
              <div className="overflow-x-auto overflow-y-visible" style={{scrollbarWidth: 'thin', scrollbarColor: '#6366f1 #f3f4f6'}}>
                <table className={`${LAYOUT_CONFIG.tableMinWidth} w-full divide-y divide-gray-200`}>
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50" onClick={() => handleSort('vendor_code')}>
                        <div className="flex items-center space-x-1">
                          <span>Code</span>
                          {sortConfig.key === 'vendor_code' && (
                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
                          )}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50" onClick={() => handleSort('name')}>
                        <div className="flex items-center space-x-1">
                          <span>Vendor Name</span>
                          {sortConfig.key === 'name' && (
                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
                          )}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Category</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Contact Person</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Contact Number</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">ICV</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">ADNOC</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Tenure</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredVendors
                      .sort((a, b) => {
                        const aVal = a[sortConfig.key] || '';
                        const bVal = b[sortConfig.key] || '';
                        if (sortConfig.direction === 'asc') {
                          return aVal > bVal ? 1 : -1;
                        }
                        return aVal < bVal ? 1 : -1;
                      })
                      .map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vendor.vendor_code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{vendor.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Array.isArray(vendor.categories) && vendor.categories.length > 0 ? vendor.categories[0] : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{vendor.contact_person || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{vendor.phone || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{vendor.email || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {vendor.is_icv_certified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {vendor.adnoc_approved ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {vendor.vendor_tenure_years ? `${vendor.vendor_tenure_years} yrs` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(vendor.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEditVendor(vendor)}
                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                            title="Edit vendor"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Card View - Responsive Grid */
            <div className={`grid grid-cols-1 gap-6 ${LAYOUT_CONFIG.cardGridCols.sm} ${LAYOUT_CONFIG.cardGridCols.lg} ${LAYOUT_CONFIG.cardGridCols.xl}`}>
              {filteredVendors.map((vendor) => (
                <div key={vendor.id} className="bg-white overflow-hidden shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-200 border-2 border-transparent hover:border-indigo-500">
                  <div className="p-6">
                    {/* Vendor Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <BuildingOfficeIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {vendor.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">Code: {vendor.vendor_code}</p>
                      </div>
                      {getStatusBadge(vendor.status)}
                    </div>

                    {/* Rating */}
                    <div className="mt-4">
                      {getRatingStars(vendor.rating)}
                    </div>

                    {/* Contact Info */}
                    <div className="mt-4 space-y-2">
                      {vendor.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="truncate">{vendor.email}</span>
                        </div>
                      )}
                      {vendor.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                      {vendor.country && (
                        <div className="flex items-center text-sm text-gray-600">
                          <GlobeAltIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{vendor.country}</span>
                        </div>
                      )}
                    </div>

                    {/* ICV Badge - Prominent Display for Abu Dhabi Market */}
                    {vendor.is_icv_certified && vendor.icv_percentage && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-3 border-2 border-red-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                              </svg>
                              <span className="text-xs font-semibold text-red-900">ICV Certified</span>
                            </div>
                            <span className="text-2xl font-bold text-red-600">{parseFloat(vendor.icv_percentage).toFixed(1)}%</span>
                          </div>
                          {vendor.icv_certificate && (
                            <div className="mt-2 text-xs text-red-700">
                              Cert: {vendor.icv_certificate}
                            </div>
                          )}
                          {vendor.icv_expiry_date && (
                            <div className="mt-1 text-xs text-red-600">
                              Valid until: {new Date(vendor.icv_expiry_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Certifications */}
                    {vendor?.certifications && Array.isArray(vendor.certifications) && vendor.certifications.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <ShieldCheckIcon className="h-4 w-4 text-[#00a896]" />
                          <span className="text-xs font-medium text-gray-700">Certifications:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {vendor.certifications.slice(0, 3).map((cert, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#00a896] bg-opacity-10 text-[#00a896] border border-[#00a896] border-opacity-20">
                              {cert}
                            </span>
                          ))}
                          {vendor.certifications.length > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              +{vendor.certifications.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => handleEditVendor(vendor)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-indigo-300 shadow-sm text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <PencilSquareIcon className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Create PO
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Vendor Creator/Editor Modal */}
      <AIVendorCreator
        isOpen={showAICreator}
        onClose={() => {
          setShowAICreator(false);
          setEditMode(false);
          setSelectedVendor(null);
        }}
        onVendorCreated={editMode ? handleVendorUpdated : handleVendorCreated}
        editMode={editMode}
        vendorData={selectedVendor}
      />
    </div>
  );
};

export default VendorManagement;
