/**
 * Feature Flags Configuration
 * Soft-coded feature toggles for different environments
 * Easily control which features/components are active in dev vs production
 */

// Determine environment
const isDevelopment = import.meta.env.MODE === 'development' || 
                     import.meta.env.DEV || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1'

const isProduction = import.meta.env.MODE === 'production' || 
                    import.meta.env.PROD || 
                    window.location.hostname === 'radai.ae' || 
                    window.location.hostname === 'www.radai.ae' ||
                    window.location.hostname.includes('vercel.app')

console.log('[Feature Config] 🎯 Environment Detection:')
console.log('[Feature Config]   - MODE:', import.meta.env.MODE)
console.log('[Feature Config]   - isDevelopment:', isDevelopment)
console.log('[Feature Config]   - isProduction:', isProduction)
console.log('[Feature Config]   - hostname:', window.location.hostname)

/**
 * Feature Status Types
 */
export const FEATURE_STATUS = {
  ACTIVE: 'active',
  BETA: 'beta',
  NEW: 'new',
  COMING_SOON: 'coming_soon',
  PREVIEW: 'preview'
}

/**
 * Feature View Modes
 */
export const FEATURE_VIEW_MODES = {
  GRID: 'grid',
  LIST: 'list',
  COMPACT: 'compact',
  DETAILED: 'detailed'
}

/**
 * Feature Sort Options
 */
export const FEATURE_SORT = {
  NAME: 'name',
  CATEGORY: 'category',
  RECENTLY_USED: 'recently_used',
  POPULARITY: 'popularity',
  STATUS: 'status'
}

/**
 * Feature Flags
 * Control which version of components to use
 * Reads from environment variables with fallback defaults
 */
export const FEATURE_FLAGS = {
  // PFD Upload Component Version
  // 'new' = Ultra Complete P&ID Generator (PFDUploadNew.jsx)
  // 'classic' = Traditional PFD Upload (PFDUpload.jsx)
  pfdUploadVersion: import.meta.env.VITE_PFD_UPLOAD_VERSION || (isDevelopment ? 'new' : 'classic'),
  
  // CRS Multi-Revision Component Version
  // 'smart' = Smart component with finish early option (CRSMultiRevisionSmart.jsx)
  // 'classic' = Traditional multi-revision (CRSMultipleRevision.jsx)
  crsMultiRevisionVersion: import.meta.env.VITE_CRS_MULTI_REVISION_VERSION || (isDevelopment ? 'smart' : 'smart'),
  
  // Enable/Disable experimental features
  enableUltraCompleteMode: import.meta.env.VITE_ENABLE_ULTRA_COMPLETE === 'true' || (import.meta.env.VITE_ENABLE_ULTRA_COMPLETE === undefined && isDevelopment),
  enableRAGKnowledgeBase: import.meta.env.VITE_ENABLE_RAG_KB === 'true' || (import.meta.env.VITE_ENABLE_RAG_KB === undefined && isDevelopment),
  enableGraphIntelligence: import.meta.env.VITE_ENABLE_GRAPH_AI === 'true' || (import.meta.env.VITE_ENABLE_GRAPH_AI === undefined && isDevelopment),
  
  // UI/UX Features
  showAdvancedOptions: isDevelopment,
  enableAnimations: true,
  enableTooltips: true,
  
  // Analysis Features
  enableFiveStageAnalysis: true,
  enableComprehensiveReports: true,
  
  // Dashboard Features
  enableAdvancedFeaturesCatalog: true,
  enableFeatureSearch: true,
  enableFeatureFilters: true,
  enableFeatureMetrics: true,
  
  // ── Module Visibility ──────────────────────────────────────────────────────
  // Set to false to hide a module without deleting its code
  
  // Internal Sales analytics dashboard — re-uses /sales route with new InternalSalesDashboard
  enableSalesModule: import.meta.env.VITE_ENABLE_SALES_MODULE !== 'false',
  
  // ✅ Human Resource Module — ENABLED (MODULE-BASED ACCESS CONTROL)
  // Controls ALL HR features: /hr, /hr/employees, /hr/payroll, /hr/leave, /hr/onboarding
  // Users with 'hr_management', 'payroll', or 'timesheet' modules will see this section
  // Set VITE_ENABLE_HR_MODULE=false in .env to disable globally (for maintenance)
  enableHRModule: import.meta.env.VITE_ENABLE_HR_MODULE === 'false' ? false : true,  // ✅ ENABLED by default, uses RBAC for access control
  
  // ───────────────────────────────────────────────────────────────────────────

  // Debug & Development
  enableDebugMode: import.meta.env.VITE_ENABLE_DEBUG === 'true' || (import.meta.env.VITE_ENABLE_DEBUG === undefined && isDevelopment),
  showConsoleDebug: isDevelopment,
  enablePerformanceMetrics: isDevelopment,
}

/**
 * Component Version Mapping
 * Maps feature flags to actual component files
 */
export const COMPONENT_VERSIONS = {
  pfdUpload: {
    new: 'PFDUploadNew', // Ultra Complete P&ID Generator
    classic: 'PFDUpload'  // Traditional PFD Upload
  }
}

/**
 * Get active component version
 */
export const getActiveComponentVersion = (componentKey) => {
  const versionKey = FEATURE_FLAGS[`${componentKey}Version`]
  return COMPONENT_VERSIONS[componentKey]?.[versionKey] || COMPONENT_VERSIONS[componentKey]?.classic
}

// Export environment detection
export const ENV = {
  isDevelopment,
  isProduction,
  mode: import.meta.env.MODE,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
}

// Log active features
console.log('[Feature Config] 🎛️ Active Features:', FEATURE_FLAGS)
console.log('[Feature Config] 📦 PFD Upload Version:', getActiveComponentVersion('pfdUpload'))
console.log('[Feature Config] 📋 Environment Variables:')
console.log('[Feature Config]   - VITE_PFD_UPLOAD_VERSION:', import.meta.env.VITE_PFD_UPLOAD_VERSION)
console.log('[Feature Config]   - VITE_ENABLE_ULTRA_COMPLETE:', import.meta.env.VITE_ENABLE_ULTRA_COMPLETE)

export default FEATURE_FLAGS
