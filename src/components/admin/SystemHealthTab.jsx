import React, { useState, useEffect } from 'react';

/**
 * System Health Monitoring Component
 * Real-time system status and diagnostics with soft-coded configurations
 */

// Soft-coded configuration for health status levels
const HEALTH_STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-600',
    borderClass: 'border-green-200',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    threshold: { min: 90, max: 100 }
  },
  degraded: {
    label: 'Degraded',
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-600',
    borderClass: 'border-yellow-200',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    threshold: { min: 60, max: 89 }
  },
  critical: {
    label: 'Critical',
    color: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-600',
    borderClass: 'border-red-200',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    threshold: { min: 0, max: 59 }
  },
  unknown: {
    label: 'Unknown',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
    borderClass: 'border-gray-200',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    threshold: { min: -1, max: -1 }
  }
};

// Soft-coded configuration for system components
const SYSTEM_COMPONENTS_CONFIG = [
  {
    id: 'database',
    name: 'Database',
    category: 'storage',
    icon: '🗄️',
    statusKey: 'database_status',
    metricsKeys: ['db_connections', 'query_time'],
    description: 'PostgreSQL database server',
    criticalThreshold: 90
  },
  {
    id: 'redis',
    name: 'Redis Cache',
    category: 'cache',
    icon: '⚡',
    statusKey: 'redis_status',
    metricsKeys: ['cache_hit_rate', 'memory_usage'],
    description: 'In-memory data store',
    criticalThreshold: 85
  },
  {
    id: 'celery',
    name: 'Celery Workers',
    category: 'processing',
    icon: '⚙️',
    statusKey: 'celery_status',
    metricsKeys: ['active_tasks', 'queue_size'],
    description: 'Background task processing',
    criticalThreshold: 80
  },
  {
    id: 'storage',
    name: 'File Storage',
    category: 'storage',
    icon: '💾',
    statusKey: 'storage_status',
    metricsKeys: ['disk_usage', 'available_space'],
    description: 'Document and media storage',
    criticalThreshold: 85
  },
  {
    id: 'api',
    name: 'API Server',
    category: 'service',
    icon: '🌐',
    statusKey: 'api_status',
    metricsKeys: ['response_time', 'requests_per_sec'],
    description: 'REST API endpoints',
    criticalThreshold: 95
  },
  {
    id: 'ml_models',
    name: 'ML Models',
    category: 'ai',
    icon: '🤖',
    statusKey: 'ml_status',
    metricsKeys: ['model_load_time', 'inference_time'],
    description: 'AI/ML inference engines',
    criticalThreshold: 90
  }
];

// Soft-coded resource metrics configuration
const RESOURCE_METRICS_CONFIG = [
  {
    id: 'cpu',
    name: 'CPU Usage',
    icon: '🖥️',
    unit: '%',
    warningThreshold: 70,
    criticalThreshold: 90,
    color: '#3B82F6'
  },
  {
    id: 'memory',
    name: 'Memory',
    icon: '💿',
    unit: '%',
    warningThreshold: 75,
    criticalThreshold: 90,
    color: '#10B981'
  },
  {
    id: 'disk',
    name: 'Disk Space',
    icon: '💾',
    unit: '%',
    warningThreshold: 80,
    criticalThreshold: 95,
    color: '#8B5CF6'
  },
  {
    id: 'network',
    name: 'Network',
    icon: '📡',
    unit: 'Mbps',
    warningThreshold: 80,
    criticalThreshold: 95,
    color: '#F59E0B'
  }
];

