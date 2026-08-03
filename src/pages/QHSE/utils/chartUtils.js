import { parseDate } from './dateUtils.js';
import { parsePercent, getKPIStatus } from './projectUtils.js';

// Helper function to safely parse percentage values
const parsePercentage = (value) => {
  if (typeof value === 'string') {
    return Number(value.replace('%', '')) || 0;
  }
  return Number(value) || 0;
};

// Helper to categorize KPI percent
const categorizeKPI = (percent) => {
  if (percent === 100) return "green";
  if (percent >= 90) return "lightGreen";
  if (percent >= 80) return "yellow";
  if (percent >= 60) return "orange";
  return "red";
};

// Generate KPI status data for charts (with 5 categories)
export const generateKPIStatusData = (filteredProjects) => {
  const categories = {
    green: 0,
    lightGreen: 0,
    yellow: 0,
    orange: 0,
    red: 0,
  };
  filteredProjects.forEach(p => {
    // Only include if KPI percent is not empty, not null, not undefined, not "N/A"
    const raw = p.projectKPIsAchievedPercent;
    if (
      raw === undefined ||
      raw === null ||
      raw === "" ||
      raw === "N/A"
    ) {
      return; // Skip empty KPI fields
    }
    const percent = typeof raw === "string"
      ? Number(raw.replace('%', ''))
      : Number(raw);
    const cat = categorizeKPI(percent);
    categories[cat]++;
  });
  return [
    { name: "Green", value: categories.green },
    { name: "Light Green", value: categories.lightGreen },
    { name: "Yellow", value: categories.yellow },
    { name: "Orange", value: categories.orange },
    { name: "Red", value: categories.red },
  ].filter(item => item.value > 0);
};

// Generate manhours data for charts
export const generateManhoursData = (filteredProjects) => {
  return filteredProjects.map(project => ({
    projectNo: project.projectNo || 'N/A', // <-- Use projectNo for axis
    name: project.projectTitleKey || project.projectTitle, // Project Title Key or fallback to full title
    originalTitle: project.projectTitle, // Keep full title for tooltips
    "Manhours for Quality": Number(project.manHourForQuality) || 0,
    "Manhours Used": Number(project.manhoursUsed) || 0,
    "Manhours Balance": Number(project.manhoursBalance) || 0,
    "Quality Billability %": project.qualityBillabilityPercent || "0%"
  }));
};

// Generate audit status data for charts
export const generateAuditStatusData = (filteredProjects) => {
  const today = new Date();
  const auditFields = ['projectAudit1', 'projectAudit2', 'projectAudit3', 'projectAudit4'];

  return auditFields.map((field, idx) => {
    let completed = 0, upcoming = 0, notApplicable = 0;
    
    filteredProjects.forEach(p => {
      const auditValue = p[field];
      
      if (!auditValue || auditValue === "" || auditValue === "N/A" || auditValue.toLowerCase() === "not applicable") {
        notApplicable++;
        return;
      }
      
      const auditDate = parseDate(auditValue);
      if (!auditDate) {
        notApplicable++;
      } else if (auditDate < today) {
        completed++;
      } else {
        upcoming++;
      }
    });
    
    return {
      name: `Audit ${idx + 1}`,
      Completed: completed,
      Upcoming: upcoming,
      NotApplicable: notApplicable
    };
  });
};

// Generate CARs & Observations data for charts
export const generateCarsObsData = (filteredProjects) => {
  return filteredProjects.map(project => ({
    name: project.projectTitle,
    projectNo: project.projectNo || '', // <-- Add projectNo for axis
    CARsOpen: Number(project.carsOpen) || 0,
    CARsClosed: Number(project.carsClosed) || 0,
    ObsOpen: Number(project.obsOpen) || 0,
    ObsClosed: Number(project.obsClosed) || 0,
  }));
};

// ✅ SIMPLE: Calculate how many days overdue a project is
const calculateDaysOverdue = (project) => {
  const today = new Date();
  const originalClosingDate = parseDate(project.projectClosingDate);
  const extensionDate = parseDate(project.projectExtension);
  
  // Step 1: Which date should we use?
  let deadlineDate = originalClosingDate; // Default: use original closing date
  
  if (extensionDate) {
    deadlineDate = extensionDate; // If extension exists, use extension date instead
  }
  
  // Step 2: Calculate days difference
  if (!deadlineDate) return 0; // No date = no overdue
  
  const timeDiff = today.getTime() - deadlineDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  return daysDiff; // Positive = overdue, Negative = time remaining
};

