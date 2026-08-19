// Quality Management Utility Functions - Soft-Coded Configuration

/**
 * QUALITY METRICS CONFIGURATION
 * Soft-coded to allow easy modifications without changing core logic
 */

// Quality Audit Status Categories
export const AUDIT_STATUS = {
  SCHEDULED: { label: 'Scheduled', color: '#3b82f6', bgColor: '#dbeafe', icon: 'calendar' },
  COMPLETED: { label: 'Completed', color: '#10b981', bgColor: '#d1fae5', icon: 'check' },
  DELAYED: { label: 'Delayed', color: '#ef4444', bgColor: '#fee2e2', icon: 'alert' },
  CANCELLED: { label: 'Cancelled', color: '#6b7280', bgColor: '#f3f4f6', icon: 'x' }
};

// Audit Types
export const AUDIT_TYPES = {
  PROJECT: { label: 'Project Audit', color: '#3b82f6', priority: 1 },
  CLIENT: { label: 'Client Audit', color: '#8b5cf6', priority: 2 },
  INTERNAL: { label: 'Internal Audit', color: '#06b6d4', priority: 3 },
  EXTERNAL: { label: 'External Audit', color: '#f59e0b', priority: 4 }
};

// Non-Conformance Severity Levels
export const NC_SEVERITY = {
  CRITICAL: { label: 'Critical', color: '#dc2626', weight: 10, threshold: 0 },
  MAJOR: { label: 'Major', color: '#ea580c', weight: 5, threshold: 3 },
  MINOR: { label: 'Minor', color: '#f59e0b', weight: 2, threshold: 7 },
  OBSERVATION: { label: 'Observation', color: '#3b82f6', weight: 1, threshold: 15 }
};

// Quality Performance Ranges
export const QUALITY_PERFORMANCE = {
  EXCELLENT: { min: 95, max: 100, label: 'Excellent', color: '#10b981', icon: '🌟' },
  GOOD: { min: 85, max: 95, label: 'Good', color: '#3b82f6', icon: '👍' },
  FAIR: { min: 70, max: 85, label: 'Fair', color: '#f59e0b', icon: '⚠️' },
  POOR: { min: 50, max: 70, label: 'Poor', color: '#ef4444', icon: '❌' },
  CRITICAL: { min: 0, max: 50, label: 'Critical', color: '#dc2626', icon: '🚨' }
};

// Compliance Status
export const COMPLIANCE_STATUS = {
  COMPLIANT: { label: 'Compliant', color: '#10b981', threshold: 95 },
  MOSTLY_COMPLIANT: { label: 'Mostly Compliant', color: '#3b82f6', threshold: 85 },
  PARTIALLY_COMPLIANT: { label: 'Partially Compliant', color: '#f59e0b', threshold: 70 },
  NON_COMPLIANT: { label: 'Non-Compliant', color: '#ef4444', threshold: 0 }
};

/**
 * Calculate quality metrics from project data
 */
