/**
 * Field Recommendations Service
 * Provides intelligent suggestions based on historical data
 * Soft-coded for easy expansion and reusability
 */

import apiClient from './api.service';

class RecommendationsService {
  /**
   * Field categories for organizing recommendations
   */
  static FIELD_CATEGORIES = {
    PROJECT_INFO: ['agreement_no', 'project_no', 'revision', 'document_class'],
    PUMP_SPECS: ['tag_no', 'service', 'motor_classification', 'type_of_motor'],
    THERMAL: ['temperature', 'fluid_viscosity_at_temp', 'density'],
    POWER: ['hp', 'motor_rating', 'motor_efficiency', 'pump_efficiency'],
    SAFETY: ['safety_margin_npsha', 'cv_rangeability']
  };

  /**
   * Cache for recommendations to minimize API calls
   */
  static cache = {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes cache
  };

  /**
   * Fetch field recommendations from backend
   * @param {Object} context - Context filters (project_no, tag_prefix)
   * @param {boolean} forceRefresh - Force cache refresh
   * @returns {Promise<Object>} Recommendations data
   */
  static async getRecommendations(context = {}, forceRefresh = false) {
    const now = Date.now();
    
    // Return cached data if valid
    if (!forceRefresh && this.cache.data && (now - this.cache.timestamp) < this.cache.ttl) {
      console.log('📦 Using cached recommendations');
      return this.cache.data;
    }

    try {
      console.log('🔄 Fetching recommendations from API', context);
      
      const params = new URLSearchParams();
      if (context.project_no) params.append('project_no', context.project_no);
      if (context.tag_prefix) params.append('tag_prefix', context.tag_prefix);
      if (context.limit) params.append('limit', context.limit);

      const response = await apiClient.get(
        `/process-datasheet/pump-calculations/field_recommendations/?${params.toString()}`
      );

      // Cache the result
      this.cache.data = response.data;
      this.cache.timestamp = now;

      console.log('✅ Recommendations fetched:', response.data.context);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch recommendations:', error);
      return {
        text_fields: {},
        numeric_fields: {},
        smart_combinations: {},
        context: { total_records_analyzed: 0 }
      };
    }
  }

  /**
   * Get suggestions for a specific text field
   * @param {string} fieldName - Field name
   * @param {Object} recommendations - Full recommendations data
   * @returns {Array} Array of suggestions with metadata
   */
  static getTextFieldSuggestions(fieldName, recommendations) {
    const fieldData = recommendations.text_fields?.[fieldName];
    
    if (!fieldData) return [];

    // Combine most common and recent values, prioritizing common ones
    const suggestions = [];
    const seen = new Set();

    // Add most common values first
    fieldData.most_common?.forEach(item => {
      if (!seen.has(item.value)) {
        suggestions.push({
          value: item.value,
          label: item.value,
          badge: `Used ${item.count}x`,
          priority: 'high',
          count: item.count
        });
        seen.add(item.value);
      }
    });

    // Add recent values that aren't already included
    fieldData.recent_values?.forEach(value => {
      if (!seen.has(value) && suggestions.length < 10) {
        suggestions.push({
          value: value,
          label: value,
          badge: 'Recent',
          priority: 'medium'
        });
        seen.add(value);
      }
    });

    return suggestions;
  }

  /**
   * Get numeric field suggestion with statistical context
   * @param {string} fieldName - Field name
   * @param {Object} recommendations - Full recommendations data
   * @returns {Object} Suggestion with statistics
   */
  static getNumericFieldSuggestion(fieldName, recommendations) {
    const fieldData = recommendations.numeric_fields?.[fieldName];
    
    if (!fieldData) return null;

    return {
      suggested: fieldData.suggested_default,
      average: fieldData.average,
      max: fieldData.max,
      commonValues: fieldData.most_common || [],
      tooltip: `Avg: ${fieldData.average?.toFixed(2) || 'N/A'}, Max: ${fieldData.max?.toFixed(2) || 'N/A'}`
    };
  }

  /**
   * Get smart combination suggestions (e.g., motor type + efficiency)
   * @param {Object} recommendations - Full recommendations data
   * @returns {Object} Smart combinations
   */
  static getSmartCombinations(recommendations) {
    return recommendations.smart_combinations || {};
  }

  /**
   * Suggest motor efficiency based on motor classification
   * @param {string} motorClassification - Selected motor classification
   * @param {Object} recommendations - Full recommendations data
   * @returns {number|null} Suggested efficiency
   */
  static suggestMotorEfficiency(motorClassification, recommendations) {
    const combos = recommendations.smart_combinations?.motor_classification_efficiency || [];
    
    const match = combos.find(
      combo => combo.motor_classification === motorClassification
    );

    return match ? match.typical_efficiency : null;
  }

  /**
   * Get contextual field value based on form state
   * @param {string} fieldName - Field to get suggestion for
   * @param {Object} formData - Current form state
   * @param {Object} recommendations - Full recommendations data
   * @returns {any} Suggested value
   */
  static getContextualSuggestion(fieldName, formData, recommendations) {
    // Text field suggestions
    if (recommendations.text_fields?.[fieldName]) {
      const suggestions = this.getTextFieldSuggestions(fieldName, recommendations);
      return suggestions[0]?.value || null;
    }

    // Numeric field suggestions
    if (recommendations.numeric_fields?.[fieldName]) {
      return this.getNumericFieldSuggestion(fieldName, recommendations)?.suggested || null;
    }

    // Smart combination logic
    if (fieldName === 'motor_efficiency' && formData.motor_classification) {
      return this.suggestMotorEfficiency(formData.motor_classification, recommendations);
    }

    return null;
  }

  /**
   * Auto-fill multiple fields with intelligent suggestions
   * @param {Object} currentFormData - Current form state
   * @param {Array} fieldsToFill - Array of field names to auto-fill
   * @param {Object} recommendations - Full recommendations data
   * @returns {Object} Object with field values to set
   */
  static autoFillFields(currentFormData, fieldsToFill, recommendations) {
    const updates = {};

    fieldsToFill.forEach(fieldName => {
      // Don't overwrite existing values
      if (!currentFormData[fieldName]) {
        const suggestion = this.getContextualSuggestion(
          fieldName,
          currentFormData,
          recommendations
        );
        
        if (suggestion !== null) {
          updates[fieldName] = suggestion;
        }
      }
    });

    return updates;
  }

  /**
   * Clear recommendations cache
   */
  static clearCache() {
    this.cache.data = null;
    this.cache.timestamp = null;
    console.log('🗑️ Recommendations cache cleared');
  }
}

export default RecommendationsService;