// ✅ SIMPLE: Get project status based on completion and deadlines
const getProjectStatus = (project) => {
  const completion = parsePercent(project.projectCompletionPercent);
  const daysOverdue = calculateDaysOverdue(project);
  const hasExtension = project.projectExtension && project.projectExtension !== "" && project.projectExtension !== "N/A";
  
  // Step 1: If project is complete, it's completed
  if (completion >= 100) {
    return "Completed";
  }
  
  // Step 2: Check if overdue
  if (daysOverdue > 0) {
    return hasExtension ? "Overdue (Extended)" : "Overdue";
  }
  
  // Step 3: Check if due soon
  if (daysOverdue >= -7) { // Due within 7 days
    return "Due Soon";
  }
  
  // Step 4: Check if has extension but not overdue
  if (hasExtension) {
    return "Extended";
  }
  
  // Step 5: Default status
  return getKPIStatus(project.projectKPIsAchievedPercent);
};

// ✅ SIMPLE: Timeline data generation
export const generateTimelineData = (filteredProjects) => {
  return filteredProjects.map(project => {
    const startDate = parseDate(project.projectStartingDate);
    const originalEndDate = parseDate(project.projectClosingDate);
    const extensionDate = parseDate(project.projectExtension);
    const completion = parsePercent(project.projectCompletionPercent);
    const hasExtension = extensionDate ? true : false;
    
    // Calculate days overdue (positive = overdue, negative = time remaining)
    const daysOverdue = calculateDaysOverdue(project);
    const daysRemaining = -daysOverdue; // Convert to remaining (negative = overdue)
    
    // Get simple status
    const status = getProjectStatus(project);
    
    return {
      name: project.projectTitle,
      progress: completion,
      projectCompletionPercent: completion,
      status: status,
      daysRemaining: daysRemaining,
      isCompleted: completion >= 100,
      projectExtension: project.projectExtension,
      hasExtension: hasExtension,
      effectiveEndDate: extensionDate || originalEndDate,
      originalEndDate: originalEndDate,
      daysOverdueAfterExtension: hasExtension && daysOverdue > 0 ? daysOverdue : 0
    };
  });
};

// Generate quality plan status data for charts
export const generateQualityPlanStatusData = (filteredProjects) => {
  return [
    { 
      name: "Approved", 
      value: filteredProjects.filter(p => 
        p.projectQualityPlanStatusRev && 
        p.projectQualityPlanStatusRev !== "" && 
        p.projectQualityPlanStatusRev !== "N/A"
      ).length 
    },
    { 
      name: "Pending", 
      value: filteredProjects.filter(p => 
        !p.projectQualityPlanStatusRev || 
        p.projectQualityPlanStatusRev === "" || 
        p.projectQualityPlanStatusRev === "N/A"
      ).length 
    }
  ];
};

