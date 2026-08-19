/**
 * QHSE Module Names and Labels Configuration
 * Soft-coded configuration for QHSE module titles, labels, and descriptions
 * 
 * USAGE:
 * - Import and use these labels in Sidebar, headers, breadcrumbs, etc.
 * - Easy to update module names across the entire application
 * - Centralized management of all QHSE module metadata
 * - Control module visibility with 'enabled' flag
 * 
 * MODIFICATION HISTORY:
 * - 2026-07-11: Changed "8.4 Health and Safety" to "8.4 Occupational Health & Safety"
 * - 2026-07-11: Disabled Environmental (8.5) and Energy (8.6) modules - not related to project quality
 */

export const QHSE_MODULE_LABELS = {
  // ========================================================================
  // QHSE MAIN MODULES (8.x Series)
  // ========================================================================
  
  general: {
    code: '8',
    title: 'QHSE',
    fullTitle: 'Quality, Health, Safety & Environment',
    description: 'Comprehensive QHSE management system',
    enabled: true
  },
  
  dashboard: {
    code: '8.1',
    title: '8.1 Dashboard',
    shortTitle: 'Dashboard',
    description: 'QHSE overview and key metrics',
    path: '/qhse/general/dashboard',
    enabled: true
  },
  
  overview: {
    code: '8.2',
    title: '8.2 Overview',
    shortTitle: 'Overview',
    description: 'Projects overview and status',
    path: '/qhse/general',
    enabled: true
  },
  
  quality: {
    code: '8.3',
    title: '8.3 Quality Management',
    shortTitle: 'Quality Management',
    description: 'Quality management and control',
    path: '/qhse/general/quality',
    enabled: true
  },
  
  healthSafety: {
    code: '8.4',
    title: '8.4 Occupational Health & Safety',
    shortTitle: 'Occupational Health & Safety',
    description: 'Occupational health and safety management',
    path: '/qhse/general/health-safety',
    enabled: true,
    // Legacy labels (for reference)
    legacyTitle: '8.4 Health & Safety',
    legacyShortTitle: 'Health and Safety'
  },
  
  environmental: {
    code: '8.5',
    title: '8.5 Environmental',
    shortTitle: 'Environmental',
    description: 'Environmental management and compliance',
    path: '/qhse/general/environmental',
    enabled: false, // DISABLED: 2026-07-11 - Not related to project quality
    disabledReason: 'Module disabled - not related to project quality per QHSE Expert'
  },
  
  energy: {
    code: '8.6',
    title: '8.6 Energy',
    shortTitle: 'Energy',
    description: 'Energy management and efficiency',
    path: '/qhse/general/energy',
    enabled: false, // DISABLED: 2026-07-11 - Not related to project quality
    disabledReason: 'Module disabled - not related to project quality per QHSE Expert'
  },
  
  technicalQHSE: {
    code: '8.7',
    title: '8.7 Technical QHSE',
    shortTitle: 'Technical QHSE',
    description: 'Technical QHSE documentation and compliance',
    path: '/qhse/general/technical-qhse',
    enabled: true
  },
  
  projectQHSE: {
    code: '8.8',
    title: '8.8 Project QHSE',
    shortTitle: 'Project QHSE',
    description: 'Project-specific QHSE management',
    path: '/qhse/general/project-qhse',
    enabled: true
  }
};

/**
 * Get module label by key
 * @param {string} moduleKey - Key from QHSE_MODULE_LABELS (e.g., 'healthSafety')
 * @param {string} labelType - Type of label to retrieve ('title', 'shortTitle', 'description')
 * @returns {string} The requested label
 */
export const getQHSEModuleLabel = (moduleKey, labelType = 'title') => {
  const module = QHSE_MODULE_LABELS[moduleKey];
  if (!module) {
    console.warn(`QHSE module key "${moduleKey}" not found in configuration`);
    return '';
  }
  return module[labelType] || module.title || '';
};

/**
 * Check if a module is enabled
 * @param {string} moduleKey - Key from QHSE_MODULE_LABELS
 * @returns {boolean} True if module is enabled
 */
export const isQHSEModuleEnabled = (moduleKey) => {
  const module = QHSE_MODULE_LABELS[moduleKey];
  if (!module) return false;
  return module.enabled !== false; // Default to true if not specified
};

/**
 * Get all module titles as an array (useful for dropdowns, filters)
 * @param {boolean} enabledOnly - If true, only return enabled modules
 * @returns {Array} Array of module objects with id and title
 */
export const getQHSEModuleList = (enabledOnly = false) => {
  return Object.entries(QHSE_MODULE_LABELS)
    .filter(([key, module]) => {
      if (key === 'general') return false; // Exclude general
      if (enabledOnly && module.enabled === false) return false; // Filter disabled modules
      return true;
    })
    .map(([key, module]) => ({
      id: key,
      code: module.code,
      title: module.title,
      shortTitle: module.shortTitle,
      path: module.path,
      description: module.description,
      enabled: module.enabled !== false
    }));
};

/**
 * Find module by path
 * @param {string} path - Route path (e.g., '/qhse/general/health-safety')
 * @returns {object|null} Module configuration object or null if not found
 */
export const findQHSEModuleByPath = (path) => {
  const entry = Object.entries(QHSE_MODULE_LABELS).find(
    ([_, module]) => module.path === path
  );
  return entry ? { key: entry[0], ...entry[1] } : null;
};

export default QHSE_MODULE_LABELS;
