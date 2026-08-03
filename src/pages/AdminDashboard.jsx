import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUser, fetchUserStats } from '../store/slices/rbacSlice';
import analyticsService from '../services/analyticsService';
import { isUserAdmin } from '../utils/rbac.utils';
import { USER_DISPLAY_CONFIG } from '../config/userDisplay.config';
import RealTimeActivityTab from '../components/admin/RealTimeActivityTab';
import SecurityAlertsTab from '../components/admin/SecurityAlertsTab';
import PredictionsTab from '../components/admin/PredictionsTab';
import SystemHealthTab from '../components/admin/SystemHealthTab';
import AuditLogsTab from '../components/admin/AuditLogsTab';
import AnalyticsCharts from '../components/admin/AnalyticsCharts';
import RealTimeAlertDashboard from '../components/admin/RealTimeAlertDashboard';
import LiveTabFrame from '../components/admin/LiveTabFrame';
import { useRealTimeDetection } from '../hooks/useRealTimeDetection';

// Soft-coded configuration for dashboard stats cards
const DASHBOARD_STATS_CONFIG = [
  {
    id: 'total_users',
    title: 'Total Users',
    dataKey: 'total_users',
    growthKey: 'user_growth_percentage',
    color: 'blue',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    format: (value) => value || 0,
    subtitle: (data) => `+${data.user_growth_percentage}% this month`
  },
  {
    id: 'active_users',
    title: 'Active Users',
    dataKey: 'active_users_count',
    color: 'indigo',
    icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    format: (value) => value || 0,
    subtitle: (data) => `${((data.active_users_count / data.total_users) * 100 || 0).toFixed(1)}% of total`
  },
  {
    id: 'system_health',
    title: 'System Health',
    dataKey: 'system_health_score',
    color: 'green',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    format: (value) => `${(value || 100).toFixed(1)}%`,
    subtitle: (data) => `${data.active_connections || 0} active connections`,
    conditionalColor: (value) => value >= 90 ? 'green' : value >= 70 ? 'yellow' : 'red'
  },
  {
    id: 'security_alerts',
    title: 'Security Alerts',
    dataKey: 'active_alerts_count',
    color: 'red',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    format: (value) => value || 0,
    subtitle: (data) => `${data.critical_alerts_count || 0} critical`,
    conditionalColor: (value, data) => data.critical_alerts_count > 0 ? 'red' : value > 5 ? 'yellow' : 'green'
  },
  {
    id: 'ai_insights',
    title: 'AI Insights',
    dataKey: 'active_predictions_count',
    color: 'purple',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    format: (value) => value || 0,
    subtitle: (data) => `${data.high_impact_insights_count || 0} high priority`
  },
  {
    id: 'api_performance',
    title: 'API Performance',
    dataKey: 'avg_response_time_ms',
    color: 'cyan',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    format: (value) => `${(value || 0).toFixed(0)}ms`,
    subtitle: (data) => `${(data.success_rate_percentage || 100).toFixed(1)}% success rate`,
    conditionalColor: (value) => value <= 200 ? 'green' : value <= 500 ? 'yellow' : 'red'
  },
  {
    id: 'storage_usage',
    title: 'Storage Usage',
    dataKey: 'storage_used_gb',
    color: 'orange',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    format: (value) => `${(value || 0).toFixed(1)} GB`,
    subtitle: (data) => `${((data.storage_used_gb / data.storage_total_gb) * 100 || 0).toFixed(1)}% used`
  },
  {
    id: 'document_count',
    title: 'Total Documents',
    dataKey: 'total_documents',
    color: 'teal',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    format: (value) => value || 0,
    subtitle: (data) => `${data.documents_processed_today || 0} processed today`
  }
];

// Soft-coded thresholds for live system health indicators
const HEALTH_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory_mb: { warning: 1024, critical: 2048 },
  response_time_ms: { warning: 200, critical: 500 },
  error_rate_pct: { warning: 1, critical: 5 },
  storage_pct: { warning: 75, critical: 90 },
  health_score: { warning: 80, critical: 60 }
};

