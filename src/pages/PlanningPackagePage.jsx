import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.config';
import { PROJECT_CONTROL_ENDPOINTS, PROJECT_CONTROL_SUBFEATURES } from '../config/projectControl.config';

/**
 * Planning Package Management Page
 * SOFT-CODED: Feature 6.2 under Project Control
 * Create and manage work packages with budgets, schedules, and deliverables
 */
const PlanningPackagePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [packages, setPackages] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // SOFT-CODED: Status and Priority options from backend model choices
  const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
    { value: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-700' },
    { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  ];

  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-700' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
  ];

  useEffect(() => {
    fetchPackages();
    fetchStatistics();
  }, [statusFilter, priorityFilter]);

  const getAuthToken = () => {
    return localStorage.getItem('access_token');
  };

  const fetchPackages = async () => {
    try {
      const token = getAuthToken();
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const response = await axios.get(
        `${API_BASE_URL}${PROJECT_CONTROL_ENDPOINTS.planningPackages}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPackages(response.data.results || response.data);
    } catch (error) {
      console.error('Failed to fetch planning packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get(
        `${API_BASE_URL}${PROJECT_CONTROL_ENDPOINTS.planningPackageStats}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatistics(response.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const getStatusBadge = (status) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${option?.color || 'bg-gray-100 text-gray-700'}`}>
        {option?.label || status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const option = PRIORITY_OPTIONS.find(opt => opt.value === priority);
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${option?.color || 'bg-gray-100 text-gray-700'}`}>
        {option?.label || priority}
      </span>
    );
  };

  const formatCurrency = (amount, currency = 'AED') => {
    if (!amount) return '—';
    return `${currency} ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          {/* SOFT-CODED: Sub-features navigation */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {PROJECT_CONTROL_SUBFEATURES.filter(sf => sf.isActive).map((subFeature) => {
              const isCurrentPage = location.pathname === subFeature.route
              return (
                <button
                  key={subFeature.id}
                  onClick={() => !isCurrentPage && navigate(subFeature.route)}
                  className={[
                    'group relative inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                    isCurrentPage
                      ? `${subFeature.bgColor} ${subFeature.textColor} ${subFeature.borderColor} border-2 shadow-sm`
                      : `bg-white text-slate-600 border border-slate-200 ${subFeature.hoverBg} hover:border-slate-300 hover:shadow`,
                  ].join(' ')}
                  disabled={isCurrentPage}
                >
                  <span className="text-base">{subFeature.icon}</span>
                  <span className="font-mono text-[10px] opacity-60">{subFeature.number}</span>
                  <span>{subFeature.name}</span>
                  {subFeature.isNew && subFeature.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${subFeature.badgeColor}`}>
                      {subFeature.badge}
                    </span>
                  )}
                  {!isCurrentPage && (
                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-sm ring-1 ring-white/30">
                  📦
                </span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 via-violet-700 to-purple-700 bg-clip-text text-transparent">
                  Planning Packages
                </h1>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">NEW</span>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mt-1">Work package planning with budgets, schedules, and deliverables</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-violet-600 text-white rounded-xl hover:bg-violet-700 flex items-center justify-center space-x-2 transition-colors shadow-lg hover:shadow-xl"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Package</span>
            </button>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Packages', value: statistics.total_packages || 0, icon: '📦', color: 'indigo' },
              { label: 'Active', value: statistics.by_status?.active || 0, icon: '✅', color: 'green' },
              { label: 'Total Budget', value: formatCurrency(statistics.total_budget), icon: '💰', color: 'violet' },
              { label: 'Avg Progress', value: `${statistics.average_progress || 0}%`, icon: '📊', color: 'blue' },
            ].map((stat, index) => (
              <div key={index} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 border-${stat.color}-500`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className="text-3xl">{stat.icon}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Priorities</option>
            {PRIORITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow border border-gray-200 cursor-pointer"
                onClick={() => navigate(`/planning-packages/${pkg.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">{pkg.package_code}</span>
                      {pkg.is_new && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">NEW</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{pkg.description}</p>
                    )}
                  </div>
                  <div className="text-2xl ml-2">📦</div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    {getStatusBadge(pkg.status)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Priority:</span>
                    {getPriorityBadge(pkg.priority)}
                  </div>
                  {pkg.budget && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Budget:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(pkg.budget, pkg.currency)}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {pkg.progress_percentage !== null && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span className="font-semibold">{pkg.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-violet-600 h-2 rounded-full transition-all"
                        style={{ width: `${pkg.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>{pkg.project_name || 'No Project'}</span>
                  {pkg.package_manager_name && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      {pkg.package_manager_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Planning Packages Found</h3>
            <p className="text-gray-600 mb-6">Create your first planning package to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Create Your First Package
            </button>
          </div>
        )}

        {/* Create Modal Placeholder */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Planning Package</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🚧</div>
                <p className="text-gray-600 mb-4">Create Package form coming soon!</p>
                <p className="text-sm text-gray-500">This feature is under development.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningPackagePage;
