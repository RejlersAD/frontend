/**
 * Feature Registry Service
 * Handles dynamic feature discovery and management
 */

import apiClient from './api.service'

class FeatureService {
  /**
   * Get all features available to the current user
   */
  async getFeatures(filters = {}) {
    try {
      const params = new URLSearchParams()
      
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)
      
      const response = await apiClient.get(`/features/?${params.toString()}`)
      return response.data
    } catch (error) {
      console.error('Error fetching features:', error)
      throw error
    }
  }

  /**
   * Get a specific feature by ID
   */
  async getFeature(featureId) {
    try {
      const response = await apiClient.get(`/features/${featureId}/`)
      return response.data
    } catch (error) {
      console.error(`Error fetching feature ${featureId}:`, error)
      throw error
    }
  }

  /**
   * Get all feature categories with counts
   */
  async getCategories() {
    try {
      const response = await apiClient.get(`/features/meta/categories/`)
      return response.data
    } catch (error) {
      console.error('Error fetching categories:', error)
      throw error
    }
  }

  /**
   * Get dynamic navigation structure
   */
  async getNavigation() {
    try {
      const response = await apiClient.get(`/features/meta/navigation/`)
      return response.data
    } catch (error) {
      console.error('Error fetching navigation:', error)
      throw error
    }
  }

  /**
   * Search features
   */
  async searchFeatures(query) {
    return this.getFeatures({ search: query })
  }

  /**
   * Get features by category
   */
  async getFeaturesByCategory(category) {
    return this.getFeatures({ category })
  }
}

export default new FeatureService()
