// Environmental Management Utility Functions - Soft-Coded Configuration
// Advanced AI-generated metrics for environmental sustainability tracking

/**
 * ENVIRONMENTAL MANAGEMENT CONFIGURATION
 * Soft-coded to allow easy modifications without changing core logic
 */

// FEATURE FLAGS - Control visibility and data calculation mode
export const ENVIRONMENTAL_FEATURES = {
  showEstimatedData: false, // Set to false to hide estimated/calculated environmental data
  showOnlyRealData: true,   // Show only data from actual project fields
  showDataUnavailableMessage: true, // Show message when environmental data not in projects
  enableCarbonTracking: false, // DISABLED: No carbon data in uploaded projects
  enableWasteManagement: false, // DISABLED: No waste data in uploaded projects
  enableWaterTracking: false,  // DISABLED: No water data in uploaded projects
  enableEnergyTracking: false  // DISABLED: No energy data in uploaded projects (see Energy page)
};

// DATA SOURCE MAPPING - Documents what data is available
export const ENVIRONMENTAL_DATA_SOURCES = {
  realDataAvailable: {
    projectInfo: ['projectNo', 'projectTitle', 'client', 'projectManager'],
    qualityMetrics: ['projectKPIsAchievedPercent', 'projectCompletionPercent'],
    complianceMetrics: ['carsOpen', 'obsOpen', 'delayInAuditsNoDays'],
    description: 'Only quality and compliance data available from uploaded projects'
  },
  estimatedData: {
    carbon: { formula: 'manhours * 50 kg CO2e', note: 'Industry average estimation only' },
    waste: { formula: 'manhours * 5 kg', note: 'Industry average estimation only' },
    water: { formula: 'manhours * 100 L', note: 'Industry average estimation only' },
    energy: { formula: 'manhours * 15 kWh', note: 'Industry average estimation only' },
    warning: 'Estimated values DO NOT reflect actual project environmental data'
  },
  dataNotInProjects: [
    'Actual carbon emissions measurements',
    'Actual waste generation records',
    'Actual water consumption data',
    'Actual energy usage data',
    'Environmental certifications',
    'Sustainability initiatives'
  ]
};

// Environmental Performance Levels
export const ENVIRONMENTAL_PERFORMANCE = {
  EXCELLENT: { min: 90, max: 100, label: 'Excellent', color: '#10b981', icon: '🌟', description: 'Outstanding environmental stewardship' },
  VERY_GOOD: { min: 80, max: 90, label: 'Very Good', color: '#22c55e', icon: '🌱', description: 'Strong environmental practices' },
  GOOD: { min: 70, max: 80, label: 'Good', color: '#3b82f6', icon: '♻️', description: 'Good environmental standards' },
  FAIR: { min: 55, max: 70, label: 'Fair', color: '#f59e0b', icon: '⚠️', description: 'Needs improvement' },
  POOR: { min: 40, max: 55, label: 'Poor', color: '#ef4444', icon: '❌', description: 'Significant concerns' },
  CRITICAL: { min: 0, max: 40, label: 'Critical', color: '#dc2626', icon: '🚨', description: 'Immediate action required' }
};

// Carbon Emission Categories (kg CO2e per project)
export const CARBON_CATEGORIES = {
  VERY_LOW: { max: 5000, label: 'Very Low', color: '#10b981', icon: '🌿' },
  LOW: { max: 15000, label: 'Low', color: '#22c55e', icon: '🌱' },
  MODERATE: { max: 30000, label: 'Moderate', color: '#3b82f6', icon: '🔵' },
  HIGH: { max: 60000, label: 'High', color: '#f59e0b', icon: '⚠️' },
  VERY_HIGH: { max: Infinity, label: 'Very High', color: '#ef4444', icon: '🔴' }
};

// Waste Management Categories
export const WASTE_CATEGORIES = {
  GENERAL: { label: 'General Waste', color: '#6b7280', recyclable: false, icon: '🗑️' },
  RECYCLABLE: { label: 'Recyclable', color: '#10b981', recyclable: true, icon: '♻️' },
  HAZARDOUS: { label: 'Hazardous', color: '#ef4444', recyclable: false, icon: '☢️' },
  ELECTRONIC: { label: 'E-Waste', color: '#3b82f6', recyclable: true, icon: '💻' },
  ORGANIC: { label: 'Organic', color: '#22c55e', recyclable: true, icon: '🌿' },
  CONSTRUCTION: { label: 'Construction', color: '#f59e0b', recyclable: true, icon: '🏗️' }
};