export const calculateQualityMetrics = (projects) => {
  if (!projects || projects.length === 0) {
    return {
      totalAudits: 0,
      completedAudits: 0,
      delayedAudits: 0,
      totalCARs: 0,
      openCARs: 0,
      closedCARs: 0,
      totalObs: 0,
      openObs: 0,
      closedObs: 0,
      avgKPI: 0,
      avgCompletion: 0,
      complianceRate: 0,
      qualityScore: 0
    };
  };

  let totalAudits = 0;
  let totalCARs = 0;
  let openCARs = 0;
  let closedCARs = 0;
  let totalObs = 0;
  let openObs = 0;
  let closedObs = 0;
  let kpiSum = 0;
  let completionSum = 0;
  let kpiCount = 0;
  let delayedAudits = 0;

  projects.forEach(project => {
    // Count audits
    const audits = [
      project.projectAudit1,
      project.projectAudit2,
      project.projectAudit3,
      project.projectAudit4
    ].filter(audit => audit && audit !== '' && audit !== 'N/A');
    totalAudits += audits.length;

    // Check for delayed audits
    if (project.delayInAuditsNoDays && Number(project.delayInAuditsNoDays) > 0) {
      delayedAudits++;
    }

    // CARs
    const carsOpen = Number(project.carsOpen) || 0;
    const carsClosed = Number(project.carsClosed) || 0;
    openCARs += carsOpen;
    closedCARs += carsClosed;
    totalCARs += carsOpen + carsClosed;

    // Observations
    const obsOpen = Number(project.obsOpen) || 0;
    const obsClosed = Number(project.obsClosed) || 0;
    openObs += obsOpen;
    closedObs += obsClosed;
    totalObs += obsOpen + obsClosed;

    // KPI
    const kpi = parsePercentage(project.projectKPIsAchievedPercent);
    if (kpi > 0) {
      kpiSum += kpi;
      kpiCount++;
    }

    // Completion
    completionSum += parsePercentage(project.projectCompletionPercent);
  });

  const avgKPI = kpiCount > 0 ? kpiSum / kpiCount : 0;
  const avgCompletion = projects.length > 0 ? completionSum / projects.length : 0;
  
  // Calculate compliance rate based on closed issues vs total issues
  const totalIssues = totalCARs + totalObs;
  const resolvedIssues = closedCARs + closedObs;
  const complianceRate = totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 100;

  // Calculate quality score (weighted average)
  const qualityScore = (
    (avgKPI * 0.4) + 
    (complianceRate * 0.3) + 
    (avgCompletion * 0.2) +
    ((totalAudits > 0 ? ((totalAudits - delayedAudits) / totalAudits) * 100 : 100) * 0.1)
  );

  return {
    totalAudits,
    completedAudits: totalAudits - delayedAudits,
    delayedAudits,
    totalCARs,
    openCARs,
    closedCARs,
    totalObs,
    openObs,
    closedObs,
    avgKPI: Math.round(avgKPI * 10) / 10,
    avgCompletion: Math.round(avgCompletion * 10) / 10,
    complianceRate: Math.round(complianceRate * 10) / 10,
    qualityScore: Math.round(qualityScore * 10) / 10
  };
};

/**
 * Get quality performance category based on score
 */
export const getQualityPerformance = (score) => {
  for (const [key, range] of Object.entries(QUALITY_PERFORMANCE)) {
    if (score >= range.min && score < range.max) {
      return { key, ...range };
    }
  }
  return { key: 'CRITICAL', ...QUALITY_PERFORMANCE.CRITICAL };
};

/**
 * Get compliance status based on rate
 */
export const getComplianceStatus = (rate) => {
  for (const [key, status] of Object.entries(COMPLIANCE_STATUS)) {
    if (rate >= status.threshold) {
      return { key, ...status };
    }
  }
  return { key: 'NON_COMPLIANT', ...COMPLIANCE_STATUS.NON_COMPLIANT };
};

/**
 * Parse percentage string to number
 */
const parsePercentage = (value) => {
  if (typeof value === 'string') {
    return Number(value.replace('%', '')) || 0;
  }
  return Number(value) || 0;
};

/**
 * Generate audit timeline data
 */
export const generateAuditTimeline = (projects) => {
  const auditData = [];
  const today = new Date();

  projects.forEach(project => {
    const audits = [
      { date: project.projectAudit1, type: 'PROJECT', number: 1 },
      { date: project.projectAudit2, type: 'PROJECT', number: 2 },
      { date: project.projectAudit3, type: 'PROJECT', number: 3 },
      { date: project.projectAudit4, type: 'PROJECT', number: 4 },
      { date: project.clientAudit1, type: 'CLIENT', number: 1 },
      { date: project.clientAudit2, type: 'CLIENT', number: 2 }
    ];

    audits.forEach(audit => {
      if (audit.date && audit.date !== '' && audit.date !== 'N/A') {
        const auditDate = new Date(audit.date);
        const isPast = auditDate < today;
        const daysUntil = Math.ceil((auditDate - today) / (1000 * 60 * 60 * 24));

        auditData.push({
          projectNo: project.projectNo,
          projectTitle: project.projectTitle,
          auditType: audit.type,
          auditNumber: audit.number,
          auditDate: audit.date,
          status: isPast ? 'COMPLETED' : daysUntil <= 7 ? 'DUE_SOON' : 'SCHEDULED',
          daysUntil,
          isPast
        });
      }
    });
  });

  return auditData.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
};

