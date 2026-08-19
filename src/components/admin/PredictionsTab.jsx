import React, { useState, useEffect } from 'react';
import analyticsService from '../../services/analyticsService';
import qhseService from '../../services/qhse.service';
import { 
  AI_MODELS_REGISTRY, 
  AI_PROVIDERS, 
  AI_MODEL_CATEGORIES,
  AI_MODELS_STATS,
  getModelsByCategory,
  getModelsByProvider 
} from '../../config/aiModels.config';

/**
 * AI Predictions and Insights Component
 * Machine learning powered recommendations + Comprehensive AI Models Information
 * Real-time model tracking with dynamic updates
 */
const PredictionsTab = ({ predictions: initialPredictions, onRefresh }) => {
  const [predictions, setPredictions] = useState(initialPredictions || []);
  const [acknowledging, setAcknowledging] = useState(false);
  const [activeView, setActiveView] = useState('models'); // 'predictions' or 'models'
  const [selectedModel, setSelectedModel] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  
  // Dynamic AI Models State
  const [dynamicModels, setDynamicModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsStats, setModelsStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch dynamic AI models from backend
  useEffect(() => {
    if (activeView === 'models') {
      fetchAIModels();
    }
  }, [activeView]);

  const fetchAIModels = async () => {
    setModelsLoading(true);
    try {
      const response = await qhseService.ai.getModelsRegistry();
      if (response.success) {
        setDynamicModels(response.models);
        setModelsStats(response.statistics);
        setLastUpdated(response.timestamp);
      }
    } catch (error) {
      console.error('Failed to fetch AI models:', error);
      // Fallback to static config if API fails
      setDynamicModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const getImpactBadge = (impact) => {
    const styles = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return styles[impact] || styles.medium;
  };

  const getInsightIcon = (type) => {
    const icons = {
      usage_forecast: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      capacity_planning: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      user_churn_risk: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      performance_optimization: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      cost_optimization: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      security_risk: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    };
    return icons[type] || icons.usage_forecast;
  };

  const handleAcknowledge = async (insightId) => {
    setAcknowledging(true);
    try {
      await analyticsService.acknowledgeInsight(insightId);
      setPredictions(predictions.filter(p => p.id !== insightId));
      onRefresh();
    } catch (error) {
      console.error('Failed to acknowledge insight:', error);
      alert('Failed to acknowledge insight');
    } finally {
      setAcknowledging(false);
    }
  };

  // Merge static and dynamic models (dynamic takes priority)
  const allModels = React.useMemo(() => {
    const models = [...AI_MODELS_REGISTRY];
    
    // Add or update with dynamic QHSE models
    dynamicModels.forEach(dynModel => {
      const existingIndex = models.findIndex(m => m.id === dynModel.id);
      if (existingIndex >= 0) {
        // Update existing model with live data
        models[existingIndex] = {
          ...models[existingIndex],
          ...dynModel,
          specifications: dynModel.configuration,
          usedIn: dynModel.usedIn || models[existingIndex].usedIn
        };
      } else {
        // Add new model
        models.push({
          id: dynModel.id,
          name: dynModel.name,
          provider: { 
            id: dynModel.provider, 
            name: dynModel.provider === 'custom' ? 'QHSE Custom Models' : 'OpenAI',
            logo: dynModel.provider === 'custom' ? '⚡' : '🤖',
            color: 'from-blue-500 to-cyan-600'
          },
          category: dynModel.category,
          version: dynModel.configuration?.version || '1.0',
          description: dynModel.description,
          capabilities: dynModel.capabilities,
          usedIn: dynModel.usedIn,
          specifications: dynModel.configuration,
          status: dynModel.status,
          lastUpdated: dynModel.last_updated
        });
      }
    });
    
    return models;
  }, [dynamicModels]);

  // Calculate comprehensive stats
  const comprehensiveStats = React.useMemo(() => {
    if (modelsStats) {
      return {
        totalModels: allModels.length,
        activeModels: modelsStats.active_models + AI_MODELS_STATS.activeModels,
        providers: modelsStats.providers + AI_MODELS_STATS.providers,
        categories: new Set([...allModels.map(m => m.category)]).size,
        totalModules: new Set([...allModels.flatMap(m => m.usedIn?.map(u => u.module) || [])]).size,
        totalPredictions: modelsStats.total_predictions || 0
      };
    }
    return {
      totalModels: allModels.length,
      activeModels: allModels.filter(m => m.status === 'active').length,
      providers: new Set(allModels.map(m => m.provider?.id || m.provider)).size,
      categories: new Set(allModels.map(m => m.category)).size,
      totalModules: new Set(allModels.flatMap(m => m.usedIn?.map(u => u.module) || [])).size,
      totalPredictions: 0
    };
  }, [allModels, modelsStats]);

  // Filter models based on category
  const filteredModels = filterCategory === 'all' 
    ? allModels 
    : allModels.filter(m => m.category === filterCategory);

  // AI Models View Component
  const renderAIModelsView = () => (
    <div className="space-y-6">
      {/* Stats Overview with Real-time Data */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{comprehensiveStats.totalModels}</div>
          <div className="text-sm text-blue-900 font-medium">Total AI Models</div>
          {modelsLoading && <div className="text-xs text-blue-700 mt-1">Updating...</div>}
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border-2 border-green-200">
          <div className="text-2xl font-bold text-green-600">{comprehensiveStats.activeModels}</div>
          <div className="text-sm text-green-900 font-medium">Active Models</div>
          {lastUpdated && <div className="text-xs text-green-700 mt-1">Live</div>}
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border-2 border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{comprehensiveStats.providers}</div>
          <div className="text-sm text-purple-900 font-medium">AI Providers</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border-2 border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{comprehensiveStats.categories}</div>
          <div className="text-sm text-orange-900 font-medium">Categories</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-xl border-2 border-cyan-200">
          <div className="text-2xl font-bold text-cyan-600">{comprehensiveStats.totalModules}</div>
          <div className="text-sm text-cyan-900 font-medium">Modules</div>
        </div>
      </div>

      {/* Last Updated Timestamp */}
      {lastUpdated && (
        <div className="flex items-center justify-between bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm font-medium text-blue-900">Real-time Data</span>
          </div>
          <div className="text-xs text-blue-700">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </div>
          <button
            onClick={fetchAIModels}
            disabled={modelsLoading}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {modelsLoading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
            filterCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Models ({AI_MODELS_REGISTRY.length})
        </button>
        {Object.entries(AI_MODEL_CATEGORIES).map(([key, value]) => (
          <button
            key={value}
            onClick={() => setFilterCategory(value)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              filterCategory === value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {key.replace('_', ' ')} ({getModelsByCategory(value).length})
          </button>
        ))}
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredModels.map((model) => (
          <div
            key={model.id}
            className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 transition-all cursor-pointer"
            onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}
          >
            {/* Model Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className={`w-16 h-16 bg-gradient-to-br ${model.provider.color} rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                  {model.provider.logo}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{model.name}</h4>
                  <p className="text-sm text-gray-600">{model.provider.name} • {model.version}</p>
                  <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                    {model.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <svg
                className={`w-6 h-6 text-gray-400 transition-transform ${selectedModel?.id === model.id ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Model Description */}
            <p className="text-gray-700 mb-4">{model.description}</p>

            {/* Capabilities Pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {model.capabilities.map((capability, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                >
                  {capability}
                </span>
              ))}
            </div>

            {/* Used In Count */}
            <div className="text-sm text-gray-600 font-medium mb-2">
              Used in {model.usedIn.length} feature{model.usedIn.length !== 1 ? 's' : ''}
            </div>

            {/* Expanded Details */}
            {selectedModel?.id === model.id && (
              <div className="mt-6 pt-6 border-t-2 border-gray-200 space-y-6">
                {/* Usage Details */}
                <div>
                  <h5 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Usage in Application
                  </h5>
                  <div className="space-y-4">
                    {model.usedIn.map((usage, idx) => (
                      <div key={idx} className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-lg border-2 border-purple-200">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h6 className="font-bold text-purple-900">{usage.feature}</h6>
                            <p className="text-sm text-purple-700 font-medium">{usage.module}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-green-600">{usage.accuracy} Accuracy</div>
                            <div className="text-xs text-gray-600">{usage.avgResponseTime}</div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{usage.purpose}</p>
                        <p className="text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded">
                          📁 {usage.file}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Specifications */}
                <div>
                  <h5 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Technical Specifications
                  </h5>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-800 overflow-x-auto">
                      {JSON.stringify(model.specifications, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="text-sm text-gray-500">
                  <span className="font-semibold">Last Updated:</span> {model.lastUpdated}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header with View Switcher */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">AI Insights & Models</h3>
          <p className="text-gray-600 mt-1">
            {activeView === 'predictions' 
              ? 'Machine learning predictions and recommendations' 
              : 'Comprehensive AI/ML models used in the application'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveView('models')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'models'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            AI Models
          </button>
          <button
            onClick={() => setActiveView('predictions')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'predictions'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Predictions ({predictions?.length || 0})
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {activeView === 'models' ? renderAIModelsView() : (
        <>
          {predictions && predictions.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {predictions.map((prediction) => (
                <div key={prediction.id} className="bg-white border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 transition-colors">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                      {getInsightIcon(prediction.insight_type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-bold text-gray-900">{prediction.title}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getImpactBadge(prediction.impact_level)}`}>
                          {prediction.impact_level.toUpperCase()} IMPACT
                        </span>
                      </div>

                      <p className="text-gray-700 mb-4">{prediction.description}</p>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Confidence Score</p>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${prediction.confidence_score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-purple-600">
                              {(prediction.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Affected Area</p>
                          <p className="text-sm font-semibold text-gray-900">{prediction.affected_area}</p>
                        </div>
                      </div>

                      {prediction.recommendations && prediction.recommendations.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                          <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Recommendations
                          </p>
                          <ul className="space-y-1">
                            {prediction.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-blue-800 flex items-start">
                                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {prediction.action_items && prediction.action_items.length > 0 && (
                        <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                          <p className="text-sm font-semibold text-yellow-900 mb-2">Action Items:</p>
                          <ul className="space-y-1">
                            {prediction.action_items.map((item, idx) => (
                              <li key={idx} className="text-sm text-yellow-800 flex items-start">
                                <input type="checkbox" className="mt-1 mr-2" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {prediction.estimated_benefit && (
                        <div className="bg-green-50 p-3 rounded-lg mb-4">
                          <p className="text-sm text-green-900">
                            <span className="font-semibold">Estimated Benefit: </span>
                            {prediction.estimated_benefit}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          <span className="font-semibold">Model:</span> {prediction.ml_model_used}
                        </div>
                        <button
                          onClick={() => handleAcknowledge(prediction.id)}
                          disabled={acknowledging}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
                        >
                          {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-lg font-semibold text-gray-900">No Active Insights</p>
              <p className="text-gray-600 mt-2">AI is analyzing your system patterns</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PredictionsTab;