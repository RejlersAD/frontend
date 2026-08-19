/**
 * Datasheet Configuration Utility
 * Shared configuration patterns for engineering datasheets
 * 
 * This utility provides a soft-coded approach to create consistent
 * datasheet modules across different engineering disciplines.
 */

/**
 * Standard color schemes for different engineering disciplines
 */
export const DISCIPLINE_COLORS = {
  process: {
    primary: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  },
  piping: {
    primary: 'orange',
    gradient: 'from-orange-500 to-orange-600',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
  },
  electrical: {
    primary: 'yellow',
    gradient: 'from-yellow-500 to-yellow-600',
    badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
  },
  mechanical: {
    primary: 'green',
    gradient: 'from-green-500 to-green-600',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  },
  civil: {
    primary: 'gray',
    gradient: 'from-gray-500 to-gray-600',
    badge: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
  },
  structural: {
    primary: 'stone',
    gradient: 'from-stone-500 to-stone-600',
    badge: 'bg-stone-100 dark:bg-stone-900/30 text-stone-700 dark:text-stone-300'
  }
};

/**
 * Standard badge types with consistent styling
 */
export const BADGE_TYPES = {
  AI_POWERED: {
    label: 'AI Powered',
    style: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  },
  NEW: {
    label: 'New',
    style: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  },
  BETA: {
    label: 'Beta',
    style: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
  },
  COMING_SOON: {
    label: 'Coming Soon',
    style: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  },
  UPDATED: {
    label: 'Updated',
    style: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
  }
};

/**
 * Standard card icons for common datasheet types
 */export const DATASHEET_ICONS = {
  // Process Engineering
  PFD: 'DocumentChartBarIcon',
  HMB: 'BeakerIcon',
  EQUIPMENT: 'CubeIcon',
  STREAMS: 'TableCellsIcon',
  SIMULATION: 'ChartBarIcon',
  UTILITIES: 'CircleStackIcon',
  
  // Piping Engineering
  STRESS_ANALYSIS: 'TableCellsIcon',
  SPECIFICATIONS: 'DocumentTextIcon',
  REPORTS: 'ChartBarIcon',
  ISOMETRIC: 'ClipboardDocumentListIcon',
  
  // Common
  DOCUMENT: 'DocumentTextIcon',
  DATA: 'TableCellsIcon',
  CHART: 'ChartBarIcon',
  UPLOAD: 'CloudArrowUpIcon'
};

/**
 * Generate datasheet card configuration
 * @param {Object} config - Card configuration
 * @returns {Object} Complete card configuration with defaults
 */
export const createDatasheetCard = (config) => {
  const {
    id,
    name,
    description,
    icon,
    color = 'blue',
    path,
    badge = null,
    disabled = false,
    features = []
  } = config;

  return {
    id,
    name,
    description,
    icon,
    color,
    gradient: `from-${color}-500 to-${color}-600`,
    path,
    badge,
    disabled,
    features: Array.isArray(features) ? features : []
  };
};

/**
 * Standard project types for different engineering applications
 */
export const PROJECT_TYPES = {
  PROCESS: [
    { value: 'offshore', label: 'Offshore Platform', icon: '🌊' },
    { value: 'onshore', label: 'Onshore Facility', icon: '🏭' },
    { value: 'refinery', label: 'Refinery', icon: '⚗️' },
    { value: 'petrochemical', label: 'Petrochemical Plant', icon: '🧪' },
    { value: 'general', label: 'General Process', icon: '⚙️' }
  ],
  PIPING: [
    { value: 'offshore', label: 'Offshore Platform', icon: '🌊' },
    { value: 'onshore', label: 'Onshore Facility', icon: '🏭' },
    { value: 'general', label: 'General Industrial', icon: '⚙️' }
  ]
};

/**
 * Standard document types for upload functionality
 */
export const DOCUMENT_TYPES = {
  MANDATORY: {
    PFD: {
      label: 'Process Flow Diagram (PFD)',
      description: 'Upload your PFD for AI-powered analysis and equipment identification',
      accept: '.pdf,.png,.jpg,.jpeg',
      badge: 'Required'
    },
    PID: {
      label: 'Piping & Instrumentation Diagram (P&ID)',
      description: 'Upload P&ID for detailed piping analysis',
      accept: '.pdf,.png,.jpg,.jpeg',
      badge: 'Required'
    }
  },
  OPTIONAL: {
    SCOPE: {
      label: 'Project Scope Document',
      description: 'Upload project scope for enhanced context and analysis',
      accept: '.pdf,.doc,.docx',
      badge: 'Optional'
    },
    SPECIFICATIONS: {
      label: 'Specifications',
      description: 'Upload technical specifications for reference',
      accept: '.pdf,.doc,.docx',
      badge: 'Optional'
    }
  }
};

/**
 * Standard analysis steps template
 * @param {string} discipline - Engineering discipline
 * @returns {Array} Analysis steps configuration
 */
export const getAnalysisSteps = (discipline) => {
  const baseSteps = [
    {
      id: 1,
      title: 'Select Project Type',
      description: 'Choose your project category for optimized analysis',
      icon: 'DocumentTextIcon'
    },
    {
      id: 2,
      title: 'Upload Documents',
      description: 'Upload required documents for analysis',
      icon: 'CloudArrowUpIcon'
    },
    {
      id: 3,
      title: 'AI Processing',
      description: 'Automated analysis and data extraction',
      icon: 'ChartBarIcon'
    },
    {
      id: 4,
      title: 'Generate Results',
      description: 'Review and export analysis results',
      icon: 'CheckCircleIcon'
    }
  ];

  return baseSteps;
};

/**
 * Utility function to generate card grid classes
 * @param {number} columns - Number of columns (1, 2, or 3)
 * @returns {string} Tailwind grid classes
 */
export const getGridClasses = (columns = 2) => {
  const gridMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  };
  
  return `grid ${gridMap[columns] || gridMap[2]} gap-6`;
};

/**
 * Utility to generate consistent status badge styles
 * @param {string} status - Status type
 * @returns {string} Tailwind classes for badge
 */
export const getStatusBadgeClasses = (status) => {
  const statusMap = {
    'active': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    'pending': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    'completed': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'error': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    'disabled': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  };
  
  return statusMap[status] || statusMap.disabled;
};

/**
 * Export all utilities as default for easy importing
 */
export default {
  DISCIPLINE_COLORS,
  BADGE_TYPES,
  DATASHEET_ICONS,
  PROJECT_TYPES,
  DOCUMENT_TYPES,
  createDatasheetCard,
  getAnalysisSteps,
  getGridClasses,
  getStatusBadgeClasses
};
