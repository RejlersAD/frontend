/**
 * Spot Check Metrics Utility
 * Comprehensive spot check analytics, compliance tracking, and performance metrics
 * All thresholds and factors are soft-coded for easy configuration
 */

// Spot Check Performance Configuration
const SPOTCHECK_PERFORMANCE = {
  status: {
    completed: { label: 'Completed', color: '#10b981', priority: 1 },
    in_progress: { label: 'In Progress', color: '#3b82f6', priority: 2 },
    pending: { label: 'Pending', color: '#f59e0b', priority: 3 },
    overdue: { label: 'Overdue', color: '#ef4444', priority: 4 },
    passed: { label: 'Passed', color: '#10b981', priority: 1 },
    failed: { label: 'Failed', color: '#ef4444', priority: 4 },
    requires_action: { label: 'Requires Action', color: '#f59e0b', priority: 3 }
  },
  compliance: {
    excellent: 95, // % compliance
    good: 85,
    moderate: 75,
    poor: 60
  },
  frequency: {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 90
  },
  scoring: {
    passed: 100,
    minorIssues: 80,
    majorIssues: 50,
    failed: 0
  }
};

// Categories Configuration
const SPOTCHECK_CATEGORIES = {
  safety: {
    name: 'Safety',
    icon: '🛡️',
    color: '#ef4444',
    weight: 1.5,
    checkpoints: ['PPE Compliance', 'Equipment Safety', 'Work Area Safety', 'Emergency Exits']
  },
  quality: {
    name: 'Quality',
    icon: '✅',
    color: '#3b82f6',
    weight: 1.2,
    checkpoints: ['Work Quality', 'Material Quality', 'Process Compliance', 'Documentation']
  },
  housekeeping: {
    name: 'Housekeeping',
    icon: '🧹',
    color: '#8b5cf6',
    weight: 1.0,
    checkpoints: ['Cleanliness', 'Organization', 'Waste Management', 'Storage']
  },
  environmental: {
    name: 'Environmental',
    icon: '🌍',
    color: '#10b981',
    weight: 1.3,
    checkpoints: ['Waste Disposal', 'Emissions', 'Water Usage', 'Energy Efficiency']
  },
  documentation: {
    name: 'Documentation',
    icon: '📋',
    color: '#f59e0b',
    weight: 1.1,
    checkpoints: ['Permits', 'Certifications', 'Records', 'Procedures']
  },
  equipment: {
    name: 'Equipment',
    icon: '⚙️',
    color: '#06b6d4',
    weight: 1.2,
    checkpoints: ['Maintenance', 'Calibration', 'Safety Guards', 'Operation']
  }
};

// Risk Levels
const RISK_LEVELS = {
  critical: { label: 'Critical', color: '#dc2626', score: 0, range: [0, 40] },
  high: { label: 'High', color: '#f59e0b', score: 25, range: [41, 60] },
  medium: { label: 'Medium', color: '#3b82f6', score: 50, range: [61, 80] },
  low: { label: 'Low', color: '#10b981', score: 75, range: [81, 95] },
  minimal: { label: 'Minimal', color: '#6b7280', score: 100, range: [96, 100] }
};

// Compliance Standards
const COMPLIANCE_STANDARDS = {
  iso_45001: { name: 'ISO 45001', category: 'Safety', targetScore: 90 },
  iso_9001: { name: 'ISO 9001', category: 'Quality', targetScore: 88 },
  iso_14001: { name: 'ISO 14001', category: 'Environmental', targetScore: 85 },
  osha: { name: 'OSHA Standards', category: 'Safety', targetScore: 95 },
  local_regulations: { name: 'Local Regulations', category: 'General', targetScore: 100 }
};

/**
 * Calculate comprehensive spot check metrics
 */
