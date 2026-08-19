import { parseDate, daysBetween } from './dateUtils.js';

// Helper function to safely parse percentage values
export const parsePercentage = (value) => {
  if (typeof value === 'string') {
    return Number(value.replace('%', '')) || 0;
  }
  return Number(value) || 0;
};

// Parse percentage values (alias for backward compatibility)
export const parsePercent = (val) => {
  if (!val || val === '' || val === 'N/A') return 0;
  const numVal = typeof val === "string" ? val.replace("%", "") : val;
  const parsed = Number(numVal);
  return isNaN(parsed) ? 0 : parsed;
};

// Get KPI Status based on percentage
export const getKPIStatus = (percentStr) => {
  const percent = parsePercent(percentStr);
  if (percent >= 90) return "Green";
  if (percent >= 70) return "Yellow";
  return "Red";
};

// Get KPI badge variant for styling
export const getKPIBadgeVariant = (status) => {
  switch (status) {
    case "Green": return "green";
    case "Yellow": return "yellow";
    case "Red": return "red";
    default: return "default";
  }
};

// Generate comprehensive project timeline data
export const getProjectTimelineData = (projects) => {
  if (!projects || projects.length === 0) {
    return [];
  }

  const today = new Date();
  
  return projects
    .map(p => {
      const start = parseDate(p.projectStartingDate);
      const end = parseDate(p.projectClosingDate);
      
      if (!start || !end) {
        return null; // Skip projects with invalid dates
      }
      
      // Calculate project timeline metrics using daysBetween
      const totalDuration = daysBetween(start, end);
      const elapsed = Math.max(0, daysBetween(start, today));
      const daysRemaining = daysBetween(today, end);
      
      let timeProgress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
      timeProgress = Math.max(0, Math.min(100, timeProgress));
      
      const actualCompletion = parsePercentage(p.projectCompletionPercent);
      const progress = Math.max(timeProgress, actualCompletion);
      const kpiStatus = parsePercentage(p.projectKPIsAchievedPercent);
      const carsOpen = Number(p.carsOpen) || 0;
      const obsOpen = Number(p.obsOpen) || 0;
      const auditDelay = Number(p.delayInAuditsNoDays) || 0;
      
      // Enhanced status logic for management focus
      let status = "On Track";
      let priority = 1; // 1=Low, 2=Medium, 3=High, 4=Critical
      
      if (actualCompletion >= 100) {
        status = "Completed";
        priority = 0; // Lowest priority for completed
      } else if (auditDelay > 10 || carsOpen > 5 || daysRemaining < 0) {
        status = "Critical";
        priority = 4; // Highest priority
      } else if (auditDelay > 0 || carsOpen > 0 || obsOpen > 3 || (daysRemaining < totalDuration * 0.1 && progress < 90)) {
        status = "Delayed";
        priority = 3; // High priority
      } else if (kpiStatus < 70 || progress < timeProgress - 15 || daysRemaining < 30) {
        status = "At Risk";
        priority = 2; // Medium priority
      }
      
      return {
        id: p.srNo || Math.random(),
        projectNo: p.projectNo,
        name: p.projectTitle,
        title: p.projectTitle,
        client: p.client,
        manager: p.projectManager,
        startDate: start,
        endDate: end,
        progress: Math.round(progress * 100) / 100,
        daysRemaining: Math.max(0, daysRemaining),
        status,
        priority,
        completion: actualCompletion,
        kpiStatus,
        carsOpen,
        obsOpen,
        auditDelay,
        totalDays: Math.ceil(totalDuration),
        elapsedDays: Math.ceil(elapsed),
        // Management focus metrics
        needsAttention: priority >= 2,
        riskFactors: [
          auditDelay > 0 && `${auditDelay} days audit delay`,
          carsOpen > 0 && `${carsOpen} open CARs`,
          obsOpen > 0 && `${obsOpen} open observations`,
          kpiStatus < 70 && `Low KPI (${kpiStatus}%)`,
          daysRemaining < 30 && daysRemaining > 0 && `Due in ${daysRemaining} days`
        ].filter(Boolean)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Sort by priority first (Critical > Delayed > At Risk > On Track > Completed)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by days remaining (urgent deadlines first)
      if (a.daysRemaining !== b.daysRemaining) {
        return a.daysRemaining - b.daysRemaining;
      }
      // Finally by completion (less complete projects first)
      return a.completion - b.completion;
    })
    // 🎯 MANAGEMENT FOCUS: Show projects that need attention
    .filter(p => p.needsAttention || p.status === "Critical" || p.status === "Delayed")
    .slice(0, 12); // Show top 12 high-priority projects
};