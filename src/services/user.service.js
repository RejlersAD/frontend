import apiClient from './api.service'
import { API_ENDPOINTS } from '../config/api.config'

/**
 * User Service
 * Smart user-related operations
 */

export const userService = {
  /**
   * Get all users
   */
  async getUsers(params = {}) {
    const response = await apiClient.get(API_ENDPOINTS.USERS, { params })
    return response.data
  },

  /**
   * Get user by ID
   */
  async getUserById(id) {
    const response = await apiClient.get(`${API_ENDPOINTS.USERS}${id}/`)
    return response.data
  },

  /**
   * Update current user profile
   */
  async updateProfile(data) {
    const response = await apiClient.put(API_ENDPOINTS.USER_PROFILE, data)
    return response.data
  },

  /**
   * Update user by ID
   */
  async updateUser(id, data) {
    const response = await apiClient.patch(`${API_ENDPOINTS.USERS}${id}/`, data)
    return response.data
  },

  /**
   * Delete user
   */
  async deleteUser(id) {
    const response = await apiClient.delete(`${API_ENDPOINTS.USERS}${id}/`)
    return response.data
  },
}