// Soft-coded recommendation rules engine — generates AI insights from real metrics
const RECOMMENDATION_RULES = [
  {
    id: 'response_time',
    evaluate: (d, m) => {
      const rt = d?.avg_response_time_ms ?? 0;
      if (rt >= HEALTH_THRESHOLDS.response_time_ms.critical) {
        return { level: 'red', title: 'API Latency: Critical', detail: `Average response time is ${rt.toFixed(0)}ms — investigate slow endpoints and DB queries.` };
      }
      if (rt >= HEALTH_THRESHOLDS.response_time_ms.warning) {
        return { level: 'yellow', title: 'API Latency: Elevated', detail: `Response time at ${rt.toFixed(0)}ms is above target. Review caching and N+1 queries.` };
      }
      return { level: 'green', title: 'API Performance: Optimal', detail: `Average response time ${rt.toFixed(0)}ms — within target SLA.` };
    }
  },
  {
    id: 'error_rate',
    evaluate: (d) => {
      const er = 100 - (d?.success_rate_percentage ?? 100);
      if (er >= HEALTH_THRESHOLDS.error_rate_pct.critical) {
        return { level: 'red', title: 'Error Rate: Critical', detail: `${er.toFixed(2)}% of requests are failing — immediate investigation required.` };
      }
      if (er >= HEALTH_THRESHOLDS.error_rate_pct.warning) {
        return { level: 'yellow', title: 'Error Rate: Elevated', detail: `${er.toFixed(2)}% failure rate detected — check error logs.` };
      }
      return null;
    }
  },
  {
    id: 'storage',
    evaluate: (d) => {
      const used = d?.storage_used_gb;
      const total = d?.storage_total_gb;
      if (!used || !total) return null;
      const pct = (used / total) * 100;
      if (pct >= HEALTH_THRESHOLDS.storage_pct.critical) {
        return { level: 'red', title: 'Storage: Critical', detail: `Storage at ${pct.toFixed(1)}% — capacity expansion required.` };
      }
      if (pct >= HEALTH_THRESHOLDS.storage_pct.warning) {
        return { level: 'yellow', title: 'Storage: Monitor', detail: `Storage at ${pct.toFixed(1)}% — plan capacity expansion.` };
      }
      return { level: 'green', title: 'Storage: Healthy', detail: `${pct.toFixed(1)}% utilized of ${total} GB.` };
    }
  },
  {
    id: 'security',
    evaluate: (d) => {
      const crit = d?.critical_alerts_count ?? 0;
      const total = d?.active_alerts_count ?? 0;
      if (crit > 0) {
        return { level: 'red', title: 'Security: Critical Alerts', detail: `${crit} critical alert(s) need immediate attention.` };
      }
      if (total > 5) {
        return { level: 'yellow', title: 'Security: Multiple Alerts', detail: `${total} active alerts — review security tab.` };
      }
      return { level: 'green', title: 'Security: Stable', detail: `No critical alerts detected.` };
    }
  },
  {
    id: 'engagement',
    evaluate: (d) => {
      const growth = d?.user_growth_percentage ?? 0;
      if (growth > 10) {
        return { level: 'blue', title: 'User Growth: Strong', detail: `+${growth.toFixed(1)}% growth — consider scaling resources proactively.` };
      }
      if (growth > 0) {
        return { level: 'blue', title: 'User Growth: Positive', detail: `+${growth.toFixed(1)}% growth this period.` };
      }
      if (growth < 0) {
        return { level: 'yellow', title: 'User Growth: Declining', detail: `${growth.toFixed(1)}% — investigate retention.` };
      }
      return null;
    }
  },
  {
    id: 'cpu',
    evaluate: (d, m) => {
      const cpu = m?.cpu_usage_percentage;
      if (cpu == null) return null;
      if (cpu >= HEALTH_THRESHOLDS.cpu.critical) {
        return { level: 'red', title: 'CPU: Critical', detail: `CPU usage at ${cpu.toFixed(1)}% — scale workers immediately.` };
      }
      if (cpu >= HEALTH_THRESHOLDS.cpu.warning) {
        return { level: 'yellow', title: 'CPU: High', detail: `CPU at ${cpu.toFixed(1)}% — monitor for sustained load.` };
      }
      return null;
    }
  }
];

