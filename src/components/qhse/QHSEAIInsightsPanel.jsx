/**
 * QHSE AI Insights Panel Component
 * Displays AI-powered recommendations, cross-module impacts, and predictive analytics
 * Beautiful, modern design with animations and interactive elements
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Target,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  Network,
  BarChart3
} from 'lucide-react';

const QHSEAIInsightsPanel = ({ 
  recommendations, 
  isAnalyzing, 
  onRefresh,
  compact = false 
}) => {
  const [expandedSections, setExpandedSections] = useState({
    insights: true,
    crossModule: true,
    actions: true
  });

  if (!recommendations) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Intelligence</h3>
            <p className="text-sm text-gray-600">Awaiting project analysis</p>
          </div>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a project to view AI-powered insights and recommendations</p>
        </div>
      </div>
    );
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const riskLevelConfig = {
    critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', icon: AlertTriangle, color: 'red' },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', icon: AlertTriangle, color: 'orange' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', icon: Info, color: 'yellow' },
    low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', icon: CheckCircle, color: 'green' }
  };

  const riskConfig = riskLevelConfig[recommendations.riskLevel] || riskLevelConfig.medium;
  const RiskIcon = riskConfig.icon;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className={`bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg ${compact ? 'p-4' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">AI Intelligence Center</h3>
              <p className="text-sm text-purple-100">Advanced predictive analytics & recommendations</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={isAnalyzing}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium">Overall Score</span>
            </div>
            <div className="text-2xl font-bold">{recommendations.overallScore}</div>
            <div className="text-xs opacity-80">out of 100</div>
          </div>
          
          <div className={`${riskConfig.bg} rounded-lg p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <RiskIcon className={`w-4 h-4 ${riskConfig.text}`} />
              <span className={`text-xs font-medium ${riskConfig.text}`}>Risk Level</span>
            </div>
            <div className={`text-2xl font-bold ${riskConfig.text} capitalize`}>
              {recommendations.riskLevel}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium">AI Confidence</span>
            </div>
            <div className="text-2xl font-bold">
              {Math.round(recommendations.aiMetadata.confidence * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection('insights')}
          className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lightbulb className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold text-gray-900">Key AI Insights</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
              {recommendations.insights.length}
            </span>
          </div>
          {expandedSections.insights ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>

        {expandedSections.insights && (
          <div className="p-6 space-y-3">
            {recommendations.insights.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">All metrics are performing well!</p>
              </div>
            ) : (
              recommendations.insights.slice(0, compact ? 3 : undefined).map((insight, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    {insight.level === 'critical' ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : insight.level === 'warning' ? (
                      <Info className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-900 uppercase tracking-wide">
                          {insight.factor || 'General'}
                        </span>
                        {typeof insight === 'string' ? null : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            insight.level === 'critical' ? 'bg-red-100 text-red-700' :
                            insight.level === 'warning' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {insight.level}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">
                        {typeof insight === 'string' ? insight : insight.message}
                      </p>
                      {insight.impacts && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {insight.impacts.map((impact, idx) => (
                            <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              {impact}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cross-Module Impacts */}
      {recommendations.crossModuleImpacts && recommendations.crossModuleImpacts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('crossModule')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-cyan-600" />
              <h4 className="font-semibold text-gray-900">Cross-Module Impacts</h4>
              <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">
                {recommendations.crossModuleImpacts.length}
              </span>
            </div>
            {expandedSections.crossModule ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>

          {expandedSections.crossModule && (
            <div className="p-6 space-y-4">
              {recommendations.crossModuleImpacts.map((impact, index) => (
                <div key={index} className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-900 capitalize">
                        {impact.targetModule.replace(/-/g, ' ')}
                      </h5>
                      <p className="text-xs text-gray-600">Priority: <span className="capitalize font-medium">{impact.priority}</span></p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {impact.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <ChevronUp className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Items */}
      {recommendations.actionItems && recommendations.actionItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('actions')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Recommended Actions</h4>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {recommendations.actionItems.length}
              </span>
            </div>
            {expandedSections.actions ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>

          {expandedSections.actions && (
            <div className="p-6">
              <div className="space-y-3">
                {recommendations.actionItems.slice(0, compact ? 5 : undefined).map((action, index) => {
                  const priorityConfig = {
                    critical: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
                    high: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
                    medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
                    low: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700' }
                  };
                  const config = priorityConfig[action.priority] || priorityConfig.medium;

                  return (
                    <div key={index} className={`${config.bg} rounded-lg p-4 border ${config.border}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase ${config.badge}`}>
                              {action.priority}
                            </span>
                            {action.source && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {action.source}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1">{action.action}</p>
                          {action.affectedModules && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {action.affectedModules.map((module, idx) => (
                                <span key={idx} className="text-xs bg-white text-gray-700 px-2 py-1 rounded border border-gray-200 capitalize">
                                  {module.replace(/-/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RAG Sources Footer */}
      {recommendations.aiMetadata.ragSources && recommendations.aiMetadata.ragSources.length > 0 && !compact && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-gray-900 mb-2">AI Knowledge Sources</h5>
              <div className="flex flex-wrap gap-2">
                {recommendations.aiMetadata.ragSources.map((source, index) => (
                  <span key={index} className="text-xs bg-white text-gray-700 px-3 py-1 rounded-full border border-gray-300">
                    {source}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Analysis based on industry standards and best practices
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Timestamp */}
      <div className="text-center text-xs text-gray-500">
        Last analyzed: {new Date(recommendations.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

export default QHSEAIInsightsPanel;
