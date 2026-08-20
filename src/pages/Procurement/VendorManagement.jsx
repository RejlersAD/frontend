<<<<<<< HEAD
import React, { useState, useEffect, useCallback } from 'react';
=======
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
>>>>>>> origin/main
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
<<<<<<< HEAD
=======
  StarIcon,
>>>>>>> origin/main
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
  TrashIcon,
  ExclamationTriangleIcon,
<<<<<<< HEAD
  PowerIcon,
  EyeIcon,
  XMarkIcon,
  MapPinIcon,
  IdentificationIcon,
  ChevronRightIcon
=======
  PowerIcon
>>>>>>> origin/main
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { PROCUREMENT_CONFIG, getVendorRating } from '../../config/procurement.config';
import AIVendorCreator from './AIVendorCreator';

// Soft-coded layout configuration
const LAYOUT_CONFIG = {
<<<<<<< HEAD
=======
  maxWidthDefault: 'max-w-7xl',        // Standard container width
  maxWidthTable: 'max-w-full',         // Full width for table view
  tableMinWidth: 'min-w-[1400px]',     // Minimum table width to show all columns
>>>>>>> origin/main
  cardGridCols: {
    sm: 'sm:grid-cols-2',
    lg: 'lg:grid-cols-3',
    xl: 'xl:grid-cols-4'
<<<<<<< HEAD
  }
};

const COMPLETENESS_FIELDS = [
  { key: 'vendor_code', label: 'Vendor code', group: 'Identity' },
  { key: 'name', label: 'Legal name', group: 'Identity' },
  { key: 'contact_person', label: 'Contact person', group: 'Contact' },
  { key: 'email', label: 'Email', group: 'Contact' },
  { key: 'phone', label: 'Phone', group: 'Contact' },
  { key: 'address', label: 'Address', group: 'Location' },
  { key: 'country', label: 'Country', group: 'Location' },
  { key: 'trade_license_number', label: 'Trade license', group: 'Compliance' },
  { key: 'vat_number', label: 'VAT number', group: 'Compliance' },
  { key: 'categories', label: 'Categories', group: 'Qualification' },
  { key: 'certifications', label: 'Certifications', group: 'Qualification' },
];

const hasVendorValue = (value) => (
  Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== ''
);

const getVendorCompleteness = (vendor = {}) => {
  const missing = COMPLETENESS_FIELDS.filter(({ key }) => !hasVendorValue(vendor[key]));
  return {
    score: Math.round(((COMPLETENESS_FIELDS.length - missing.length) / COMPLETENESS_FIELDS.length) * 100),
    missing,
  };
};

const isVendorAttentionRequired = (vendor) => {
  const { score } = getVendorCompleteness(vendor);
  const icvExpired = vendor?.icv_expiry_date && new Date(vendor.icv_expiry_date) < new Date();
  return score < 75 || vendor?.status === 'pending' || Boolean(icvExpired);
=======
  },
  scrollIndicator: 'shadow-sm ring-1 ring-gray-900/5' // Visual scroll hint
>>>>>>> origin/main
};

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
<<<<<<< HEAD
  const [filterCompleteness, setFilterCompleteness] = useState('all');
  const [activeKpi, setActiveKpi] = useState('total');
  const [showAICreator, setShowAICreator] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detailVendor, setDetailVendor] = useState(null);
  const [enrichmentVendor, setEnrichmentVendor] = useState(undefined);
=======
  const [showAICreator, setShowAICreator] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState(null);
>>>>>>> origin/main
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

