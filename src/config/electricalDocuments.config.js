/**
 * Electrical Documents Configuration
 * SOFT-CODED: Centralized configuration for all electrical engineering documents
 * Version: 1.0.0 - Recreated after remote merge
 */

// SOFT-CODED: Feature Flag - Control entire page visibility
export const ELECTRICAL_DOCUMENTS_FEATURE_ENABLED = false; // Set to true to restore all content

// Document Status Constants
export const DOCUMENT_STATUS = {
  ACTIVE: 'active',
  COMING_SOON: 'coming_soon',
  IN_DEVELOPMENT: 'in_development'
};

// Document Categories
export const DOCUMENT_CATEGORIES = {
  DATASHEETS: 'datasheets',
  DIAGRAMS: 'diagrams',
  CALCULATIONS: 'calculations',
  LOAD_LISTS: 'load_lists',
  STUDIES: 'studies',
  SCHEDULES: 'schedules'
};

// Category Display Names
export const CATEGORY_DISPLAY_NAMES = {
  [DOCUMENT_CATEGORIES.DATASHEETS]: 'Datasheets',
  [DOCUMENT_CATEGORIES.DIAGRAMS]: 'Diagrams & Drawings',
  [DOCUMENT_CATEGORIES.CALCULATIONS]: 'Calculations',
  [DOCUMENT_CATEGORIES.LOAD_LISTS]: 'Load Lists',
  [DOCUMENT_CATEGORIES.STUDIES]: 'Studies & Reports',
  [DOCUMENT_CATEGORIES.SCHEDULES]: 'Schedules'
};

// Category Descriptions
export const CATEGORY_DESCRIPTIONS = {
  [DOCUMENT_CATEGORIES.DATASHEETS]: 'Technical specifications and datasheets for electrical equipment',
  [DOCUMENT_CATEGORIES.DIAGRAMS]: 'Single line diagrams, schematics, and technical drawings',
  [DOCUMENT_CATEGORIES.CALCULATIONS]: 'Electrical calculations including load flow, voltage drop, and short circuit',
  [DOCUMENT_CATEGORIES.LOAD_LISTS]: 'Load lists and equipment schedules',
  [DOCUMENT_CATEGORIES.STUDIES]: 'System studies, protection coordination, and analysis reports',
  [DOCUMENT_CATEGORIES.SCHEDULES]: 'Cable schedules, panel schedules, and equipment lists'
};

