import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api.service';
import {
  FolderOpen,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  FileText,
  BarChart3,
  PieChart,
  Filter,
  Search,
  Plus,
  ExternalLink,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react';

// Soft-coded project configuration
const PROJECT_CONFIG = {
  STATUS_COLORS: {
    planning: { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock },
    active: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
    on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
    completed: { bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    archived: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Archive }
  },
  HEALTH_COLORS: {
    green: { bg: 'bg-green-100', text: 'text-green-800', label: 'On Track', barColor: 'bg-green-500' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'At Risk', barColor: 'bg-yellow-500' },
    red: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical', barColor: 'bg-red-500' }
  },
  BUDGET_THRESHOLDS: {
    warning: 80,
    critical: 95,
    overspend: 100
  }
};

const ProjectDashboard = () => {
  const navigate = useNavigate();
  
  // State management
  const [projects, setProjects] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    health_status: '',
    project_type: '',
    active_only: true
  });

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const response = await apiClient.get('/procurement/projects/dashboard_stats/');
      setDashboardStats(response.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  // Fetch projects with filters
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.health_status) params.health_status = filters.health_status;
      if (filters.project_type) params.project_type = filters.project_type;
      if (filters.active_only) params.active_only = 'true';
      
      const response = await apiClient.get('/procurement/projects/', { params });
      setProjects(response.data.results || response.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardStats();
    fetchProjects();
  }, []);

  // Refresh on filter change
  useEffect(() => {
    fetchProjects();
  }, [filters]);

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardStats(), fetchProjects()]);
    setRefreshing(false);
  };

  // Calculate budget utilization color
  const getBudgetUtilizationColor = (percentage) => {
    if (percentage >= PROJECT_CONFIG.BUDGET_THRESHOLDS.overspend) return 'bg-red-500';
    if (percentage >= PROJECT_CONFIG.BUDGET_THRESHOLDS.critical) return 'bg-orange-500';
    if (percentage >= PROJECT_CONFIG.BUDGET_THRESHOLDS.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Format currency
  const formatCurrency = (amount, currency = 'AED') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // KPI Cards Component
  const KPICard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="ml-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-7 h-7" style={{ color }} />
          </div>
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          <span className="text-green-600 font-medium">{trend}</span>
        </div>
      )}
    </div>
  );

  // Project Card Component
  const ProjectCard = ({ project }) => {
    const statusConfig = PROJECT_CONFIG.STATUS_COLORS[project.status] || PROJECT_CONFIG.STATUS_COLORS.planning;
    const healthConfig = PROJECT_CONFIG.HEALTH_COLORS[project.health_status] || PROJECT_CONFIG.HEALTH_COLORS.green;
    const StatusIcon = statusConfig.icon;
    
    const budgetUtilization = project.budget_utilization || 0;
    const utilizationColor = getBudgetUtilizationColor(budgetUtilization);

    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900">{project.project_name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${healthConfig.bg} ${healthConfig.text}`}>
                  {healthConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Project #:</span> {project.project_number}
              </p>
              {project.client_name && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Client:</span> {project.client_name}
                </p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
              <StatusIcon className="w-3 h-3" />
              {project.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Contract Value</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(project.contract_value, project.contract_currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Budget</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(project.total_budget, project.contract_currency)}
              </p>
            </div>
          </div>

          {/* Budget Utilization Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Budget Utilization</span>
              <span className={`text-xs font-bold ${budgetUtilization > PROJECT_CONFIG.BUDGET_THRESHOLDS.critical ? 'text-red-600' : 'text-gray-900'}`}>
                {budgetUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${utilizationColor}`}
                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
              <span>Spent: {formatCurrency(project.total_spent, project.contract_currency)}</span>
              {budgetUtilization > PROJECT_CONFIG.BUDGET_THRESHOLDS.warning && (
                <span className="flex items-center text-orange-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Near Limit
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Project Progress</span>
              <span className="text-xs font-bold text-gray-900">{project.progress_percentage || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all"
                style={{ width: `${project.progress_percentage || 0}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={() => navigate(`/procurement/projects/${project.id}`)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
            <button
              onClick={() => navigate(`/procurement/purchase-orders?project=${project.id}`)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              POs
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-blue-600" />
              Project Portfolio Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Professional project-based procurement management and financial tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/finance/invoice-tracker')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Invoice Tracker
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/procurement/projects/new')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Projects"
            value={dashboardStats.total_projects || 0}
            subtitle={`${dashboardStats.active_projects || 0} active`}
            icon={FolderOpen}
            color="#3B82F6"
          />
          <KPICard
            title="Active Projects"
            value={dashboardStats.active_projects || 0}
            subtitle={`${dashboardStats.completed_projects || 0} completed`}
            icon={CheckCircle}
            color="#10B981"
          />
          <KPICard
            title="Total Contract Value"
            value={formatCurrency(dashboardStats.total_contract_value)}
            subtitle="All projects"
            icon={DollarSign}
            color="#8B5CF6"
          />
          <KPICard
            title="Health Status"
            value={`${dashboardStats.health_breakdown?.green || 0}`}
            subtitle={`${dashboardStats.health_breakdown?.yellow || 0} at risk, ${dashboardStats.health_breakdown?.red || 0} critical`}
            icon={BarChart3}
            color="#059669"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="archived">Archived</option>
          </select>

          {/* Health Filter */}
          <select
            value={filters.health_status}
            onChange={(e) => setFilters({ ...filters, health_status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Health Status</option>
            <option value="green">On Track</option>
            <option value="yellow">At Risk</option>
            <option value="red">Critical</option>
          </select>

          {/* Project Type Filter */}
          <select
            value={filters.project_type}
            onChange={(e) => setFilters({ ...filters, project_type: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="engineering">Engineering Services</option>
            <option value="construction">Construction</option>
            <option value="pmc">PMC</option>
            <option value="feed">FEED</option>
            <option value="detailed_design">Detailed Design</option>
            <option value="commissioning">Commissioning</option>
          </select>

          {/* Active Only Toggle */}
          <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.active_only}
              onChange={(e) => setFilters({ ...filters, active_only: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Active Only</span>
          </label>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-600 font-medium">Loading projects...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
          <p className="text-gray-600 mb-6">
            {filters.search || filters.status || filters.health_status || filters.project_type
              ? 'Try adjusting your filters'
              : 'Get started by creating your first project'}
          </p>
          <button
            onClick={() => navigate('/procurement/projects/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create First Project
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {projects.length} Project{projects.length !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={() => {/* TODO: Export functionality */}}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectDashboard;