export const calculateSpotCheckMetrics = (spotChecks = []) => {
  if (!Array.isArray(spotChecks) || spotChecks.length === 0) {
    return {
      // Counts
      totalSpotChecks: 0,
      completedChecks: 0,
      pendingChecks: 0,
      overdueChecks: 0,
      
      // Scores
      overallComplianceScore: 0,
      safetyScore: 0,
      qualityScore: 0,
      
      // Status Distribution
      statusBreakdown: [],
      categoryBreakdown: [],
      
      // Trends
      complianceTrend: 0,
      checksPerMonth: 0,
      
      // Issues
      totalIssues: 0,
      criticalIssues: 0,
      resolvedIssues: 0,
      
      // Performance
      passRate: 0,
      averageScore: 0,
      topPerformingCategory: 'N/A',
      
      // By Category
      categoryScores: {},
      
      // Engineers
      totalEngineers: 0,
      topEngineer: 'N/A',
      
      // Clients
      totalClients: 0,
      topClient: 'N/A',
      
      // Processed data
      processedChecks: []
    };
  }

  // Process each spot check
  const processedChecks = spotChecks.map(check => {
    // Determine status
    const status = check.spotCheckStatus?.toLowerCase() || 'pending';
    const category = check.category?.toLowerCase() || 'general';
    
    // Calculate score based on status and remarks
    let score = 0;
    if (status.includes('pass') || status.includes('complete')) {
      score = check.remarks && check.remarks.toLowerCase().includes('issue') 
        ? SPOTCHECK_PERFORMANCE.scoring.minorIssues 
        : SPOTCHECK_PERFORMANCE.scoring.passed;
    } else if (status.includes('fail') || status.includes('overdue')) {
      score = SPOTCHECK_PERFORMANCE.scoring.failed;
    } else {
      score = SPOTCHECK_PERFORMANCE.scoring.minorIssues;
    }
    
    // Identify issues
    const hasIssues = check.remarks && (
      check.remarks.toLowerCase().includes('issue') ||
      check.remarks.toLowerCase().includes('problem') ||
      check.remarks.toLowerCase().includes('fail') ||
      check.remarks.toLowerCase().includes('risk')
    );
    
    const isCritical = check.remarks && (
      check.remarks.toLowerCase().includes('critical') ||
      check.remarks.toLowerCase().includes('urgent') ||
      check.remarks.toLowerCase().includes('immediate')
    );
    
    // Date processing
    const checkDate = check.dateOfSpotCheck ? new Date(check.dateOfSpotCheck) : new Date();
    const monthKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}`;
    
    return {
      ...check,
      processedStatus: status,
      processedCategory: category,
      score,
      hasIssues,
      isCritical,
      isResolved: status.includes('complete') || status.includes('close'),
      checkDate,
      monthKey,
      engineer: check.qhseEngineer || 'Unknown',
      client: check.client || 'Unknown'
    };
  });

  // Calculate counts
  const totalSpotChecks = processedChecks.length;
  const completedChecks = processedChecks.filter(c => c.isResolved).length;
  const pendingChecks = processedChecks.filter(c => !c.isResolved && !c.processedStatus.includes('overdue')).length;
  const overdueChecks = processedChecks.filter(c => c.processedStatus.includes('overdue')).length;
  
  // Calculate issues
  const totalIssues = processedChecks.filter(c => c.hasIssues).length;
  const criticalIssues = processedChecks.filter(c => c.isCritical).length;
  const resolvedIssues = processedChecks.filter(c => c.hasIssues && c.isResolved).length;
  
  // Calculate scores
  const totalScore = processedChecks.reduce((sum, c) => sum + c.score, 0);
  const averageScore = totalScore / totalSpotChecks;
  const passRate = (processedChecks.filter(c => c.score >= 80).length / totalSpotChecks) * 100;
  
  // Overall compliance score (weighted by category)
  let weightedScore = 0;
  let totalWeight = 0;
  
  Object.entries(SPOTCHECK_CATEGORIES).forEach(([key, cat]) => {
    const categoryChecks = processedChecks.filter(c => c.processedCategory.includes(key));
    if (categoryChecks.length > 0) {
      const catScore = categoryChecks.reduce((sum, c) => sum + c.score, 0) / categoryChecks.length;
      weightedScore += catScore * cat.weight;
      totalWeight += cat.weight;
    }
  });
  
  const overallComplianceScore = totalWeight > 0 ? weightedScore / totalWeight : averageScore;
  
  // Safety and Quality specific scores
  const safetyChecks = processedChecks.filter(c => c.processedCategory.includes('safety'));
  const safetyScore = safetyChecks.length > 0 
    ? safetyChecks.reduce((sum, c) => sum + c.score, 0) / safetyChecks.length 
    : 0;
  
  const qualityChecks = processedChecks.filter(c => c.processedCategory.includes('quality'));
  const qualityScore = qualityChecks.length > 0 
    ? qualityChecks.reduce((sum, c) => sum + c.score, 0) / qualityChecks.length 
    : 0;
  
  // Status breakdown
  const statusCounts = {};
  processedChecks.forEach(c => {
    const statusKey = c.processedStatus.includes('pass') ? 'passed' :
                      c.processedStatus.includes('fail') ? 'failed' :
                      c.processedStatus.includes('overdue') ? 'overdue' :
                      c.processedStatus.includes('progress') ? 'in_progress' : 'pending';
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
  });
  
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
    status: SPOTCHECK_PERFORMANCE.status[status]?.label || status,
    count,
    percentage: (count / totalSpotChecks) * 100,
    color: SPOTCHECK_PERFORMANCE.status[status]?.color || '#6b7280'
  }));
  
  // Category breakdown
  const categoryCounts = {};
  const categoryScores = {};
  
  processedChecks.forEach(c => {
    const catKey = Object.keys(SPOTCHECK_CATEGORIES).find(k => c.processedCategory.includes(k)) || 'other';
    categoryCounts[catKey] = (categoryCounts[catKey] || 0) + 1;
    
    if (!categoryScores[catKey]) {
      categoryScores[catKey] = { total: 0, count: 0 };
    }
    categoryScores[catKey].total += c.score;
    categoryScores[catKey].count += 1;
  });
  
  const categoryBreakdown = Object.entries(categoryCounts).map(([category, count]) => {
    const catConfig = SPOTCHECK_CATEGORIES[category] || { name: category, color: '#6b7280', icon: '📊' };
    const avgScore = categoryScores[category].total / categoryScores[category].count;
    
    return {
      category: catConfig.name,
      count,
      percentage: (count / totalSpotChecks) * 100,
      color: catConfig.color,
      icon: catConfig.icon,
      averageScore: Math.round(avgScore),
      key: category
    };
  }).sort((a, b) => b.count - a.count);
  
  const topPerformingCategory = categoryBreakdown.length > 0 
    ? categoryBreakdown.reduce((max, cat) => cat.averageScore > max.averageScore ? cat : max, categoryBreakdown[0]).category
    : 'N/A';
  
  // Calculate final category scores for return
  const finalCategoryScores = {};
  Object.keys(SPOTCHECK_CATEGORIES).forEach(key => {
    if (categoryScores[key]) {
      finalCategoryScores[key] = Math.round(categoryScores[key].total / categoryScores[key].count);
    } else {
      finalCategoryScores[key] = 0;
    }
  });
  
  // Engineer analysis
  const engineerCounts = {};
  processedChecks.forEach(c => {
    engineerCounts[c.engineer] = (engineerCounts[c.engineer] || 0) + 1;
  });
  const totalEngineers = Object.keys(engineerCounts).length;
  const topEngineer = Object.entries(engineerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  
  // Client analysis
  const clientCounts = {};
  processedChecks.forEach(c => {
    clientCounts[c.client] = (clientCounts[c.client] || 0) + 1;
  });
  const totalClients = Object.keys(clientCounts).length;
  const topClient = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  
  // Trend calculation (compare last 3 months vs previous 3 months)
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  
  const recentChecks = processedChecks.filter(c => c.checkDate >= threeMonthsAgo);
  const previousChecks = processedChecks.filter(c => c.checkDate >= sixMonthsAgo && c.checkDate < threeMonthsAgo);
  
  const recentScore = recentChecks.length > 0 
    ? recentChecks.reduce((sum, c) => sum + c.score, 0) / recentChecks.length 
    : 0;
  const previousScore = previousChecks.length > 0 
    ? previousChecks.reduce((sum, c) => sum + c.score, 0) / previousChecks.length 
    : recentScore;
  
  const complianceTrend = previousScore > 0 ? ((recentScore - previousScore) / previousScore) * 100 : 0;
  
  // Checks per month
  const monthCounts = {};
  processedChecks.forEach(c => {
    monthCounts[c.monthKey] = (monthCounts[c.monthKey] || 0) + 1;
  });
  const checksPerMonth = Object.values(monthCounts).length > 0 
    ? Object.values(monthCounts).reduce((sum, count) => sum + count, 0) / Object.values(monthCounts).length 
    : 0;
  
  return {
    // Counts
    totalSpotChecks,
    completedChecks,
    pendingChecks,
    overdueChecks,
    
    // Scores
    overallComplianceScore: Math.round(overallComplianceScore * 10) / 10,
    safetyScore: Math.round(safetyScore * 10) / 10,
    qualityScore: Math.round(qualityScore * 10) / 10,
    
    // Status Distribution
    statusBreakdown,
    categoryBreakdown,
    
    // Trends
    complianceTrend: Math.round(complianceTrend * 10) / 10,
    checksPerMonth: Math.round(checksPerMonth * 10) / 10,
    
    // Issues
    totalIssues,
    criticalIssues,
    resolvedIssues,
    issueResolutionRate: totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 100,
    
    // Performance
    passRate: Math.round(passRate * 10) / 10,
    averageScore: Math.round(averageScore * 10) / 10,
    topPerformingCategory,
    
    // By Category
    categoryScores: finalCategoryScores,
    
    // Engineers
    totalEngineers,
    topEngineer,
    engineerCounts,
    
    // Clients
    totalClients,
    topClient,
    clientCounts,
    
    // Processed data
    processedChecks
  };
};

/**
 * Generate monthly trend data (last 12 months)
 */
export const generateMonthlyTrend = (spotChecks = []) => {
  const months = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleString('default', { month: 'short' });
    
    const monthChecks = spotChecks.filter(c => {
      const checkDate = new Date(c.dateOfSpotCheck || c.checkDate);
      return checkDate.getFullYear() === date.getFullYear() && 
             checkDate.getMonth() === date.getMonth();
    });
    
    const totalChecks = monthChecks.length;
    const passedChecks = monthChecks.filter(c => 
      c.spotCheckStatus?.toLowerCase().includes('pass') ||
      c.processedStatus?.includes('pass')
    ).length;
    const failedChecks = monthChecks.filter(c => 
      c.spotCheckStatus?.toLowerCase().includes('fail') ||
      c.processedStatus?.includes('fail')
    ).length;
    
    const complianceRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
    
    months.push({
      month: monthName,
      monthKey,
      totalChecks,
      passedChecks,
      failedChecks,
      complianceRate: Math.round(complianceRate * 10) / 10,
      year: date.getFullYear()
    });
  }
  
  return months;
};

/**
 * Generate risk assessment data
 */
export const generateRiskAssessment = (metrics) => {
  const riskFactors = [];
  
  // Critical issues risk
  if (metrics.criticalIssues > 0) {
    riskFactors.push({
      category: 'Critical Issues',
      level: 'critical',
      count: metrics.criticalIssues,
      description: `${metrics.criticalIssues} critical issues require immediate attention`,
      color: RISK_LEVELS.critical.color
    });
  }
  
  // Overdue checks risk
  if (metrics.overdueChecks > metrics.totalSpotChecks * 0.1) {
    riskFactors.push({
      category: 'Overdue Checks',
      level: 'high',
      count: metrics.overdueChecks,
      description: `${metrics.overdueChecks} overdue spot checks`,
      color: RISK_LEVELS.high.color
    });
  }
  
  // Low pass rate risk
  if (metrics.passRate < 70) {
    riskFactors.push({
      category: 'Low Pass Rate',
      level: 'high',
      count: Math.round(metrics.passRate),
      description: `Pass rate at ${metrics.passRate}% is below target`,
      color: RISK_LEVELS.high.color
    });
  }
  
  // Safety score risk
  if (metrics.safetyScore < 80) {
    riskFactors.push({
      category: 'Safety Concerns',
      level: 'high',
      count: Math.round(metrics.safetyScore),
      description: `Safety score at ${metrics.safetyScore}% needs improvement`,
      color: RISK_LEVELS.high.color
    });
  }
  
  return riskFactors;
};

/**
 * Generate compliance comparison with standards
 */
export const generateComplianceComparison = (metrics) => {
  return Object.entries(COMPLIANCE_STANDARDS).map(([key, standard]) => {
    // Find relevant category score
    let actualScore = metrics.overallComplianceScore;
    
    if (standard.category === 'Safety') {
      actualScore = metrics.safetyScore;
    } else if (standard.category === 'Quality') {
      actualScore = metrics.qualityScore;
    }
    
    const gap = standard.targetScore - actualScore;
    const status = gap <= 0 ? 'compliant' : gap <= 5 ? 'nearCompliant' : 'nonCompliant';
    
    return {
      standard: standard.name,
      category: standard.category,
      targetScore: standard.targetScore,
      actualScore: Math.round(actualScore),
      gap: Math.round(Math.abs(gap)),
      status,
      statusLabel: status === 'compliant' ? 'Compliant' : 
                    status === 'nearCompliant' ? 'Near Compliant' : 'Non-Compliant',
      statusColor: status === 'compliant' ? '#10b981' : 
                    status === 'nearCompliant' ? '#f59e0b' : '#ef4444'
    };
  });
};

// Export configurations
export {
  SPOTCHECK_PERFORMANCE,
  SPOTCHECK_CATEGORIES,
  RISK_LEVELS,
  COMPLIANCE_STANDARDS
};
