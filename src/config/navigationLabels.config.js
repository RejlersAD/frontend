/**
 * Navigation Labels Configuration
 * Central configuration for all navigation menu labels and titles
 * This allows for easy customization without modifying core logic
 */

export const NAVIGATION_LABELS = {
  // Main Sections
  dashboard: 'Dashboard',
  
  // Section 1: Engineering (formerly Process Engineering)
  processEngineering: {
    main: 'Engineering',
    fullName: 'Engineering',
    number: '1'
  },
  
  // Section 2: COMMON (formerly CRS)
  crs: {
    main: 'COMMON',
    fullName: 'Common Features & Tools',
    number: '2'
  },
  
  // Section 3: Finance
  finance: {
    main: 'Finance',
    fullName: 'Finance & Accounting',
    number: '3'
  },
  
  // Section 4: Human Resource
  human_resource: {
    main: 'Human Resource',
    fullName: 'Human Resource Management',
    number: '4'
  },

  // Section 5: Dept of Sales
  sales: {
    main: 'Dept of Sales',
    fullName: 'Department of Sales',
    number: '5'
  },
  
  // Section 6: Project Control
  projectControl: {
    main: 'Project Control',
    fullName: 'Project Control & Management',
    number: '6'
  },
  
  // Section 7: Procurement
  procurement: {
    main: 'Procurement',
    fullName: 'Procurement & Supply Chain',
    number: '7'
  },
  
  // Section 8: QHSE
  hse: {
    main: 'QHSE',
    fullName: 'Quality, Health, Safety & Environment',
    number: '8'
  },

  // Section 9: Admin
  admin: {
    main: 'Admin',
    fullName: 'System Administration',
    number: '9'
  }
}

/**
 * Helper function to get formatted section title
 * @param {string} section - Section key from NAVIGATION_LABELS
 * @param {boolean} includeNumber - Whether to include section number
 * @param {boolean} useFullName - Whether to use full name instead of main
 * @returns {string} Formatted title
 */
export const getSectionTitle = (section, includeNumber = true, useFullName = false) => {
  const sectionData = NAVIGATION_LABELS[section]
  
  if (typeof sectionData === 'string') {
    return sectionData
  }
  
  if (!sectionData) {
    return section
  }
  
  const name = useFullName ? sectionData.fullName : sectionData.main
  
  if (includeNumber && sectionData.number) {
    return `${sectionData.number}. ${name}`
  }
  
  return name
}

/**
 * Get section number only
 */
export const getSectionNumber = (section) => {
  const sectionData = NAVIGATION_LABELS[section]
  return typeof sectionData === 'object' ? sectionData.number : null
}

/**
 * Get section name without number
 */
export const getSectionName = (section, useFullName = false) => {
  const sectionData = NAVIGATION_LABELS[section]
  
  if (typeof sectionData === 'string') {
    return sectionData
  }
  
  if (!sectionData) {
    return section
  }
  
  return useFullName ? sectionData.fullName : sectionData.main
}

export default NAVIGATION_LABELS