// Sustainability Goals (UN SDGs relevant to QHSE)
export const SUSTAINABILITY_GOALS = {
  SDG_3: { number: 3, label: 'Good Health and Well-being', color: '#4c9f38', icon: '❤️' },
  SDG_6: { number: 6, label: 'Clean Water and Sanitation', color: '#26bde2', icon: '💧' },
  SDG_7: { number: 7, label: 'Affordable and Clean Energy', color: '#fcc30b', icon: '⚡' },
  SDG_8: { number: 8, label: 'Decent Work and Economic Growth', color: '#a21942', icon: '💼' },
  SDG_9: { number: 9, label: 'Industry, Innovation and Infrastructure', color: '#fd6925', icon: '🏭' },
  SDG_11: { number: 11, label: 'Sustainable Cities and Communities', color: '#fd9d24', icon: '🏙️' },
  SDG_12: { number: 12, label: 'Responsible Consumption and Production', color: '#bf8b2e', icon: '🔄' },
  SDG_13: { number: 13, label: 'Climate Action', color: '#3f7e44', icon: '🌍' }
};

// Environmental Compliance Standards
export const COMPLIANCE_STANDARDS = {
  ISO_14001: { label: 'ISO 14001:2015', description: 'Environmental Management Systems', threshold: 85 },
  ISO_50001: { label: 'ISO 50001:2018', description: 'Energy Management Systems', threshold: 80 },
  LEED: { label: 'LEED Certification', description: 'Leadership in Energy and Environmental Design', threshold: 75 },
  BREEAM: { label: 'BREEAM', description: 'Building Research Establishment Environmental Assessment', threshold: 75 },
  LOCAL_REGULATIONS: { label: 'Local Environmental Regulations', description: 'Regional compliance', threshold: 95 }
};

