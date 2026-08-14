import apiClient from './api.service'

/**
 * Notification Service
 * Handles all notification-related API calls
 */

const NOTIFICATION_BASE_URL = '/notifications'

// ─── Soft-coded knobs ───────────────────────────────────────────────────────
// Polls run in the background — they must fail fast so that a busy worker
// (e.g. handling a large upload) does not block the UI for 120 s.
// Override at runtime via window.__NOTIFICATION_POLL_TIMEOUT_MS = 5000 if needed.
const NOTIFICATION_POLL_TIMEOUT_MS =
  (typeof window !== 'undefined' && window.__NOTIFICATION_POLL_TIMEOUT_MS) || 10000

export const notificationService = {
  /**
   * Get all notifications for current user
   * @param {Object} params - Query parameters (priority, status, category, is_read)
   * @returns {Promise}
   */
  getNotifications: async (params = {}, options = {}) => {
    try {
      const response = await apiClient.get(NOTIFICATION_BASE_URL + '/', {
        params,
        timeout: NOTIFICATION_POLL_TIMEOUT_MS,
        silentTimeout: true,
        ...options,
      })
      return response.data
    } catch (error) {
      if (error.code !== 'ERR_CANCELED') {
        console.warn('[Notification Service] Notification list unavailable:', error.message)
      }
      throw error
    }
  },

  /**
   * Get unread notification count
   * @returns {Promise<number>}
   */
  getUnreadCount: async (options = {}) => {
    try {
      console.log('[Notification Service] Fetching unread count...')
      const response = await apiClient.get(`${NOTIFICATION_BASE_URL}/unread_count/`, {
        timeout: NOTIFICATION_POLL_TIMEOUT_MS,
        ...options,
      })
      console.log('[Notification Service] Response:', response.data)
      return response.data.unread_count || 0
    } catch (error) {
      // Silent failure for background poll — UI keeps the last known count.
      // Toast suppression is handled in api.service.js via SILENT_TIMEOUT_ENDPOINTS.
      console.warn('[Notification Service] Unread count poll failed (silent):', error.message)
      if (error.response?.status === 401) {
        console.error('[Notification Service] ⚠️ Unauthorized - User may need to login')
      }
      return 0
    }
  },

  /**
   * Mark notification(s) as read
   * @param {number|number[]} notificationIds - Single ID or array of IDs
   * @returns {Promise}
   */
  markAsRead: async (notificationIds) => {
    try {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds]
      const response = await apiClient.post(`${NOTIFICATION_BASE_URL}/mark_as_read/`, {
        notification_ids: ids
      })
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error marking as read:', error)
      throw error
    }
  },

  /**
   * Mark all notifications as read
   * @returns {Promise}
   */
  markAllAsRead: async () => {
    try {
      const response = await apiClient.post(`${NOTIFICATION_BASE_URL}/mark_all_as_read/`)
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error marking all as read:', error)
      throw error
    }
  },

  /**
   * Get notification statistics
   * @returns {Promise}
   */
  getStats: async () => {
    try {
      const response = await apiClient.get(`${NOTIFICATION_BASE_URL}/stats/`)
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error fetching stats:', error)
      throw error
    }
  },

  /**
   * Get notification categories
   * @returns {Promise}
   */
  getCategories: async () => {
    try {
      const response = await apiClient.get(`${NOTIFICATION_BASE_URL}/categories/`)
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error fetching categories:', error)
      throw error
    }
  },

  /**
   * Get user notification preferences
   * @returns {Promise}
   */
  getPreferences: async () => {
    try {
      const response = await apiClient.get(`${NOTIFICATION_BASE_URL}/preferences/`)
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error fetching preferences:', error)
      throw error
    }
  },

  /**
   * Update user notification preferences
   * @param {Object} preferences - Preference data
   * @returns {Promise}
   */
  updatePreferences: async (preferences) => {
    try {
      const response = await apiClient.patch(`${NOTIFICATION_BASE_URL}/preferences/`, preferences)
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error updating preferences:', error)
      throw error
    }
  },

  /**
   * Delete a notification
   * @param {number} notificationId
   * @returns {Promise}
   */
  deleteNotification: async (notificationId) => {
    try {
      const response = await apiClient.delete(`${NOTIFICATION_BASE_URL}/${notificationId}/`)
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error deleting notification:', error)
      throw error
    }
  },

  decideOffboarding: async (offboardingId, decision, note = '') => {
    const response = await apiClient.post(
      `/onboarding/offboarding/${offboardingId}/project-manager-decision/`,
      { decision, note }
    )
    return response.data
  },

  /**
   * Archive old notifications
   * @param {number} days - Archive notifications older than X days
   * @returns {Promise}
   */
  archiveOld: async (days = 30) => {
    try {
      const response = await apiClient.post(`${NOTIFICATION_BASE_URL}/archive_old/`, { days })
      return response.data
    } catch (error) {
      console.error('[Notification Service] Error archiving notifications:', error)
      throw error
    }
  }
}

export default notificationService
