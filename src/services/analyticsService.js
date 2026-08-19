/**
 * AI-Powered Analytics Service
 * API client for advanced admin analytics
 */
import apiClient from './api.service';

const analyticsService = {
  // Dashboard Overview
  getDashboardOverview: async () => {
    const response = await apiClient.get('/rbac/analytics/dashboard/overview/');
    return response.data;
  },

  getRealTimeActivity: async (limit = 20) => {
    const response = await apiClient.get('/rbac/analytics/dashboard/real_time_activity/', {
      params: { limit }
    });
    return response.data;
  },

  getSystemPerformance: async (days = 7) => {
    const response = await apiClient.get('/rbac/analytics/dashboard/system_performance/', {
      params: { days }
    });
    return response.data;
  },

  getUserEngagementTrends: async (days = 30) => {
    const response = await apiClient.get('/rbac/analytics/dashboard/user_engagement_trends/', {
      params: { days }
    });
    return response.data;
  },

  // System Metrics
  getLatestMetrics: async () => {
    const response = await apiClient.get('/rbac/analytics/system-metrics/latest/');
    return response.data;
  },

  getMetricsAverages: async (days = 7) => {
    const response = await apiClient.get('/rbac/analytics/system-metrics/averages/', {
      params: { days }
    });
    return response.data;
  },

  getSystemMetrics: async (params = {}) => {
    const response = await apiClient.get('/rbac/analytics/system-metrics/', { params });
    return response.data;
  },

  // User Activity Analytics
  getUserActivity: async (params = {}) => {
    const response = await apiClient.get('/rbac/analytics/user-activity/', { params });
    return response.data;
  },

  getTopEngagedUsers: async (days = 7, limit = 10) => {
    const response = await apiClient.get('/rbac/analytics/user-activity/top_engaged_users/', {
      params: { days, limit }
    });
    return response.data;
  },

  getAnomalies: async (days = 7) => {
    const response = await apiClient.get('/rbac/analytics/user-activity/anomalies/', {
      params: { days }
    });
    return response.data;
  },

  getUserTimeline: async (userId, days = 30) => {
    const response = await apiClient.get(`/rbac/analytics/user-activity/${userId}/user_timeline/`, {
      params: { days }
    });
    return response.data;
  },

  // Security Alerts
  getSecurityAlerts: async (params = {}) => {
    const response = await apiClient.get('/rbac/analytics/security-alerts/', { params });
    return response.data;
  },

  getCriticalAlerts: async () => {
    const response = await apiClient.get('/rbac/analytics/security-alerts/critical/');
    return response.data;
  },

  getAlertStatistics: async (days = 30) => {
    const response = await apiClient.get('/rbac/analytics/security-alerts/statistics/', {
      params: { days }
    });
    return response.data;
  },

  resolveAlert: async (alertId, notes) => {
    const response = await apiClient.post(`/rbac/analytics/security-alerts/${alertId}/resolve/`, {
      notes
    });
    return response.data;
  },

  investigateAlert: async (alertId) => {
    const response = await apiClient.post(`/rbac/analytics/security-alerts/${alertId}/investigate/`);
    return response.data;
  },

  // Predictive Insights
  getPredictions: async (params = {}) => {
    const response = await apiClient.get('/rbac/analytics/predictions/', { params });
    return response.data;
  },

  getPendingInsights: async () => {
    const response = await apiClient.get('/rbac/analytics/predictions/pending/');
    return response.data;
  },

  getHighPriorityInsights: async () => {
    const response = await apiClient.get('/rbac/analytics/predictions/high_priority/');
    return response.data;
  },

  acknowledgeInsight: async (insightId) => {
    const response = await apiClient.post(`/rbac/analytics/predictions/${insightId}/acknowledge/`);
    return response.data;
  },

  // Feature Usage Analytics
  getFeatureUsage: async (params = {}) => {
    const response = await apiClient.get('/rbac/analytics/feature-usage/', { params });
    return response.data;
  },

  getFeatureUsageSummary: async (days = 7) => {
    const response = await apiClient.get('/rbac/analytics/feature-usage/summary/', {
      params: { days }
    });
    return response.data;
  },

  getTrendingFeatures: async () => {
    const response = await apiClient.get('/rbac/analytics/feature-usage/trending/');
    return response.data;
  },

  // Error Log Analytics
  getErrorLogs: async (params = {}) => {
    const response = await apiClient.get('/rbac/analytics/error-logs/', { params });
    return response.data;
  },

  getCriticalErrors: async () => {
    const response = await apiClient.get('/rbac/analytics/error-logs/critical_errors/');
    return response.data;
  },

  getErrorStatistics: async (days = 7) => {
    const response = await apiClient.get('/rbac/analytics/error-logs/statistics/', {
      params: { days }
    });
    return response.data;
  },

  markErrorResolved: async (errorId, notes) => {
    const response = await apiClient.post(`/rbac/analytics/error-logs/${errorId}/mark_resolved/`, {
      notes
    });
    return response.data;
  },

  // System Health
  getLatestHealthCheck: async () => {
    const response = await apiClient.get('/rbac/analytics/health-checks/latest/');
    return response.data;
  },

  getHealthCheckHistory: async (hours = 24) => {
    const response = await apiClient.get('/rbac/analytics/health-checks/history/', {
      params: { hours }
    });
    return response.data;
  },

  getComponentStatus: async () => {
    const response = await apiClient.get('/rbac/analytics/health-checks/component_status/');
    return response.data;
  },

  // ===== AI Champion of the Month =====
  // `config` is an optional axios request config — useful for callers that
  // want a shorter timeout for fire-and-forget telemetry so the POST can
  // never queue behind a long-running synchronous request and hang for
  // the global default (120 s). See `useAIChampionTracker`.
  trackActivity: async (payload, config = {}) => {
    const response = await apiClient.post('/rbac/ai-champion/track/activity/', payload, config);
    return response.data;
  },

  trackAIUsage: async (payload, config = {}) => {
    const response = await apiClient.post('/rbac/ai-champion/track/ai-usage/', payload, config);
    return response.data;
  },

  getChampionLeaderboard: async (days = 30, limit = 20) => {
    const response = await apiClient.get('/rbac/ai-champion/leaderboard/', {
      params: { days, limit }
    });
    return response.data;
  },

  getCurrentChampion: async () => {
    const response = await apiClient.get('/rbac/ai-champion/champion/current/');
    return response.data;
  },

  getChampionHistory: async (limit = 12) => {
    const response = await apiClient.get('/rbac/ai-champion/champion/history/', {
      params: { limit }
    });
    return response.data;
  },

  getCostReport: async (days = 30) => {
    const response = await apiClient.get('/rbac/ai-champion/cost-report/', {
      params: { days }
    });
    return response.data;
  },

  getMonthlySummary: async (year, month) => {
    const response = await apiClient.get('/rbac/ai-champion/monthly-summary/', {
      params: { year, month }
    });
    return response.data;
  },

  getUserChampionScore: async (userId, days = 30) => {
    const response = await apiClient.get(`/rbac/ai-champion/${userId}/score/`, {
      params: { days }
    });
    return response.data;
  },

  recomputeChampion: async (year, month) => {
    const response = await apiClient.post('/rbac/ai-champion/recompute/', null, {
      params: { year, month }
    });
    return response.data;
  },

  exportLeaderboardCSV: async (days = 30) => {
    const response = await apiClient.get('/rbac/ai-champion/export/csv/', {
      params: { days },
      responseType: 'blob'
    });
    return response.data;
  },

  // ===== Activity Reports — Admin Dashboard =====
  getActivitySummary: async (window = 'month') => {
    const response = await apiClient.get('/rbac/activity-reports/summary/', {
      params: { window }
    });
    return response.data;
  },

  getActivityByUser: async (window = 'month', limit = 50) => {
    const response = await apiClient.get('/rbac/activity-reports/by-user/', {
      params: { window, limit }
    });
    return response.data;
  },

  getActivityByFeature: async (window = 'month') => {
    const response = await apiClient.get('/rbac/activity-reports/by-feature/', {
      params: { window }
    });
    return response.data;
  },

  getActivityDaily: async (window = 'week') => {
    const response = await apiClient.get('/rbac/activity-reports/daily/', {
      params: { window }
    });
    return response.data;
  },

  getActivityTimeWindows: async () => {
    const response = await apiClient.get('/rbac/activity-reports/time-windows/');
    return response.data;
  },

  exportActivityReportCSV: async (window = 'month', format = 'user') => {
    const response = await apiClient.get('/rbac/activity-reports/export/csv/', {
      params: { window, format },
      responseType: 'blob'
    });
    return response.data;
  },
};

export default analyticsService;