<<<<<<< HEAD
  const fetchVendors = useCallback(async () => {
=======
  const fetchVendors = async () => {
>>>>>>> origin/main
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
      
<<<<<<< HEAD
=======
      // AI-powered vendor analytics
      generateAIRecommendations(normalizedData);
>>>>>>> origin/main
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
<<<<<<< HEAD
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors, pageControls.isRefreshing]);
=======
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
>>>>>>> origin/main

  // Soft-coded filter logic with safe array handling
  const filteredVendors = Array.isArray(vendors) ? vendors.filter(vendor => {
    // Soft-coded field access with fallbacks
    const name = vendor?.name || '';
    const vendorCode = vendor?.vendor_code || '';
    const status = vendor?.status || '';
    const rating = vendor?.rating || 0;
<<<<<<< HEAD
    const country = vendor?.country || '';
    const email = vendor?.email || '';
    const categories = Array.isArray(vendor?.categories) ? vendor.categories.join(' ') : '';
    const completeness = getVendorCompleteness(vendor).score;
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         country.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         categories.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesRating = filterRating === 'all' || rating === parseInt(filterRating);
    const matchesCompleteness = filterCompleteness === 'all'
      || (filterCompleteness === 'complete' && completeness >= 85)
      || (filterCompleteness === 'incomplete' && completeness < 85)
      || (filterCompleteness === 'attention' && isVendorAttentionRequired(vendor));
    return matchesSearch && matchesStatus && matchesRating && matchesCompleteness;
=======
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendorCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesRating = filterRating === 'all' || rating === parseInt(filterRating);
    return matchesSearch && matchesStatus && matchesRating;
>>>>>>> origin/main
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

<<<<<<< HEAD
  const handleVendorCreated = async () => {
=======
  const handleVendorCreated = async (vendorData) => {
>>>>>>> origin/main
    // After successful creation, refresh vendor list
    await fetchVendors();
    setShowAICreator(false);
    setEditMode(false);
    setSelectedVendor(null);
  };

<<<<<<< HEAD
  const handleVendorUpdated = async () => {
=======
  const handleVendorUpdated = async (updatedVendor) => {
>>>>>>> origin/main
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
   * Handle vendor deletion with confirmation
   */
  const handleDeleteVendor = (vendor) => {
    setConfirmAction({
      type: 'delete',
      vendor: vendor,
      title: 'Delete Vendor',
      message: `Are you sure you want to delete "${vendor.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      confirmStyle: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await apiClient.delete(`/procurement/vendors/${vendor.id}/`);
          console.log(`✅ Vendor ${vendor.vendor_code} deleted successfully`);
          await fetchVendors(); // Refresh the list
          setShowConfirmModal(false);
          setConfirmAction(null);
        } catch (error) {
          console.error('Error deleting vendor:', error);
          setError({
            type: 'network',
            message: `Failed to delete vendor: ${error.response?.data?.detail || error.message}`,
            action: () => handleDeleteVendor(vendor)
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  /**
   * Handle vendor status toggle (activate/deactivate)
   */
  const handleToggleStatus = (vendor) => {
    const newStatus = vendor.status === 'active' ? 'inactive' : 'active';
    const actionLabel = newStatus === 'active' ? 'Activate' : 'Deactivate';
    
    setConfirmAction({
      type: 'toggle',
      vendor: vendor,
      newStatus: newStatus,
      title: `${actionLabel} Vendor`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} "${vendor.name}"?`,
      confirmLabel: actionLabel,
      confirmStyle: newStatus === 'active' ? 'success' : 'warning',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await apiClient.patch(`/procurement/vendors/${vendor.id}/`, {
            status: newStatus
          });
          console.log(`✅ Vendor ${vendor.vendor_code} status updated to ${newStatus}`);
          await fetchVendors(); // Refresh the list
          setShowConfirmModal(false);
          setConfirmAction(null);
        } catch (error) {
          console.error('Error updating vendor status:', error);
          setError({
            type: 'network',
            message: `Failed to update vendor status: ${error.response?.data?.detail || error.message}`,
            action: () => handleToggleStatus(vendor)
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
    setShowConfirmModal(true);
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

<<<<<<< HEAD
  const applyKpiFilter = (key) => {
    setActiveKpi(key);
    setSearchTerm('');
    setFilterRating('all');
    setFilterStatus(key === 'active' ? 'active' : 'all');
    setFilterCompleteness(
      key === 'attention' ? 'attention' : key === 'complete' ? 'complete' : 'all'
    );
  };

  const VendorStats = () => {
    const safeVendors = Array.isArray(vendors) ? vendors : [];
    const completenessScores = safeVendors.map(vendor => getVendorCompleteness(vendor).score);
    const stats = {
      total: safeVendors.length,
      active: safeVendors.filter(vendor => vendor?.status === 'active').length,
      attention: safeVendors.filter(isVendorAttentionRequired).length,
      complete: completenessScores.filter(score => score >= 85).length,
      average: completenessScores.length
        ? Math.round(completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length)
        : 0,
    };
    const cards = [
      {
        key: 'total', label: 'Total Vendors', value: stats.total,
        message: 'Complete supplier master directory', icon: UserGroupIcon,
        iconClass: 'bg-slate-900', accentClass: 'border-[#00a896]',
      },
      {
        key: 'active', label: 'Active Vendors', value: stats.active,
        message: `${stats.active} approved for procurement`, icon: CheckCircleIcon,
        iconClass: 'bg-[#00a896]', accentClass: 'border-[#00a896]',
      },
      {
        key: 'attention', label: 'Needs Attention', value: stats.attention,
        message: 'Missing data, pending review, or expired ICV', icon: ExclamationTriangleIcon,
        iconClass: 'bg-amber-500', accentClass: 'border-amber-400',
      },
      {
        key: 'complete', label: 'Data Complete', value: stats.complete,
        message: `${stats.average}% average completeness`, icon: ShieldCheckIcon,
        iconClass: 'bg-[#73bdc8]', accentClass: 'border-[#73bdc8]',
      },
    ];

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const selected = activeKpi === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => applyKpiFilter(card.key)}
              aria-pressed={selected}
              className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#00a896]/20 ${
                selected ? `${card.accentClass} ring-2 ring-[#00a896]/20` : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{card.value}</p>
                </div>
                <span className={`rounded-xl p-3 shadow-sm ${card.iconClass}`}>
                  <Icon className="h-6 w-6 text-white" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-xs leading-5 text-slate-500">{card.message}</p>
                <ChevronRightIcon className="h-4 w-4 flex-none text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#00a896]" />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const enrichmentTargets = enrichmentVendor === undefined
    ? []
    : enrichmentVendor
      ? [enrichmentVendor]
      : vendors.filter(vendor => getVendorCompleteness(vendor).score < 85);
  const enrichmentMissingFields = enrichmentVendor
    ? getVendorCompleteness(enrichmentVendor).missing
    : [];

  const enrichmentSourceFor = (field) => {
    if (field.group === 'Compliance') return 'Trade license / VAT document';
    if (field.group === 'Qualification') return 'Company profile / certificate';
    if (field.group === 'Contact' || field.group === 'Location') return 'Verified website / company profile';
    return 'Vendor master evidence';
  };

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-6" style={pageControls.styles.content}>
        {/* RADAI vendor workspace header and primary actions */}
        <div className="w-full px-3 sm:px-4">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 shadow-xl">
            <div className="relative px-6 py-7 lg:px-8">
              <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#00a896]/20 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-24 w-56 rounded-full bg-[#73bdc8]/10 blur-3xl" />
              <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-[#00a896] p-3 shadow-lg shadow-[#00a896]/20">
                      <UserGroupIcon className="h-7 w-7 text-white" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#73bdc8]">RADAI Procurement</p>
                      <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Vendor Management</h1>
                    </div>
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                    Manage supplier identity, contacts, compliance, qualifications, and data readiness from one controlled workspace.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
                  {/* <div className="rounded-xl bg-white/95 p-1 shadow-sm">
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
                  </div> */}
                  <button type="button" onClick={handleExportToExcel} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20">
                    <DocumentArrowDownIcon className="mr-2 h-5 w-5" /> Export
                  </button>
                  <button type="button" onClick={() => setEnrichmentVendor(null)} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#73bdc8]/40 bg-[#73bdc8]/15 px-4 text-sm font-semibold text-[#b9edf0] transition hover:bg-[#73bdc8]/25 focus:outline-none focus:ring-4 focus:ring-[#73bdc8]/20">
                    <SparklesIcon className="mr-2 h-5 w-5" /> AI Enrich
                  </button>
                  <button type="button" onClick={() => { setSelectedVendor(null); setEditMode(false); setShowAICreator(true); }} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#00a896] px-4 text-sm font-semibold text-white shadow-lg shadow-[#00a896]/20 transition hover:bg-[#008f80] focus:outline-none focus:ring-4 focus:ring-[#00a896]/30">
                    <PlusIcon className="mr-2 h-5 w-5" /> Add Vendor
                  </button>
                </div>
=======
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
>>>>>>> origin/main
              </div>
            </div>
          </div>
        </div>

<<<<<<< HEAD
        {/* Statistics */}
        <div className="w-full px-3 sm:px-4 mt-6">
          <VendorStats />
        </div>

=======
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
        <div className="w-full px-3 sm:px-4">
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
        <div className="w-full px-3 sm:px-4 mt-8">
          <VendorStats />
        </div>

        {/* AI Recommendations */}
        {aiRecommendations && aiRecommendations.length > 0 && (
          <div className="w-full px-3 sm:px-4 mt-6">
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

>>>>>>> origin/main
        {/* Error Message */}
        {error && (
          <div className="w-full px-3 sm:px-4 mt-6">
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
<<<<<<< HEAD
        <div className="w-full px-3 sm:px-4 mt-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Vendor Directory</h2>
                <p className="mt-1 text-xs text-slate-500">Search and filter the supplier master list.</p>
              </div>
              <FunnelIcon className="h-5 w-5 text-[#00a896]" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
=======
        <div className="w-full px-3 sm:px-4 mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
>>>>>>> origin/main
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
<<<<<<< HEAD
                    className="block h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#00a896] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#00a896]/10"
                    placeholder="Name, code, email, country, or category..."
=======
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Search by name or code..."
>>>>>>> origin/main
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
<<<<<<< HEAD
                <label htmlFor="status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
=======
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
>>>>>>> origin/main
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
<<<<<<< HEAD
                  onChange={(e) => { setFilterStatus(e.target.value); setActiveKpi('custom'); }}
                  className="block h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm focus:border-[#00a896] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#00a896]/10"
=======
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
>>>>>>> origin/main
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
<<<<<<< HEAD
                <label htmlFor="rating" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
=======
                <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-2">
>>>>>>> origin/main
                  Rating
                </label>
                <select
                  id="rating"
                  value={filterRating}
<<<<<<< HEAD
                  onChange={(e) => { setFilterRating(e.target.value); setActiveKpi('custom'); }}
                  className="block h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm focus:border-[#00a896] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#00a896]/10"
=======
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
>>>>>>> origin/main
                >
                  <option value="all">All Ratings</option>
                  <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                  <option value="4">⭐⭐⭐⭐ Good</option>
                  <option value="3">⭐⭐⭐ Average</option>
                  <option value="2">⭐⭐ Below Average</option>
                  <option value="1">⭐ Poor</option>
                </select>
              </div>
<<<<<<< HEAD

              <div>
                <label htmlFor="completeness" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Data Readiness
                </label>
                <select
                  id="completeness"
                  value={filterCompleteness}
                  onChange={(e) => { setFilterCompleteness(e.target.value); setActiveKpi('custom'); }}
                  className="block h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm focus:border-[#00a896] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#00a896]/10"
                >
                  <option value="all">All readiness</option>
                  <option value="complete">Complete (85%+)</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="attention">Needs attention</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {filteredVendors.length} of {Array.isArray(vendors) ? vendors.length : 0} vendors
              </p>
              
              <div className="flex items-center gap-2">
                {(searchTerm || filterStatus !== 'all' || filterRating !== 'all' || filterCompleteness !== 'all') && (
                  <button type="button" onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterRating('all'); setFilterCompleteness('all'); setActiveKpi('total'); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                    Clear filters
                  </button>
                )}
=======
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Showing {filteredVendors.length} of {Array.isArray(vendors) ? vendors.length : 0} vendors
              </p>
              
              <div className="flex space-x-2">
>>>>>>> origin/main
                {/* View Toggle */}
                <div className="inline-flex rounded-md shadow-sm" role="group">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-2 text-sm font-medium border ${ 
                      viewMode === 'table'
<<<<<<< HEAD
                        ? 'bg-[#00a896] text-white border-[#00a896]'
=======
                        ? 'bg-indigo-600 text-white border-indigo-600'
>>>>>>> origin/main
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
<<<<<<< HEAD
                        ? 'bg-[#00a896] text-white border-[#00a896]'
=======
                        ? 'bg-indigo-600 text-white border-indigo-600'
>>>>>>> origin/main
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } rounded-r-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  >
                    <Squares2X2Icon className="h-5 w-5" />
                  </button>
                </div>

<<<<<<< HEAD
=======
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
>>>>>>> origin/main
              </div>
            </div>
          </div>
        </div>

        {/* Vendors List */}
        <div className="w-full px-3 sm:px-4 mt-8">
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
<<<<<<< HEAD
            /* Grouped vendor directory table */
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <p className="text-xs font-medium text-slate-500">Click a vendor row to open the full profile.</p>
                <span className="rounded-full bg-[#00a896]/10 px-3 py-1 text-xs font-semibold text-[#008f80]">{filteredVendors.length} vendors</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1080px] w-full divide-y divide-slate-200">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th scope="col" onClick={() => handleSort('name')} className="cursor-pointer px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100">
                        <span className="inline-flex items-center gap-1">Vendor &amp; Scope {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />)}</span>
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Completeness</th>
                      <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Primary Contact</th>
                      <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Compliance</th>
                      <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Performance</th>
                      <th scope="col" className="sticky right-0 bg-slate-50 px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Status &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredVendors
                      .slice()
                      .sort((a, b) => {
                        const aVal = a[sortConfig.key] || '';
                        const bVal = b[sortConfig.key] || '';
                        if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
                        return aVal < bVal ? 1 : -1;
                      })
                      .map((vendor) => {
                        const completeness = getVendorCompleteness(vendor);
                        const complianceMissing = [
                          !vendor.trade_license_number && 'Trade license',
                          !vendor.vat_number && 'VAT',
                        ].filter(Boolean);
                        return (
                          <tr key={vendor.id} onClick={() => setDetailVendor(vendor)} className="group cursor-pointer transition-colors hover:bg-[#00a896]/[0.035]">
                            <td className="px-5 py-4 align-top">
                              <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                                  {(vendor.name || 'V').slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="max-w-[260px] truncate text-sm font-bold text-slate-900">{vendor.name}</p>
                                  <p className="mt-0.5 text-xs font-medium text-[#008f80]">{vendor.vendor_code}</p>
                                  <div className="mt-2 flex max-w-[280px] flex-wrap gap-1">
                                    {(Array.isArray(vendor.categories) ? vendor.categories : []).slice(0, 2).map(category => (
                                      <span key={category} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{category}</span>
                                    ))}
                                    {(!vendor.categories || vendor.categories.length === 0) && <span className="text-xs text-amber-600">Category missing</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="flex items-center justify-between gap-3">
                                <span className={`text-sm font-bold ${completeness.score >= 85 ? 'text-emerald-600' : completeness.score >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{completeness.score}%</span>
                                <span className="text-[11px] text-slate-400">{completeness.missing.length} missing</span>
                              </div>
                              <div className="mt-2 h-2 w-36 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${completeness.score >= 85 ? 'bg-[#00a896]' : completeness.score >= 60 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${completeness.score}%` }} />
                              </div>
                              {completeness.missing.length > 0 && <p className="mt-2 max-w-[170px] truncate text-xs text-slate-500" title={completeness.missing.map(field => field.label).join(', ')}>Missing: {completeness.missing[0].label}{completeness.missing.length > 1 ? ` +${completeness.missing.length - 1}` : ''}</p>}
                            </td>
                            <td className="px-5 py-4 align-top text-xs text-slate-600">
                              <p className="font-semibold text-slate-800">{vendor.contact_person || 'Contact missing'}</p>
                              <p className="mt-1 max-w-[210px] truncate">{vendor.email || 'Email missing'}</p>
                              <p className="mt-1">{vendor.phone || 'Phone missing'}</p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${vendor.is_icv_certified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>ICV {vendor.is_icv_certified ? 'Verified' : 'No'}</span>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${vendor.adnoc_approved ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>ADNOC {vendor.adnoc_approved ? 'Approved' : 'No'}</span>
                              </div>
                              <p className={`mt-2 text-xs ${complianceMissing.length ? 'text-amber-600' : 'text-emerald-600'}`}>{complianceMissing.length ? `${complianceMissing.join(' & ')} missing` : 'Legal identifiers recorded'}</p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              {getRatingStars(vendor.rating)}
                              <p className="mt-2 text-xs text-slate-500">{vendor.vendor_tenure_years ? `${vendor.vendor_tenure_years} years tenure` : 'Tenure not recorded'}</p>
                            </td>
                            <td className="sticky right-0 bg-white px-5 py-4 align-top group-hover:bg-[#f5fbfa]">
                              <div className="flex items-center justify-end gap-2">
                                {getStatusBadge(vendor.status)}
                                <button type="button" onClick={(event) => { event.stopPropagation(); setEnrichmentVendor(vendor); }} className="rounded-lg p-2 text-[#008f80] hover:bg-[#00a896]/10" title="AI enrich vendor"><SparklesIcon className="h-4 w-4" /></button>
                                <button type="button" onClick={(event) => { event.stopPropagation(); setDetailVendor(vendor); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="View vendor"><EyeIcon className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
=======
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
                          <div className="flex items-center space-x-2">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleEditVendor(vendor)}
                              className="text-indigo-600 hover:text-indigo-900 inline-flex items-center space-x-1 px-2 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                              title="Edit vendor"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              <span className="hidden xl:inline">Edit</span>
                            </button>
                            
                            {/* Activate/Deactivate Button */}
                            <button
                              onClick={() => handleToggleStatus(vendor)}
                              className={`${
                                vendor.status === 'active'
                                  ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                                  : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                              } inline-flex items-center space-x-1 px-2 py-1.5 rounded-md transition-colors`}
                              title={vendor.status === 'active' ? 'Deactivate vendor' : 'Activate vendor'}
                            >
                              <PowerIcon className="h-4 w-4" />
                              <span className="hidden xl:inline">
                                {vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                              </span>
                            </button>
                            
                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteVendor(vendor)}
                              className="text-red-600 hover:text-red-900 inline-flex items-center space-x-1 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete vendor"
                            >
                              <TrashIcon className="h-4 w-4" />
                              <span className="hidden xl:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
>>>>>>> origin/main
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

<<<<<<< HEAD
                    <button type="button" onClick={() => setDetailVendor(vendor)} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-[#00a896]/40">
                      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">Data completeness</span><span className="text-sm font-bold text-[#008f80]">{getVendorCompleteness(vendor).score}%</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#00a896]" style={{ width: `${getVendorCompleteness(vendor).score}%` }} /></div>
                    </button>

=======
>>>>>>> origin/main
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
                    <div className="mt-6 flex flex-col space-y-2">
                      <div className="flex space-x-2">
<<<<<<< HEAD
                        <button type="button" onClick={() => setDetailVendor(vendor)} className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"><EyeIcon className="h-4 w-4 mr-1" /> View</button>
                        <button type="button" onClick={() => setEnrichmentVendor(vendor)} className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-[#00a896]/30 text-sm font-medium rounded-md text-[#008f80] bg-[#00a896]/5 hover:bg-[#00a896]/10"><SparklesIcon className="h-4 w-4 mr-1" /> AI Enrich</button>
                      </div>
                      <div className="flex space-x-2">
=======
>>>>>>> origin/main
                        <button
                          onClick={() => handleEditVendor(vendor)}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-indigo-300 shadow-sm text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <PencilSquareIcon className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(vendor)}
                          className={`flex-1 inline-flex justify-center items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            vendor.status === 'active'
                              ? 'border-orange-300 text-orange-700 bg-white hover:bg-orange-50 focus:ring-orange-500'
                              : 'border-green-300 text-green-700 bg-white hover:bg-green-50 focus:ring-green-500'
                          }`}
                        >
                          <PowerIcon className="h-4 w-4 mr-1" />
                          {vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteVendor(vendor)}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete Vendor
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

<<<<<<< HEAD
      {/* Vendor profile drawer */}
      {detailVendor && (
        <>
          <button type="button" aria-label="Close vendor details" onClick={() => setDetailVendor(null)} className="fixed inset-0 z-[60] cursor-default bg-slate-950/35 backdrop-blur-[2px]" />
          <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="vendor-detail-title">
            <div className="bg-gradient-to-r from-slate-950 to-blue-950 px-6 py-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#00a896] text-base font-bold">{(detailVendor.name || 'V').slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#73bdc8]">{detailVendor.vendor_code}</p>
                    <h2 id="vendor-detail-title" className="mt-1 truncate text-xl font-bold">{detailVendor.name}</h2>
                  </div>
                </div>
                <button type="button" onClick={() => setDetailVendor(null)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#7fcab5]" style={{ width: `${getVendorCompleteness(detailVendor).score}%` }} /></div>
                <span className="text-sm font-bold">{getVendorCompleteness(detailVendor).score}% complete</span>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50 p-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><BuildingOfficeIcon className="h-5 w-5 text-[#00a896]" /> Overview</div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs font-medium text-slate-400">Status</p><div className="mt-1">{getStatusBadge(detailVendor.status)}</div></div>
                  <div><p className="text-xs font-medium text-slate-400">Country</p><p className="mt-1 font-semibold text-slate-800">{detailVendor.country || 'Not recorded'}</p></div>
                  <div className="col-span-2"><p className="text-xs font-medium text-slate-400">Categories</p><div className="mt-2 flex flex-wrap gap-1.5">{(detailVendor.categories || []).map(category => <span key={category} className="rounded-lg bg-[#00a896]/10 px-2.5 py-1 text-xs font-medium text-[#008f80]">{category}</span>)}{(!detailVendor.categories || detailVendor.categories.length === 0) && <span className="text-slate-500">Not recorded</span>}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><EnvelopeIcon className="h-5 w-5 text-[#00a896]" /> Contact &amp; Location</div>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <p><span className="font-semibold">Contact:</span> {detailVendor.contact_person || 'Not recorded'}</p>
                  <p><span className="font-semibold">Email:</span> {detailVendor.email || 'Not recorded'}</p>
                  <p><span className="font-semibold">Phone:</span> {detailVendor.phone || 'Not recorded'}</p>
                  <p className="flex items-start gap-2"><MapPinIcon className="mt-0.5 h-4 w-4 flex-none text-slate-400" /><span>{detailVendor.address || 'Address not recorded'}</span></p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><IdentificationIcon className="h-5 w-5 text-[#00a896]" /> Legal &amp; Compliance</div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs text-slate-400">Trade license</p><p className="mt-1 font-semibold text-slate-800">{detailVendor.trade_license_number || 'Missing'}</p></div>
                  <div><p className="text-xs text-slate-400">VAT number</p><p className="mt-1 font-semibold text-slate-800">{detailVendor.vat_number || 'Missing'}</p></div>
                  <div><p className="text-xs text-slate-400">ICV</p><p className="mt-1 font-semibold text-slate-800">{detailVendor.is_icv_certified ? `${detailVendor.icv_percentage || '—'}% certified` : 'Not certified'}</p></div>
                  <div><p className="text-xs text-slate-400">ADNOC</p><p className="mt-1 font-semibold text-slate-800">{detailVendor.adnoc_approved ? 'Approved' : 'Not approved'}</p></div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheckIcon className="h-5 w-5 text-[#00a896]" /> Data Readiness</div><span className="text-sm font-bold text-[#008f80]">{getVendorCompleteness(detailVendor).score}%</span></div>
                {getVendorCompleteness(detailVendor).missing.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">{getVendorCompleteness(detailVendor).missing.map(field => <span key={field.key} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{field.label} missing</span>)}</div>
                ) : <p className="mt-3 text-sm text-emerald-600">All tracked master-data fields are complete.</p>}
              </section>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-white p-5">
              <button type="button" onClick={() => { setEnrichmentVendor(detailVendor); setDetailVendor(null); }} className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#00a896]/30 bg-[#00a896]/10 px-4 py-2.5 text-sm font-semibold text-[#008f80] hover:bg-[#00a896]/15"><SparklesIcon className="mr-2 h-4 w-4" /> AI Enrich</button>
              <button type="button" onClick={() => { const vendor = detailVendor; setDetailVendor(null); handleEditVendor(vendor); }} className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#00a896] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#008f80]"><PencilSquareIcon className="mr-2 h-4 w-4" /> Edit Vendor</button>
            </div>
          </aside>
        </>
      )}

      {/* AI enrichment review placeholder */}
      {enrichmentVendor !== undefined && (
        <>
          <button type="button" aria-label="Close AI enrichment review" onClick={() => setEnrichmentVendor(undefined)} className="fixed inset-0 z-[75] cursor-default bg-slate-950/45 backdrop-blur-[2px]" />
          <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-2xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="enrichment-title">
            <div className="border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-2xl bg-gradient-to-br from-[#00a896] to-[#73bdc8] p-3"><SparklesIcon className="h-6 w-6 text-white" /></span>
                  <div><p className="text-xs font-semibold uppercase tracking-widest text-[#008f80]">Review workspace</p><h2 id="enrichment-title" className="mt-1 text-xl font-bold text-slate-950">AI Enrich {enrichmentVendor ? enrichmentVendor.name : 'Incomplete Vendors'}</h2><p className="mt-1 text-sm text-slate-500">Suggestions require verified evidence and human approval.</p></div>
                </div>
                <button type="button" onClick={() => setEnrichmentVendor(undefined)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><XMarkIcon className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="mb-5 rounded-2xl border border-[#73bdc8]/40 bg-[#73bdc8]/10 p-4 text-sm text-slate-700"><strong className="text-slate-900">Preview only:</strong> no vendor values will be changed until trusted document and registry sources are connected.</div>
              {enrichmentVendor ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[28px_1fr_1.25fr_80px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span /><span>Missing field</span><span>Proposed source</span><span>Confidence</span></div>
                  {enrichmentMissingFields.length > 0 ? enrichmentMissingFields.map(field => (
                    <div key={field.key} className="grid grid-cols-[28px_1fr_1.25fr_80px] items-center gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-0">
                      <input type="checkbox" disabled className="rounded border-slate-300 text-[#00a896]" />
                      <div><p className="font-semibold text-slate-800">{field.label}</p><p className="text-xs text-slate-400">{field.group}</p></div>
                      <p className="text-xs leading-5 text-slate-600">{enrichmentSourceFor(field)}</p>
                      <span className="text-xs font-semibold text-slate-400">Pending</span>
                    </div>
                  )) : <div className="p-8 text-center text-sm text-emerald-600">This vendor is complete across all tracked fields.</div>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Enrichment queue</h3><span className="text-xs text-slate-500">{enrichmentTargets.length} vendors below 85%</span></div>
                  {enrichmentTargets.slice(0, 12).map(vendor => {
                    const completeness = getVendorCompleteness(vendor);
                    return <button key={vendor.id} type="button" onClick={() => setEnrichmentVendor(vendor)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#00a896]/50 hover:shadow-md"><div><p className="text-sm font-bold text-slate-900">{vendor.name}</p><p className="mt-1 text-xs text-slate-500">{completeness.missing.length} missing fields · {vendor.vendor_code}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-amber-600">{completeness.score}%</span><ChevronRightIcon className="h-4 w-4 text-slate-400" /></div></button>;
                  })}
                  {enrichmentTargets.length === 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-sm text-emerald-700">All vendors meet the 85% completeness threshold.</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Source connectors and field application will be enabled in the enrichment phase.</p><button type="button" disabled className="rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500">Apply selected changes</button></div>
          </aside>
        </>
      )}

=======
>>>>>>> origin/main
      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => !actionLoading && setShowConfirmModal(false)}
            ></div>

            {/* Center modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                  confirmAction.confirmStyle === 'danger' ? 'bg-red-100' :
                  confirmAction.confirmStyle === 'warning' ? 'bg-yellow-100' :
                  'bg-green-100'
                }`}>
                  {confirmAction.confirmStyle === 'danger' ? (
                    <TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                  ) : confirmAction.confirmStyle === 'warning' ? (
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                  ) : (
                    <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                  )}
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    {confirmAction.title}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {confirmAction.message}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmAction.onConfirm}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                    confirmAction.confirmStyle === 'danger' 
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' :
                    confirmAction.confirmStyle === 'warning'
                      ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  } ${actionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    confirmAction.confirmLabel
                  )}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowConfirmModal(false)}
                  className={`mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm ${
                    actionLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