// Electrical Documents - Main Configuration Array
// SOFT-CODED: All electrical document options DISABLED
export const ELECTRICAL_DOCUMENTS = [
  // ALL DOCUMENTS DISABLED - To re-enable, uncomment the items below
  /* 
  // DATASHEETS
  {
    id: 'unified_quality_checker',
    code: 'EE-UNIVERSAL',
    name: 'Universal Quality Checker',
    fullName: 'AI-Powered Universal Quality Checker',
    description: 'GPT-4 powered universal quality checker for ALL electrical equipment types with ADNOC standards compliance',
    category: DOCUMENT_CATEGORIES.DATASHEETS,
    status: DOCUMENT_STATUS.ACTIVE,
    route: '/engineering/electrical/datasheet/unified-checker',
    featured: true,
    badge: 'AI Universal Tool'
  },
  {
    id: 'electrical_datasheet',
    code: 'EE-DS-001',
    name: 'Electrical Datasheet',
    fullName: 'Electrical Equipment Datasheet',
    description: 'Comprehensive datasheet for electrical equipment specifications',
    category: DOCUMENT_CATEGORIES.DATASHEETS,
    status: DOCUMENT_STATUS.ACTIVE,
    route: '/engineering/electrical/datasheet'
  },
  {
    id: 'excel_quality_checker',
    code: 'EE-DS-002',
    name: 'Excel Quality Checker',
    fullName: 'AI-Powered Excel Quality Checker',
    description: 'Intelligent validation and quality checking for electrical Excel datasheets with AI-powered analysis',
    category: DOCUMENT_CATEGORIES.DATASHEETS,
    status: DOCUMENT_STATUS.ACTIVE,
    route: '/engineering/electrical/datasheet/quality-checker'
  },
  
  // DIAGRAMS
  {
    id: 'single_line_diagram',
    code: 'EE-SLD-001',
    name: 'Single Line Diagram',
    fullName: 'Single Line Diagram (SLD)',
    description: 'Electrical power distribution single line diagrams',
    category: DOCUMENT_CATEGORIES.DIAGRAMS,
    status: DOCUMENT_STATUS.ACTIVE,
    route: '/engineering/electrical/single-line-diagram'
  },
  
  // CALCULATIONS
  {
    id: 'load_flow',
    code: 'EE-CALC-001',
    name: 'Load Flow Calculation',
    fullName: 'Power System Load Flow Analysis',
    description: 'Steady-state load flow calculations and analysis',
    category: DOCUMENT_CATEGORIES.CALCULATIONS,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'voltage_drop',
    code: 'EE-CALC-002',
    name: 'Voltage Drop Calculation',
    fullName: 'Cable Voltage Drop Calculation',
    description: 'Voltage drop calculations for cable sizing',
    category: DOCUMENT_CATEGORIES.CALCULATIONS,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'short_circuit',
    code: 'EE-CALC-003',
    name: 'Short Circuit Analysis',
    fullName: 'Short Circuit Current Calculation',
    description: 'Fault current analysis and protective device coordination',
    category: DOCUMENT_CATEGORIES.CALCULATIONS,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  
  // LOAD LISTS
  {
    id: 'motor_load_list',
    code: 'EE-LL-001',
    name: 'Motor Load List',
    fullName: 'Motor and Drive Load List',
    description: 'Comprehensive list of motors with ratings and specifications',
    category: DOCUMENT_CATEGORIES.LOAD_LISTS,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'panel_load_schedule',
    code: 'EE-LL-002',
    name: 'Panel Load Schedule',
    fullName: 'Distribution Panel Load Schedule',
    description: 'Load distribution and balance for electrical panels',
    category: DOCUMENT_CATEGORIES.LOAD_LISTS,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  
  // STUDIES
  {
    id: 'arc_flash_study',
    code: 'EE-STD-001',
    name: 'Arc Flash Study',
    fullName: 'Arc Flash Hazard Analysis',
    description: 'Arc flash incident energy calculations and PPE requirements',
    category: DOCUMENT_CATEGORIES.STUDIES,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'protection_coordination',
    code: 'EE-STD-002',
    name: 'Protection Coordination',
    fullName: 'Protective Device Coordination Study',
    description: 'Time-current coordination for protective devices',
    category: DOCUMENT_CATEGORIES.STUDIES,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'harmonic_analysis',
    code: 'EE-STD-003',
    name: 'Harmonic Analysis',
    fullName: 'Power Quality and Harmonic Analysis',
    description: 'Harmonic distortion analysis and mitigation',
    category: DOCUMENT_CATEGORIES.STUDIES,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  
  // SCHEDULES
  {
    id: 'cable_schedule',
    code: 'EE-SCH-001',
    name: 'Cable Schedule',
    fullName: 'Cable and Wire Schedule',
    description: 'Complete cable routing and specification schedule',
    category: DOCUMENT_CATEGORIES.SCHEDULES,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'panel_schedule',
    code: 'EE-SCH-002',
    name: 'Panel Schedule',
    fullName: 'Distribution Panel Schedule',
    description: 'Circuit breaker and panel board schedules',
    category: DOCUMENT_CATEGORIES.SCHEDULES,
    status: DOCUMENT_STATUS.COMING_SOON
  },
  {
    id: 'lighting_schedule',
    code: 'EE-SCH-003',
    name: 'Lighting Schedule',
    fullName: 'Lighting Fixture Schedule',
    description: 'Lighting fixtures, controls, and circuits schedule',
    category: DOCUMENT_CATEGORIES.SCHEDULES,
    status: DOCUMENT_STATUS.COMING_SOON
  }
  */
];

/**
 * Get documents by category
 * @param {string} category - Document category
 * @returns {Array} Filtered documents
 */
export const getDocumentsByCategory = (category) => {
  if (category === 'all') return ELECTRICAL_DOCUMENTS;
  return ELECTRICAL_DOCUMENTS.filter(doc => doc.category === category);
};

/**
 * Get statistics for each category
 * @returns {Object} Category statistics
 */
export const getCategoryStats = () => {
  const stats = {};
  
  Object.values(DOCUMENT_CATEGORIES).forEach(category => {
    const categoryDocs = ELECTRICAL_DOCUMENTS.filter(doc => doc.category === category);
    stats[category] = {
      total: categoryDocs.length,
      active: categoryDocs.filter(doc => doc.status === DOCUMENT_STATUS.ACTIVE).length,
      comingSoon: categoryDocs.filter(doc => doc.status === DOCUMENT_STATUS.COMING_SOON).length,
      inDevelopment: categoryDocs.filter(doc => doc.status === DOCUMENT_STATUS.IN_DEVELOPMENT).length
    };
  });
  
  return stats;
};

/**
 * Get document by ID
 * @param {string} id - Document ID
 * @returns {Object|null} Document object or null
 */
export const getDocumentById = (id) => {
  return ELECTRICAL_DOCUMENTS.find(doc => doc.id === id) || null;
};

/**
 * Get all active documents
 * @returns {Array} Active documents
 */
export const getActiveDocuments = () => {
  return ELECTRICAL_DOCUMENTS.filter(doc => doc.status === DOCUMENT_STATUS.ACTIVE);
};

/**
 * Search documents by query
 * @param {string} query - Search query
 * @returns {Array} Matching documents
 */
export const searchDocuments = (query) => {
  const lowerQuery = query.toLowerCase();
  return ELECTRICAL_DOCUMENTS.filter(doc => 
    doc.name.toLowerCase().includes(lowerQuery) ||
    doc.fullName.toLowerCase().includes(lowerQuery) ||
    doc.description.toLowerCase().includes(lowerQuery) ||
    doc.code.toLowerCase().includes(lowerQuery)
  );
};
