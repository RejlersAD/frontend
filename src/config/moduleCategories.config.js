/**
 * Module Categories Configuration
 * Centralized, dynamic categorization for all system modules
 * 
 * How it works:
 * - Categories are defined with display name, icon, color, and order
 * - Module codes are mapped to categories using patterns/prefixes
 * - Easy to add new categories in the future without code changes
 * 
 * @version 1.0.0
 * @author RADAI System
 */

export const MODULE_CATEGORIES_CONFIG = {
  // Define all system categories
  categories: [
    {
      id: 'process_eng',
      name: 'Process Engineering',
      icon: '⚙️',
      color: 'blue',
      description: 'Process flow diagrams and engineering analysis',
      order: 1,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      badgeColor: 'bg-blue-100'
    },
    {
      id: 'crs',
      name: 'CRS Documents',
      icon: '📄',
      color: 'purple',
      description: 'Correspondence and document management',
      order: 2,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      badgeColor: 'bg-purple-100'
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: '💰',
      color: 'green',
      description: 'Financial management and invoicing',
      order: 3,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      badgeColor: 'bg-green-100'
    },
    {
      id: 'sales',
      name: 'Dept of Sales',
      icon: '💼',
      color: 'cyan',
      description: 'Sales CRM and pipeline management',
      order: 4,
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-200',
      textColor: 'text-cyan-700',
      badgeColor: 'bg-cyan-100'
    },
    {
      id: 'project_control',
      name: 'Project Control',
      icon: '📊',
      color: 'indigo',
      description: 'Project tracking and control systems',
      order: 5,
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      textColor: 'text-indigo-700',
      badgeColor: 'bg-indigo-100'
    },
    {
      id: 'procurement',
      name: 'Procurement',
      icon: '🛒',
      color: 'orange',
      description: 'Procurement and purchasing management',
      order: 6,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      badgeColor: 'bg-orange-100'
    },
    {
      id: 'qhse',
      name: 'QHSE',
      icon: '🛡️',
      color: 'red',
      description: 'Quality, Health, Safety & Environment',
      order: 7,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      badgeColor: 'bg-red-100'
    },
    {
      id: 'admin',
      name: 'Administration',
      icon: '⚡',
      color: 'gray',
      description: 'System administration and user management',
      order: 8,
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-700',
      badgeColor: 'bg-gray-100'
    },
    {
      id: 'digitization',
      name: 'Digitization',
      icon: '🔍',
      color: 'emerald',
      description: 'Digital document extraction and metadata processing',
      order: 9,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      badgeColor: 'bg-emerald-100'
    },
    {
      id: 'other',
      name: 'Other Features',
      icon: '📦',
      color: 'slate',
      description: 'Additional system features',
      order: 99,
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      textColor: 'text-slate-700',
      badgeColor: 'bg-slate-100'
    }
  ],

  // Mapping rules: Module code patterns to categories
  // Add new patterns here when adding new features
  categoryMapping: {
    // Process Engineering
    process_eng: ['pfd', 'pid', 'process_', 'flow_diagram', 'engineering_'],
    
    // CRS Documents
    crs: ['crs', 'correspondence', 'document_', 'letter_', 'revision_'],
    
    // Finance
    finance: ['finance', 'invoice', 'billing', 'payment', 'accounting_'],
    
    // Sales
    sales: ['sales', 'crm', 'client', 'deal', 'pipeline', 'quote', 'lead', 'opportunity'],
    
    // Project Control
    project_control: ['project_control', 'milestone', 'tracking', 'schedule_'],
    
    // Procurement
    procurement: ['procurement', 'purchase', 'supplier', 'vendor_', 'buying_'],
    
    // QHSE
    qhse: ['qhse', 'safety', 'quality', 'audit', 'inspection', 'health_', 'environment_'],
    
    // Admin
    admin: ['admin', 'user_management', 'settings', 'system_', 'rbac_'],

    // Digitization — SOFT-CODED: extend list when adding new digitization modules
    digitization: ['digitization', 'non_teff', 'teff_', 'metadata_extract'],

    // Other (catch-all)
    other: []
  },

  // Display settings
  display: {
    showIcons: true,
    showDescriptions: true,
    showModuleCount: true,
    expandAllByDefault: false,
    allowCategoryCollapse: true,
    sortModulesAlphabetically: true
  },

  // Feature flags - easy to enable/disable features
  features: {
    enableSearch: true,
    enableQuickActions: true,
    enableCategoryFilters: false,
    showCategoryColors: true,
    showModuleCodes: true,
    enableBulkSelection: true
  }
};

/**
 * Determine which category a module belongs to based on its code
 * @param {string} moduleCode - The module's code (e.g., 'qhse_projects', 'crs_documents')
 * @returns {string} - Category ID
 */
export const getCategoryForModule = (moduleCode) => {
  if (!moduleCode) return 'other';
  
  const codeLower = moduleCode.toLowerCase();
  
  // Check each category's patterns
  for (const [categoryId, patterns] of Object.entries(MODULE_CATEGORIES_CONFIG.categoryMapping)) {
    if (categoryId === 'other') continue; // Skip 'other' for now
    
    // Check if module code matches any pattern
    const matches = patterns.some(pattern => 
      codeLower.includes(pattern.toLowerCase()) ||
      codeLower.startsWith(pattern.toLowerCase())
    );
    
    if (matches) {
      return categoryId;
    }
  }
  
  // Default to 'other' if no match found
  return 'other';
};

/**
 * Get category configuration by ID
 * @param {string} categoryId - The category ID
 * @returns {Object|null} - Category configuration object
 */
export const getCategoryConfig = (categoryId) => {
  return MODULE_CATEGORIES_CONFIG.categories.find(cat => cat.id === categoryId) || null;
};

/**
 * Group modules by category
 * @param {Array} modules - Array of module objects
 * @returns {Object} - Grouped modules { categoryId: { config, modules: [] } }
 */
export const groupModulesByCategory = (modules = []) => {
  const grouped = {};
  
  // Initialize all categories
  MODULE_CATEGORIES_CONFIG.categories
    .sort((a, b) => a.order - b.order)
    .forEach(category => {
      grouped[category.id] = {
        config: category,
        modules: []
      };
    });
  
  // Assign modules to categories
  modules.forEach(module => {
    const categoryId = getCategoryForModule(module.code);
    if (grouped[categoryId]) {
      grouped[categoryId].modules.push(module);
    }
  });
  
  // Sort modules within each category (if enabled)
  if (MODULE_CATEGORIES_CONFIG.display.sortModulesAlphabetically) {
    Object.keys(grouped).forEach(categoryId => {
      grouped[categoryId].modules.sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    });
  }
  
  // Remove empty categories (except 'other')
  Object.keys(grouped).forEach(categoryId => {
    if (categoryId !== 'other' && grouped[categoryId].modules.length === 0) {
      delete grouped[categoryId];
    }
  });
  
  return grouped;
};

/**
 * Get all active categories with their module counts
 * @param {Array} modules - Array of module objects
 * @returns {Array} - Array of categories with counts
 */
export const getCategoriesWithCounts = (modules = []) => {
  const grouped = groupModulesByCategory(modules);
  
  return MODULE_CATEGORIES_CONFIG.categories
    .filter(cat => grouped[cat.id] && grouped[cat.id].modules.length > 0)
    .map(cat => ({
      ...cat,
      count: grouped[cat.id].modules.length
    }))
    .sort((a, b) => a.order - b.order);
};

export default MODULE_CATEGORIES_CONFIG;
