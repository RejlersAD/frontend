/**
 * QHSE Column Visibility Configuration
 * Soft-coded configuration for controlling which columns are visible in QHSE tables
 * 
 * USAGE:
 * - Set field visibility to false to hide columns from all QHSE views
 * - Backend still stores and returns data, only frontend hides display
 * - Easy to re-enable columns by changing configuration
 */

export const QHSE_COLUMN_VISIBILITY = {
  // ========================================================================
  // HIDDEN COLUMNS (as per business requirement - 2026-07-11)
  // ========================================================================
  
  /**
   * Quality Billability Percent - HIDDEN
   * Requirement: Remove from /qhse/general/detailed view
   * Field: qualityBillabilityPercent
   */
  qualityBillabilityPercent: false,
  
  // ========================================================================
  // VISIBLE COLUMNS (all other columns remain visible)
  // ========================================================================
  
  // Primary Identification
  srNo: true,
  projectNo: true,
  projectTitle: true,
  client: true,
  
  // Project Management
  projectManager: true,
  projectQualityEng: true,
  
  // Project Timeline
  projectStartingDate: true,
  projectClosingDate: true,
  projectExtension: true,
  
  // Manhours Management
  manHourForQuality: true,
  manhoursUsed: true,
  manhoursBalance: true,
  
  // Quality Plan Status
  projectQualityPlanStatusRev: true,
  projectQualityPlanStatusIssueDate: true,
  
  // Project Audits
  projectAudit1: true,
  projectAudit2: true,
  projectAudit3: true,
  projectAudit4: true,
  
  // Client Audits
  clientAudit1: true,
  clientAudit2: true,
  
  // Delays & Issues
  delayInAuditsNoDays: true,
  
  // CARs (Corrective Action Requests)
  carsOpen: true,
  carsDelayedClosingNoDays: true,
  carsClosed: true,
  
  // Observations
  obsOpen: true,
  obsDelayedClosingNoDays: true,
  obsClosed: true,
  
  // Project Performance Metrics
  projectKPIsAchievedPercent: true,
  projectCompletionPercent: true,
  rejectionOfDeliverablesPercent: true,
  costOfPoorQualityAed: true,
  
  // Additional Information
  remarks: true,
};

/**
 * Get visible columns for QHSE tables
 * @returns {string[]} Array of visible column field names
 */
export const getVisibleQHSEColumns = () => {
  return Object.keys(QHSE_COLUMN_VISIBILITY).filter(
    (key) => QHSE_COLUMN_VISIBILITY[key] === true
  );
};

/**
 * Check if a specific column should be visible
 * @param {string} columnKey - The field name to check
 * @returns {boolean} True if column should be visible
 */
export const isQHSEColumnVisible = (columnKey) => {
  // Default to true if not explicitly configured
  return QHSE_COLUMN_VISIBILITY[columnKey] !== false;
};

/**
 * Filter field labels to only include visible columns
 * @param {Object} fieldLabels - Object mapping field keys to labels
 * @returns {Object} Filtered field labels with only visible columns
 */
export const getVisibleFieldLabels = (fieldLabels) => {
  const visibleLabels = {};
  Object.keys(fieldLabels).forEach((key) => {
    if (isQHSEColumnVisible(key)) {
      visibleLabels[key] = fieldLabels[key];
    }
  });
  return visibleLabels;
};

export default QHSE_COLUMN_VISIBILITY;
