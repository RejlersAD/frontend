import React, { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Activity,
  Shield,
  Target,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import qhseService from '../../services/qhse.service';

const QHSEAIDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAIInsights();
  }, []);

  const loadAIInsights = async () => {
    try {
      setLoading(true);
      const data = await qhseService.ai.getAIInsights();
      setInsights(data);
    } catch (error) {
      console.error('Failed to load AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAIInsights();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading AI insights...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QHSE AI Dashboard</h1>
            <p className="text-sm text-gray-600">AI-powered insights and predictions</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Target}
          label="Projects Analyzed"
          value={insights?.total_projects_analyzed || 0}
          color="blue"
        />
        <MetricCard
          icon={AlertTriangle}
          label="High Risk Projects"
          value={insights?.high_risk_projects || 0}
          color="orange"
          trend={insights?.high_risk_projects > 5 ? 'up' : 'down'}
        />
        <MetricCard
          icon={Activity}
          label="Avg Risk Score"
          value={insights?.average_risk_score?.toFixed(1) || '0.0'}
          color="purple"
        />
        <MetricCard
          icon={Shield}
          label="Anomalies Detected"
          value={insights?.anomalies_detected_count || 0}
          color="red"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-2">
            {[
              { id: 'overview', label: 'Overview', icon: Eye },
              { id: 'risk', label: 'Risk Analysis', icon: AlertTriangle },
              { id: 'models', label: 'AI Models', icon: Brain },
              { id: 'performance', label: 'Performance', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab insights={insights} />}
          {activeTab === 'risk' && <RiskAnalysisTab insights={insights} />}
          {activeTab === 'models' && <AIModelsTab insights={insights} />}
          {activeTab === 'performance' && <PerformanceTab insights={insights} />}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color, trend }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-red-600' : 'text-green-600'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
};

const OverviewTab = ({ insights }) => {
  return (
    <div className="space-y-6">
      {/* Risk Distribution */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(insights?.risk_distribution || {}).map(([level, count]) => (
            <div key={level} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`text-2xl font-bold mb-1 ${getRiskColor(level)}`}>
                {count}
              </div>
              <div className="text-xs text-gray-600 capitalize">{level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Risk Projects */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Risk Projects</h3>
        <div className="space-y-2">
          {insights?.top_risk_projects?.slice(0, 5).map((project, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{project.project_no}</div>
                <div className="text-sm text-gray-600">{project.project_title}</div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: project.risk_color }}>
                    {project.risk_score?.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-600">{project.risk_label}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  project.risk_category === 'critical' ? 'bg-red-100 text-red-700' :
                  project.risk_category === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {project.risk_category}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Predictions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent AI Predictions</h3>
        <div className="space-y-3">
          {insights?.recent_predictions?.slice(0, 3).map((pred, idx) => (
            <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{pred.project_no}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Confidence: {(pred.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(pred.prediction_timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RiskAnalysisTab = ({ insights }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Critical Risk Projects</h3>
          </div>
          <div className="text-4xl font-bold text-red-600 mb-2">
            {insights?.critical_risk_projects || 0}
          </div>
          <p className="text-sm text-gray-600">Require immediate attention</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl">
          <div className="flex items-center space-x-3 mb-4">
            <TrendingUp className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">High Risk Projects</h3>
          </div>
          <div className="text-4xl font-bold text-orange-600 mb-2">
            {insights?.high_risk_projects || 0}
          </div>
          <p className="text-sm text-gray-600">Need proactive monitoring</p>
        </div>
      </div>

      {/* All High Risk Projects */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All High-Risk Projects</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Risk Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {insights?.top_risk_projects
                ?.filter(p => ['critical', 'high'].includes(p.risk_category))
                .map((project, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{project.project_no}</div>
                      <div className="text-sm text-gray-500">{project.project_title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-lg font-bold" style={{ color: project.risk_color }}>
                        {project.risk_score?.toFixed(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        project.risk_category === 'critical' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {project.risk_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {(project.confidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AIModelsTab = ({ insights }) => {
  const models = [
    {
      name: 'Risk Prediction',
      status: 'active',
      accuracy: insights?.model_performance?.risk_prediction?.accuracy || 0.85,
      predictions: insights?.model_performance?.risk_prediction?.total_predictions || 0
    },
    {
      name: 'CAR Classification',
      status: 'active',
      accuracy: insights?.model_performance?.car_classification?.accuracy || 0.78,
      predictions: insights?.model_performance?.car_classification?.total_classifications || 0
    },
    {
      name: 'Anomaly Detection',
      status: 'active',
      accuracy: insights?.model_performance?.anomaly_detection?.accuracy || 0.88,
      predictions: insights?.model_performance?.anomaly_detection?.anomalies_found || 0
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {models.map((model, idx) => (
          <div key={idx} className="p-6 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">{model.name}</h4>
              <span className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Active</span>
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 mb-1">Accuracy</div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${model.accuracy * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {(model.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Predictions</div>
                <div className="text-2xl font-bold text-gray-900">{model.predictions}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PerformanceTab = ({ insights }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-green-50 rounded-xl">
          <h4 className="font-semibold text-gray-900 mb-2">Average Confidence</h4>
          <div className="text-3xl font-bold text-green-600">
            {((insights?.model_performance?.risk_prediction?.avg_confidence || 0.85) * 100).toFixed(0)}%
          </div>
        </div>
        <div className="p-6 bg-blue-50 rounded-xl">
          <h4 className="font-semibold text-gray-900 mb-2">Total Predictions</h4>
          <div className="text-3xl font-bold text-blue-600">
            {insights?.total_projects_analyzed || 0}
          </div>
        </div>
        <div className="p-6 bg-purple-50 rounded-xl">
          <h4 className="font-semibold text-gray-900 mb-2">Model Version</h4>
          <div className="text-3xl font-bold text-purple-600">v1.0.0</div>
        </div>
      </div>
    </div>
  );
};

const getRiskColor = (level) => {
  const colors = {
    critical: 'text-red-600',
    high: 'text-orange-600',
    medium: 'text-yellow-600',
    low: 'text-blue-600',
    minimal: 'text-green-600'
  };
  return colors[level] || 'text-gray-600';
};

export default QHSEAIDashboard;