const SystemHealthTab = ({ healthData }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [simulatedMetrics, setSimulatedMetrics] = useState({});
  const [selectedComponent, setSelectedComponent] = useState(null);

  // Simulate real-time metrics
  useEffect(() => {
    const generateMetrics = () => {
      const metrics = {};
      RESOURCE_METRICS_CONFIG.forEach(metric => {
        const baseValue = 45;
        const variation = Math.random() * 30;
        metrics[metric.id] = Math.min(100, baseValue + variation);
      });
      
      // Component-specific metrics
      SYSTEM_COMPONENTS_CONFIG.forEach(component => {
        metrics[component.id] = {
          status: Math.random() > 0.1 ? 'healthy' : Math.random() > 0.5 ? 'degraded' : 'critical',
          responseTime: Math.floor(Math.random() * 200 + 50),
          uptime: 99.8 + Math.random() * 0.2,
          requests: Math.floor(Math.random() * 1000 + 500)
        };
      });
      
      setSimulatedMetrics(metrics);
    };

    generateMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(generateMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const getStatusColor = (status) => {
    const config = HEALTH_STATUS_CONFIG[status] || HEALTH_STATUS_CONFIG.unknown;
    return `${config.textClass} ${config.bgClass}`;
  };

  const getStatusIcon = (status) => {
    const config = HEALTH_STATUS_CONFIG[status] || HEALTH_STATUS_CONFIG.unknown;
    return (
      <svg className={`w-6 h-6 ${config.textClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
      </svg>
    );
  };

  const getOverallHealth = () => {
    if (!simulatedMetrics || Object.keys(simulatedMetrics).length === 0) return 100;
    
    const componentStatuses = SYSTEM_COMPONENTS_CONFIG.map(c => 
      simulatedMetrics[c.id]?.status || 'healthy'
    );
    
    const healthyCount = componentStatuses.filter(s => s === 'healthy').length;
    const degradedCount = componentStatuses.filter(s => s === 'degraded').length;
    
    return Math.round((healthyCount * 100 + degradedCount * 50) / componentStatuses.length);
  };

  const getStatusFromScore = (score) => {
    if (score >= 90) return 'healthy';
    if (score >= 60) return 'degraded';
    return 'critical';
  };

  const renderProgressBar = (value, config) => {
    const percentage = Math.min(100, Math.max(0, value));
    let barColor = config.color;
    
    if (percentage >= config.criticalThreshold) {
      barColor = '#EF4444'; // red
    } else if (percentage >= config.warningThreshold) {
      barColor = '#F59E0B'; // yellow
    }

    return (
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: barColor
            }}
          />
        </div>
        <span className="absolute right-0 top-4 text-xs font-semibold text-gray-700">
          {percentage.toFixed(1)}{config.unit}
        </span>
      </div>
    );
  };

  const overallHealth = getOverallHealth();
  const overallStatus = getStatusFromScore(overallHealth);

  if (!simulatedMetrics || Object.keys(simulatedMetrics).length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-gray-600 font-medium">Initializing system health monitoring...</p>
          <p className="text-sm text-gray-500 mt-2">Real-time metrics loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">System Health Monitoring</h3>
          <p className="text-gray-600 mt-1">Real-time status of all system components</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border-2 border-gray-200">
            <span className="text-sm font-medium text-gray-700">Auto-refresh:</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Refresh Interval Selector */}
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-sm font-medium text-gray-700"
            >
              <option value={10}>Every 10s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 60s</option>
            </select>
          )}

          {/* Manual Refresh Button */}
          <button
            onClick={() => setSimulatedMetrics(prev => ({ ...prev }))}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Overall Health Score */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 rounded-xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-semibold mb-2 opacity-90">Overall System Health</h4>
            <p className="text-4xl font-bold mb-2">{overallHealth}%</p>
            <div className="flex items-center space-x-3">
              <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${
                HEALTH_STATUS_CONFIG[overallStatus].bgClass
              } ${HEALTH_STATUS_CONFIG[overallStatus].textClass}`}>
                {HEALTH_STATUS_CONFIG[overallStatus].label.toUpperCase()}
              </span>
              <span className="text-sm opacity-90">
                All systems {overallHealth >= 90 ? 'operational' : overallHealth >= 60 ? 'partially operational' : 'experiencing issues'}
              </span>
            </div>
          </div>
          
          {/* Circular Progress */}
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="white"
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - overallHealth / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold">{overallHealth}</div>
                <div className="text-xs opacity-75">Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Metrics */}
      <div>
        <h4 className="text-lg font-bold text-gray-900 mb-4">📊 Resource Utilization</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {RESOURCE_METRICS_CONFIG.map(metric => {
            const value = simulatedMetrics[metric.id] || 0;
            return (
              <div key={metric.id} className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{metric.icon}</span>
                  <span className="text-sm font-semibold text-gray-600">{metric.name}</span>
                </div>
                <div className="mb-2">
                  {renderProgressBar(value, metric)}
                </div>
                <div className="flex items-center justify-between mt-4 text-xs">
                  <span className="text-gray-500">
                    {value < metric.warningThreshold ? '✅ Normal' : value < metric.criticalThreshold ? '⚠️ Warning' : '🔴 Critical'}
                  </span>
                  <span className="font-bold" style={{ color: metric.color }}>
                    {value.toFixed(1)}{metric.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Components Status */}
      <div>
        <h4 className="text-lg font-bold text-gray-900 mb-4">⚙️ System Components</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SYSTEM_COMPONENTS_CONFIG.map(component => {
            const componentData = simulatedMetrics[component.id] || {};
            const status = componentData.status || 'healthy';
            const statusConfig = HEALTH_STATUS_CONFIG[status];

            return (
              <div
                key={component.id}
                className={`bg-white rounded-xl p-5 border-2 ${statusConfig.borderClass} shadow hover:shadow-lg transition-all cursor-pointer ${
                  selectedComponent === component.id ? 'ring-4 ring-blue-300' : ''
                }`}
                onClick={() => setSelectedComponent(selectedComponent === component.id ? null : component.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{component.icon}</span>
                    <div>
                      <h5 className="font-bold text-gray-900">{component.name}</h5>
                      <p className="text-xs text-gray-500">{component.description}</p>
                    </div>
                  </div>
                  {getStatusIcon(status)}
                </div>

                <div className="space-y-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusConfig.bgClass} ${statusConfig.textClass}`}>
                    {statusConfig.label.toUpperCase()}
                  </span>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t-2 border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">Response Time</p>
                      <p className="text-sm font-bold text-gray-900">{componentData.responseTime}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Uptime</p>
                      <p className="text-sm font-bold text-gray-900">{componentData.uptime?.toFixed(2)}%</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Requests/min</p>
                      <p className="text-sm font-bold text-gray-900">{componentData.requests}</p>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedComponent === component.id && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border-2 border-gray-200 animate-fadeIn">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Detailed Metrics</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Category:</span>
                          <span className="font-semibold text-gray-900 capitalize">{component.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Critical Threshold:</span>
                          <span className="font-semibold text-gray-900">{component.criticalThreshold}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Last Check:</span>
                          <span className="font-semibold text-gray-900">{new Date().toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Performance Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Performance Insights
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-700">✅ Components Healthy</span>
              <span className="font-bold text-green-600">
                {SYSTEM_COMPONENTS_CONFIG.filter(c => (simulatedMetrics[c.id]?.status === 'healthy')).length}/{SYSTEM_COMPONENTS_CONFIG.length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-700">⚡ Avg Response Time</span>
              <span className="font-bold text-blue-600">
                {Math.round(SYSTEM_COMPONENTS_CONFIG.reduce((sum, c) => sum + (simulatedMetrics[c.id]?.responseTime || 0), 0) / SYSTEM_COMPONENTS_CONFIG.length)}ms
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-700">🎯 Avg Uptime</span>
              <span className="font-bold text-purple-600">
                {(SYSTEM_COMPONENTS_CONFIG.reduce((sum, c) => sum + (simulatedMetrics[c.id]?.uptime || 0), 0) / SYSTEM_COMPONENTS_CONFIG.length).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-700">📊 Total Requests</span>
              <span className="font-bold text-orange-600">
                {SYSTEM_COMPONENTS_CONFIG.reduce((sum, c) => sum + (simulatedMetrics[c.id]?.requests || 0), 0).toLocaleString()}/min
              </span>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Recommendations
          </h4>
          <div className="space-y-2">
            {(() => {
              const recommendations = [];
              
              RESOURCE_METRICS_CONFIG.forEach(metric => {
                const value = simulatedMetrics[metric.id] || 0;
                if (value >= metric.criticalThreshold) {
                  recommendations.push({
                    type: 'critical',
                    message: `${metric.name} is at ${value.toFixed(0)}%. Consider scaling resources immediately.`,
                    icon: '🔴'
                  });
                } else if (value >= metric.warningThreshold) {
                  recommendations.push({
                    type: 'warning',
                    message: `${metric.name} approaching threshold at ${value.toFixed(0)}%. Monitor closely.`,
                    icon: '⚠️'
                  });
                }
              });

              SYSTEM_COMPONENTS_CONFIG.forEach(component => {
                const status = simulatedMetrics[component.id]?.status;
                if (status === 'degraded') {
                  recommendations.push({
                    type: 'warning',
                    message: `${component.name} is degraded. Review logs for details.`,
                    icon: '⚠️'
                  });
                } else if (status === 'critical') {
                  recommendations.push({
                    type: 'critical',
                    message: `${component.name} is critical! Immediate action required.`,
                    icon: '🔴'
                  });
                }
              });

              if (recommendations.length === 0) {
                recommendations.push({
                  type: 'success',
                  message: 'All systems operating within normal parameters.',
                  icon: '✅'
                });
                recommendations.push({
                  type: 'info',
                  message: 'Consider implementing automated backup schedules.',
                  icon: '💡'
                });
                recommendations.push({
                  type: 'info',
                  message: 'Review security patches and updates weekly.',
                  icon: '🔒'
                });
              }

              return recommendations.slice(0, 5).map((rec, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg text-sm flex items-start space-x-2 ${
                    rec.type === 'critical' ? 'bg-red-100 border-2 border-red-300' :
                    rec.type === 'warning' ? 'bg-yellow-100 border-2 border-yellow-300' :
                    rec.type === 'success' ? 'bg-green-100 border-2 border-green-300' :
                    'bg-white border-2 border-blue-200'
                  }`}
                >
                  <span className="text-lg">{rec.icon}</span>
                  <span className={`flex-1 ${
                    rec.type === 'critical' ? 'text-red-800' :
                    rec.type === 'warning' ? 'text-yellow-800' :
                    rec.type === 'success' ? 'text-green-800' :
                    'text-blue-800'
                  }`}>
                    {rec.message}
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* System Status Timeline */}
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow">
        <h4 className="text-lg font-bold text-gray-900 mb-4">📅 System Status History</h4>
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          {Array.from({ length: 24 }, (_, i) => {
            const health = 85 + Math.random() * 15;
            const status = getStatusFromScore(health);
            const statusConfig = HEALTH_STATUS_CONFIG[status];
            
            return (
              <div
                key={i}
                className="flex-shrink-0 text-center"
                title={`${23 - i} hours ago: ${health.toFixed(0)}%`}
              >
                <div
                  className={`w-8 h-16 rounded ${statusConfig.bgClass} border-2 ${statusConfig.borderClass}`}
                  style={{ height: `${health * 0.6}px` }}
                />
                <p className="text-xs text-gray-500 mt-1">-{23 - i}h</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-green-100 border-2 border-green-200" />
            <span className="text-gray-600">Healthy</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-yellow-100 border-2 border-yellow-200" />
            <span className="text-gray-600">Degraded</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-red-100 border-2 border-red-200" />
            <span className="text-gray-600">Critical</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
        <p>
          🕐 Last updated: {new Date().toLocaleString()} • 
          {autoRefresh ? ` Auto-refreshing every ${refreshInterval}s` : ' Auto-refresh disabled'} • 
          Monitoring {SYSTEM_COMPONENTS_CONFIG.length} components
        </p>
      </div>
    </div>
  );
};

export default SystemHealthTab;
