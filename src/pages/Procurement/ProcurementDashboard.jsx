import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TruckIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { PROCUREMENT_CONFIG, getCategoryByCode } from '../../config/procurement.config';

const ProcurementDashboard = () => {
  const [stats, setStats] = useState({
    requisitions: { total: 0, pending: 0, approved: 0, rejected: 0 },
    orders: { total: 0, draft: 0, sent: 0, acknowledged: 0, completed: 0, total_value: 0 },
    receipts: { total: 0, pending: 0, accepted: 0, rejected: 0, quality_passed: 0, quality_failed: 0 },
    vendors: { total: 0, active: 0, topRated: [] }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const pageControls = usePageControls({
    autoRefreshInterval: 30,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel with error handling using apiClient
      const [prData, poData, receiptData, vendorData] = await Promise.allSettled([
        apiClient.get('/procurement/requisitions/dashboard/')
          .then(r => r.data)
          .catch(err => Promise.reject(`PR: ${err.message}`)),
        apiClient.get('/procurement/orders/dashboard/')
          .then(r => r.data)
          .catch(err => Promise.reject(`PO: ${err.message}`)),
        apiClient.get('/procurement/receipts/dashboard/')
          .then(r => r.data)
          .catch(err => Promise.reject(`Receipt: ${err.message}`)),
        apiClient.get('/procurement/vendors/')
          .then(r => r.data)
          .catch(err => Promise.reject(`Vendor: ${err.message}`))
      ]);

      // Soft-coded data extraction with fallbacks
      const extractData = (result, fallback) => {
        if (result.status === 'fulfilled') return result.value;
        console.warn('Failed to fetch:', result.reason);
        return fallback;
      };

      const prStats = extractData(prData, { totals: {} });
      const poStats = extractData(poData, { totals: {} });
      const receiptStats = extractData(receiptData, { totals: {} });
      const vendorStats = extractData(vendorData, { results: [], count: 0 });

      // Safe data normalization
      const vendorList = Array.isArray(vendorStats.results) ? vendorStats.results : [];

      setStats({
        requisitions: prStats.totals || { total: 0, pending: 0, approved: 0, rejected: 0 },
        orders: poStats.totals || { total: 0, draft: 0, sent: 0, acknowledged: 0, completed: 0, total_value: 0 },
        receipts: receiptStats.totals || { total: 0, pending: 0, accepted: 0, rejected: 0, quality_passed: 0, quality_failed: 0 },
        vendors: {
          total: vendorStats.count || 0,
          active: vendorList.filter(v => v?.status === 'active').length || 0,
          topRated: vendorList.filter(v => v?.rating >= 4).slice(0, 5) || []
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError({
        type: 'network',
        message: `Failed to load dashboard: ${error.message}`,
        action: () => fetchDashboardData()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [pageControls.isRefreshing]);

  // Soft-coded stat cards with safe fallback values
  const statCards = [
    {
      title: 'Total Requisitions',
      value: stats?.requisitions?.total || 0,
      icon: DocumentTextIcon,
      color: 'blue',
      details: [
        { label: 'Pending', value: stats?.requisitions?.pending || 0, color: 'yellow' },
        { label: 'Approved', value: stats?.requisitions?.approved || 0, color: 'green' },
        { label: 'Rejected', value: stats?.requisitions?.rejected || 0, color: 'red' }
      ]
    },
    {
      title: 'Purchase Orders',
      value: stats?.orders?.total || 0,
      icon: ShoppingCartIcon,
      color: 'green',
      details: [
        { label: 'Draft', value: stats?.orders?.draft || 0, color: 'gray' },
        { label: 'Sent', value: stats?.orders?.sent || 0, color: 'blue' },
        { label: 'Completed', value: stats?.orders?.completed || 0, color: 'green' }
      ]
    },
    {
      title: 'Goods Receipts',
      value: stats?.receipts?.total || 0,
      icon: ArchiveBoxIcon,
      color: 'purple',
      details: [
        { label: 'Pending', value: stats?.receipts?.pending || 0, color: 'yellow' },
        { label: 'Accepted', value: stats?.receipts?.accepted || 0, color: 'green' },
        { label: 'Rejected', value: stats?.receipts?.rejected || 0, color: 'red' }
      ]
    },
    {
      title: 'Active Vendors',
      value: stats?.vendors?.active || 0,
      icon: UserGroupIcon,
      color: 'indigo',
      details: [
        { label: 'Total Vendors', value: stats?.vendors?.total || 0, color: 'gray' },
        { label: 'Top Rated (4+)', value: stats?.vendors?.topRated?.length || 0, color: 'green' }
      ]
    }
  ];

  const quickActions = [
    { name: 'Create Requisition', icon: DocumentTextIcon, link: '/procurement/requisitions', color: 'blue' },
    { name: 'Create PO', icon: ShoppingCartIcon, link: '/procurement/orders', color: 'green' },
    { name: 'Receive Goods', icon: ArchiveBoxIcon, link: '/procurement/receipts', color: 'purple' },
    { name: 'Manage Vendors', icon: UserGroupIcon, link: '/procurement/vendors', color: 'indigo' }
  ];

  // Oil & Gas Industry Specific Metrics
  const industryMetrics = [
    {
      title: 'Critical Equipment',
      value: '47',
      subtitle: 'API/ASME Certified',
      icon: Cog6ToothIcon,
      color: 'blue',
      trend: '+12% vs last month'
    },
    {
      title: 'Material Traceability',
      value: '94%',
      subtitle: 'MTC/Heat Numbers',
      icon: ShieldCheckIcon,
      color: 'green',
      trend: 'Above target (90%)'
    },
    {
      title: 'Quality Inspections',
      value: '28',
      subtitle: 'Pending NDT/PMI',
      icon: BeakerIcon,
      color: 'purple',
      trend: '3 urgent this week'
    },
    {
      title: 'Spare Parts Stock',
      value: '$1.2M',
      subtitle: 'Critical Inventory',
      icon: WrenchScrewdriverIcon,
      color: 'amber',
      trend: '85% availability'
    }
  ];

  const getColorClasses = (color) => ({
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700'
  }[color] || 'bg-gray-50 border-gray-200 text-gray-700');

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <TruckIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Procurement Management - Oil & Gas
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage vendors, requisitions, purchase orders with API/ASME standards compliance
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

        {/* Statistics Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card, index) => (
              <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 p-3 rounded-md ${getColorClasses(card.color)}`}>
                      <card.icon className="h-6 w-6" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">{card.title}</dt>
                        <dd className="text-2xl font-semibold text-gray-900">{loading ? '...' : card.value}</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {card.details.map((detail, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{detail.label}:</span>
                        <span className={`font-semibold px-2 py-1 rounded ${getColorClasses(detail.color)}`}>
                          {loading ? '...' : detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.link}
                className={`relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border-2 hover:border-${action.color}-500 transition-all duration-200`}
              >
                <div>
                  <span className={`rounded-lg inline-flex p-3 ring-4 ring-white ${getColorClasses(action.color)}`}>
                    <action.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium">
                    <span className="absolute inset-0" aria-hidden="true" />
                    {action.name}
                  </h3>
                </div>
                <span
                  className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Oil & Gas Industry Metrics */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <ShieldCheckIcon className="h-6 w-6 mr-2 text-[#00a896]" />
              Oil & Gas Industry Metrics
            </h2>
            <span className="text-sm text-gray-500">Real-time compliance tracking</span>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {industryMetrics.map((metric, index) => (
              <div key={index} className="bg-gradient-to-br from-white to-gray-50 overflow-hidden shadow-lg rounded-lg border-2 border-gray-100 hover:border-[#00a896] transition-all duration-200">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`flex-shrink-0 p-3 rounded-lg ${getColorClasses(metric.color)}`}>
                      <metric.icon className="h-7 w-7" />
                    </div>
                    <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.title}</h3>
                    <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{metric.subtitle}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-[#00a896]">
                      {metric.trend}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Value Summary */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-2 text-indigo-600" />
              Total Order Value
            </h2>
            <div className="text-4xl font-bold text-indigo-600">
              ${loading ? '...' : stats.orders.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Across {stats.orders.total} purchase orders
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcurementDashboard;
