import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api.service';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Users,
  Calendar,
  MapPin,
  Briefcase,
  PieChart,
  BarChart3,
  Receipt,
  Package,
  RefreshCw,
  Edit,
  ExternalLink
} from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch project details
  const fetchProjectDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/procurement/projects/${id}/`);
      setProject(response.data);
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch financial summary
  const fetchFinancialSummary = async () => {
    try {
      const response = await apiClient.get(`/procurement/projects/${id}/financial_summary/`);
      setFinancialSummary(response.data);
    } catch (err) {
      console.error('Error fetching financial summary:', err);
    }
  };

  // Fetch purchase orders
  const fetchPurchaseOrders = async () => {
    try {
      const response = await apiClient.get(`/procurement/projects/${id}/purchase_orders/`);
      setPurchaseOrders(response.data.results || response.data);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProjectDetail();
      fetchFinancialSummary();
      fetchPurchaseOrders();
    }
  }, [id]);

  // Format currency
  const formatCurrency = (amount, currency = 'AED') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Stat Card Component
  const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-5 h-5" style={{ color }} />
            <p className="text-sm text-gray-600 font-medium">{title}</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center text-xs">
          <span className={trend > 0 ? 'text-red-600' : 'text-green-600'}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs budget
          </span>
        </div>
      )}
    </div>
  );

  // Budget Category Card
  const BudgetCategoryCard = ({ budget }) => {
    const utilization = budget.utilization_percentage || 0;
    const isOverBudget = budget.is_over_budget;
    const barColor = isOverBudget ? 'bg-red-500' : utilization > 80 ? 'bg-yellow-500' : 'bg-green-500';

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-medium text-gray-900">{budget.category.replace('_', ' ').toUpperCase()}</h4>
            {budget.sub_category && (
              <p className="text-xs text-gray-500 mt-1">{budget.sub_category}</p>
            )}
          </div>
          {isOverBudget && (
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
              Over Budget
            </span>
          )}
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Allocated:</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(budget.allocated_amount, budget.currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Spent:</span>
            <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCurrency(budget.spent_amount, budget.currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Remaining:</span>
            <span className={`font-semibold ${budget.remaining_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(budget.remaining_amount, budget.currency)}
            </span>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Utilization</span>
            <span className={`text-xs font-bold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
              {utilization.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
        </div>

        {budget.is_approved ? (
          <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
            <CheckCircle className="w-3 h-3" />
            <span>Approved</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-yellow-600 mt-2">
            <Clock className="w-3 h-3" />
            <span>Pending Approval</span>
          </div>
        )}
      </div>
    );
  };

  // Purchase Order Row
  const PurchaseOrderRow = ({ po }) => (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
        {po.po_number}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {po.vendor_name || 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatCurrency(po.total_value, po.currency)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          po.status === 'approved' ? 'bg-green-100 text-green-800' :
          po.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          po.status === 'draft' ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
          {po.status.toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          po.invoice_status === 'fully_invoiced' ? 'bg-green-100 text-green-800' :
          po.invoice_status === 'partially_invoiced' ? 'bg-blue-100 text-blue-800' :
          po.invoice_status === 'over_invoiced' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {(po.invoice_status || 'not_invoiced').replace('_', ' ').toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(po.created_at)}
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600 font-medium">Loading project...</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Project</h2>
          <p className="text-gray-600 mb-6">{error || 'Project not found'}</p>
          <button
            onClick={() => navigate('/procurement/projects')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/procurement/projects')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Projects</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/procurement/projects/${id}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit Project
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.project_name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {project.project_number}
                </span>
                {project.client_name && (
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {project.client_name}
                  </span>
                )}
                {project.site_location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {project.site_location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                project.status === 'active' ? 'bg-green-100 text-green-800' :
                project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                project.health_status === 'green' ? 'bg-green-100 text-green-800' :
                project.health_status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {project.health_status === 'green' ? 'On Track' :
                 project.health_status === 'yellow' ? 'At Risk' : 'Critical'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6 border-b border-gray-200">
            {['overview', 'budgets', 'purchase-orders', 'invoices'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-2 font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.replace('-', ' ').toUpperCase()}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && financialSummary && (
          <div className="space-y-8">
            {/* Financial KPIs */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Contract Value"
                  value={formatCurrency(project.contract_value, project.contract_currency)}
                  icon={DollarSign}
                  color="#3B82F6"
                />
                <StatCard
                  title="Total Budget"
                  value={formatCurrency(financialSummary.budget_stats.total_budget)}
                  subtitle={`${financialSummary.budget_stats.approved_budgets} approved`}
                  icon={PieChart}
                  color="#10B981"
                />
                <StatCard
                  title="Total Spent"
                  value={formatCurrency(financialSummary.budget_stats.total_spent)}
                  subtitle={`${financialSummary.po_stats.total_pos} purchase orders`}
                  icon={TrendingUp}
                  color="#8B5CF6"
                  trend={((financialSummary.budget_stats.total_spent / financialSummary.budget_stats.total_budget - 1) * 100).toFixed(1)}
                />
                <StatCard
                  title="Remaining Budget"
                  value={formatCurrency(financialSummary.budget_stats.remaining_budget)}
                  subtitle={`${financialSummary.budget_stats.budget_utilization.toFixed(1)}% utilized`}
                  icon={BarChart3}
                  color={financialSummary.budget_stats.remaining_budget < 0 ? '#EF4444' : '#059669'}
                />
              </div>
            </div>

            {/* Project Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Project Timeline
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium text-gray-900">{formatDate(project.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Planned End:</span>
                    <span className="font-medium text-gray-900">{formatDate(project.planned_end_date)}</span>
                  </div>
                  {project.actual_end_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual End:</span>
                      <span className="font-medium text-gray-900">{formatDate(project.actual_end_date)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Progress:</span>
                      <span className="font-bold text-gray-900">{project.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full"
                        style={{ width: `${project.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Team & Stakeholders
                </h3>
                <div className="space-y-3">
                  {project.project_manager_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Project Manager:</span>
                      <span className="font-medium text-gray-900">{project.project_manager_name}</span>
                    </div>
                  )}
                  {project.lead_engineer_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lead Engineer:</span>
                      <span className="font-medium text-gray-900">{project.lead_engineer_name}</span>
                    </div>
                  )}
                  {project.team_member_names && project.team_member_names.length > 0 && (
                    <div>
                      <span className="text-gray-600 block mb-2">Team Members:</span>
                      <div className="flex flex-wrap gap-2">
                        {project.team_member_names.map((name, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budgets' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Budget Breakdown by Category</h2>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Add Budget
              </button>
            </div>
            {project.budgets && project.budgets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {project.budgets.map((budget) => (
                  <BudgetCategoryCard key={budget.id} budget={budget} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <PieChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Budgets Allocated</h3>
                <p className="text-gray-600 mb-6">Start by creating budget allocations for this project</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'purchase-orders' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Purchase Orders</h2>
              <button
                onClick={() => navigate('/procurement/purchase-orders/new')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Create PO
              </button>
            </div>
            {purchaseOrders.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseOrders.map((po) => (
                      <PurchaseOrderRow key={po.id} po={po} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Purchase Orders</h3>
                <p className="text-gray-600 mb-6">No purchase orders have been created for this project yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Invoice Reconciliation</h2>
              <button
                onClick={() => navigate('/finance/invoice-tracker')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Invoice Tracker
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Invoice Integration</h3>
              <p className="text-gray-600 mb-6">
                View and manage invoices in the Invoice Tracker with automatic PO reconciliation
              </p>
              <button
                onClick={() => navigate('/finance/invoice-tracker')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
              >
                <ExternalLink className="w-5 h-5" />
                Go to Invoice Tracker
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
