import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PREDICTIVE_MODELS, AI_INSIGHTS } from '../../config/reportGenerator.config';
import { REJLERS_COLORS } from '../../config/theme.config';

/**
 * ============================================
 * PREDICTIVE INSIGHTS COMPONENT
 * ============================================
 * 
 * AI-powered predictive analytics with forecasting,
 * anomaly detection, and strategic recommendations.
 */

const PredictiveInsights = () => {
  const [selectedModel, setSelectedModel] = useState('userGrowth');
  const [timeHorizon, setTimeHorizon] = useState('1_month');
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate loading predictions
  useEffect(() => {
    loadPredictions();
  }, [selectedModel, timeHorizon]);

  const loadPredictions = () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const mockPredictions = generateMockPredictions(selectedModel, timeHorizon);
      setPredictions(mockPredictions);
      setIsLoading(false);
    }, 1500);
  };

  const generateMockPredictions = (modelId, horizon) => {
    const model = PREDICTIVE_MODELS[modelId];
    const predictions = [];

    // Generate sample predictions based on model type
    if (modelId === 'userGrowth') {
      predictions.push({
        metric: 'Total Users',
        current: 98,
        predicted: 145,
        change: '+47.96%',
        confidence: 92,
        trend: 'up',
        factors: model.factors
      });
      predictions.push({
        metric: 'Active Users',
        current: 76,
        predicted: 115,
        change: '+51.32%',
        confidence: 89,
        trend: 'up',
        factors: model.factors
      });
    } else if (modelId === 'featureAdoption') {
      predictions.push({
        metric: 'Sales Module Adoption',
        current: 45,
        predicted: 72,
        change: '+60.00%',
        confidence: 88,
        trend: 'up',
        factors: model.factors
      });
      predictions.push({
        metric: 'QHSE Module Adoption',
        current: 68,
        predicted: 85,
        change: '+25.00%',
        confidence: 91,
        trend: 'up',
        factors: model.factors
      });
    } else if (modelId === 'churnPrediction') {
      predictions.push({
        metric: 'At-Risk Users',
        current: 8,
        predicted: 12,
        change: '+50.00%',
        confidence: 91,
        trend: 'warning',
        factors: model.factors,
        actionable: true
      });
      predictions.push({
        metric: 'Churn Rate',
        current: '8.2%',
        predicted: '12.2%',
        change: '+4.0 pp',
        confidence: 87,
        trend: 'warning',
        factors: model.factors,
        actionable: true
      });
    } else if (modelId === 'performanceAnomaly') {
      predictions.push({
        metric: 'API Response Time',
        current: '185ms',
        predicted: '210ms',
        change: '+13.51%',
        confidence: 94,
        trend: 'warning',
        factors: model.factors
      });
    } else if (modelId === 'resourcePlanning') {
      predictions.push({
        metric: 'Server Capacity',
        current: '68%',
        predicted: '89%',
        change: '+21 pp',
        confidence: 89,
        trend: 'warning',
        factors: model.factors
      });
      predictions.push({
        metric: 'Storage Usage',
        current: '142 GB',
        predicted: '215 GB',
        change: '+51.41%',
        confidence: 86,
        trend: 'up',
        factors: model.factors
      });
    } else if (modelId === 'revenueImpact') {
      predictions.push({
        metric: 'Cost Savings',
        current: '245,000 SEK',
        predicted: '380,000 SEK',
        change: '+55.10%',
        confidence: 87,
        trend: 'up',
        factors: model.factors
      });
      predictions.push({
        metric: 'ROI',
        current: '178%',
        predicted: '245%',
        change: '+67 pp',
        confidence: 84,
        trend: 'up',
        factors: model.factors
      });
    }

    return predictions;
  };

  const renderModelSelector = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(PREDICTIVE_MODELS).map(([key, model]) => (
          <div
            key={key}
            onClick={() => setSelectedModel(key)}
            className={`p-6 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
              selectedModel === key
                ? 'border-green-500 bg-green-50 shadow-lg transform scale-105'
                : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{model.icon}</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  model.confidence === 'very_high'
                    ? 'bg-green-100 text-green-700'
                    : model.confidence === 'high'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {model.accuracy}% Accurate
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {model.name}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {model.description}
            </p>

            <div className="space-y-2">
              <div className="flex items-center text-xs text-gray-500">
                <span className="mr-2">🤖</span>
                <span>{model.algorithm}</span>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <span className="mr-2">📊</span>
                <span>{model.type.replace('_', ' ')}</span>
              </div>
              {model.actionable && (
                <div className="flex items-center text-xs font-semibold text-purple-600">
                  <span className="mr-2">⚡</span>
                  <span>Actionable Insights</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTimeHorizonSelector = () => {
    const horizons = PREDICTIVE_MODELS[selectedModel]?.timeHorizons || [];
    
    const horizonLabels = {
      'real_time': 'Real-time',
      '1_hour': '1 Hour',
      '24_hours': '24 Hours',
      '1_week': '1 Week',
      '2_weeks': '2 Weeks',
      '1_month': '1 Month',
      '3_months': '3 Months',
      '6_months': '6 Months',
      '1_year': '1 Year',
      '1_quarter': '1 Quarter'
    };

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📅 Prediction Time Horizon</h3>
        <div className="flex flex-wrap gap-3">
          {horizons.map((horizon) => (
            <button
              key={horizon}
              onClick={() => setTimeHorizon(horizon)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                timeHorizon === horizon
                  ? 'text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={{
                backgroundColor: timeHorizon === horizon ? REJLERS_COLORS.secondary.green.base : undefined
              }}
            >
              {horizonLabels[horizon]}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderPredictions = () => {
    if (isLoading) {
      return (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4 animate-bounce">🔮</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Data</h3>
          <p className="text-gray-600">AI is generating predictions...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {predictions.map((prediction, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${
              prediction.trend === 'up'
                ? 'border-green-500'
                : prediction.trend === 'warning'
                ? 'border-yellow-500'
                : 'border-red-500'
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Prediction */}
              <div className="lg:col-span-2">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {prediction.metric}
                    </h3>
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm text-gray-500">Current</p>
                        <p className="text-xl font-semibold text-gray-700">
                          {prediction.current}
                        </p>
                      </div>
                      <div className="text-2xl">→</div>
                      <div>
                        <p className="text-sm text-gray-500">Predicted</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {prediction.predicted}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Change</p>
                        <p className={`text-xl font-bold ${
                          prediction.trend === 'up'
                            ? 'text-green-600'
                            : prediction.trend === 'warning'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {prediction.change}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Confidence</p>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${prediction.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {prediction.confidence}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contributing Factors */}
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Contributing Factors:
                  </h4>
                  <div className="space-y-2">
                    {prediction.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-700">{factor.name}</span>
                            <span className="text-xs text-gray-500">
                              {(factor.weight * 100).toFixed(0)}% weight
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${factor.weight * 100}%`,
                                background: `linear-gradient(to right, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.turbine.base})`
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions & Recommendations */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  💡 Recommendations
                </h4>
                <div className="space-y-3">
                  {prediction.actionable && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-yellow-800 mb-1">
                        ⚠️ Action Required
                      </p>
                      <p className="text-xs text-yellow-700">
                        Immediate intervention recommended to prevent negative outcomes
                      </p>
                    </div>
                  )}
                  
                  <button
                    className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-semibold"
                    onClick={() => alert('Viewing detailed analysis...')}
                  >
                    📊 Detailed Analysis
                  </button>
                  
                  <button
                    className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all text-sm font-semibold"
                    onClick={() => alert('Creating action plan...')}
                  >
                    📋 Create Action Plan
                  </button>
                  
                  <button
                    className="w-full py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold"
                    onClick={() => alert('Exporting prediction...')}
                  >
                    📤 Export Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderModelDetails = () => {
    const model = PREDICTIVE_MODELS[selectedModel];
    
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-4xl">{model.icon}</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{model.name}</h2>
              <p className="text-gray-600">{model.description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-500">Algorithm</p>
            <p className="text-lg font-semibold text-gray-900">{model.algorithm}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Model Type</p>
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {model.type.replace('_', ' ')}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Accuracy</p>
            <p className="text-lg font-semibold text-green-600">{model.accuracy}%</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Confidence</p>
            <p className="text-lg font-semibold text-blue-600 capitalize">
              {model.confidence.replace('_', ' ')}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Factors</p>
            <p className="text-lg font-semibold text-purple-600">
              {model.factors.length}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              to="/admin/reports"
              className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
            >
              ← Back to Report Generator
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🔮 Predictive Insights
            </h1>
            <p className="text-lg text-gray-600">
              AI-powered forecasting and predictive analytics
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={loadPredictions}
              className="px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg transform hover:-translate-y-0.5"
              style={{ backgroundColor: REJLERS_COLORS.secondary.green.base }}
            >
              🔄 Refresh Predictions
            </button>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Select Prediction Model
        </h2>
        {renderModelSelector()}
      </div>

      {/* Model Details */}
      {renderModelDetails()}

      {/* Time Horizon */}
      {renderTimeHorizonSelector()}

      {/* Predictions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Prediction Results
        </h2>
        {renderPredictions()}
      </div>

      {/* Additional Insights */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🎯 Strategic Recommendations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="text-3xl mb-3">💡</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Growth Opportunities
            </h3>
            <p className="text-sm text-gray-700">
              Based on current trends, focus on Sales and Finance modules for maximum ROI.
              User engagement is strong and ready for expansion.
            </p>
          </div>
          
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Risk Mitigation
            </h3>
            <p className="text-sm text-gray-700">
              Monitor server capacity closely. Consider infrastructure upgrades before
              reaching 90% utilization to prevent performance degradation.
            </p>
          </div>
          
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="text-3xl mb-3">🚀</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Optimization Priorities
            </h3>
            <p className="text-sm text-gray-700">
              API response times can be significantly improved. Implementing caching
              strategies could reduce load times by 15-20%.
            </p>
          </div>
          
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Resource Planning
            </h3>
            <p className="text-sm text-gray-700">
              Plan for team expansion by Q3 2026. Predicted user growth will require
              2-3 additional team members to maintain service quality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveInsights;
