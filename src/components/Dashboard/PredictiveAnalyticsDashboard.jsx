/**
 * ==================================================================================
 * PREDICTIVE ANALYTICS DASHBOARD - INTELLIGENT FORECASTING
 * ==================================================================================
 * Advanced dashboard with ML-powered predictions, anomaly detection, and insights.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChartBarIcon,
  SparklesIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CpuChipIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../config/api.config';
import {
  PREDICTION_MODELS,
  PREDICTION_METRICS,
  INSIGHT_TYPES,
  forecastNextDays,
  detectAnomalies,
  generateInsights,
  calculateConfidenceInterval
} from '../../config/predictiveAnalytics.config';

/**
 * Error Boundary Component for safe rendering
 */
class PredictiveAnalyticsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PredictiveAnalyticsDashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
          <div className="text-red-600 text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Component Error</h3>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all shadow-sm"
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const PredictiveAnalyticsDashboard = ({ refreshInterval = 60000 }) => {
  const [predictions, setPredictions] = useState({});
  const [insights, setInsights] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('document_uploads');
  const [selectedModel, setSelectedModel] = useState('linear_regression');
  const [liveMode, setLiveMode] = useState(true);
  const [error, setError] = useState(null);

  console.log('[PredictiveAnalytics] Component mounted');

  /**
   * Fetch predictive analytics data
   */
  const fetchPredictiveData = useCallback(async () => {
    console.log('[PredictiveAnalytics] Fetching data...');
    try {
      setError(null); // Clear any previous errors
      
      // Get authentication token from localStorage
      const token = localStorage.getItem('access_token');
      
      console.log('[PredictiveAnalytics] Token found:', !!token);
      
      if (!token) {
        console.warn('[PredictiveAnalytics] No authentication token found');
        setError('Authentication required. Please log in.');
        setLoading(false);
        return;
      }
      
      const url = `${API_BASE_URL}/analytics/predictions/`;
      console.log('[PredictiveAnalytics] Fetching from:', url);
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('[PredictiveAnalytics] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[PredictiveAnalytics] Data received:', data);
        
        // Safety check for data
        if (!data || !data.historical) {
          console.warn('[PredictiveAnalytics] No historical data in response');
          setError('No data available from server');
          setLoading(false);
          return;
        }
        
        // Process predictions for each metric
        const processedPredictions = {};
        
        PREDICTION_METRICS.forEach(metric => {
          try {
            const historicalData = data.historical?.[metric.id] || [];
            // Use selectedModel for forecasting, allowing dynamic model switching
            const activeModel = selectedModel || metric.model;
            const forecastData = forecastNextDays(historicalData, activeModel, metric.forecastDays);
            const detectedAnomalies = detectAnomalies(historicalData);
            const confidenceInterval = calculateConfidenceInterval(forecastData, 0.95);
            
            processedPredictions[metric.id] = {
              historical: historicalData,
              forecast: forecastData,
              confidence: confidenceInterval,
              anomalies: detectedAnomalies,
              model: activeModel,
              accuracy: PREDICTION_MODELS[activeModel?.toUpperCase()]?.accuracy || 75
            };
          } catch (metricError) {
            console.error(`Error processing metric ${metric.id}:`, metricError);
          }
        });
        
        setPredictions(processedPredictions);
        
        // Generate intelligent insights
        const currentMetric = processedPredictions[selectedMetric];
        if (currentMetric) {
          try {
            const generatedInsights = generateInsights(
              currentMetric.historical,
              currentMetric.forecast,
              currentMetric.anomalies
            );
            setInsights(generatedInsights);
            setAnomalies(currentMetric.anomalies);
          } catch (insightError) {
            console.error('Error generating insights:', insightError);
          }
        }
      }
    } catch (error) {
      console.error('Predictive analytics fetch error:', error);
      setError(error.message || 'Failed to load predictive analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, selectedModel]);

  // Auto-refresh
  useEffect(() => {
    fetchPredictiveData();
    
    if (liveMode) {
      const interval = setInterval(fetchPredictiveData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPredictiveData, liveMode, refreshInterval, selectedModel]);

  /**
   * Get color classes for metric (soft-coded)
   */
  const getMetricColorClasses = (color, isSelected) => {
    const colorMap = {
      blue: {
        bg: isSelected ? 'bg-blue-50' : 'bg-white',
        border: isSelected ? 'border-blue-500' : 'border-gray-200',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
        chart: 'bg-blue-400'
      },
      purple: {
        bg: isSelected ? 'bg-purple-50' : 'bg-white',
        border: isSelected ? 'border-purple-500' : 'border-gray-200',
        iconBg: 'bg-purple-100',
        iconText: 'text-purple-600',
        chart: 'bg-purple-400'
      },
      emerald: {
        bg: isSelected ? 'bg-emerald-50' : 'bg-white',
        border: isSelected ? 'border-emerald-500' : 'border-gray-200',
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600',
        chart: 'bg-emerald-400'
      },
      green: {
        bg: isSelected ? 'bg-green-50' : 'bg-white',
        border: isSelected ? 'border-green-500' : 'border-gray-200',
        iconBg: 'bg-green-100',
        iconText: 'text-green-600',
        chart: 'bg-green-400'
      },
      amber: {
        bg: isSelected ? 'bg-amber-50' : 'bg-white',
        border: isSelected ? 'border-amber-500' : 'border-gray-200',
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-600',
        chart: 'bg-amber-400'
      }
    };
    return colorMap[color] || colorMap.blue;
  };

  /**
   * Render prediction card
   */
  const renderPredictionCard = (metric) => {
    const prediction = predictions[metric.id];
    if (!prediction) return null;

    const latestHistorical = prediction.historical[prediction.historical.length - 1] || 0;
    const avgForecast = prediction.forecast.reduce((a, b) => a + b, 0) / prediction.forecast.length;
    const change = ((avgForecast - latestHistorical) / latestHistorical) * 100;
    const isPositive = change > 0;
    const colors = getMetricColorClasses(metric.color, selectedMetric === metric.id);

    return (
      <div
        key={metric.id}
        onClick={() => setSelectedMetric(metric.id)}
        className={`p-6 rounded-xl cursor-pointer transition-all duration-200 ${colors.bg} border-2 ${colors.border} ${
          selectedMetric === metric.id ? 'shadow-lg scale-[1.02]' : 'hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${colors.iconBg}`}>
              <ChartBarIcon className={`w-6 h-6 ${colors.iconText}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{metric.name}</h3>
              <p className="text-xs text-gray-500">{metric.description}</p>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-500">Current</p>
            <p className="text-lg font-bold text-gray-900">{Math.round(latestHistorical)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Forecast Avg</p>
            <p className="text-lg font-bold text-purple-600">{Math.round(avgForecast)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Accuracy</p>
            <p className="text-lg font-bold text-blue-600">{prediction.accuracy}%</p>
          </div>
        </div>

        {/* Mini visualization */}
        <div className="mt-4 flex items-end gap-1 h-12">
          {prediction.historical.slice(-7).map((value, idx) => {
            const maxValue = Math.max(...prediction.historical.slice(-7), ...prediction.forecast.slice(0, 3));
            const height = (value / maxValue) * 100;
            return (
              <div
                key={idx}
                className={`flex-1 ${colors.chart} rounded-t`}
                style={{ height: `${height}%` }}
              />
            );
          })}
          {prediction.forecast.slice(0, 3).map((value, idx) => {
            const maxValue = Math.max(...prediction.historical.slice(-7), ...prediction.forecast.slice(0, 3));
            const height = (value / maxValue) * 100;
            return (
              <div
                key={`f-${idx}`}
                className="flex-1 bg-purple-300 rounded-t opacity-60"
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        {prediction.anomalies.length > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-amber-700">
              {prediction.anomalies.length} anomalies detected
            </span>
          </div>
        )}
      </div>
    );
  };

  /**
   * Get insight color classes (soft-coded)
   */
  const getInsightColorClasses = (color) => {
    const colorMap = {
      green: { bg: 'bg-green-100', icon: 'bg-green-100', text: 'text-green-600', badge: 'bg-green-100 text-green-700' },
      red: { bg: 'bg-red-100', icon: 'bg-red-100', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
      amber: { bg: 'bg-amber-100', icon: 'bg-amber-100', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
      blue: { bg: 'bg-blue-100', icon: 'bg-blue-100', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
      purple: { bg: 'bg-purple-100', icon: 'bg-purple-100', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
      indigo: { bg: 'bg-indigo-100', icon: 'bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' }
    };
    return colorMap[color] || colorMap.blue;
  };

  /**
   * Render insights panel
   */
  const renderInsights = () => {
    if (insights.length === 0) {
      return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <SparklesIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">AI-Powered Insights</h3>
              <p className="text-sm text-gray-600">Loading intelligent analysis...</p>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <SparklesIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI-Powered Insights</h3>
            <p className="text-sm text-gray-600">Intelligent analysis and recommendations</p>
          </div>
        </div>

        <div className="space-y-3">
          {insights.map((insight, idx) => {
            const insightType = INSIGHT_TYPES[insight.type.toUpperCase()] || INSIGHT_TYPES.FORECAST;
            const colors = getInsightColorClasses(insightType.color);
            
            return (
              <div
                key={idx}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 ${colors.icon} rounded-lg`}>
                    <LightBulbIcon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.badge}`}>
                        {insightType.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(insight.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{insight.message}</p>
                    {insight.action && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                        💡 {insight.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * Get model color classes (soft-coded)
   */
  const getModelColorClasses = (color, isSelected) => {
    const colorMap = {
      blue: {
        bg: isSelected ? 'bg-blue-50' : 'bg-gray-50',
        border: isSelected ? 'border-blue-500' : 'border-gray-200',
        badge: 'bg-blue-100 text-blue-700'
      },
      purple: {
        bg: isSelected ? 'bg-purple-50' : 'bg-gray-50',
        border: isSelected ? 'border-purple-500' : 'border-gray-200',
        badge: 'bg-purple-100 text-purple-700'
      },
      green: {
        bg: isSelected ? 'bg-green-50' : 'bg-gray-50',
        border: isSelected ? 'border-green-500' : 'border-gray-200',
        badge: 'bg-green-100 text-green-700'
      },
      amber: {
        bg: isSelected ? 'bg-amber-50' : 'bg-gray-50',
        border: isSelected ? 'border-amber-500' : 'border-gray-200',
        badge: 'bg-amber-100 text-amber-700'
      },
      indigo: {
        bg: isSelected ? 'bg-indigo-50' : 'bg-gray-50',
        border: isSelected ? 'border-indigo-500' : 'border-gray-200',
        badge: 'bg-indigo-100 text-indigo-700'
      }
    };
    return colorMap[color] || colorMap.blue;
  };

  /**
   * Render model selector
   */
  const renderModelSelector = () => {
    return (
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <BeakerIcon className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="font-bold text-gray-900">Prediction Models</h3>
            <p className="text-xs text-gray-500">Select forecasting algorithm</p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.values(PREDICTION_MODELS).map(model => {
            const colors = getModelColorClasses(model.color, selectedModel === model.id);
            return (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`p-4 rounded-lg cursor-pointer transition-all ${colors.bg} border-2 ${colors.border} hover:shadow-md`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-gray-900">{model.name}</h4>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.badge}`}>
                    {model.accuracy}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{model.description}</p>
                <div className="text-xs text-gray-500">
                  Best for: <span className="font-medium">{model.bestFor.slice(0, 2).join(', ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
        <div className="text-red-600 text-4xl mb-2">⚠️</div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Error Loading Analytics</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchPredictiveData}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all shadow-sm"
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  // Safety check - ensure we have predictions data
  if (!predictions || Object.keys(predictions).length === 0) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
        <div className="text-yellow-600 mb-2">⚠️</div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Prediction Data Available</h3>
        <p className="text-gray-600 mb-4">Unable to load predictive analytics data. Please try refreshing.</p>
        <button
          onClick={fetchPredictiveData}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all shadow-sm"
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg">
              <CpuChipIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Predictive Analytics Dashboard</h2>
              <p className="text-sm text-gray-600">AI-powered forecasting with intelligent insights</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLiveMode(!liveMode)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm ${
                liveMode
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {liveMode ? '🟢 Live Mode' : '⏸️ Paused'}
            </button>
            <button
              onClick={fetchPredictiveData}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all shadow-sm"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Prediction Metrics Grid - Full Width */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">Forecast Metrics</h3>
          <span className="text-sm text-gray-500 ml-2">({PREDICTION_METRICS.length} metrics tracked)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PREDICTION_METRICS.map(metric => renderPredictionCard(metric))}
        </div>
      </div>

      {/* Two Column Layout: Insights + Models */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights - Takes 2 columns */}
        <div className="lg:col-span-2">
          {renderInsights()}
        </div>

        {/* Prediction Models - Takes 1 column */}
        <div>
          {renderModelSelector()}
        </div>
      </div>

      {/* Anomalies Section - Full Width */}
      {anomalies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
            <h3 className="text-xl font-bold text-gray-900">Anomaly Detection</h3>
            <span className="text-sm text-amber-600 ml-2">({anomalies.length} anomalies found)</span>
          </div>
          <div className="bg-amber-50 rounded-xl p-6 border-2 border-amber-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {anomalies.map((anomaly, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-amber-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      anomaly.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {anomaly.type === 'spike' ? '↑ Spike' : '↓ Drop'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Z: {anomaly.zScore.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{anomaly.value}</p>
                  <p className="text-xs text-gray-500">Day {anomaly.index + 1}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export with Error Boundary wrapper
export default function PredictiveAnalyticsDashboardWrapper(props) {
  return (
    <PredictiveAnalyticsErrorBoundary>
      <PredictiveAnalyticsDashboard {...props} />
    </PredictiveAnalyticsErrorBoundary>
  );
}
