import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Common utility function for Tailwind CSS classes
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Re-export all utilities from different modules
export * from './dateUtils.js';
export * from './chartUtils.js';
export * from './filterUtils.js';
export * from './projectUtils.js';

// You can also create aliases for commonly used functions
export {
  parseDate,
  formatDate,
  daysBetween,
  getUniqueYears
} from './dateUtils.js';

export {
  generateKPIStatusData,
  generateManhoursData,
  generateAuditStatusData,
  getMonthlyOverviewData,
  getYearlyOverviewData
} from './chartUtils.js';

export {
  calculateProjectMetrics,
  createProjectFilters,
  getUniqueClients
} from './filterUtils.js';

export {
  parsePercent,
  getKPIStatus,
  getKPIBadgeVariant,
  getProjectTimelineData
} from './projectUtils.js';


