/**
 * Client Management (CRM) Page
 * Comprehensive client relationship management with AI-powered insights
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import salesService from '../../services/sales.service';

const ClientManagement = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    industry_type: '',
    client_tier: '',
    status: 'active'
  });
  const [formData, setFormData] = useState({
    client_code: '',
    company_name: '',
    industry_type: 'oil_gas',
    client_tier: 'bronze',
    email: '',
    phone: '',
    website: '',
    status: 'active'
  });

  // Soft-coded configurations
  const INDUSTRY_TYPES = {
    oil_gas: { name: 'Oil & Gas', icon: '🔥', color: 'red' },
    petrochemical: { name: 'Petrochemical', icon: '⚗️', color: 'purple' },
    power_generation: { name: 'Power & Utilities', icon: '⚡', color: 'yellow' },
    water_treatment: { name: 'Water & Wastewater', icon: '💧', color: 'blue' },
    manufacturing: { name: 'Manufacturing', icon: '⚙️', color: 'gray' },
    construction: { name: 'Construction & EPC', icon: '🏗️', color: 'orange' },
    mining: { name: 'Mining & Minerals', icon: '🗿', color: 'brown' },
    pharmaceutical: { name: 'Pharmaceutical', icon: '💊', color: 'green' },
    food_beverage: { name: 'Food & Beverage', icon: '🛒', color: 'lime' },
    government: { name: 'Government & Public Sector', icon: '🛡️', color: 'blue' },
    other: { name: 'Other', icon: '⋯', color: 'gray' }
  };

  const CLIENT_TIERS = {
    platinum: { name: 'Platinum', color: 'text-gray-400', bg: 'bg-gray-100' },
    gold: { name: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-100' },
    silver: { name: 'Silver', color: 'text-gray-500', bg: 'bg-gray-200' },
    bronze: { name: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-100' }
  };

  const CHURN_RISK_COLORS = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200'
  };

  useEffect(() => {
    fetchClients();
  }, [filters]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await salesService.getClients(filters);
      setClients(data.results || data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClient = async (clientId) => {
    try {
      const client = await salesService.getClient(clientId);
      setSelectedClient(client);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch client details:', error);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await salesService.createClient(formData);
      setShowForm(false);
      setFormData({
        client_code: '',
        company_name: '',
        industry_type: 'oil_gas',
        client_tier: 'bronze',
        email: '',
        phone: '',
        website: '',
        status: 'active'
      });
      fetchClients();
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  const handleCalculateHealth = async (clientId) => {
    try {
      const result = await salesService.calculateHealthScore(clientId);
      alert(`Health Score: ${result.health_score}/100\nStatus: ${result.status}`);
      fetchClients();
    } catch (error) {
      console.error('Failed to calculate health score:', error);
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              👥 Client Management
            </h1>
            <p className="text-gray-600">
              Comprehensive CRM with AI-powered health scoring and churn prediction
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>➕</span>
            Add New Client
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="🔍 Search clients..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filters.industry_type}
              onChange={(e) => setFilters({ ...filters, industry_type: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Industries</option>
              {Object.entries(INDUSTRY_TYPES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.icon} {value.name}
                </option>
              ))}
            </select>
            <select
              value={filters.client_tier}
              onChange={(e) => setFilters({ ...filters, client_tier: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Tiers</option>
              {Object.entries(CLIENT_TIERS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
              <option value="former">Former Client</option>
            </select>
          </div>
        </div>

        {/* Client List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No clients found</p>
            <p className="text-gray-400">Add your first client to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewClient(client.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {INDUSTRY_TYPES[client.industry_type]?.icon || '🏢'}
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {client.company_name}
                        </h3>
                        <p className="text-sm text-gray-500">{client.client_code}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {/* Client Tier */}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${CLIENT_TIERS[client.client_tier]?.bg} ${CLIENT_TIERS[client.client_tier]?.color}`}>
                        {CLIENT_TIERS[client.client_tier]?.name}
                      </span>

                      {/* Industry */}
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {INDUSTRY_TYPES[client.industry_type]?.name}
                      </span>

                      {/* Churn Risk */}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${CHURN_RISK_COLORS[client.churn_risk]}`}>
                        {client.churn_risk.toUpperCase()} Risk
                      </span>

                      {/* Status */}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {client.status}
                      </span>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className="text-right ml-4">
                    <div className={`text-3xl font-bold ${getHealthScoreColor(client.health_score)}`}>
                      {client.health_score}
                    </div>
                    <p className="text-sm text-gray-500">Health Score</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCalculateHealth(client.id);
                      }}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      Recalculate
                    </button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-500">Lifetime Value</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${parseFloat(client.lifetime_value || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Annual Revenue</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${parseFloat(client.annual_revenue || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Employee Count</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {client.employee_count || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Client Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Add New Client</h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.client_code}
                        onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CLT-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Acme Corporation"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Industry Type *
                      </label>
                      <select
                        value={formData.industry_type}
                        onChange={(e) => setFormData({ ...formData, industry_type: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(INDUSTRY_TYPES).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.icon} {value.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client Tier *
                      </label>
                      <select
                        value={formData.client_tier}
                        onChange={(e) => setFormData({ ...formData, client_tier: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(CLIENT_TIERS).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="contact@company.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+971 12 345 6789"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://company.com"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Create Client
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Client Detail Modal */}
        {showModal && selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {selectedClient.company_name}
                    </h2>
                    <p className="text-gray-500">{selectedClient.client_code}</p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* AI Metrics */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-200">
                    <h3 className="font-bold text-blue-900 mb-4 text-lg">🤖 AI Insights</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-blue-700">Health Score</p>
                        <p className={`text-3xl font-bold ${getHealthScoreColor(selectedClient.health_score)}`}>
                          {selectedClient.health_score}/100
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">Churn Risk</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {selectedClient.churn_risk.toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">Lifetime Value</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${parseFloat(selectedClient.lifetime_value || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Contact Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedClient.email && (
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="text-gray-900">{selectedClient.email}</p>
                        </div>
                      )}
                      {selectedClient.phone && (
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="text-gray-900">{selectedClient.phone}</p>
                        </div>
                      )}
                      {selectedClient.website && (
                        <div>
                          <p className="text-sm text-gray-500">Website</p>
                          <a
                            href={selectedClient.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {selectedClient.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company Details */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Company Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Industry</p>
                        <p className="text-gray-900">
                          {INDUSTRY_TYPES[selectedClient.industry_type]?.icon}{' '}
                          {INDUSTRY_TYPES[selectedClient.industry_type]?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Tier</p>
                        <p className="text-gray-900">
                          {CLIENT_TIERS[selectedClient.client_tier]?.name}
                        </p>
                      </div>
                      {selectedClient.employee_count && (
                        <div>
                          <p className="text-sm text-gray-500">Employee Count</p>
                          <p className="text-gray-900">{selectedClient.employee_count}</p>
                        </div>
                      )}
                      {selectedClient.annual_revenue && (
                        <div>
                          <p className="text-sm text-gray-500">Annual Revenue</p>
                          <p className="text-gray-900">
                            ${parseFloat(selectedClient.annual_revenue).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientManagement;
