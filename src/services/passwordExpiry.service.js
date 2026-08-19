/**
 * Password Expiry Service
 * Handles password expiry checking and notifications
 * Soft-coded approach for maintainability
 */

import apiClient from './api.service';
import { PASSWORD_RESET_API, PASSWORD_EXPIRY_CONFIG } from '../config/passwordReset.config';

class PasswordExpiryService {
  constructor() {
    this.checkIntervalId = null;
    this.expiryStatus = null;
    this.listeners = [];
  }

  /**
   * Check password expiry status from backend
   * @returns {Promise<Object>} Expiry status object
   */
  async checkPasswordExpiry() {
    try {
      const response = await apiClient.get(PASSWORD_RESET_API.checkExpiry);
      this.expiryStatus = response.data;
      this.notifyListeners(this.expiryStatus);
      return this.expiryStatus;
    } catch (error) {
      console.error('[PasswordExpiry] Failed to check password expiry:', error);
      throw error;
    }
  }

  /**
   * Get current expiry status (from cache)
   * @returns {Object|null} Cached expiry status
   */
  getExpiryStatus() {
    return this.expiryStatus;
  }

  /**
   * Start periodic password expiry checks
   * @param {number} interval - Check interval in milliseconds (default from config)
   */
  startPeriodicCheck(interval = PASSWORD_EXPIRY_CONFIG.checkInterval) {
    // Stop any existing interval
    this.stopPeriodicCheck();

    // Perform initial check
    this.checkPasswordExpiry().catch(err => {
      console.warn('[PasswordExpiry] Initial check failed:', err);
    });

    // Set up periodic checks
    this.checkIntervalId = setInterval(() => {
      this.checkPasswordExpiry().catch(err => {
        console.warn('[PasswordExpiry] Periodic check failed:', err);
      });
    }, interval);

    console.log(`[PasswordExpiry] Started periodic checks every ${interval / 1000}s`);
  }

  /**
   * Stop periodic password expiry checks
   */
  stopPeriodicCheck() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log('[PasswordExpiry] Stopped periodic checks');
    }
  }

  /**
   * Subscribe to expiry status changes
   * @param {Function} callback - Called when expiry status changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.push(callback);
    
    // Immediately call with current status if available
    if (this.expiryStatus) {
      callback(this.expiryStatus);
    }

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of status change
   * @param {Object} status - New expiry status
   */
  notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[PasswordExpiry] Listener error:', error);
      }
    });
  }

  /**
   * Check if password requires immediate change
   * @returns {boolean}
   */
  requiresChange() {
    return this.expiryStatus?.requires_change || false;
  }

  /**
   * Check if password is expired
   * @returns {boolean}
   */
  isExpired() {
    return this.expiryStatus?.expired || false;
  }

  /**
   * Check if in warning period
   * @returns {boolean}
   */
  isInWarningPeriod() {
    return this.expiryStatus?.in_warning_period || false;
  }

  /**
   * Check if in grace period
   * @returns {boolean}
   */
  isInGracePeriod() {
    return this.expiryStatus?.in_grace_period || false;
  }

  /**
   * Get days until expiry
   * @returns {number|null}
   */
  getDaysUntilExpiry() {
    return this.expiryStatus?.days_until_expiry ?? null;
  }

  /**
   * Get formatted expiry message
   * @returns {string}
   */
  getExpiryMessage() {
    if (!this.expiryStatus) {
      return 'Unable to check password expiry status';
    }

    if (this.expiryStatus.exempt) {
      return 'Your account is exempt from password expiry';
    }

    if (this.expiryStatus.requires_change) {
      const daysOverdue = Math.abs(this.expiryStatus.days_until_expiry);
      return `Your password expired ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago. Please change it immediately.`;
    }

    if (this.expiryStatus.in_grace_period) {
      const daysOverdue = Math.abs(this.expiryStatus.days_until_expiry);
      return `Your password expired ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago. Please change it soon.`;
    }

    if (this.expiryStatus.in_warning_period) {
      const days = this.expiryStatus.days_until_expiry;
      return `Your password will expire in ${days} day${days !== 1 ? 's' : ''}. Consider changing it soon.`;
    }

    const days = this.expiryStatus.days_until_expiry;
    return `Your password is valid for ${days} more day${days !== 1 ? 's' : ''}`;
  }

  /**
   * Get expiry alert level
   * @returns {string} 'none' | 'info' | 'warning' | 'error'
   */
  getAlertLevel() {
    if (!this.expiryStatus || this.expiryStatus.exempt) {
      return 'none';
    }

    if (this.expiryStatus.requires_change) {
      return 'error';
    }

    if (this.expiryStatus.in_grace_period) {
      return 'error';
    }

    if (this.expiryStatus.in_warning_period) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Handle expiry response headers from API
   * @param {Object} headers - Response headers
   */
  handleResponseHeaders(headers) {
    const warningHeader = headers['x-password-expiry-warning'];
    const graceHeader = headers['x-password-expiry-grace'];
    const daysUntilExpiry = headers['x-password-days-until-expiry'];
    const daysOverdue = headers['x-password-days-overdue'];

    if (warningHeader === 'true' || graceHeader === 'true') {
      // Update status if needed
      this.checkPasswordExpiry().catch(err => {
        console.warn('[PasswordExpiry] Failed to update status from headers:', err);
      });
    }
  }

  /**
   * Clear cached status
   */
  clearStatus() {
    this.expiryStatus = null;
  }

  /**
   * Clear cached status and immediately notify all listeners
   * Use after a successful password change so banners hide instantly
   */
  clearAndNotify() {
    this.expiryStatus = null;
    this.notifyListeners(null);
  }
}

// Create singleton instance
const passwordExpiryService = new PasswordExpiryService();

export default passwordExpiryService;
