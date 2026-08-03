/**
 * Sales Pipeline Page
 * Kanban-style pipeline management with AI-powered insights
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import salesService from '../../services/sales.service';

const SalesPipeline = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pipelineSummary, setPipelineSummary] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    deal_name: '',
    client: '',
    deal_value: '',
    stage: 'lead',
    priority: 'medium',
    expected_close_date: ''
  });

  // Soft-coded pipeline stages
  const DEAL_STAGES = {
    lead: { name: 'Lead', probability: 10, color: 'bg-gray-200 text-gray-800', icon: '📋' },
    qualified: { name: 'Qualified', probability: 25, color: 'bg-blue-200 text-blue-800', icon: '✅' },
    proposal: { name: 'Proposal', probability: 50, color: 'bg-purple-200 text-purple-800', icon: '📄' },
    negotiation: { name: 'Negotiation', probability: 75, color: 'bg-yellow-200 text-yellow-800', icon: '🤝' },
    closed_won: { name: 'Closed Won', probability: 100, color: 'bg-green-200 text-green-800', icon: '🎉' },
    closed_lost: { name: 'Closed Lost', probability: 0, color: 'bg-red-200 text-red-800', icon: '❌' }
  };

  const PRIORITY_COLORS = {
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200'
  };

  useEffect(() => {
    fetchDeals();
    fetchPipelineSummary();
  }, []);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const data = await salesService.getDeals();
      setDeals(data.results || data);
    } catch (error) {
      console.error('Failed to fetch deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineSummary = async () => {
    try {
      const summary = await salesService.getPipelineSummary();
      setPipelineSummary(summary);
    } catch (error) {
      console.error('Failed to fetch pipeline summary:', error);
    }
  };

  const handleViewDeal = async (dealId) => {
    try {
      const deal = await salesService.getDeal(dealId);
      setSelectedDeal(deal);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch deal details:', error);
    }
  };

  const handleMoveDeal = async (dealId, newStage) => {
    try {
      await salesService.moveDealStage(dealId, newStage);
      fetchDeals();
      fetchPipelineSummary();
    } catch (error) {
      console.error('Failed to move deal:', error);
    }
  };

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    try {
      await salesService.createDeal(formData);
      setShowForm(false);
      setFormData({
        deal_name: '',
        client: '',
        deal_value: '',
        stage: 'lead',
        priority: 'medium',
        expected_close_date: ''
      });
      fetchDeals();
      fetchPipelineSummary();
    } catch (error) {
      console.error('Failed to create deal:', error);
    }
  };

  const getDealsByStage = (stage) => {
    return deals.filter(deal => deal.stage === stage);
  };

  const calculateStageValue = (stage) => {
    return getDealsByStage(stage).reduce((sum, deal) => sum + parseFloat(deal.deal_value || 0), 0);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🎯 Sales Pipeline
            </h1>
            <p className="text-gray-600">
              Manage deals across stages with AI-powered win probability
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>➕</span>
            New Deal
          </button>
        </div>

        {/* Pipeline Summary */}
        {pipelineSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Total Pipeline Value</h3>
              <p className="text-3xl font-bold text-gray-900">
                ${parseFloat(pipelineSummary.total_value || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Weighted Value</h3>
              <p className="text-3xl font-bold text-gray-900">
                ${parseFloat(pipelineSummary.weighted_value || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Active Deals</h3>
              <p className="text-3xl font-bold text-gray-900">
                {pipelineSummary.total_deals || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Avg. Deal Size</h3>
              <p className="text-3xl font-bold text-gray-900">
                ${parseFloat(pipelineSummary.average_deal_size || 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Kanban Pipeline Board */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading pipeline...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Object.entries(DEAL_STAGES).map(([stageKey, stage]) => {
              const stageDeals = getDealsByStage(stageKey);
              const stageValue = calculateStageValue(stageKey);
              
              return (
                <div key={stageKey} className="bg-gray-100 rounded-lg p-4 min-h-[500px]">
                  {/* Stage Header */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{stage.icon}</span>
                        <h3 className="font-bold text-gray-900">{stage.name}</h3>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${stage.color}`}>
                        {stageDeals.length}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-semibold">${stageValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Probability:</span>
                        <span className="font-semibold">{stage.probability}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Deal Cards */}
                  <div className="space-y-3">
                    {stageDeals.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No deals in this stage
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-500"
                          onClick={() => handleViewDeal(deal.id)}
                        >
                          <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                            {deal.deal_name}
                          </h4>
                          
                          <div className="text-lg font-bold text-blue-600 mb-2">
                            ${parseFloat(deal.deal_value || 0).toLocaleString()}
                          </div>

                          {deal.client_name && (
                            <p className="text-xs text-gray-600 mb-2">
                              🏢 {deal.client_name}
                            </p>
                          )}

                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PRIORITY_COLORS[deal.priority]}`}>
                              {deal.priority.toUpperCase()}
                            </span>
                            {deal.ai_win_probability && (
                              <span className="text-xs font-semibold text-green-600">
                                {deal.ai_win_probability}% win
                              </span>
                            )}
                          </div>

                          {deal.expected_close_date && (
                            <p className="text-xs text-gray-500">
                              📅 {new Date(deal.expected_close_date).toLocaleDateString()}
                            </p>
                          )}

                          {/* Stage Actions */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <select
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (e.target.value !== stageKey) {
                                  handleMoveDeal(deal.id, e.target.value);
                                }
                              }}
                              value={stageKey}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {Object.entries(DEAL_STAGES).map(([key, s]) => (
                                <option key={key} value={key}>
                                  Move to {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Deal Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Create New Deal</h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreateDeal} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deal Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deal_name}
                      onChange={(e) => setFormData({ ...formData, deal_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="New pipeline installation project"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deal Value *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.deal_value}
                        onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="250000"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Close Date
                      </label>
                      <input
                        type="date"
                        value={formData.expected_close_date}
                        onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage *
                      </label>
                      <select
                        value={formData.stage}
                        onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(DEAL_STAGES).map(([key, stage]) => (
                          <option key={key} value={key}>
                            {stage.icon} {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority *
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Create Deal
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

        {/* Deal Detail Modal */}
        {showModal && selectedDeal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {selectedDeal.deal_name}
                    </h2>
                    <p className="text-gray-500">{selectedDeal.client_name}</p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Deal Value & Stage */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                      <p className="text-sm text-blue-700 mb-1">Deal Value</p>
                      <p className="text-3xl font-bold text-blue-900">
                        ${parseFloat(selectedDeal.deal_value || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                      <p className="text-sm text-green-700 mb-1">Win Probability</p>
                      <p className="text-3xl font-bold text-green-900">
                        {selectedDeal.ai_win_probability || DEAL_STAGES[selectedDeal.stage]?.probability}%
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm text-purple-700 mb-1">Current Stage</p>
                      <p className="text-xl font-bold text-purple-900">
                        {DEAL_STAGES[selectedDeal.stage]?.name}
                      </p>
                    </div>
                  </div>

                  {/* Deal Details */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">Deal Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Priority</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${PRIORITY_COLORS[selectedDeal.priority]}`}>
                          {selectedDeal.priority.toUpperCase()}
                        </span>
                      </div>
                      {selectedDeal.expected_close_date && (
                        <div>
                          <p className="text-sm text-gray-500">Expected Close Date</p>
                          <p className="text-gray-900">
                            {new Date(selectedDeal.expected_close_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {selectedDeal.service_category && (
                        <div>
                          <p className="text-sm text-gray-500">Service Category</p>
                          <p className="text-gray-900">{selectedDeal.service_category}</p>
                        </div>
                      )}
                      {selectedDeal.deal_owner_name && (
                        <div>
                          <p className="text-sm text-gray-500">Deal Owner</p>
                          <p className="text-gray-900">{selectedDeal.deal_owner_name}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  {selectedDeal.ai_recommended_actions && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-200">
                      <h3 className="font-bold text-purple-900 mb-3 text-lg">🤖 AI Recommendations</h3>
                      <div className="space-y-2">
                        {selectedDeal.ai_recommended_actions.map((action, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-purple-600">✓</span>
                            <span className="text-purple-900">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedDeal.description && (
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-700">{selectedDeal.description}</p>
                    </div>
                  )}
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

export default SalesPipeline;
