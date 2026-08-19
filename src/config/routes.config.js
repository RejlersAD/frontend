/**
 * ════════════════════════════════════════════════════════════════════════════
 * RADAI - Centralized Route Configuration
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * SOFT-CODED route paths for the entire application.
 * Change routes in ONE place, automatically updates everywhere.
 * 
 * Usage:
 *   import { ROUTES } from '@/config/routes.config';
 *   navigate(ROUTES.PID_VERIFICATION);
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

export const ROUTES = {
  // ═══════════════════════════════════════════════════════════════════════
  // ENGINEERING - PROCESS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * P&ID Verification (Primary)
   * Main entry point for P&ID quality checking workflow
   */
  PID_VERIFICATION: '/engineering/process/pid-verification-v1',
  
  /**
   * P&ID Verification Report
   * Detailed comparison report for a specific document
   */
  PID_VERIFICATION_REPORT: '/engineering/process/pid-verification-v1/report',
  
  /**
   * P&ID Checker V2
   * Line-list extractor with Legend Sheets integration
   */
  PID_CHECKER_V2: '/engineering/process/pid-checker-v2',
  PID_CHECKER_V2_DOCS: '/engineering/process/pid-checker-v2/docs',
  PID_CHECKER_V2_LEGENDS: '/engineering/process/pid-checker-v2/legends',
  
  /**
   * Legacy P&ID Upload (Redirects to PID_VERIFICATION)
   */
  PID_UPLOAD_LEGACY: '/pid/upload',
  
  /**
   * PFD Quality Checker
   */
  PFD_QUALITY_CHECKER: '/engineering/process/pfd-quality',
  
  // ═══════════════════════════════════════════════════════════════════════
  // HOME & DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════
  
  HOME: '/',
  PERSONAL_DASHBOARD: '/personal-dashboard',
  ENTERPRISE_DASHBOARD: '/enterprise-dashboard',
  
  // ═══════════════════════════════════════════════════════════════════════
  // ENGINEERING - OTHER
  // ═══════════════════════════════════════════════════════════════════════
  
  INSTRUMENT_INDEX: '/engineering/instrument/index',
  CRITICAL_LINE_LIST: '/engineering/piping/critical-line-list',
  VALVE_MTO: '/engineering/piping/valve-mto',
  NON_TEFF_METADATA: '/engineering/digitization/non-teff-metadata',
};

/**
 * Helper function to generate dynamic route with parameters
 * @param {string} route - Base route path
 * @param {object} params - Route parameters
 * @returns {string} - Complete route with parameters
 * 
 * Example:
 *   buildRoute(ROUTES.PID_VERIFICATION_REPORT, { documentId: '123' })
 *   => '/engineering/process/pid-verification-v1/report/123'
 */
export const buildRoute = (route, params = {}) => {
  let path = route;
  Object.keys(params).forEach(key => {
    path = path.replace(`:${key}`, params[key]);
  });
  return path;
};

/**
 * Legacy route mappings for backwards compatibility
 * Maps old routes to new ROUTES constants
 */
export const LEGACY_ROUTES = {
  '/pid/upload': ROUTES.PID_VERIFICATION,
  '/engineering/process/pid-verification': ROUTES.PID_VERIFICATION,
};

export default ROUTES;
