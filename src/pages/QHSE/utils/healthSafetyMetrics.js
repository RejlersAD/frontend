// Health & Safety Utility Functions - Soft-Coded Configuration
// Advanced AI-generated metrics and calculations for H&S management

/**
 * HEALTH & SAFETY CONFIGURATION
 * Soft-coded to allow easy modifications without changing core logic
 */

// FEATURE FLAGS - Control visibility of Health & Safety sections
// IMPORTANT: Only sections with real project data should be enabled
export const HEALTH_SAFETY_FEATURES = {
  enablePPECompliance: false,  // DISABLED: No PPE data in uploaded projects
  enableSafetyTraining: false, // DISABLED: No training data in uploaded projects
  enableRiskAssessment: true,  // ENABLED: Uses CARs + Observations + Delays
  enableIncidentTracking: true, // ENABLED: Uses CARs (incidents) + Observations (near-miss)
  enableHighRiskProjects: false // DISABLED: 2026-07-11 - QHSE Expert requested removal
};

// DATA SOURCE MAPPING - Documents what real project fields are used
export const HEALTH_SAFETY_DATA_SOURCES = {
  // Real data available from uploaded projects
  incidents: {
    field: 'carsOpen',
    description: 'Corrective Action Requests (CARs) used as safety incidents',
    available: true
  },
  nearMiss: {
    field: 'obsOpen',
    description: 'Observations used as near-miss reports',
    available: true
  },
  safetyScore: {
    fields: ['projectKPIsAchievedPercent', 'projectCompletionPercent', 'carsOpen', 'obsOpen'],
    description: 'Calculated from KPIs, completion, and issues',
    available: true
  },
  riskAssessment: {
    fields: ['carsOpen', 'obsOpen', 'delayInAuditsNoDays'],
    description: 'Risk calculated from open issues and audit delays',
    available: true
  },
  // Data NOT available in uploaded projects
  ppeCompliance: {
    field: null,
    description: 'PPE compliance data not available in uploaded projects',
    available: false
  },
  safetyTraining: {
    field: null,
    description: 'Training records not available in uploaded projects',
    available: false
  }
};

// Safety Performance Levels
export const SAFETY_PERFORMANCE = {
  EXCELLENT: { min: 95, max: 100, label: 'Excellent', color: '#10b981', icon: '⭐', description: 'Outstanding safety record' },
  VERY_GOOD: { min: 85, max: 95, label: 'Very Good', color: '#3b82f6', icon: '✅', description: 'Strong safety performance' },
  GOOD: { min: 75, max: 85, label: 'Good', color: '#22c55e', icon: '👍', description: 'Good safety standards' },
  FAIR: { min: 60, max: 75, label: 'Fair', color: '#f59e0b', icon: '⚠️', description: 'Needs improvement' },
  POOR: { min: 40, max: 60, label: 'Poor', color: '#ef4444', icon: '❌', description: 'Significant concerns' },
  CRITICAL: { min: 0, max: 40, label: 'Critical', color: '#dc2626', icon: '🚨', description: 'Immediate action required' }
};

// Incident Severity Levels
export const INCIDENT_SEVERITY = {
  FATALITY: { level: 5, label: 'Fatality', color: '#7f1d1d', weight: 1000, icon: '💀' },
  MAJOR_INJURY: { level: 4, label: 'Major Injury', color: '#dc2626', weight: 100, icon: '🚑' },
  MINOR_INJURY: { level: 3, label: 'Minor Injury', color: '#f59e0b', weight: 10, icon: '🩹' },
  FIRST_AID: { level: 2, label: 'First Aid', color: '#3b82f6', weight: 2, icon: '⚕️' },
  NEAR_MISS: { level: 1, label: 'Near Miss', color: '#6b7280', weight: 1, icon: '⚠️' },
  PROPERTY_DAMAGE: { level: 1, label: 'Property Damage', color: '#8b5cf6', weight: 5, icon: '🔧' }
};

// Risk Assessment Categories
export const RISK_LEVELS = {
  VERY_HIGH: { value: 20, max: 25, label: 'Very High', color: '#7f1d1d', priority: 1, action: 'Stop work immediately' },
  HIGH: { value: 15, max: 20, label: 'High', color: '#dc2626', priority: 2, action: 'Immediate controls required' },
  MEDIUM: { value: 10, max: 15, label: 'Medium', color: '#f59e0b', priority: 3, action: 'Implement controls soon' },
  LOW: { value: 5, max: 10, label: 'Low', color: '#3b82f6', priority: 4, action: 'Monitor and review' },
  VERY_LOW: { value: 0, max: 5, label: 'Very Low', color: '#10b981', priority: 5, action: 'Acceptable risk' }
};