// Energy Sources
export const ENERGY_SOURCES = {
  RENEWABLE: { label: 'Renewable Energy', color: '#10b981', icon: '☀️', sustainable: true },
  NATURAL_GAS: { label: 'Natural Gas', color: '#3b82f6', icon: '🔥', sustainable: false },
  ELECTRICITY_GRID: { label: 'Grid Electricity', color: '#f59e0b', icon: '⚡', sustainable: false },
  DIESEL: { label: 'Diesel', color: '#ef4444', icon: '⛽', sustainable: false },
  HYBRID: { label: 'Hybrid', color: '#22c55e', icon: '🔋', sustainable: true }
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
 * Calculate compliance rate from real project data
 */
const calculateComplianceRate = (projects) => {
  if (!projects || projects.length === 0) return 0;
  
  let complianceSum = 0;
  projects.forEach(project => {
    const kpi = parsePercentage(project.projectKPIsAchievedPercent);
    const delayDays = Number(project.delayInAuditsNoDays) || 0;
    const complianceScore = kpi - (delayDays * 0.5);
    complianceSum += Math.max(0, Math.min(100, complianceScore));
  });
  
  return Math.round((complianceSum / projects.length) * 10) / 10;
};

/**
 * Calculate comprehensive environmental metrics from project data
 * NOTE: Returns estimated data based on industry averages, NOT actual environmental measurements
 */
export const calculateEnvironmentalMetrics = (projects) => {
  if (!projects || projects.length === 0) {
    return {
      dataAvailable: false,
      message: 'No projects available for environmental analysis',
      activeProjects: 0,
      totalProjects: 0,
      highImpactProjects: 0,
      compliantProjects: 0,
      overallScore: 0,
      environmentalScore: 0,
      sustainabilityScore: 0,
      avgProjectEnvironmentalScore: 0,
      totalCarbonEmissions: 0,
      carbonFootprint: 0,
      carbonPerProject: 0,
      carbonIntensity: { value: 0, label: 'No Data' },
      totalWaste: 0,
      wasteGenerated: 0,
      recycledWaste: 0,
      wasteRecycled: 0,
      recyclingRate: 0,
      totalWaterUsage: 0,
      waterConsumption: 0,
      waterPerProject: 0,
      totalEnergyUsage: 0,
      energyConsumption: 0,
      renewableEnergy: 0,
      renewablePercentage: 0,
      renewableEnergyRate: 0,
      complianceRate: 0
    };
  }

  // Check if estimated data should be shown
  if (!ENVIRONMENTAL_FEATURES.showEstimatedData && ENVIRONMENTAL_FEATURES.showOnlyRealData) {
    return {
      dataAvailable: false,
      showEstimatedData: false,
      message: 'Environmental tracking data not available in uploaded projects',
      detailedMessage: 'The uploaded projects contain quality and compliance data only. Carbon emissions, waste, water, and energy data are not tracked. Enable estimated data mode to see industry-average calculations.',
      realDataAvailable: {
        projects: projects.length,
        qualityMetrics: true,
        complianceMetrics: true,
        environmentalMetrics: false
      },
      // Return only real compliance data
      activeProjects: projects.length,
      totalProjects: projects.length,
      compliantProjects: projects.filter(p => {
        const kpi = typeof p.projectKPIsAchievedPercent === 'string' 
          ? Number(p.projectKPIsAchievedPercent.replace('%', '')) 
          : Number(p.projectKPIsAchievedPercent) || 0;
        return kpi >= 80;
      }).length,
      complianceRate: calculateComplianceRate(projects),
      overallScore: 0,
      environmentalScore: 0,
      sustainabilityScore: 0,
      avgProjectEnvironmentalScore: 0,
      totalCarbonEmissions: 0,
      carbonFootprint: 0,
      carbonPerProject: 0,
      carbonIntensity: { value: 0, label: 'Data Not Available' },
      totalWaste: 0,
      wasteGenerated: 0,
      recycledWaste: 0,
      wasteRecycled: 0,
      recyclingRate: 0,
      totalWaterUsage: 0,
      waterConsumption: 0,
      waterPerProject: 0,
      totalEnergyUsage: 0,
      energyConsumption: 0,
      renewableEnergy: 0,
      renewablePercentage: 0,
      renewableEnergyRate: 0
    };
  }

  // If estimated data is enabled, continue with calculations
  let carbonSum = 0;
  let wasteSum = 0;
  let recycledWasteSum = 0;
  let waterSum = 0;
  let energySum = 0;
  let renewableEnergySum = 0;
  let complianceSum = 0;
  let envScoreSum = 0;

  projects.forEach(project => {
    // Estimate carbon emissions based on project size and completion
    const completion = parsePercentage(project.projectCompletionPercent);
    const estimatedCO2 = estimateCarbonEmissions(project);
    carbonSum += estimatedCO2;

    // Estimate waste based on observations and CARs
    const wasteGenerated = estimateWaste(project);
    const recycled = wasteGenerated * 0.65; // Assume 65% recycling rate
    wasteSum += wasteGenerated;
    recycledWasteSum += recycled;

    // Estimate resource consumption
    waterSum += estimateWaterUsage(project);
    energySum += estimateEnergyUsage(project);
    renewableEnergySum += estimateRenewableEnergy(project);

    // Environmental compliance based on KPI and audit status
    const kpi = parsePercentage(project.projectKPIsAchievedPercent);
    const delayDays = Number(project.delayInAuditsNoDays) || 0;
    const complianceScore = kpi - (delayDays * 0.5);
    complianceSum += Math.max(0, Math.min(100, complianceScore));

    // Project environmental score
    const projectEnvScore = calculateProjectEnvironmentalScore(project);
    envScoreSum += projectEnvScore;
  });

  const avgProjectEnvScore = projects.length > 0 ? envScoreSum / projects.length : 0;
  const recyclingRate = wasteSum > 0 ? (recycledWasteSum / wasteSum) * 100 : 0;
  const renewableEnergyRate = energySum > 0 ? (renewableEnergySum / energySum) * 100 : 0;
  const complianceRate = projects.length > 0 ? complianceSum / projects.length : 0;
  const carbonIntensity = projects.length > 0 ? carbonSum / projects.length : 0;

  // Overall environmental score (weighted average)
  const environmentalScore = (
    (avgProjectEnvScore * 0.3) +
    (complianceRate * 0.25) +
    (recyclingRate * 0.2) +
    (renewableEnergyRate * 0.15) +
    ((100 - Math.min(carbonIntensity / 1000, 100)) * 0.1)
  );

  // Sustainability score
  const sustainabilityScore = (
    (recyclingRate * 0.3) +
    (renewableEnergyRate * 0.3) +
    (complianceRate * 0.25) +
    (avgProjectEnvScore * 0.15)
  );

  return {
    // Project counts
    activeProjects: projects.length,
    totalProjects: projects.length,
    highImpactProjects: projects.filter(p => estimateCarbonEmissions(p) > 30000).length,
    compliantProjects: projects.filter(p => parsePercentage(p.projectKPIsAchievedPercent) >= 80).length,
    
    // Scores
    overallScore: Math.round(environmentalScore * 10) / 10,
    environmentalScore: Math.round(environmentalScore * 10) / 10,
    sustainabilityScore: Math.round(sustainabilityScore * 10) / 10,
    avgProjectEnvironmentalScore: Math.round(avgProjectEnvScore * 10) / 10,
    
    // Carbon metrics
    totalCarbonEmissions: Math.round(carbonSum),
    carbonFootprint: Math.round(carbonSum),
    carbonPerProject: Math.round(carbonIntensity),
    carbonIntensity: {
      value: Math.round(carbonIntensity),
      label: carbonIntensity < 5000 ? 'Very Low' : carbonIntensity < 15000 ? 'Low' : carbonIntensity < 30000 ? 'Moderate' : carbonIntensity < 60000 ? 'High' : 'Very High'
    },
    
    // Waste metrics
    totalWaste: Math.round(wasteSum),
    wasteGenerated: Math.round(wasteSum),
    recycledWaste: Math.round(recycledWasteSum),
    wasteRecycled: Math.round(recycledWasteSum),
    recyclingRate: Math.round(recyclingRate * 10) / 10,
    
    // Water metrics
    totalWaterUsage: Math.round(waterSum),
    waterConsumption: Math.round(waterSum),
    waterPerProject: projects.length > 0 ? Math.round(waterSum / projects.length) : 0,
    
    // Energy metrics
    totalEnergyUsage: Math.round(energySum),
    energyConsumption: Math.round(energySum),
    renewableEnergy: Math.round(renewableEnergySum),
    renewablePercentage: Math.round(renewableEnergyRate * 10) / 10,
    renewableEnergyRate: Math.round(renewableEnergyRate * 10) / 10,
    
    // Compliance
    complianceRate: Math.round(complianceRate * 10) / 10
  };
};

/**
 * Estimate carbon emissions for a project (kg CO2e)
 */
const estimateCarbonEmissions = (project) => {
  // Base emissions on project parameters
  const completion = parsePercentage(project.projectCompletionPercent);
  const manhours = Number(project.manhoursUsed) || 0;
  const issues = (Number(project.carsOpen) || 0) + (Number(project.obsOpen) || 0);
  
  // Formula: Base emissions + manhour factor + issues penalty
  // Average: 50 kg CO2e per manhour for construction/engineering
  const baseEmissions = manhours * 50;
  const completionFactor = completion / 100;
  const issuesPenalty = issues * 500; // Each issue adds emissions due to rework
  
  return (baseEmissions * completionFactor) + issuesPenalty;
};

/**
 * Estimate waste generation for a project (kg)
 */
const estimateWaste = (project) => {
  const completion = parsePercentage(project.projectCompletionPercent);
  const manhours = Number(project.manhoursUsed) || 0;
  
  // Average: 5 kg waste per manhour in construction/engineering
  return manhours * 5 * (completion / 100);
};

/**
 * Estimate water usage for a project (liters)
 */
const estimateWaterUsage = (project) => {
  const completion = parsePercentage(project.projectCompletionPercent);
  const manhours = Number(project.manhoursUsed) || 0;
  
  // Average: 100 liters per manhour (includes all project activities)
  return manhours * 100 * (completion / 100);
};

/**
 * Estimate energy usage for a project (kWh)
 */
const estimateEnergyUsage = (project) => {
  const completion = parsePercentage(project.projectCompletionPercent);
  const manhours = Number(project.manhoursUsed) || 0;
  
  // Average: 15 kWh per manhour
  return manhours * 15 * (completion / 100);
};

/**
 * Estimate renewable energy usage (kWh)
 */
const estimateRenewableEnergy = (project) => {
  const totalEnergy = estimateEnergyUsage(project);
  const kpi = parsePercentage(project.projectKPIsAchievedPercent);
  
  // Better performing projects assumed to use more renewable energy
  const renewablePercentage = kpi > 80 ? 0.4 : kpi > 60 ? 0.25 : 0.15;
  return totalEnergy * renewablePercentage;
};

/**
 * Calculate project environmental score
 */
const calculateProjectEnvironmentalScore = (project) => {
  const kpi = parsePercentage(project.projectKPIsAchievedPercent);
  const completion = parsePercentage(project.projectCompletionPercent);
  const issues = (Number(project.carsOpen) || 0) + (Number(project.obsOpen) || 0);
  const delayDays = Number(project.delayInAuditsNoDays) || 0;
  
  // Environmental score formula
  const score = (
    (kpi * 0.4) +
    (completion * 0.3) -
    (issues * 2) -
    (delayDays * 0.5)
  );
  
  return Math.max(0, Math.min(100, score));
};

/**
 * Get environmental performance category
 */
export const getEnvironmentalPerformance = (score) => {
  for (const [key, range] of Object.entries(ENVIRONMENTAL_PERFORMANCE)) {
    if (score >= range.min && score < range.max) {
      return { key, ...range };
    }
  }
  return { key: 'CRITICAL', ...ENVIRONMENTAL_PERFORMANCE.CRITICAL };
};

/**
 * Generate carbon emissions trend by project phase
 */
export const generateCarbonTrend = (projects) => {
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

    const totalEmissions = rangeProjects.reduce((sum, p) => sum + estimateCarbonEmissions(p), 0);
    const avgEmissions = rangeProjects.length > 0 ? totalEmissions / rangeProjects.length : 0;

    return {
      name: range.label,
      'Carbon Emissions (kg CO2e)': Math.round(totalEmissions),
      'Average per Project': Math.round(avgEmissions),
      projectCount: rangeProjects.length
    };
  }).filter(item => item.projectCount > 0);
};

