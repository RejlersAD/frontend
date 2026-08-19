import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../config/api.config';
import { isUserAdmin } from '../utils/rbac.utils';
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  UsersIcon,
  ServerIcon,
  ChartBarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

/**
 * Subscription Management Page
 * Displays all subscription plans, features, and user subscriptions
 */
const SubscriptionManagement = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('plans');

  // Check admin access
  // Smart admin check using utility function
  const isAdmin = isUserAdmin(user);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Load subscription plans
      const plansResponse = await fetch(`${API_BASE_URL}/subscriptions/plans/`, { headers });
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.results || plansData);
      }

      // Load user subscriptions
      const subsResponse = await fetch(`${API_BASE_URL}/subscriptions/subscriptions/`, { headers });
      if (subsResponse.ok) {
        const subsData = await subsResponse.json();
        setSubscriptions(subsData.results || subsData);
      }

      // Load dashboard stats
      const statsResponse = await fetch(`${API_BASE_URL}/subscriptions/dashboard/stats/`, { headers });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeColor = (planType) => {
    const colors = {
      'free': 'bg-gray-100 text-gray-700 border-gray-300',
      'basic': 'bg-blue-100 text-blue-700 border-blue-300',
      'professional': 'bg-purple-100 text-purple-700 border-purple-300',
      'enterprise': 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-500'
    };
    return colors[planType] || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>,
      'trial': <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Trial</span>,
      'expired': <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Expired</span>,
      'cancelled': <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Cancelled</span>
    };
    return badges[status] || status;
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <CurrencyDollarIcon className="w-10 h-10 text-blue-600" />
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Subscription Management
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Manage subscription plans, features, and user subscriptions
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-blue-600"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Total Plans</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.total_plans || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.active_plans || 0} active</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <SparklesIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Active Subscriptions</p>
                  <p className="text-3xl font-bold text-green-600">{stats.active_subscriptions || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.trial_subscriptions || 0} on trial</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-purple-600">${(stats.total_revenue || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Monthly recurring</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.total_subscribers || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Subscribed users</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-6 py-4 text-sm font-medium transition-all ${
                activeTab === 'plans'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-gradient-to-t from-blue-50 to-transparent'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-6 py-4 text-sm font-medium transition-all ${
                activeTab === 'subscriptions'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-gradient-to-t from-blue-50 to-transparent'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              User Subscriptions
            </button>
          </div>

          {/* Plans Tab */}
          {activeTab === 'plans' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative bg-white rounded-xl border-2 p-6 hover:shadow-xl transition-all ${
                      plan.plan_type === 'enterprise' ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50' : 'border-gray-200'
                    }`}
                  >
                    {/* Plan Badge */}
                    {plan.badge && (
                      <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getPlanBadgeColor(plan.plan_type)}`}>
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    {/* Plan Info */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.display_name || plan.name}</h3>
                      <div className="flex items-baseline space-x-2 mb-2">
                        <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                        <span className="text-gray-600">/{plan.billing_cycle}</span>
                      </div>
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    </div>

                    {/* Limits */}
                    <div className="space-y-2 mb-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Users:</span>
                        <span className="font-semibold text-gray-900">
                          {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Storage:</span>
                        <span className="font-semibold text-gray-900">
                          {plan.max_storage_gb === -1 ? 'Unlimited' : `${plan.max_storage_gb} GB`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Projects:</span>
                        <span className="font-semibold text-gray-900">
                          {plan.max_projects === -1 ? 'Unlimited' : plan.max_projects}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">API Calls:</span>
                        <span className="font-semibold text-gray-900">
                          {plan.max_api_calls_per_day === -1 ? 'Unlimited' : `${plan.max_api_calls_per_day}/day`}
                        </span>
                      </div>
                    </div>

                    {/* Features */}
                    {plan.features && Object.keys(plan.features).length > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">KEY FEATURES:</p>
                        <div className="space-y-1">
                          {Object.entries(plan.features).slice(0, 3).map(([key, value]) => (
                            value && (
                              <div key={key} className="flex items-center space-x-2">
                                <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span className="text-xs text-gray-600">{key.replace(/_/g, ' ')}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {plan.is_active ? (
                        <span className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-gray-400 text-sm font-medium">
                          <XCircleIcon className="w-4 h-4" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscriptions Tab */}
          {activeTab === 'subscriptions' && (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Start Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">End Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {sub.user_email || sub.user?.email || `User #${sub.user}`}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor(sub.plan_type)}`}>
                            {sub.plan_name || sub.plan?.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(sub.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          ${sub.current_price || 0}
                        </td>
                      </tr>
                    ))}
                    {subscriptions.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                          No subscriptions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={`${API_BASE_URL.replace('/api', '')}/admin/rbac/subscriptionplan/`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-blue-100 hover:border-blue-300"
          >
            <div className="flex items-center space-x-3">
              <ServerIcon className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-bold text-gray-900">Django Admin</p>
                <p className="text-sm text-gray-600">Manage plans in detail</p>
              </div>
            </div>
          </a>

          <button
            onClick={() => window.open(`${API_BASE_URL}/subscriptions/plans/`, '_blank')}
            className="p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-purple-100 hover:border-purple-300 text-left w-full"
          >
            <div className="flex items-center space-x-3">
              <ChartBarIcon className="w-8 h-8 text-purple-600" />
              <div>
                <p className="font-bold text-gray-900">View Plans API</p>
                <p className="text-sm text-gray-600">JSON response of all plans</p>
              </div>
            </div>
          </button>

          <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200">
            <div className="flex items-center space-x-3">
              <SparklesIcon className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-bold text-gray-900">Documentation</p>
                <p className="text-sm text-gray-600">backend/apps/rbac/SUBSCRIPTION_GUIDE.md</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;
