/**
 * Real-time Alert Dashboard Component
 * Advanced ML-powered alert monitoring with live updates
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useRealTimeDetection, useSystemMetrics } from '../../hooks/useRealTimeDetection';
import { 
  BellIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  CpuChipIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api.config';


const SEVERITY_CONFIG = {
  critical: {
    color: 'red',
    bgClass: 'bg-red-100',
    borderClass: 'border-red-500',
    textClass: 'text-red-700',
    icon: ExclamationTriangleIcon,
    label: 'Critical'
  },
  high: {
    color: 'orange',
    bgClass: 'bg-orange-100',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-700',
    icon: ExclamationTriangleIcon,
    label: 'High'
  },
  medium: {
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    borderClass: 'border-yellow-500',
    textClass: 'text-yellow-700',
    icon: BellIcon,
    label: 'Medium'
  },
  low: {
    color: 'blue',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-700',
    icon: BellIcon,
    label: 'Low'
  }
};


const RealTimeAlertDashboard = () => {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [filter, setFilter] = useState('all'); // all, critical, high, new
  const [dashboardStats, setDashboardStats] = useState(null);
  
  // Real-time hooks
  const {
    isConnected,
    alerts,
    metrics,
    lastUpdate,
    error: wsError,
    acknowledgeAlert
  } = useRealTimeDetection({
    autoConnect: true,
    onAlert: (alert) => {
      // Play sound or show notification for critical alerts
      if (alert.severity === 'critical') {
        playAlertSound();
        showBrowserNotification(alert);
      }
    }
  });

  const {
    isConnected: metricsConnected,
    metrics: systemMetrics
  } = useSystemMetrics({ autoConnect: true });

  // Fetch dashboard stats
  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/ml-detection/alerts/dashboard_summary/`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'new') return alerts.filter((a) => a.status === 'new');
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      high: alerts.filter((a) => a.severity === 'high').length,
      new: alerts.filter((a) => a.status === 'new').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length
    };
  }, [alerts]);

  const handleAcknowledge = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/ml-detection/alerts/${alertId}/acknowledge/`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      acknowledgeAlert(alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/ml-detection/alerts/${alertId}/resolve/`,
        { notes: 'Resolved from dashboard' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const playAlertSound = () => {
    // Play alert sound
    const audio = new Audio('/alert-sound.mp3');
    audio.play().catch((e) => console.log('Audio play failed:', e));
  };

  const showBrowserNotification = (alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 Critical Alert', {
        body: alert.title,
        icon: '/logo.png'
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <div>
            <p className="font-semibold text-gray-900">
              {isConnected ? '🟢 Real-time Detection Active' : '🔴 Disconnected'}
            </p>
            <p className="text-sm text-gray-600">
              {lastUpdate ? `Last update: ${new Date(lastUpdate).toLocaleTimeString()}` : 'No updates yet'}
            </p>
          </div>
        </div>
        
        {wsError && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
            {wsError}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Alerts"
          value={stats.total}
          icon={BellIcon}
          color="blue"
          subtitle="All time"
        />
        <StatCard
          title="Critical"
          value={stats.critical}
          icon={ExclamationTriangleIcon}
          color="red"
          subtitle="Requires immediate action"
          pulse={stats.critical > 0}
        />
        <StatCard
          title="High Priority"
          value={stats.high}
          icon={ExclamationTriangleIcon}
          color="orange"
          subtitle="Needs attention"
        />
        <StatCard
          title="New Alerts"
          value={stats.new}
          icon={ClockIcon}
          color="purple"
          subtitle="Unacknowledged"
        />
        <StatCard
          title="Acknowledged"
          value={stats.acknowledged}
          icon={CheckCircleIcon}
          color="green"
          subtitle="In progress"
        />
      </div>

      {/* System Metrics */}
      {systemMetrics && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm p-4 border-2 border-indigo-200">
          <div className="flex items-center space-x-2 mb-3">
            <CpuChipIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-gray-900">System Performance</h3>
            <span className={`w-2 h-2 rounded-full ${metricsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricBar label="CPU" value={systemMetrics.cpu_usage} max={100} unit="%" />
            <MetricBar label="Memory" value={systemMetrics.memory_usage} max={100} unit="%" />
            <MetricBar label="Disk" value={systemMetrics.disk_usage} max={100} unit="%" />
            <div className="text-center">
              <p className="text-sm text-gray-600">Active Streams</p>
              <p className="text-2xl font-bold text-indigo-600">{systemMetrics.active_streams}</p>
            </div>
          </div>
        </div>
      )}

      {/* ML Detection Metrics */}
      {metrics && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow-sm p-4 border-2 border-purple-200">
          <div className="flex items-center space-x-2 mb-3">
            <ChartBarIcon className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900">ML Detection Performance</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Alerts (1h)</p>
              <p className="text-2xl font-bold text-purple-600">{metrics.total_alerts_last_hour}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Critical (1h)</p>
              <p className="text-2xl font-bold text-red-600">{metrics.critical_alerts_last_hour}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className="text-2xl font-bold text-green-600">{(metrics.accuracy * 100).toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Precision</p>
              <p className="text-2xl font-bold text-blue-600">{(metrics.precision * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm p-2">
        <div className="flex space-x-2">
          {['all', 'critical', 'high', 'new'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className="ml-2 px-2 py-0.5 bg-white bg-opacity-20 rounded-full text-xs">
                  {f === 'new' ? stats.new : f === 'critical' ? stats.critical : stats.high}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Alerts</h3>
            <p className="text-gray-600">All systems operating normally</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onSelect={setSelectedAlert}
            />
          ))
        )}
      </div>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <AlertDetailsModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
      )}
    </div>
  );
};


// Sub-components
const StatCard = ({ title, value, icon: Icon, color, subtitle, pulse }) => {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-600',
    red: 'from-red-50 to-red-100 border-red-200 text-red-600',
    orange: 'from-orange-50 to-orange-100 border-orange-200 text-orange-600',
    purple: 'from-purple-50 to-purple-100 border-purple-200 text-purple-600',
    green: 'from-green-50 to-green-100 border-green-200 text-green-600'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-sm p-4 border-2`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-8 h-8 ${pulse ? 'animate-pulse' : ''}`} />
        <span className={`text-3xl font-bold`}>{value}</span>
      </div>
      <p className="text-sm font-semibold mb-1">{title}</p>
      <p className="text-xs opacity-75">{subtitle}</p>
    </div>
  );
};


const MetricBar = ({ label, value, max, unit }) => {
  const percentage = (value / max) * 100;
  const color = percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};


const AlertCard = ({ alert, onAcknowledge, onResolve, onSelect }) => {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const Icon = config.icon;

  return (
    <div
      className={`${config.bgClass} border-l-4 ${config.borderClass} rounded-lg shadow-sm p-4 hover:shadow-md transition-all cursor-pointer`}
      onClick={() => onSelect(alert)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <Icon className={`w-6 h-6 ${config.textClass} flex-shrink-0 mt-1`} />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-bold text-gray-900">{alert.title}</h4>
              <span className={`px-2 py-0.5 ${config.bgClass} ${config.textClass} rounded-full text-xs font-semibold`}>
                {config.label}
              </span>
              {alert.is_critical && (
                <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-semibold animate-pulse">
                  CRITICAL
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              <span>🎯 Confidence: {(alert.confidence * 100).toFixed(1)}%</span>
              <span>⏰ {new Date(alert.detected_at).toLocaleTimeString()}</span>
              <span className={`px-2 py-0.5 rounded ${
                alert.status === 'new' ? 'bg-yellow-100 text-yellow-700' :
                alert.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}>
                {alert.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2 ml-4">
          {alert.status === 'new' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(alert.id);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Acknowledge
            </button>
          )}
          {alert.status === 'acknowledged' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve(alert.id);
              }}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


const AlertDetailsModal = ({ alert, onClose, onAcknowledge, onResolve }) => {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`${config.bgClass} border-b-4 ${config.borderClass} p-6`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{alert.title}</h2>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 ${config.bgClass} ${config.textClass} rounded-full text-sm font-semibold`}>
                  {config.label}
                </span>
                <span className="text-sm text-gray-600">
                  {new Date(alert.detected_at).toLocaleString()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircleIcon className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700">{alert.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Confidence</h3>
              <p className="text-2xl font-bold text-blue-600">{(alert.confidence * 100).toFixed(1)}%</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Status</h3>
              <p className="text-lg font-semibold text-gray-700 capitalize">{alert.status}</p>
            </div>
          </div>

          <div className="flex space-x-3">
            {alert.status === 'new' && (
              <button
                onClick={() => {
                  onAcknowledge(alert.id);
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Acknowledge Alert
              </button>
            )}
            {alert.status === 'acknowledged' && (
              <button
                onClick={() => {
                  onResolve(alert.id);
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Resolve Alert
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default RealTimeAlertDashboard;
