/**
 * QHSE Quality Management Configuration
 * Soft-coded configuration for Quality Management features and settings
 * 
 * USAGE:
 * - Control feature visibility and behavior
 * - Easy to enable/disable features without code changes
 * - Central configuration for all Quality Management settings
 */

export const QUALITY_MANAGEMENT_CONFIG = {
  // ========================================================================
  // FEATURE TOGGLES
  // ========================================================================
  
  /**
   * Projects Needing Attention - DISABLED
   * Reason: QHSE focuses on overall company quality, not individual project quality
   * Date: 2026-07-11
   */
  showProjectsNeedingAttention: false,
  
  /**
   * Enable detailed modal views for metric cards
   * When clicked, shows comprehensive details in a modal
   */
  enableDetailedMetricViews: true,
  
  /**
   * Enable expandable sections in Audits and Compliance views
   * Allows sections to be expanded/collapsed for better organization
   */
  enableExpandableSections: true,
  
  // ========================================================================
  // METRIC CARD SETTINGS
  // ========================================================================
  
  /**
   * Configuration for each metric card in the overview
   */
  metricCards: {
    qualityScore: {
      enabled: true,
      showDetailButton: true,
      detailView: 'modal', // 'modal' or 'inline'
      title: 'Quality Score Details',
      description: 'Comprehensive quality performance analysis'
    },
    complianceRate: {
      enabled: true,
      showDetailButton: true,
      detailView: 'modal',
      title: 'Compliance Rate Details',
      description: 'Detailed compliance metrics and trends'
    },
    openIssues: {
      enabled: true,
      showDetailButton: true,
      detailView: 'modal',
      title: 'Open Issues Details',
      description: 'Complete list of CARs and Observations'
    },
    qualityAudits: {
      enabled: true,
      showDetailButton: true,
      detailView: 'modal',
      title: 'Quality Audits Details',
      description: 'Full audit schedule and history'
    }
  },
  
  // ========================================================================
  // AUDIT SETTINGS
  // ========================================================================
  
  auditSettings: {
    // Default number of audits to show in collapsed view
    defaultVisibleCount: 3,
    // Allow expanding to show all audits
    allowExpand: true,
    // Show audit statistics
    showStatistics: true,
    // Group audits by type
    groupByType: true
  },
  
  // ========================================================================
  // COMPLIANCE SETTINGS
  // ========================================================================
  
  complianceSettings: {
    // Default number of compliance items to show
    defaultVisibleCount: 5,
    // Allow expanding categories
    allowExpand: true,
    // Show compliance charts
    showCharts: true,
    // Enable filtering by status
    enableFiltering: true
  },
  
  // ========================================================================
  // CHART SETTINGS
  // ========================================================================
  
  chartSettings: {
    // Default height for charts
    defaultHeight: 300,
    // Enable animations
    enableAnimations: true,
    // Color scheme
    colors: {
      cars: '#ef4444',      // red
      observations: '#f59e0b', // orange
      total: '#8b5cf6',     // purple
      compliant: '#10b981', // green
      nonCompliant: '#ef4444' // red
    }
  }
};

/**
 * Check if a feature is enabled
 * @param {string} featurePath - Dot-notation path to feature (e.g., 'metricCards.qualityScore.enabled')
 * @returns {boolean} True if feature is enabled
 */
export const isFeatureEnabled = (featurePath) => {
  const keys = featurePath.split('.');
  let value = QUALITY_MANAGEMENT_CONFIG;
  
  for (const key of keys) {
    if (value[key] === undefined) return false;
    value = value[key];
  }
  
  return value === true;
};

/**
 * Get configuration value
 * @param {string} configPath - Dot-notation path to config value
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Configuration value
 */
export const getConfig = (configPath, defaultValue = null) => {
  const keys = configPath.split('.');
  let value = QUALITY_MANAGEMENT_CONFIG;
  
  for (const key of keys) {
    if (value[key] === undefined) return defaultValue;
    value = value[key];
  }
  
  return value;
};

export default QUALITY_MANAGEMENT_CONFIG;