/**
 * Generate waste management breakdown
 */
export const generateWasteBreakdown = (projects) => {
  const totalWaste = projects.reduce((sum, p) => sum + estimateWaste(p), 0);
  
  return Object.entries(WASTE_CATEGORIES).map(([key, category]) => {
    // Distribute waste across categories with realistic percentages
    const percentages = {
      GENERAL: 0.25,
      RECYCLABLE: 0.30,
      HAZARDOUS: 0.05,
      ELECTRONIC: 0.10,
      ORGANIC: 0.15,
      CONSTRUCTION: 0.15
    };
    
    const amount = totalWaste * percentages[key];
    
    return {
      name: category.label,
      value: Math.round(amount),
      percentage: Math.round(percentages[key] * 100),
      recyclable: category.recyclable,
      color: category.color,
      icon: category.icon
    };
  });
};

/**
 * Generate resource consumption trend
 */
export const generateResourceConsumptionTrend = (projects) => {
  // Group by project completion for trend
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

    const water = rangeProjects.reduce((sum, p) => sum + estimateWaterUsage(p), 0);
    const energy = rangeProjects.reduce((sum, p) => sum + estimateEnergyUsage(p), 0);
    const renewable = rangeProjects.reduce((sum, p) => sum + estimateRenewableEnergy(p), 0);

    return {
      name: range.label,
      'Water (1000L)': Math.round(water / 1000),
      'Energy (MWh)': Math.round(energy / 1000),
      'Renewable (MWh)': Math.round(renewable / 1000),
      projectCount: rangeProjects.length
    };
  }).filter(item => item.projectCount > 0);
};

