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
  PencilSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { PROCUREMENT_CONFIG, getVendorRating } from '../../config/procurement.config';
import AIVendorCreator from './AIVendorCreator';

// Soft-coded layout configuration
const LAYOUT_CONFIG = {
  maxWidthDefault: 'max-w-full',
  maxWidthTable: 'max-w-full',
  tableMinWidth: 'min-w-[1400px]',
  cardGridCols: {
    sm: 'sm:grid-cols-2',
    lg: 'lg:grid-cols-3',
    xl: 'xl:grid-cols-4'
  }
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/procurement/vendors/', {
        params: {
          page_size: 1000
        }
      });
      const data = response.data;
      
      let normalizedData = [];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === 'object') {
        normalizedData = [data];
      }
      
      setVendors(normalizedData);
      generateAIRecommendations(normalizedData);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load vendors: ${error.message}`,
        action: () => fetchVendors()
      });
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [pageControls.isRefreshing]);

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterRating]);

  const generateAIRecommendations = (vendorList) => {
    if (!Array.isArray(vendorList) || vendorList.length === 0) return;

    const recommendations = [];
    
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

  const filteredVendors = Array.isArray(vendors) ? vendors.filter(vendor => {
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

  // Sorting
  const sortedVendors = [...filteredVendors].sort((a, b) => {
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  // Pagination Logic
  const totalItems = sortedVendors.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentVendors = sortedVendors.slice(startIndex, endIndex);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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

  const handleVendorCreated = async () => {
    await fetchVendors();
    setShowAICreator(false);
    setEditMode(false);
    setSelectedVendor(null);
  };

  const handleVendorUpdated = async () => {
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

  // Corporate Pagination Component
  const PaginationUI = () => {
    if (totalItems === 0) return null;

    const renderPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      if (start > 1) {
        pages.push(
          <button
            key={1}
            onClick={() => setCurrentPage(1)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
          >
            1
          </button>
        );
        if (start > 2) {
          pages.push(<span key="start-dots" className="px-3 py-2 text-sm text-gray-500 border border-gray-300 bg-white">...</span>);
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`px-3 py-2 text-sm font-medium border ${
              currentPage === i
                ? 'bg-indigo-600 text-white border-indigo-600 z-10'
                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
            }`}
          >
            {i}
          </button>
        );
      }

      if (end < totalPages) {
        if (end < totalPages - 1) {
          pages.push(<span key="end-dots" className="px-3 py-2 text-sm text-gray-500 border border-gray-300 bg-white">...</span>);
        }
        pages.push(
          <button
            key={totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
          >
            {totalPages}
          </button>
        );
      }

      return pages;
    };

    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg shadow-sm">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-6">
            <p className="text-sm text-gray-700">
              Showing <span className="font-semibold text-gray-900">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-gray-900">{endIndex}</span> of{' '}
              <span className="font-semibold text-gray-900">{totalItems}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="rowsPerPage" className="text-sm text-gray-600 font-medium">Rows per page:</label>
              <select
                id="rowsPerPage"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2.5 border border-gray-300 bg-white rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              {renderPageNumbers()}
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </nav>
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
              <p className="text-sm text-gray-500 font-medium">
                Showing {totalItems} {totalItems === 1 ? 'vendor' : 'vendors'} found
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

        {/* Vendors List Section */}
        <div className={`${viewMode === 'table' ? LAYOUT_CONFIG.maxWidthTable : LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500 font-medium">Loading vendors...</p>
            </div>
          ) : currentVendors.length === 0 ? (
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
            /* Corporate Table View */
            <div className="bg-white shadow-md overflow-hidden rounded-lg border border-gray-200">
              <div className="overflow-x-auto overflow-y-visible" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
                <table className={`${LAYOUT_CONFIG.tableMinWidth} w-full divide-y divide-gray-200`}>
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('vendor_code')}>
                        <div className="flex items-center space-x-1">
                          <span>Code</span>
                          {sortConfig.key === 'vendor_code' && (
                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4 text-indigo-600" /> : <ArrowDownIcon className="h-4 w-4 text-indigo-600" />
                          )}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                        <div className="flex items-center space-x-1">
                          <span>Vendor Name</span>
                          {sortConfig.key === 'name' && (
                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4 text-indigo-600" /> : <ArrowDownIcon className="h-4 w-4 text-indigo-600" />
                          )}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact Person</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact Number</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ICV</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ADNOC</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenure</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentVendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{vendor.vendor_code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{vendor.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Array.isArray(vendor.categories) && vendor.categories.length > 0 ? vendor.categories[0] : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{vendor.contact_person || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{vendor.phone || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{vendor.email || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {vendor.is_icv_certified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {vendor.adnoc_approved ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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
              {/* Pagination Bar */}
              <PaginationUI />
            </div>
          ) : (
            /* Grid / Card View with Pagination */
            <div>
              <div className={`grid grid-cols-1 gap-6 ${LAYOUT_CONFIG.cardGridCols.sm} ${LAYOUT_CONFIG.cardGridCols.lg} ${LAYOUT_CONFIG.cardGridCols.xl}`}>
                {currentVendors.map((vendor) => (
                  <div key={vendor.id} className="bg-white overflow-hidden shadow-sm hover:shadow-md rounded-lg transition-shadow duration-200 border border-gray-200">
                    <div className="p-6">
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

                      <div className="mt-4">
                        {getRatingStars(vendor.rating)}
                      </div>

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

                      {vendor.is_icv_certified && vendor.icv_percentage && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-3 border border-red-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-red-900">ICV Certified</span>
                              </div>
                              <span className="text-2xl font-bold text-red-600">{parseFloat(vendor.icv_percentage).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex space-x-3">
                        <button
                          onClick={() => handleEditVendor(vendor)}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <PencilSquareIcon className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                          Create PO
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination Bar for Card View */}
              <div className="mt-6">
                <PaginationUI />
              </div>
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