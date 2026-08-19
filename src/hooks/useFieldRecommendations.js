/**
 * Custom React Hook for Field Recommendations
 * Provides easy integration of recommendations into forms
 */

import { useState, useEffect, useCallback } from 'react';
import RecommendationsService from '../services/recommendations.service';

/**
 * Hook for managing field recommendations
 * @param {Object} formData - Current form state
 * @param {Object} options - Hook options
 * @returns {Object} Recommendations state and helpers
 */
export const useFieldRecommendations = (formData = {}, options = {}) => {
  const {
    autoFetch = true,
    context = {},
    onRecommendationsLoaded = null
  } = options;

  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch recommendations from API
   */
  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Build context from form data if not provided
      const fetchContext = {
        ...context,
        project_no: context.project_no || formData.project_no,
        tag_prefix: context.tag_prefix || (formData.tag_no ? formData.tag_no.substring(0, 3) : null)
      };

      const data = await RecommendationsService.getRecommendations(fetchContext, forceRefresh);
      setRecommendations(data);

      if (onRecommendationsLoaded) {
        onRecommendationsLoaded(data);
      }

      console.log('✅ Recommendations loaded in hook:', data.context);
    } catch (err) {
      setError(err.message);
      console.error('❌ Hook: Failed to fetch recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, [formData.project_no, formData.tag_no, context, onRecommendationsLoaded]);

  /**
   * Auto-fetch on mount if enabled
   */
  useEffect(() => {
    if (autoFetch) {
      fetchRecommendations();
    }
  }, []); // Only run on mount

  /**
   * Get suggestions for a specific field
   */
  const getSuggestionsForField = useCallback((fieldName) => {
    if (!recommendations) return [];
    return RecommendationsService.getTextFieldSuggestions(fieldName, recommendations);
  }, [recommendations]);

  /**
   * Get numeric suggestion for a field
   */
  const getNumericSuggestion = useCallback((fieldName) => {
    if (!recommendations) return null;
    return RecommendationsService.getNumericFieldSuggestion(fieldName, recommendations);
  }, [recommendations]);

  /**
   * Apply suggestion to a field
   */
  const applySuggestion = useCallback((fieldName, value, setFieldValue) => {
    console.log(`💡 Applying suggestion for ${fieldName}:`, value);
    setFieldValue(fieldName, value);
  }, []);

  /**
   * Auto-fill multiple fields with suggestions
   */
  const autoFillForm = useCallback((fieldsToFill, setFormData) => {
    if (!recommendations) {
      console.warn('⚠️ No recommendations available for auto-fill');
      return;
    }

    const updates = RecommendationsService.autoFillFields(
      formData,
      fieldsToFill,
      recommendations
    );

    if (Object.keys(updates).length > 0) {
      console.log('🎯 Auto-filling fields:', Object.keys(updates));
      setFormData(prevData => ({
        ...prevData,
        ...updates
      }));
    } else {
      console.log('ℹ️ No fields to auto-fill (all have values or no suggestions)');
    }
  }, [formData, recommendations]);

  /**
   * Get smart motor efficiency suggestion
   */
  const getMotorEfficiencySuggestion = useCallback((motorClassification) => {
    if (!recommendations || !motorClassification) return null;
    return RecommendationsService.suggestMotorEfficiency(motorClassification, recommendations);
  }, [recommendations]);

  /**
   * Check if recommendations are ready
   */
  const isReady = !loading && recommendations !== null && !error;

  /**
   * Get recommendation statistics
   */
  const stats = recommendations?.context || null;

  return {
    // State
    recommendations,
    loading,
    error,
    isReady,
    stats,
    
    // Methods
    fetchRecommendations,
    getSuggestionsForField,
    getNumericSuggestion,
    applySuggestion,
    autoFillForm,
    getMotorEfficiencySuggestion,
    
    // Utilities
    clearCache: RecommendationsService.clearCache
  };
};

export default useFieldRecommendations;