/**
 * Get high environmental impact projects
 */
export const getHighImpactProjects = (projects, limit = 5) => {
  return projects
    .map(project => {
      const carbonEmissions = estimateCarbonEmissions(project);
      const waste = estimateWaste(project);
      const waterUsage = estimateWaterUsage(project);
      const envScore = calculateProjectEnvironmentalScore(project);
      
      // Calculate environmental impact score (higher = worse impact)
      const impactScore = (carbonEmissions / 1000) + (waste / 100) + (waterUsage / 10000) - envScore;

      return {
        ...project,
        carbonEmissions: Math.round(carbonEmissions),
        waste: Math.round(waste),
        waterUsage: Math.round(waterUsage),
        envScore: Math.round(envScore * 10) / 10,
        impactScore: Math.round(impactScore * 10) / 10,
        impactLevel: getImpactLevel(impactScore)
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, limit);
};

/**
 * Get impact level based on score
 */
const getImpactLevel = (score) => {
  if (score >= 100) return { label: 'Very High', color: '#dc2626' };
  if (score >= 50) return { label: 'High', color: '#ef4444' };
  if (score >= 25) return { label: 'Moderate', color: '#f59e0b' };
  if (score >= 10) return { label: 'Low', color: '#3b82f6' };
  return { label: 'Very Low', color: '#10b981' };
};

/**
 * Generate sustainability goals progress
 */
export const generateSustainabilityProgress = (projects, metrics) => {
  return [
    {
      goal: SUSTAINABILITY_GOALS.SDG_7,
      progress: metrics.renewableEnergyRate,
      target: 50,
      description: `${metrics.renewableEnergyRate.toFixed(1)}% renewable energy usage`
    },
    {
      goal: SUSTAINABILITY_GOALS.SDG_12,
      progress: metrics.recyclingRate,
      target: 75,
      description: `${metrics.recyclingRate.toFixed(1)}% waste recycling rate`
    },
    {
      goal: SUSTAINABILITY_GOALS.SDG_13,
      progress: Math.min((100000 - metrics.carbonFootprint) / 1000, 100),
      target: 100,
      description: `${metrics.carbonFootprint.toLocaleString()} kg CO2e total emissions`
    },
    {
      goal: SUSTAINABILITY_GOALS.SDG_6,
      progress: Math.min(metrics.complianceRate, 100),
      target: 95,
      description: `${metrics.complianceRate.toFixed(1)}% environmental compliance`
    }
  ];
};

/**
 * Generate environmental compliance matrix
 */
export const generateComplianceMatrix = (projects, metrics) => {
  return Object.entries(COMPLIANCE_STANDARDS).map(([key, standard]) => {
    let complianceScore = 0;

    switch (key) {
      case 'ISO_14001':
        complianceScore = metrics.environmentalScore;
        break;
      case 'ISO_50001':
        complianceScore = metrics.renewableEnergyRate;
        break;
      case 'LEED':
      case 'BREEAM':
        complianceScore = (metrics.recyclingRate + metrics.renewableEnergyRate) / 2;
        break;
      case 'LOCAL_REGULATIONS':
        complianceScore = metrics.complianceRate;
        break;
    }

    return {
      standard: standard.label,
      description: standard.description,
      threshold: standard.threshold,
      currentScore: Math.round(complianceScore * 10) / 10,
      status: complianceScore >= standard.threshold ? 'Compliant' : 'Non-Compliant',
      gap: Math.max(0, standard.threshold - complianceScore)
    };
  });
};

/**
 * Calculate monthly environmental trend (simulated)
 */
export const generateMonthlyEnvironmentalTrend = (projects) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  return months.slice(0, currentMonth + 1).map((month, idx) => {
    const monthProjects = projects.filter((p, index) => index % 12 === idx);
    const carbon = monthProjects.reduce((sum, p) => sum + estimateCarbonEmissions(p), 0);
    const waste = monthProjects.reduce((sum, p) => sum + estimateWaste(p), 0);
    const recycled = waste * 0.65;
    
    return {
      name: month,
      'Carbon (tons)': Math.round(carbon / 1000),
      'Waste (tons)': Math.round(waste / 1000),
      'Recycled (tons)': Math.round(recycled / 1000),
      'Env Score': monthProjects.length > 0 ? 
        Math.round(monthProjects.reduce((sum, p) => sum + calculateProjectEnvironmentalScore(p), 0) / monthProjects.length) : 
        85
    };
  });
};