// Soft-coded refresh interval options
const REFRESH_INTERVAL_OPTIONS = [
  { value: 5000, label: '5s refresh' },
  { value: 10000, label: '10s refresh' },
  { value: 30000, label: '30s refresh' },
  { value: 60000, label: '1m refresh' },
  { value: 300000, label: '5m refresh' }
];

// Map indicator level to Tailwind classes
const LEVEL_DOT_CLASS = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500'
};

// Format relative time (live "x seconds ago")
const formatRelativeTime = (date) => {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

// Soft-coded tab configuration
const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'ml-detection', label: '🤖 ML Detection', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', badge: true },
  { id: 'activity', label: 'Real-time Activity', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'security', label: 'Security', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'predictions', label: 'AI Insights', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'health', label: 'System Health', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { id: 'audit', label: 'Audit Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' }
];

// Soft-coded list of tab IDs to hide from the dashboard navigation.
// The underlying tab content / route remains intact (core logic unchanged) —
// only the nav entry is suppressed. Add an ID here to hide a tab; remove
// to restore it. The dedicated `/admin/users` route remains accessible.
const HIDDEN_DASHBOARD_TAB_IDS = new Set(['users']);
const VISIBLE_DASHBOARD_TABS = DASHBOARD_TABS.filter(
  (tab) => !HIDDEN_DASHBOARD_TAB_IDS.has(tab.id)
);

/**
 * Super Admin Dashboard - AI-Powered Analytics
 * Advanced admin features with machine learning insights
 */
const AdminDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentUser, stats, loading } = useSelector((state) => state.rbac);
  const { user: authUser } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('overview');
  
  // AI Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [realtimeActivity, setRealtimeActivity] = useState([]);
  const [latestMetrics, setLatestMetrics] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [featureUsage, setFeatureUsage] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefreshAt, setNextRefreshAt] = useState(null);
  const [, setTick] = useState(0); // forces re-render for live timers
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Real-time ML Detection Hook
  const { 
    isConnected: mlConnected,
    alerts: mlAlerts,
    metrics: mlMetrics
  } = useRealTimeDetection({
    autoConnect: true,
    onAlert: (alert) => {
      // Show toast notification for new alerts
      if (alert.severity === 'critical') {
        console.log('🚨 Critical ML Alert:', alert);
      }
    }
  });

  useEffect(() => {
    dispatch(fetchCurrentUser());
    dispatch(fetchUserStats());
    loadAIAnalytics();
    
    // Dynamic refresh interval based on user preference. Skip the timer
    // when the user has paused auto-refresh from the live tab frame.
    if (!autoRefreshEnabled) return undefined;
    const interval = setInterval(loadAIAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [dispatch, refreshInterval, autoRefreshEnabled]);

  // Live "x seconds ago" / countdown ticker — updates every second
  useEffect(() => {
    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(tickInterval);
  }, []);

  const loadAIAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const [overview, health, alerts, insights, activity, metrics, history, features] = await Promise.all([
        analyticsService.getDashboardOverview().catch(() => null),
        analyticsService.getLatestHealthCheck().catch(() => null),
        analyticsService.getCriticalAlerts().catch(() => []),
        analyticsService.getHighPriorityInsights().catch(() => []),
        analyticsService.getRealTimeActivity(10).catch(() => []),
        analyticsService.getLatestMetrics().catch(() => null),
        analyticsService.getSystemPerformance(1).catch(() => []),
        analyticsService.getFeatureUsageSummary(7).catch(() => [])
      ]);

      // Merge live system metrics into overview so storage/CPU/memory cards work without fabrication
      const merged = overview ? {
        ...overview,
        // Backend returns `active_users_today`; expose as `active_users_count` for backwards compat
        active_users_count: overview.active_users_count ?? overview.active_users_today,
        cpu_usage_percentage: metrics?.cpu_usage_percentage ?? overview.cpu_usage_percentage,
        memory_usage_mb: metrics?.memory_usage_mb ?? overview.memory_usage_mb,
        storage_used_gb: overview.storage_used_gb ?? metrics?.disk_usage_gb,
        storage_total_gb: overview.storage_total_gb,
        total_documents: overview.total_documents,
        documents_processed_today: overview.documents_processed_today
      } : null;

      setAnalyticsData(merged);
      setSystemHealth(health);
      setSecurityAlerts(Array.isArray(alerts) ? alerts : (alerts?.results || []));
      setPredictions(Array.isArray(insights) ? insights : (insights?.results || []));
      setRealtimeActivity(Array.isArray(activity) ? activity : (activity?.results || []));
      setLatestMetrics(metrics);
      setMetricsHistory(Array.isArray(history) ? history : (history?.results || []));
      setFeatureUsage(Array.isArray(features) ? features : (features?.results || []));
      setLastUpdated(new Date());
      setNextRefreshAt(new Date(Date.now() + refreshInterval));
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Color theme map for soft coding
  const colorThemes = {
    blue: { bg: 'bg-blue-100', hover: 'hover:border-blue-300', border: 'border-blue-100', text: 'text-blue-600', icon: 'bg-blue-100' },
    indigo: { bg: 'bg-indigo-100', hover: 'hover:border-indigo-300', border: 'border-indigo-100', text: 'text-indigo-600', icon: 'bg-indigo-100' },
    green: { bg: 'bg-green-100', hover: 'hover:border-green-300', border: 'border-green-100', text: 'text-green-600', icon: 'bg-green-100' },
    red: { bg: 'bg-red-100', hover: 'hover:border-red-300', border: 'border-red-100', text: 'text-red-600', icon: 'bg-red-100' },
    yellow: { bg: 'bg-yellow-100', hover: 'hover:border-yellow-300', border: 'border-yellow-100', text: 'text-yellow-600', icon: 'bg-yellow-100' },
    purple: { bg: 'bg-purple-100', hover: 'hover:border-purple-300', border: 'border-purple-100', text: 'text-purple-600', icon: 'bg-purple-100' },
    cyan: { bg: 'bg-cyan-100', hover: 'hover:border-cyan-300', border: 'border-cyan-100', text: 'text-cyan-600', icon: 'bg-cyan-100' },
    orange: { bg: 'bg-orange-100', hover: 'hover:border-orange-300', border: 'border-orange-100', text: 'text-orange-600', icon: 'bg-orange-100' },
    teal: { bg: 'bg-teal-100', hover: 'hover:border-teal-300', border: 'border-teal-100', text: 'text-teal-600', icon: 'bg-teal-100' }
  };

  // Render stats card (soft-coded component)
  const renderStatsCard = (config) => {
    if (!analyticsData) return null;
    
    const value = analyticsData[config.dataKey];
    const displayValue = config.format ? config.format(value) : value;
    const subtitle = config.subtitle ? config.subtitle(analyticsData) : '';
    
    // Determine color dynamically
    let colorKey = config.color;
    if (config.conditionalColor) {
      colorKey = config.conditionalColor(value, analyticsData);
    }
    
    const colors = colorThemes[colorKey] || colorThemes.blue;
    
    return (
      <div key={config.id} className={`bg-white rounded-xl shadow-lg p-4 sm:p-5 md:p-6 border-2 ${colors.border} ${colors.hover} transition-all`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">{config.title}</h3>
            <p className={`text-2xl sm:text-3xl font-bold ${colors.text}`}>{displayValue}</p>
            {subtitle && <p className={`text-xs ${colors.text} mt-1`}>{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 ${colors.icon} rounded-full flex items-center justify-center flex-shrink-0`}>
            <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  // Check if user has admin access via RBAC roles OR Django superuser/staff flags
  const hasRBACAdminRole = currentUser?.roles?.some(
    role => ['super_admin', 'admin'].includes(role.code)
  );
  
  // Smart admin check using utility function
  const isDjangoSuperuser = isUserAdmin(authUser);
  
  const hasAdminAccess = hasRBACAdminRole || isDjangoSuperuser;

  if (!hasAdminAccess && !loading && currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access the Admin Dashboard.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header with Live Status */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              {/* Personalized Greeting with smart user display */}
              {(() => {
                const firstName = USER_DISPLAY_CONFIG.formatting.getDisplayName(authUser);
                const getGreeting = () => {
                  const hour = new Date().getHours();
                  if (hour < 12) return 'Good Morning';
                  if (hour < 18) return 'Good Afternoon';
                  return 'Good Evening';
                };
                return (
                  <p className="text-lg sm:text-xl text-gray-700 mb-1 font-medium">
                    {getGreeting()}, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-bold">{firstName}</span>! 👋
                  </p>
                );
              })()}
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  AI-Powered Admin Dashboard
                </h1>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">Live</span>
                </div>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Real-time analytics, AI insights & intelligent system monitoring
              </p>
            </div>
            
            {/* Quick Actions & Settings */}
            <div className="flex items-center space-x-3">
              {/* Live status pill: last updated + countdown to next refresh */}
              <div className="hidden md:flex items-center space-x-2 px-3 py-2 bg-white rounded-lg shadow-md text-xs">
                <div className={`w-2 h-2 rounded-full ${loadingAnalytics ? 'bg-blue-500 animate-pulse' : 'bg-green-500 animate-pulse'}`}></div>
                <div className="flex flex-col leading-tight">
                  <span className="text-gray-700 font-medium">
                    Updated {formatRelativeTime(lastUpdated)}
                  </span>
                  {nextRefreshAt && (
                    <span className="text-gray-500">
                      Next in {Math.max(0, Math.ceil((nextRefreshAt.getTime() - Date.now()) / 1000))}s
                    </span>
                  )}
                </div>
              </div>

              {/* Refresh Control */}
              <button
                onClick={loadAIAnalytics}
                disabled={loadingAnalytics}
                className="px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-blue-600"
              >
                <svg className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
              
              {/* Auto-refresh Selector */}
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-2 bg-white rounded-lg shadow-md text-sm font-medium text-gray-700 border-none focus:ring-2 focus:ring-blue-500"
              >
                {REFRESH_INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* AI-Powered Stats Cards Grid */}
        {analyticsData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-6 sm:mb-8">
            {DASHBOARD_STATS_CONFIG.map(config => renderStatsCard(config))}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
            {VISIBLE_DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm md:text-base font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-gradient-to-t from-blue-50 to-transparent'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'overview' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">AI-Powered Overview</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="8" />
                    </svg>
                    <span>Last updated: {lastUpdated ? formatRelativeTime(lastUpdated) : '—'}</span>
                  </div>
                </div>

                {/* Quick Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <button
                    onClick={() => setActiveTab('activity')}
                    className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg text-left transition-all group shadow-md hover:shadow-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Real-time Activity</p>
                        <p className="text-xs text-gray-600">Monitor live events</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('security')}
                    className="p-4 bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-lg text-left transition-all group shadow-md hover:shadow-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Security Alerts</p>
                        <p className="text-xs text-gray-600">AI threat detection</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('predictions')}
                    className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg text-left transition-all group shadow-md hover:shadow-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">AI Insights</p>
                        <p className="text-xs text-gray-600">Predictive analytics</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('health')}
                    className="p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg text-left transition-all group shadow-md hover:shadow-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">System Health</p>
                        <p className="text-xs text-gray-600">Component status</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/admin/reports')}
                    className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg text-left transition-all group shadow-md hover:shadow-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Report Generator</p>
                        <p className="text-xs text-gray-600">CEO reports & analytics</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Enhanced Performance Banner */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-xl mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold">System Performance Overview</h4>
                    <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                      <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="6" />
                      </svg>
                      <span className="text-sm font-medium">Live</span>
                    </div>
                  </div>
                  <p className="text-sm opacity-90 mb-4">
                    Leverage advanced AI analytics to monitor, predict, and optimize your system performance.
                    Real-time threat detection, predictive insights, and comprehensive health monitoring.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors">
                      <p className="text-2xl font-bold">{analyticsData?.total_api_requests_today || 0}</p>
                      <p className="text-xs opacity-90">API Requests Today</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors">
                      <p className="text-2xl font-bold">{analyticsData?.avg_response_time_ms?.toFixed(0) || 0}ms</p>
                      <p className="text-xs opacity-90">Avg Response Time</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors">
                      <p className="text-2xl font-bold">{analyticsData?.success_rate_percentage?.toFixed(1) || 100}%</p>
                      <p className="text-xs opacity-90">Success Rate</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors">
                      <p className="text-2xl font-bold">{analyticsData?.active_connections || 0}</p>
                      <p className="text-xs opacity-90">Active Connections</p>
                    </div>
                  </div>
                </div>

                {/* Live System Metrics — driven by real /system-metrics/latest/ + /system_performance/ */}
                {(latestMetrics || metricsHistory?.length > 0) && (
                  <div className="bg-white rounded-xl p-6 border-2 border-gray-100 shadow-md mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Live System Metrics</span>
                      </h4>
                      <span className="text-xs text-gray-500">
                        {latestMetrics?.timestamp ? `Sample: ${new Date(latestMetrics.timestamp).toLocaleTimeString()}` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(() => {
                        const liveCards = [
                          {
                            id: 'cpu',
                            label: 'CPU Usage',
                            value: latestMetrics?.cpu_usage_percentage,
                            format: (v) => `${(v ?? 0).toFixed(1)}%`,
                            thresholds: HEALTH_THRESHOLDS.cpu,
                            invert: false
                          },
                          {
                            id: 'mem',
                            label: 'Memory',
                            value: latestMetrics?.memory_usage_mb,
                            format: (v) => `${(v ?? 0).toFixed(0)} MB`,
                            thresholds: HEALTH_THRESHOLDS.memory_mb,
                            invert: false
                          },
                          {
                            id: 'errs',
                            label: 'Errors Today',
                            value: analyticsData?.errors_today,
                            format: (v) => v ?? 0,
                            thresholds: { warning: 5, critical: 20 },
                            invert: false
                          },
                          {
                            id: 'health',
                            label: 'Health Score',
                            value: analyticsData?.system_health_score,
                            format: (v) => `${(v ?? 0).toFixed(1)}%`,
                            thresholds: HEALTH_THRESHOLDS.health_score,
                            invert: true
                          }
                        ];
                        return liveCards.map(card => {
                          const v = card.value;
                          let tone = 'text-gray-700';
                          if (v != null) {
                            const { warning, critical } = card.thresholds;
                            if (card.invert) {
                              tone = v <= critical ? 'text-red-600' : v <= warning ? 'text-yellow-600' : 'text-green-600';
                            } else {
                              tone = v >= critical ? 'text-red-600' : v >= warning ? 'text-yellow-600' : 'text-green-600';
                            }
                          }
                          return (
                            <div key={card.id} className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
                              <p className="text-xs text-gray-600 font-medium mb-1">{card.label}</p>
                              <p className={`text-2xl font-bold ${tone}`}>{v == null ? '—' : card.format(v)}</p>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Inline sparkline of response time over last 24h — pure SVG, no extra deps */}
                    {metricsHistory.length > 1 && (() => {
                      const points = metricsHistory
                        .map(p => p.avg_response_time_ms)
                        .filter(v => v != null);
                      if (points.length < 2) return null;
                      const max = Math.max(...points, 1);
                      const min = Math.min(...points, 0);
                      const range = max - min || 1;
                      const width = 600;
                      const height = 60;
                      const stepX = width / (points.length - 1);
                      const path = points
                        .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
                        .join(' ');
                      return (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Response time (last 24h) — {points.length} samples</span>
                            <span>min {min.toFixed(0)}ms · max {max.toFixed(0)}ms</span>
                          </div>
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
                            <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />
                          </svg>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* AI Recommendations — generated dynamically from real metrics */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">AI-Powered Recommendations</h4>
                    <span className="text-xs text-gray-500 ml-auto">Auto-generated from live metrics</span>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const recs = RECOMMENDATION_RULES
                        .map(r => ({ id: r.id, ...(r.evaluate(analyticsData, latestMetrics) || {}) }))
                        .filter(r => r.title);
                      if (recs.length === 0) {
                        return (
                          <div className="p-3 bg-white rounded-lg shadow-sm text-sm text-gray-500">
                            Awaiting live metrics — recommendations will appear once data is collected.
                          </div>
                        );
                      }
                      return recs.map(rec => (
                        <div key={rec.id} className="flex items-start space-x-3 p-3 bg-white rounded-lg shadow-sm">
                          <div className={`w-2 h-2 ${LEVEL_DOT_CLASS[rec.level] || 'bg-gray-400'} rounded-full mt-2`}></div>
                          <div>
                            <p className="font-medium text-gray-900">{rec.title}</p>
                            <p className="text-sm text-gray-600">{rec.detail}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <LiveTabFrame
                tabId="activity"
                context={{ analyticsData, realtimeActivity }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
                <RealTimeActivityTab activities={realtimeActivity} onRefresh={loadAIAnalytics} />
              </LiveTabFrame>
            )}

            {activeTab === 'security' && (
              <LiveTabFrame
                tabId="security"
                context={{ analyticsData, securityAlerts }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
                <SecurityAlertsTab alerts={securityAlerts} onRefresh={loadAIAnalytics} />
              </LiveTabFrame>
            )}

            {activeTab === 'predictions' && (
              <LiveTabFrame
                tabId="predictions"
                context={{ analyticsData, predictions }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
                <PredictionsTab predictions={predictions} onRefresh={loadAIAnalytics} />
              </LiveTabFrame>
            )}

            {activeTab === 'health' && (
              <LiveTabFrame
                tabId="health"
                context={{ analyticsData, systemHealth }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
                <SystemHealthTab healthData={systemHealth} />
              </LiveTabFrame>
            )}

            {activeTab === 'users' && (
              <div className="p-6 text-center py-8">
                <p className="text-gray-600 mb-4">Comprehensive User Management</p>
                <button
                  onClick={() => navigate('/admin/users')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to User Management
                </button>
              </div>
            )}

            {activeTab === 'analytics' && (
              <LiveTabFrame
                tabId="analytics"
                context={{ analyticsData, featureUsage }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Advanced Analytics & Insights</h3>
                  <button
                    onClick={loadAIAnalytics}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </button>
                </div>
                
                {/* Analytics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* User Engagement */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">User Engagement</h4>
                        <p className="text-sm text-gray-600">Activity patterns & trends</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Active Users:</span>
                        <span className="font-bold text-blue-600">{analyticsData?.active_users_count || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Growth Rate:</span>
                        <span className="font-bold text-green-600">+{analyticsData?.user_growth_percentage || 0}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Engagement Score:</span>
                        <span className="font-bold text-purple-600">{((analyticsData?.active_users_count / analyticsData?.total_users) * 100 || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature Usage — real data from /feature-usage/summary/ */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Feature Usage</h4>
                        <p className="text-sm text-gray-600">Top modules (last 7d)</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {featureUsage.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No usage data collected yet.</p>
                      ) : (
                        featureUsage.slice(0, 5).map((f, idx) => {
                          const label = f.feature_name || f.feature || f.name || `Feature ${idx + 1}`;
                          const value = f.usage_count ?? f.total_usage ?? f.count ?? 0;
                          const adoption = f.adoption_rate ?? f.adoption_percentage;
                          return (
                            <div key={`${label}-${idx}`} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 truncate" title={label}>{label}:</span>
                              <span className="font-bold text-green-600 ml-2">
                                {adoption != null ? `${Number(adoption).toFixed(0)}%` : value}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Performance</h4>
                        <p className="text-sm text-gray-600">System efficiency metrics</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Response:</span>
                        <span className="font-bold text-purple-600">{analyticsData?.avg_response_time_ms?.toFixed(0) || 0}ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Success Rate:</span>
                        <span className="font-bold text-green-600">{analyticsData?.success_rate_percentage?.toFixed(1) || 100}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">API Requests:</span>
                        <span className="font-bold text-blue-600">{analyticsData?.total_api_requests_today || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Storage Analytics */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border-2 border-orange-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Storage Analytics</h4>
                        <p className="text-sm text-gray-600">Capacity & utilization</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Used:</span>
                        <span className="font-bold text-orange-600">{analyticsData?.storage_used_gb?.toFixed(1) || 0} GB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="font-bold text-gray-600">{analyticsData?.storage_total_gb || 100} GB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Usage:</span>
                        <span className="font-bold text-blue-600">{((analyticsData?.storage_used_gb / analyticsData?.storage_total_gb) * 100 || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Error Analytics */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border-2 border-red-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Error Analytics</h4>
                        <p className="text-sm text-gray-600">AI-powered tracking</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Error Rate:</span>
                        <span className="font-bold text-red-600">{(100 - (analyticsData?.success_rate_percentage || 100)).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Critical Errors:</span>
                        <span className="font-bold text-red-600">{analyticsData?.critical_errors_count ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Errors Today:</span>
                        <span className="font-bold text-yellow-600">{analyticsData?.errors_today ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Processing */}
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl border-2 border-teal-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">Document Processing</h4>
                        <p className="text-sm text-gray-600">AI analysis metrics</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Docs:</span>
                        <span className="font-bold text-teal-600">{analyticsData?.total_documents || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Processed Today:</span>
                        <span className="font-bold text-green-600">{analyticsData?.documents_processed_today || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Processing Rate:</span>
                        <span className="font-bold text-blue-600">98.5%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytics Charts - Usage Trends & System Metrics */}
                <div className="mt-6">
                  <AnalyticsCharts analyticsData={analyticsData} />
                </div>
              </div>
              </LiveTabFrame>
            )}

            {activeTab === 'ml-detection' && (
              <LiveTabFrame
                tabId="ml-detection"
                context={{ analyticsData, mlConnected, mlAlerts, mlMetrics }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
                <div className="p-6">
                  <RealTimeAlertDashboard />
                </div>
              </LiveTabFrame>
            )}

            {activeTab === 'audit' && (
              <LiveTabFrame
                tabId="audit"
                context={{ analyticsData }}
                onRefresh={loadAIAnalytics}
                lastUpdated={lastUpdated}
                autoRefresh={autoRefreshEnabled}
                onToggleAutoRefresh={() => setAutoRefreshEnabled((v) => !v)}
                loading={loadingAnalytics}
              >
                <AuditLogsTab onRefresh={loadAIAnalytics} />
              </LiveTabFrame>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
