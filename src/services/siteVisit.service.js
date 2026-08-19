/**
 * Site Visit API Service
 * Handles GPS-based attendance tracking for off-site engineers
 */

import apiClient from './api.service';

const BASE_URL = '/api/v1/site-visits';

const siteVisitService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT SITES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get list of all client sites
   * @param {boolean} activeOnly - Filter active sites only
   */
  getSites: async (activeOnly = true) => {
    const params = activeOnly ? { is_active: true } : {};
    const response = await apiClient.get(`${BASE_URL}/sites/`, { params });
    return response.data;
  },

  /**
   * Get site details by ID
   */
  getSiteDetail: async (siteId) => {
    const response = await apiClient.get(`${BASE_URL}/sites/${siteId}/`);
    return response.data;
  },

  /**
   * Generate QR code for a site
   */
  generateSiteQR: async (siteId) => {
    const response = await apiClient.post(`${BASE_URL}/sites/${siteId}/generate_qr/`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SITE VISIT REQUESTS (Approval Workflow)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get my site visit requests
   * @param {string} status - Filter by status (PENDING, APPROVED, REJECTED, CANCELLED)
   */
  getMyRequests: async (status = null) => {
    const params = status ? { status } : {};
    const response = await apiClient.get(`${BASE_URL}/requests/`, { params });
    return response.data;
  },

  /**
   * Submit new site visit request
   * @param {Object} data - { site_id, start_date, end_date, purpose }
   */
  submitRequest: async (data) => {
    const response = await apiClient.post(`${BASE_URL}/requests/`, data);
    return response.data;
  },

  /**
   * Approve a site visit request (Manager/Admin only)
   */
  approveRequest: async (requestId, note = '') => {
    const response = await apiClient.post(`${BASE_URL}/requests/${requestId}/approve/`, {
      reviewer_note: note,
    });
    return response.data;
  },

  /**
   * Reject a site visit request (Manager/Admin only)
   */
  rejectRequest: async (requestId, note = '') => {
    const response = await apiClient.post(`${BASE_URL}/requests/${requestId}/reject/`, {
      reviewer_note: note,
    });
    return response.data;
  },

  /**
   * Cancel my pending request
   */
  cancelRequest: async (requestId) => {
    const response = await apiClient.delete(`${BASE_URL}/requests/${requestId}/`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GPS CHECK-IN / CHECK-OUT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check in to a site
   * @param {Object} data - { site_id, latitude, longitude, accuracy, method, photo }
   */
  checkIn: async (data) => {
    const formData = new FormData();
    formData.append('site', data.site_id);
    formData.append('check_in_lat', data.latitude);
    formData.append('check_in_lon', data.longitude);
    formData.append('check_in_accuracy', data.accuracy);
    formData.append('check_in_method', data.method || 'GPS');
    
    if (data.photo) {
      formData.append('check_in_photo', data.photo);
    }
    
    if (data.note) {
      formData.append('employee_note', data.note);
    }

    const response = await apiClient.post(`${BASE_URL}/check-ins/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Check out from a site
   * @param {string} checkInId - ID of the check-in record
   * @param {Object} data - { latitude, longitude, accuracy, method, photo }
   */
  checkOut: async (checkInId, data) => {
    const formData = new FormData();
    formData.append('check_out_lat', data.latitude);
    formData.append('check_out_lon', data.longitude);
    formData.append('check_out_accuracy', data.accuracy);
    formData.append('check_out_method', data.method || 'GPS');
    
    if (data.photo) {
      formData.append('check_out_photo', data.photo);
    }
    
    if (data.note) {
      formData.append('employee_note', data.note);
    }

    const response = await apiClient.post(
      `${BASE_URL}/check-ins/${checkInId}/checkout/`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },

  /**
   * Get my check-in history
   * @param {Object} filters - { start_date, end_date, site_id }
   */
  getMyCheckIns: async (filters = {}) => {
    const response = await apiClient.get(`${BASE_URL}/check-ins/`, { params: filters });
    return response.data;
  },

  /**
   * Get currently active (not checked out) site visits
   */
  getActiveSiteVisits: async () => {
    const response = await apiClient.get(`${BASE_URL}/check-ins/live/`);
    return response.data;
  },

  /**
   * Get current GPS position
   * @returns {Promise<{ latitude, longitude, accuracy }>}
   */
  getCurrentPosition: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          let message = 'Unable to get GPS location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'GPS permission denied. Please enable location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'GPS position unavailable. Try again.';
              break;
            case error.TIMEOUT:
              message = 'GPS request timed out.';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds
          maximumAge: 0,
        }
      );
    });
  },

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in meters
   */
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
};

export default siteVisitService;