/**
 * Generate non-conformance trend data
 */
export const generateNCTrend = (projects) => {
  // Group by completion ranges for trend analysis
  const ranges = [
    { min: 0, max: 25, label: '0-25%' },
    { min: 25, max: 50, label: '25-50%' },
    { min: 50, max: 75, label: '50-75%' },
    { min: 75, max: 90, label: '75-90%' },
    { min: 90, max: 100, label: '90-100%' }
  ];

  return ranges.map(range => {
    const rangeProjects = projects.filter(p => {
      const completion = parsePercentage(p.projectCompletionPercent);
      return completion >= range.min && completion < range.max;
    });

    const totalCARs = rangeProjects.reduce((sum, p) => sum + (Number(p.carsOpen) || 0), 0);
    const totalObs = rangeProjects.reduce((sum, p) => sum + (Number(p.obsOpen) || 0), 0);

    return {
      name: range.label,
      CARs: totalCARs,
      Observations: totalObs,
      Total: totalCARs + totalObs,
      projectCount: rangeProjects.length
    };
  }).filter(item => item.projectCount > 0);
};

/**
 * Get top projects needing attention
 */
export const getProjectsNeedingAttention = (projects, limit = 5) => {
  return projects
    .map(project => {
      const openIssues = (Number(project.carsOpen) || 0) + (Number(project.obsOpen) || 0);
      const delayedDays = Number(project.delayInAuditsNoDays) || 0;
      const kpi = parsePercentage(project.projectKPIsAchievedPercent);
      
      // Calculate attention score (higher = needs more attention)
      const attentionScore = 
        (openIssues * 5) + 
        (delayedDays * 2) + 
        ((100 - kpi) * 0.5);

      return {
        ...project,
        openIssues,
        delayedDays,
        kpi,
        attentionScore
      };
    })
    .filter(p => p.attentionScore > 0)
    .sort((a, b) => b.attentionScore - a.attentionScore)
    .slice(0, limit);
};

/**
 * Generate compliance matrix data
 */
export const generateComplianceMatrix = (projects) => {
  const categories = [
    { name: 'Quality Plans', field: 'projectQualityPlanStatusRev' },
    { name: 'Audits Current', field: 'delayInAuditsNoDays', inverse: true },
    { name: 'CARs Resolved', calcField: true, calc: (p) => {
      const total = (Number(p.carsOpen) || 0) + (Number(p.carsClosed) || 0);
      return total > 0 ? ((Number(p.carsClosed) || 0) / total) * 100 : 100;
    }},
    { name: 'KPI Achievement', field: 'projectKPIsAchievedPercent' }
  ];

  return categories.map(cat => {
    let compliantCount = 0;
    let totalCount = 0;

    projects.forEach(project => {
      totalCount++;
      
      if (cat.calcField) {
        const value = cat.calc(project);
        if (value >= 80) compliantCount++;
      } else if (cat.inverse) {
        // For fields where lower is better (like delays)
        const value = Number(project[cat.field]) || 0;
        if (value === 0) compliantCount++;
      } else if (cat.field === 'projectQualityPlanStatusRev') {
        if (project[cat.field] && project[cat.field] !== '' && project[cat.field] !== 'N/A') {
          compliantCount++;
        }
      } else {
        const value = parsePercentage(project[cat.field]);
        if (value >= 80) compliantCount++;
      }
    });

    const complianceRate = totalCount > 0 ? (compliantCount / totalCount) * 100 : 0;

    return {
      name: cat.name,
      complianceRate: Math.round(complianceRate * 10) / 10,
      compliantCount,
      totalCount,
      status: getComplianceStatus(complianceRate)
    };
  });
};
