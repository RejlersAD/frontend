/**
 * Usage Tracking API Service
 * 
 * Handles all API calls for usage tracking and analytics
 */

import api from './api.service';

const usageTrackingService = {
  /**
   * Get global usage summary
   */
  getSummary: async () => {
    try {
      const response = await api.get('/usage/overview/');
      return response.data;
    } catch (error) {
      console.error('[Usage Tracking] Failed to fetch summary:', error);
      return {
        total_users: 0,
        active_today: 0,
        total_sessions: 0,
        avg_session_duration: 0,
        total_requests: 0
      };
    }
  },

  /**
   * Get department usage breakdown
   */
  getDepartmentUsage: async () => {
    try {
      const response = await api.get('/usage/department-usage/');
      return response.data;
    } catch (error) {
      console.error('[Usage Tracking] Failed to fetch department usage:', error);
      return [];
    }
  },

  /**
   * Get feature usage statistics
   */
  getFeatureUsage: async () => {
    try {
      const response = await api.get('/usage/feature-usage/');
      return response.data;
    } catch (error) {
      console.error('[Usage Tracking] Failed to fetch feature usage:', error);
      return [];
    }
  },

  /**
   * Get top users
   * @param {number} limit - Number of top users to fetch
   */
  getTopUsers: async (limit = 10) => {
    try {
      const response = await api.get('/usage/top-users/', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('[Usage Tracking] Failed to fetch top users:', error);
      return [];
    }
  },

  /**
   * Get usage trends
   * @param {number} days - Number of days to look back
   */
  getTrends: async (days = 30) => {
    try {
      const response = await api.get('/usage/usage-trends/', {
        params: { days },
      });
      return response.data;
    } catch (error) {
      console.error('[Usage Tracking] Failed to fetch trends:', error);
      return [];
    }
  },

  /**
   * Get usage logs (paginated)
   * @param {object} params - Query parameters
   */
  getUsageLogs: async (params = {}) => {
    try {
      const response = await api.get('/usage/', {
        params,
      });
      return response.data;
    } catch (error) {
      console.error('[Usage Tracking] Failed to fetch usage logs:', error);
      return { results: [], count: 0 };
    }
  },
};

export default usageTrackingService;