// ✅ SMART: Generate monthly overview data (with fallback for missing dates)
export const getMonthlyOverviewData = (projects) => {
  if (!projects || projects.length === 0) {
    return [];
  }

  // Try date-based grouping first
  const monthly = {};
  let hasValidDates = false;
  
  projects.forEach(p => {
    const date = parseDate(p.projectStartingDate);
    if (!date) return;
    
    hasValidDates = true;
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const monthLabel = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    
    if (!monthly[monthKey]) {
      monthly[monthKey] = { 
        name: monthLabel, 
        date: new Date(date.getFullYear(), date.getMonth()), 
        carsOpen: 0, 
        obsOpen: 0, 
        kpiAchieved: 0, 
        billability: 0, 
        count: 0 
      };
    }
    
    monthly[monthKey].carsOpen += Number(p.carsOpen) || 0;
    monthly[monthKey].obsOpen += Number(p.obsOpen) || 0;
    monthly[monthKey].kpiAchieved += parsePercentage(p.projectKPIsAchievedPercent);
    monthly[monthKey].billability += parsePercentage(p.qualityBillabilityPercent);
    monthly[monthKey].count += 1;
  });
  
  // If we have valid date data, use it
  if (hasValidDates && Object.keys(monthly).length > 0) {
    return Object.values(monthly)
      .map(m => ({
        ...m,
        kpiAchieved: m.count ? Math.round((m.kpiAchieved / m.count) * 100) / 100 : 0,
        billability: m.count ? Math.round((m.billability / m.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.date - b.date);
  }
  
  // ✅ FALLBACK: Group by completion ranges when dates are missing
  const completionRanges = [
    { min: 0, max: 25, name: '0-25% Complete' },
    { min: 25, max: 50, name: '25-50% Complete' },
    { min: 50, max: 75, name: '50-75% Complete' },
    { min: 75, max: 90, name: '75-90% Complete' },
    { min: 90, max: 100, name: '90-100% Complete' },
  ];
  
  return completionRanges.map(range => {
    const rangeProjects = projects.filter(p => {
      const completion = parsePercentage(p.projectCompletionPercent);
      return completion >= range.min && completion < range.max;
    });
    
    if (rangeProjects.length === 0) return null;
    
    const carsOpen = rangeProjects.reduce((sum, p) => sum + (Number(p.carsOpen) || 0), 0);
    const obsOpen = rangeProjects.reduce((sum, p) => sum + (Number(p.obsOpen) || 0), 0);
    const avgKpi = rangeProjects.reduce((sum, p) => sum + parsePercentage(p.projectKPIsAchievedPercent), 0) / rangeProjects.length;
    
    return {
      name: range.name,
      carsOpen,
      obsOpen,
      kpiAchieved: Math.round(avgKpi * 100) / 100,
      count: rangeProjects.length
    };
  }).filter(Boolean); // Remove null entries
};

// ✅ SMART: Generate yearly overview data (with fallback for missing dates)
export const getYearlyOverviewData = (projects) => {
  if (!projects || projects.length === 0) {
    return [];
  }

  // Try date-based grouping first
  const yearly = {};
  let hasValidDates = false;
  
  projects.forEach(p => {
    const date = parseDate(p.projectStartingDate);
    if (!date) return;
    
    hasValidDates = true;
    const yearKey = `${date.getFullYear()}`;
    
    if (!yearly[yearKey]) {
      yearly[yearKey] = { 
        name: yearKey, 
        date: new Date(date.getFullYear(), 0), 
        carsOpen: 0, 
        obsOpen: 0, 
        kpiAchieved: 0, 
        billability: 0, 
        count: 0 
      };
    }
    
    yearly[yearKey].carsOpen += Number(p.carsOpen) || 0;
    yearly[yearKey].obsOpen += Number(p.obsOpen) || 0;
    yearly[yearKey].kpiAchieved += parsePercentage(p.projectKPIsAchievedPercent);
    yearly[yearKey].billability += parsePercentage(p.qualityBillabilityPercent);
    yearly[yearKey].count += 1;
  });
  
  // If we have valid date data, use it
  if (hasValidDates && Object.keys(yearly).length > 0) {
    return Object.values(yearly)
      .map(y => ({
        ...y,
        kpiAchieved: y.count ? Math.round((y.kpiAchieved / y.count) * 100) / 100 : 0,
        billability: y.count ? Math.round((y.billability / y.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.date - b.date);
  }
  
  // ✅ FALLBACK: Group by KPI performance ranges when dates are missing
  const kpiRanges = [
    { min: 90, max: 101, name: '90-100% KPI (Excellent)' },
    { min: 75, max: 90, name: '75-89% KPI (Good)' },
    { min: 50, max: 75, name: '50-74% KPI (Fair)' },
    { min: 1, max: 50, name: '1-49% KPI (Poor)' },
    { min: 0, max: 1, name: '0% KPI (No Data)' },
  ];
  
  return kpiRanges.map(range => {
    const rangeProjects = projects.filter(p => {
      const kpi = parsePercentage(p.projectKPIsAchievedPercent);
      return kpi >= range.min && kpi < range.max;
    });
    
    if (rangeProjects.length === 0) return null;
    
    const carsOpen = rangeProjects.reduce((sum, p) => sum + (Number(p.carsOpen) || 0), 0);
    const obsOpen = rangeProjects.reduce((sum, p) => sum + (Number(p.obsOpen) || 0), 0);
    const avgKpi = rangeProjects.reduce((sum, p) => sum + parsePercentage(p.projectKPIsAchievedPercent), 0) / rangeProjects.length;
    
    return {
      name: range.name,
      carsOpen,
      obsOpen,
      kpiAchieved: Math.round(avgKpi * 100) / 100,
      count: rangeProjects.length
    };
  }).filter(Boolean); // Remove null entries
};

// ✅ SIMPLE: Management timeline data
export const generateManagementTimelineData = (filteredProjects) => {
  return filteredProjects
    .filter(project => {
      // Only include projects with proper name and ID
      const hasValidId = project.srNo || project.projectNo;
      const hasValidName = project.projectTitle && project.projectTitle !== "" && project.projectTitle !== "N/A";
      return hasValidId && hasValidName;
    })
    .map(project => {
      const completion = parsePercent(project.projectCompletionPercent);
      const daysOverdue = calculateDaysOverdue(project);
      const hasExtension = project.projectExtension && project.projectExtension !== "" && project.projectExtension !== "N/A";
      
      // Quality issues
      const carsOpen = Number(project.carsOpen) || 0;
      const obsOpen = Number(project.obsOpen) || 0;
      const auditDelay = Number(project.delayInAuditsNoDays) || 0;
      
      // Simple urgency score
      let urgencyScore = 0;
      if (auditDelay > 10) urgencyScore += 4;
      else if (auditDelay > 0) urgencyScore += 2;
      
      if (carsOpen > 5) urgencyScore += 4;
      else if (carsOpen > 0) urgencyScore += 2;
      
      if (obsOpen > 3) urgencyScore += 2;
      else if (obsOpen > 0) urgencyScore += 1;
      
      if (daysOverdue > 0) urgencyScore += hasExtension ? 5 : 4;
      else if (daysOverdue >= -7) urgencyScore += 2;
      
      if (hasExtension) urgencyScore += 1;
      
      // Simple status
      let status = "On Track";
      let priority = 1;
      
      if (completion >= 100) {
        status = "Completed";
        priority = 0;
      } else if (urgencyScore >= 7) {
        status = "Critical";
        priority = 4;
      } else if (urgencyScore >= 4) {
        status = hasExtension ? "Extended" : "Delayed";
        priority = 3;
      } else if (urgencyScore > 0 || daysOverdue >= -30) {
        status = "At Risk";
        priority = 2;
      }
      
      // Simple risk factors
      const riskFactors = [
        auditDelay > 0 && `${auditDelay} days audit delay`,
        carsOpen > 0 && `${carsOpen} open CARs`,
        obsOpen > 0 && `${obsOpen} open observations`,
        daysOverdue === 0 && `Due TODAY`,
        daysOverdue > 0 && !hasExtension && `OVERDUE by ${daysOverdue} days`,
        daysOverdue > 0 && hasExtension && `OVERDUE by ${daysOverdue} days (Even with extension)`
      ].filter(Boolean);
      
      return {
        id: project.srNo || project.projectNo,
        projectNo: project.projectNo,
        name: project.projectTitle,
        client: project.client || null,
        manager: project.projectManager || null,
        progress: completion,
        daysRemaining: -daysOverdue,
        status: status,
        priority: priority,
        urgencyScore: urgencyScore,
        carsOpen: carsOpen,
        obsOpen: obsOpen,
        auditDelay: auditDelay,
        riskFactors: riskFactors,
        needsAttention: priority >= 2,
        hasExtension: hasExtension,
        daysOverdueTotal: daysOverdue > 0 ? daysOverdue : 0
      };
    })
    .filter(project => project.needsAttention)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
};

// ✅ REAL DATA: QHSE-focused timeline data using EXACT field names from Google Sheets
export const generateQHSETimelineData = (filteredProjects) => {
  console.log("🛡️ generateQHSETimelineData - Processing", filteredProjects?.length || 0, "projects");
  
  if (!filteredProjects || filteredProjects.length === 0) {
    console.log("❌ No projects provided to generateQHSETimelineData");
    return [];
  }

  // ✅ Log first project to see actual field names
  console.log("🔍 Sample project data (first project):", filteredProjects[0]);
  console.log("🔍 Available fields:", Object.keys(filteredProjects[0]));

  const result = filteredProjects
    .filter(project => {
      // Using EXACT field names from your Google Sheets mapping
      const hasValidId = project.srNo || project.projectNo;
      const hasValidName = project.projectTitle && project.projectTitle !== "" && project.projectTitle !== "N/A";
      console.log(`🔍 Project "${project.projectTitle}" - Valid ID: ${!!hasValidId}, Valid Name: ${!!hasValidName}`);
      return hasValidId && hasValidName;
    })
    .map(project => {
      console.log(`🔍 Processing project: ${project.projectTitle}`);
      
      // ✅ Using EXACT field names from your useQHSERunningProjects.js mapping
      const completion = parsePercent(project.projectCompletionPercent);
      const kpiStatus = parsePercentage(project.projectKPIsAchievedPercent);
      const billability = parsePercentage(project.qualityBillabilityPercent);
      
      // ✅ Quality issues using EXACT field names
      const carsOpen = Number(project.carsOpen) || 0;
      const obsOpen = Number(project.obsOpen) || 0;
      const auditDelay = Number(project.delayInAuditsNoDays) || 0;
      
      // ✅ New fields using EXACT field names
      const rejectionRate = parsePercentage(project.rejectionOfDeliverablesPercent);
      const costOfPoorQualityAED = Number(project.costOfPoorQualityAED) || 0;
      
      // ✅ Quality Plan status using EXACT field name
      const qualityPlanStatus = project.projectQualityPlanStatusRev && 
                               project.projectQualityPlanStatusRev !== "" && 
                               project.projectQualityPlanStatusRev !== "N/A" ? "Approved" : "Pending";
      
      console.log(`📊 ${project.projectTitle} - Raw data:`, {
        carsOpen: project.carsOpen,
        obsOpen: project.obsOpen,
        auditDelay: project.delayInAuditsNoDays,
        kpiStatus: project.projectKPIsAchievedPercent,
        billability: project.qualityBillabilityPercent,
        rejectionRate: project.rejectionOfDeliverablesPercent,
        costOfPoorQualityAED: project.costOfPoorQualityAED,
        qualityPlanStatus: project.projectQualityPlanStatusRev
      });
      
      console.log(`📊 ${project.projectTitle} - Parsed data:`, {
        carsOpen, obsOpen, auditDelay, kpiStatus, billability, rejectionRate, costOfPoorQualityAED, qualityPlanStatus
      });
      
      // ✅ QHSE Risk Score calculation with detailed logging
      let qhseScore = 0;
      let scoreBreakdown = [];
      
      // Audit delays (high impact)
      if (auditDelay > 10) {
        qhseScore += 4;
        scoreBreakdown.push(`Audit delay >10 days: +4`);
      } else if (auditDelay > 0) {
        qhseScore += 2;
        scoreBreakdown.push(`Audit delay >0 days: +2`);
      }
      
      // CARs (high impact)
      if (carsOpen > 5) {
        qhseScore += 4;
        scoreBreakdown.push(`CARs >5: +4`);
      } else if (carsOpen > 0) {
        qhseScore += 2;
        scoreBreakdown.push(`CARs >0: +2`);
      }
      
      // Observations (medium impact)
      if (obsOpen > 3) {
        qhseScore += 2;
        scoreBreakdown.push(`Observations >3: +2`);
      } else if (obsOpen > 0) {
        qhseScore += 1;
        scoreBreakdown.push(`Observations >0: +1`);
      }
      
      // Quality Plan status (medium impact)
      if (qualityPlanStatus === "Pending") {
        qhseScore += 2;
        scoreBreakdown.push(`Quality Plan Pending: +2`);
      }
      
      // KPI achievement (low impact)
      if (kpiStatus < 70) {
        qhseScore += 2;
        scoreBreakdown.push(`KPI <70%: +2`);
      } else if (kpiStatus < 80) {
        qhseScore += 1;
        scoreBreakdown.push(`KPI <80%: +1`);
      }
      
      // Billability (low impact)
      if (billability < 80) {
        qhseScore += 1;
        scoreBreakdown.push(`Billability <80%: +1`);
      }
      
      // Rejection rate (medium impact)
      if (rejectionRate > 5) {
        qhseScore += 3;
        scoreBreakdown.push(`Rejection rate >5%: +3`);
      } else if (rejectionRate > 0) {
        qhseScore += 1;
        scoreBreakdown.push(`Rejection rate >0%: +1`);
      }
      
      // Quality costs (medium impact)
      if (costOfPoorQualityAED > 5000) {
        qhseScore += 3;
        scoreBreakdown.push(`Quality costs >5000 AED: +3`);
      } else if (costOfPoorQualityAED > 0) {
        qhseScore += 1;
        scoreBreakdown.push(`Quality costs >0 AED: +1`);
      }
      
      console.log(`📈 ${project.projectTitle} - QHSE Score: ${qhseScore}`, scoreBreakdown);
      
      // QHSE Status assignment
      let qhseStatus = "QHSE Compliant";
      if (qhseScore >= 8) {
        qhseStatus = "Critical QHSE Issues";
      } else if (qhseScore >= 5) {
        qhseStatus = "Quality Issues";
      } else if (auditDelay > 0) {
        qhseStatus = "Audit Required";
      } else if (qualityPlanStatus === "Pending") {
        qhseStatus = "Documentation Issues";
      } else if (qhseScore > 0) {
        qhseStatus = "Minor Issues";
      }
      
      // QHSE Issues list
      const qhseIssues = [
        auditDelay > 0 && `Audit delayed by ${auditDelay} days`,
        carsOpen > 0 && `${carsOpen} open CARs requiring closure`,
        obsOpen > 0 && `${obsOpen} open observations`,
        qualityPlanStatus === "Pending" && `Quality plan pending approval`,
        kpiStatus < 70 && `Low KPI achievement (${Math.round(kpiStatus)}%)`,
        billability < 80 && `Low quality billability (${Math.round(billability)}%)`,
        rejectionRate > 0 && `${Math.round(rejectionRate)}% deliverable rejection rate`,
        costOfPoorQualityAED > 0 && `${costOfPoorQualityAED.toLocaleString()} AED quality costs`
      ].filter(Boolean);
      
      // ✅ REAL DATA: Only show projects that actually need QHSE attention
      const needsQHSEAttention = qhseScore >= 3;
      
      console.log(`✅ ${project.projectTitle} - Status: ${qhseStatus}, Needs Attention: ${needsQHSEAttention}, Score: ${qhseScore}`);
      
      return {
        id: project.srNo || project.projectNo || `qhse-${Date.now()}-${Math.random()}`,
        projectNo: project.projectNo,
        name: project.projectTitle,
        client: project.client || null,
        qualityEngineer: project.projectQualityEng || null, // ✅ Using correct field name
        progress: completion,
        qhseStatus: qhseStatus,
        qhseScore: qhseScore,
        kpiStatus: kpiStatus,
        billability: billability,
        carsOpen: carsOpen,
        obsOpen: obsOpen,
        auditDelay: auditDelay,
        qualityPlanStatus: qualityPlanStatus,
        rejectionRate: rejectionRate,
        costOfPoorQualityAED: costOfPoorQualityAED,
        qhseIssues: qhseIssues,
        needsQHSEAttention: needsQHSEAttention,
        scoreBreakdown: scoreBreakdown // ✅ For debugging
      };
    })
    .filter(project => project.needsQHSEAttention) // ✅ REAL DATA: Filter by actual QHSE attention needed
    .sort((a, b) => b.qhseScore - a.qhseScore); // ✅ Sort by highest risk first

  console.log(`🎯 generateQHSETimelineData - Final result: ${result.length} projects need QHSE attention`);
  console.log("📋 Projects requiring attention:", result.map(p => `${p.name} (Score: ${p.qhseScore})`));
  
  return result;
};

// Generate Growth Chart Data
export function generateGrowthChartData(projects) {
  return projects.map(project => ({
    name: project.projectNo, // X axis value
    projectTitleKey: project.projectTitleKey, // For X axis hover
    projectTitle: project.projectTitle, // For chart tooltip
    rejectionPercent: Number(
      typeof project.rejectionOfDeliverablesPercent === 'string'
        ? project.rejectionOfDeliverablesPercent.replace('%', '')
        : project.rejectionOfDeliverablesPercent
    ),
    costPoorQuality: Number(project.costOfPoorQualityAED || 0)
  }));
}

// ✅ REMOVE THE DEMO DATA FUNCTION - We're using real data now
// Keep the demo function for reference only
export const generateDemoQHSETimelineData = () => {
  // Demo data kept for reference/testing - not used in production
  return [];
};