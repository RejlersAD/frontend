/**
 * AI Insights Dashboard
 * Real-time AI-powered sales analytics and recommendations
 */

import { useState, useEffect } from 'react';
import salesService from '../../services/sales.service';

const AIInsights = () => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [atRiskClients, setAtRiskClients] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchAIInsights();
    fetchDashboard();
    fetchAtRiskClients();
    fetchLatestForecast();
  }, []);

  const fetchAIInsights = async () => {
    try {
      const data = await salesService.getAIInsights();
      setInsights(data);
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const data = await salesService.getDashboardSummary();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  };

  const fetchAtRiskClients = async () => {
    try {
      const data = await salesService.getAtRiskClients();
      setAtRiskClients(data.results || data);
    } catch (error) {
      console.error('Failed to fetch at-risk clients:', error);
    }
  };

  const fetchLatestForecast = async () => {
    try {
      const data = await salesService.getForecasts({ page_size: 1 });
      if (data.results && data.results.length > 0) {
        setForecast(data.results[0]);
      }
    } catch (error) {
      console.error('Failed to fetch forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForecast = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      
      const forecastData = await salesService.generateForecast({
        period_start: nextMonth.toISOString().split('T')[0],
        period_end: endOfNextMonth.toISOString().split('T')[0],
        include_pipeline: true
      });
      
      setForecast(forecastData);
    } catch (error) {
      console.error('Failed to generate forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  const INSIGHT_ICONS = {
    opportunity: '💡',
    warning: '⚠️',
    success: '✅',
    forecast: '📊',
    recommendation: '🎯'
  };

  const IMPACT_COLORS = {
    high: 'bg-red-50 border-red-200 text-red-900',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    low: 'bg-blue-50 border-blue-200 text-blue-900'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🤖 AI-Powered Insights
            </h1>
            <p className="text-gray-600">
              Real-time analytics, forecasting, and intelligent recommendations
            </p>
          </div>
          <button
            onClick={handleGenerateForecast}
            disabled={loading}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2 disabled:bg-gray-400"
          >
            <span>📊</span>
            Generate New Forecast
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading AI insights...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dashboard Metrics */}
            {dashboardData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-sm font-medium mb-1 opacity-90">Total Revenue</h3>
                  <p className="text-3xl font-bold">
                    ${parseFloat(dashboardData.total_revenue || 0).toLocaleString()}
                  </p>
                  <p className="text-sm mt-2 opacity-75">
                    {dashboardData.active_clients || 0} active clients
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-sm font-medium mb-1 opacity-90">Pipeline Value</h3>
                  <p className="text-3xl font-bold">
                    ${parseFloat(dashboardData.pipeline_value || 0).toLocaleString()}
                  </p>
                  <p className="text-sm mt-2 opacity-75">
                    {dashboardData.active_deals || 0} active deals
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-sm font-medium mb-1 opacity-90">Avg Health Score</h3>
                  <p className="text-3xl font-bold">
                    {dashboardData.average_health_score || 0}/100
                  </p>
                  <p className="text-sm mt-2 opacity-75">
                    Client health metric
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-sm font-medium mb-1 opacity-90">Win Rate</h3>
                  <p className="text-3xl font-bold">
                    {dashboardData.win_rate || 0}%
                  </p>
                  <p className="text-sm mt-2 opacity-75">
                    Closed deals success rate
                  </p>
                </div>
              </div>
            )}

            {/* AI Forecast */}
            {forecast && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg shadow-lg p-6 border-2 border-purple-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-purple-900 mb-1">
                      📊 Revenue Forecast
                    </h2>
                    <p className="text-purple-700">
                      {new Date(forecast.forecast_period_start).toLocaleDateString()} - {new Date(forecast.forecast_period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-purple-700">Confidence</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {forecast.accuracy_score || 0}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                    <p className="text-sm text-purple-700 mb-1">Predicted Revenue</p>
                    <p className="text-2xl font-bold text-purple-900">
                      ${parseFloat(forecast.predicted_revenue || 0).toLocaleString()}
                    </p>
                  </div>
                  
                  {forecast.best_case_scenario && (
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                      <p className="text-sm text-green-700 mb-1">Best Case</p>
                      <p className="text-2xl font-bold text-green-900">
                        ${parseFloat(forecast.best_case_scenario || 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  {forecast.worst_case_scenario && (
                    <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                      <p className="text-sm text-orange-700 mb-1">Worst Case</p>
                      <p className="text-2xl font-bold text-orange-900">
                        ${parseFloat(forecast.worst_case_scenario || 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {forecast.ai_insights && (
                  <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                    <h3 className="font-bold text-purple-900 mb-2">AI Analysis</h3>
                    <p className="text-purple-800">{forecast.ai_insights}</p>
                  </div>
                )}
              </div>
            )}

            {/* AI Insights */}
            {insights && insights.insights && insights.insights.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  💡 AI-Generated Insights
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`rounded-lg shadow-md p-6 border-2 ${IMPACT_COLORS[insight.impact] || IMPACT_COLORS.low}`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-3xl">
                          {INSIGHT_ICONS[insight.insight_type] || '📌'}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-1">{insight.title}</h3>
                          <p className="text-sm opacity-75">{insight.description}</p>
                        </div>
                      </div>

                      {insight.recommendation && (
                        <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                          <p className="text-sm font-medium mb-1">Recommendation:</p>
                          <p className="text-sm">{insight.recommendation}</p>
                        </div>
                      )}

                      {insight.action_items && insight.action_items.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Action Items:</p>
                          <ul className="space-y-1">
                            {insight.action_items.map((action, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span>✓</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-current opacity-50">
                        <span className="text-xs font-medium uppercase">
                          {insight.impact} Impact
                        </span>
                        <span className="text-xs">
                          {insight.confidence ? `${(insight.confidence * 100).toFixed(0)}% confidence` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* At-Risk Clients */}
            {atRiskClients && atRiskClients.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  ⚠️ At-Risk Clients
                </h2>
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">
                          Churn Risk
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">
                          Health Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">
                          Lifetime Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">
                          Last Contact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {atRiskClients.slice(0, 10).map((client) => (
                        <tr key={client.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {client.company_name}
                            </div>
                            <div className="text-sm text-gray-500">{client.client_code}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              client.churn_risk === 'high' ? 'bg-red-100 text-red-800' :
                              client.churn_risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {client.churn_risk.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {client.health_score}/100
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${parseFloat(client.lifetime_value || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {client.last_contact_date ? new Date(client.last_contact_date).toLocaleDateString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tips & Best Practices */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-md p-6 border-2 border-blue-200">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">
                🎯 AI-Powered Sales Tips
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2">📈 Improve Win Rates</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Follow up on proposals within 48 hours</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Focus on high-priority deals in negotiation stage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Leverage AI win probability for resource allocation</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2">💡 Client Retention</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Monitor health scores weekly for early warnings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Contact at-risk clients proactively</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Use AI insights to personalize engagement</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2">🎯 Lead Scoring</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Prioritize leads with scores above 70</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Review AI recommendations for lead qualification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Update lead information to improve AI accuracy</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-2">📊 Forecasting</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Generate monthly forecasts for pipeline planning</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Compare predictions vs actuals for accuracy</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✓</span>
                      <span>Use best/worst case for risk management</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