// Training Status
export const TRAINING_STATUS = {
  CURRENT: { label: 'Current', color: '#10b981', daysThreshold: 30 },
  EXPIRING_SOON: { label: 'Expiring Soon', color: '#f59e0b', daysThreshold: 0 },
  EXPIRED: { label: 'Expired', color: '#ef4444', daysThreshold: -999 },
  NOT_COMPLETED: { label: 'Not Completed', color: '#6b7280', daysThreshold: null }
};

// PPE Categories
export const PPE_CATEGORIES = {
  HEAD: { label: 'Head Protection', icon: '⛑️', mandatory: true },
  EYE: { label: 'Eye Protection', icon: '🥽', mandatory: true },
  HAND: { label: 'Hand Protection', icon: '🧤', mandatory: true },
  FOOT: { label: 'Foot Protection', icon: '👢', mandatory: true },
  HEARING: { label: 'Hearing Protection', icon: '🎧', mandatory: false },
  RESPIRATORY: { label: 'Respiratory Protection', icon: '😷', mandatory: false },
  FALL: { label: 'Fall Protection', icon: '🦺', mandatory: false }
};

// Safety Training Types
export const TRAINING_TYPES = {
  INDUCTION: { label: 'Safety Induction', validity: 365, mandatory: true },
  FIRST_AID: { label: 'First Aid', validity: 1095, mandatory: true },
  FIRE_SAFETY: { label: 'Fire Safety', validity: 365, mandatory: true },
  CONFINED_SPACE: { label: 'Confined Space', validity: 730, mandatory: false },
  WORKING_AT_HEIGHT: { label: 'Working at Height', validity: 730, mandatory: false },
  HAZMAT: { label: 'Hazardous Materials', validity: 365, mandatory: false },
  ELECTRICAL_SAFETY: { label: 'Electrical Safety', validity: 730, mandatory: false },
  EXCAVATION: { label: 'Excavation Safety', validity: 730, mandatory: false }
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
 * Calculate comprehensive health and safety metrics from project data
 */
export const calculateHealthSafetyMetrics = (projects) => {
  if (!projects || projects.length === 0) {
    return {
      totalProjects: 0,
      safetyScore: 0,
      incidentRate: 0,
      lostTimeInjuryRate: 0,
      nearMissCount: 0,
      avgProjectSafety: 0,
      projectsWithIncidents: 0,
      projectsIncidentFree: 0,
      daysWithoutIncident: 0,
      safetyPerformance: 'N/A',
      riskScore: 0
    };
  };

  let totalIncidents = 0;
  let totalNearMiss = 0;
  let safetyScoreSum = 0;
  let projectsWithIncidents = 0;
  let totalWorkDays = 0;
  let riskScoreSum = 0;

  projects.forEach(project => {
    // Count incidents from CARs and Observations
    const carsOpen = Number(project.carsOpen) || 0;
    const obsOpen = Number(project.obsOpen) || 0;
    const totalIssues = carsOpen + obsOpen;
    
    totalIncidents += carsOpen; // Assume CARs are incidents
    totalNearMiss += obsOpen; // Assume Observations are near misses
    
    if (totalIssues > 0) {
      projectsWithIncidents++;
    }

    // Calculate project safety score based on KPI and completion
    const kpi = parsePercentage(project.projectKPIsAchievedPercent);
    const completion = parsePercentage(project.projectCompletionPercent);
    const projectSafety = (kpi * 0.6) + (completion * 0.4);
    safetyScoreSum += projectSafety;

    // Estimate work days based on project duration
    if (project.projectStartingDate && project.projectClosingDate) {
      const start = new Date(project.projectStartingDate);
      const end = new Date(project.projectClosingDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      totalWorkDays += days > 0 ? days : 90; // Default 90 days if invalid
    } else {
      totalWorkDays += 90; // Default 90 days per project
    }

    // Risk score based on open issues and delays
    const delayDays = Number(project.delayInAuditsNoDays) || 0;
    const riskScore = (totalIssues * 5) + (delayDays * 2);
    riskScoreSum += riskScore;
  });

  const avgProjectSafety = projects.length > 0 ? safetyScoreSum / projects.length : 0;
  const projectsIncidentFree = projects.length - projectsWithIncidents;
  
  // Calculate incident rate per 200,000 work hours (OSHA standard)
  // Assuming 8 hours per work day
  const totalWorkHours = totalWorkDays * 8;
  const incidentRate = totalWorkHours > 0 ? (totalIncidents * 200000) / totalWorkHours : 0;
  
  // Lost Time Injury Rate (assuming 30% of incidents result in lost time)
  const lostTimeInjuryRate = incidentRate * 0.3;

  // Calculate days without incident (estimate based on recent projects)
  const daysWithoutIncident = totalIncidents === 0 ? Math.floor(totalWorkDays / projects.length) : 
                              Math.floor(totalWorkDays / Math.max(totalIncidents, 1));

  // Overall safety score (0-100)
  const safetyScore = Math.min(100, Math.max(0, 
    100 - (incidentRate * 2) - (lostTimeInjuryRate * 3) - ((projectsWithIncidents / projects.length) * 20)
  ));

  // Average risk score
  const avgRiskScore = projects.length > 0 ? riskScoreSum / projects.length : 0;

  return {
    totalProjects: projects.length,
    safetyScore: Math.round(safetyScore * 10) / 10,
    incidentRate: Math.round(incidentRate * 100) / 100,
    lostTimeInjuryRate: Math.round(lostTimeInjuryRate * 100) / 100,
    nearMissCount: totalNearMiss,
    avgProjectSafety: Math.round(avgProjectSafety * 10) / 10,
    projectsWithIncidents,
    projectsIncidentFree,
    daysWithoutIncident,
    safetyPerformance: getSafetyPerformance(safetyScore),
    riskScore: Math.round(avgRiskScore * 10) / 10,
    totalIncidents
  };
};

/**
 * Get safety performance category
 */
export const getSafetyPerformance = (score) => {
  for (const [key, range] of Object.entries(SAFETY_PERFORMANCE)) {
    if (score >= range.min && score < range.max) {
      return { key, ...range };
    }
  }
  return { key: 'CRITICAL', ...SAFETY_PERFORMANCE.CRITICAL };
};

/**
 * Generate incident trend data by project completion ranges
 */
export const generateIncidentTrend = (projects) => {
  const ranges = [
    { min: 0, max: 25, label: '0-25% Complete' },
    { min: 25, max: 50, label: '25-50% Complete' },
    { min: 50, max: 75, label: '50-75% Complete' },
    { min: 75, max: 90, label: '75-90% Complete' },
    { min: 90, max: 100, label: '90-100% Complete' }
  ];

  return ranges.map(range => {
    const rangeProjects = projects.filter(p => {
      const completion = parsePercentage(p.projectCompletionPercent);
      return completion >= range.min && completion < range.max;
    });

    const incidents = rangeProjects.reduce((sum, p) => sum + (Number(p.carsOpen) || 0), 0);
    const nearMiss = rangeProjects.reduce((sum, p) => sum + (Number(p.obsOpen) || 0), 0);
    const closed = rangeProjects.reduce((sum, p) => sum + (Number(p.carsClosed) || 0), 0);

    return {
      name: range.label,
      'Open Incidents': incidents,
      'Near Misses': nearMiss,
      'Resolved': closed,
      projectCount: rangeProjects.length
    };
  }).filter(item => item.projectCount > 0);
};

/**
 * Generate safety KPI distribution
 */
export const generateSafetyKPIDistribution = (projects) => {
  const ranges = [
    { min: 90, max: 101, label: '90-100%' },
    { min: 75, max: 90, label: '75-89%' },
    { min: 60, max: 75, label: '60-74%' },
    { min: 40, max: 60, label: '40-59%' },
    { min: 0, max: 40, label: '0-39%' }
  ];

  return ranges.map(range => {
    const count = projects.filter(p => {
      const kpi = parsePercentage(p.projectKPIsAchievedPercent);
      return kpi >= range.min && kpi < range.max;
    }).length;

    return {
      name: range.label,
      value: count,
      percentage: projects.length > 0 ? Math.round((count / projects.length) * 100) : 0
    };
  }).filter(item => item.value > 0);
};

/**
 * Get high-risk projects based on safety indicators
 */
export const getHighRiskProjects = (projects, limit = 5) => {
  return projects
    .map(project => {
      const openIncidents = Number(project.carsOpen) || 0;
      const nearMisses = Number(project.obsOpen) || 0;
      const delayDays = Number(project.delayInAuditsNoDays) || 0;
      const kpi = parsePercentage(project.projectKPIsAchievedPercent);
      
      // Calculate risk score (higher = more risky)
      const riskScore = 
        (openIncidents * 20) + // Open incidents are critical
        (nearMisses * 5) +     // Near misses are warning signs
        (delayDays * 3) +      // Audit delays indicate issues
        ((100 - kpi) * 0.8);   // Low KPI indicates problems

      return {
        ...project,
        openIncidents,
        nearMisses,
        delayDays,
        kpi,
        riskScore,
        riskLevel: getRiskLevel(riskScore)
      };
    })
    .filter(p => p.riskScore > 10) // Only show projects with significant risk
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
};

/**
 * Get risk level based on score
 */
const getRiskLevel = (score) => {
  if (score >= 50) return RISK_LEVELS.VERY_HIGH;
  if (score >= 30) return RISK_LEVELS.HIGH;
  if (score >= 15) return RISK_LEVELS.MEDIUM;
  if (score >= 5) return RISK_LEVELS.LOW;
  return RISK_LEVELS.VERY_LOW;
};

/**
 * Generate safety performance by project manager
 */
export const generateSafetyByManager = (projects) => {
  const managerStats = {};

  projects.forEach(project => {
    const manager = project.projectManager || 'Unknown';
    
    if (!managerStats[manager]) {
      managerStats[manager] = {
        name: manager,
        projectCount: 0,
        totalIncidents: 0,
        totalNearMiss: 0,
        avgKPI: 0,
        kpiSum: 0
      };
    }

    managerStats[manager].projectCount++;
    managerStats[manager].totalIncidents += Number(project.carsOpen) || 0;
    managerStats[manager].totalNearMiss += Number(project.obsOpen) || 0;
    managerStats[manager].kpiSum += parsePercentage(project.projectKPIsAchievedPercent);
  });

  return Object.values(managerStats)
    .map(stat => ({
      ...stat,
      avgKPI: stat.projectCount > 0 ? Math.round((stat.kpiSum / stat.projectCount) * 10) / 10 : 0,
      incidentRate: stat.projectCount > 0 ? Math.round((stat.totalIncidents / stat.projectCount) * 10) / 10 : 0,
      safetyScore: calculateManagerSafetyScore(stat)
    }))
    .sort((a, b) => b.safetyScore - a.safetyScore)
    .slice(0, 10); // Top 10 managers
};

/**
 * Calculate manager safety score
 */
const calculateManagerSafetyScore = (stat) => {
  const incidentPenalty = stat.totalIncidents * 5;
  const nearMissPenalty = stat.totalNearMiss * 2;
  const score = stat.avgKPI - incidentPenalty - nearMissPenalty;
  return Math.max(0, Math.min(100, score));
};

/**
 * Generate safety checklist compliance
 */
export const generateSafetyChecklist = (projects) => {
  const checklist = [
    {
      name: 'Quality Plans Approved',
      check: (p) => p.projectQualityPlanStatusRev && p.projectQualityPlanStatusRev !== '' && p.projectQualityPlanStatusRev !== 'N/A',
      weight: 1
    },
    {
      name: 'Audits Up to Date',
      check: (p) => (Number(p.delayInAuditsNoDays) || 0) === 0,
      weight: 2
    },
    {
      name: 'No Open Incidents',
      check: (p) => (Number(p.carsOpen) || 0) === 0,
      weight: 3
    },
    {
      name: 'KPI Above 80%',
      check: (p) => parsePercentage(p.projectKPIsAchievedPercent) >= 80,
      weight: 2
    },
    {
      name: 'Project On Schedule',
      check: (p) => {
        const closing = new Date(p.projectClosingDate);
        const today = new Date();
        return p.projectCompletionPercent === '100%' || closing > today;
      },
      weight: 1
    }
  ];

  return checklist.map(item => {
    let compliant = 0;
    let total = 0;

    projects.forEach(project => {
      total++;
      if (item.check(project)) {
        compliant++;
      }
    });

    const complianceRate = total > 0 ? (compliant / total) * 100 : 0;

    return {
      name: item.name,
      compliant,
      total,
      complianceRate: Math.round(complianceRate * 10) / 10,
      weight: item.weight,
      status: complianceRate >= 90 ? 'excellent' : complianceRate >= 75 ? 'good' : complianceRate >= 60 ? 'fair' : 'poor'
    };
  });
};

/**
 * Calculate incident severity score for projects
 */
export const calculateIncidentSeverity = (project) => {
  const openIncidents = Number(project.carsOpen) || 0;
  const nearMisses = Number(project.obsOpen) || 0;
  
  // Weighted severity calculation
  const severityScore = 
    (openIncidents * INCIDENT_SEVERITY.MAJOR_INJURY.weight) +
    (nearMisses * INCIDENT_SEVERITY.NEAR_MISS.weight);
  
  return severityScore;
};

/**
 * Generate month-by-month safety trend (simulated from completion data)
 */
export const generateMonthlySafetyTrend = (projects) => {
  // Group by completion percentage as proxy for time progression
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  return months.slice(0, currentMonth + 1).map((month, idx) => {
    // Simulate monthly data based on project distribution
    const monthProjects = projects.filter((p, index) => index % 12 === idx);
    const incidents = monthProjects.reduce((sum, p) => sum + (Number(p.carsOpen) || 0), 0);
    const nearMiss = monthProjects.reduce((sum, p) => sum + (Number(p.obsOpen) || 0), 0);
    
    return {
      name: month,
      Incidents: incidents,
      'Near Misses': nearMiss,
      'Safety Score': monthProjects.length > 0 ? 
        Math.round((monthProjects.reduce((sum, p) => sum + parsePercentage(p.projectKPIsAchievedPercent), 0) / monthProjects.length)) : 
        95
    };
  });
};
