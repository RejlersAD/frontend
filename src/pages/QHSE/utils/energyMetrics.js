/**
 * Energy Management Metrics Utility
 * Comprehensive energy monitoring, optimization, and sustainability calculations
 * All thresholds and factors are soft-coded for easy configuration
 */

// FEATURE FLAGS - Control visibility and data calculation mode
export const ENERGY_FEATURES = {
  showEstimatedData: false, // Set to false to hide estimated/calculated energy data
  showOnlyRealData: true,   // Show only data from actual project fields
  showDataUnavailableMessage: true, // Show message when energy data not in projects
  enableConsumptionTracking: false, // DISABLED: No energy data in uploaded projects
  enableSourceTracking: false,      // DISABLED: No energy source data available
  enableEfficiencyTracking: false,  // DISABLED: No efficiency data available
  enableCostTracking: false         // DISABLED: No cost data available
};

// DATA SOURCE MAPPING - Documents what data is available
export const ENERGY_DATA_SOURCES = {
  realDataAvailable: {
    projectInfo: ['projectNo', 'projectTitle', 'client', 'projectManager'],
    qualityMetrics: ['projectKPIsAchievedPercent', 'projectCompletionPercent'],
    complianceMetrics: ['carsOpen', 'obsOpen', 'delayInAuditsNoDays'],
    description: 'Only quality and compliance data available from uploaded projects'
  },
  estimatedData: {
    consumption: { formula: 'manhours * 15 kWh', note: 'Industry average estimation only' },
    sources: { note: 'Energy source distribution is fictional/estimated' },
    efficiency: { note: 'Efficiency scores are calculated estimates' },
    renewable: { formula: 'Based on KPI performance assumptions', note: 'Not real renewable energy data' },
    warning: 'Estimated values DO NOT reflect actual project energy data'
  },
  dataNotInProjects: [
    'Actual energy consumption measurements',
    'Energy source breakdown',
    'Renewable energy usage',
    'Energy efficiency metrics',
    'Cost per kWh data',
    'Peak demand data',
    'Smart meter readings'
  ]
};

// Energy Performance Configuration
const ENERGY_PERFORMANCE = {
  consumption: {
    baseline: 15, // kWh per manhour baseline
    excellent: 10,
    good: 12,
    moderate: 15,
    high: 20
  },
  renewable: {
    excellent: 60, // % renewable energy
    good: 40,
    moderate: 25,
    poor: 10
  },
  efficiency: {
    excellent: 85, // efficiency score
    good: 75,
    moderate: 65,
    poor: 50
  },
  cost: {
    baseline: 0.15, // $ per kWh
    excellent: 0.10,
    good: 0.12,
    moderate: 0.15,
    high: 0.20
  }
};

// Energy Sources Configuration
const ENERGY_SOURCES = {
  solar: {
    name: 'Solar',
    color: '#f59e0b',
    carbonIntensity: 45, // gCO2/kWh
    basePercentage: 25,
    icon: '☀️'
  },
  wind: {
    name: 'Wind',
    color: '#3b82f6',
    carbonIntensity: 11,
    basePercentage: 15,
    icon: '🌬️'
  },
  hydro: {
    name: 'Hydro',
    color: '#06b6d4',
    carbonIntensity: 24,
    basePercentage: 10,
    icon: '💧'
  },
  biomass: {
    name: 'Biomass',
    color: '#84cc16',
    carbonIntensity: 230,
    basePercentage: 5,
    icon: '🌱'
  },
  grid: {
    name: 'Grid',
    color: '#6b7280',
    carbonIntensity: 475,
    basePercentage: 35,
    icon: '⚡'
  },
  natural_gas: {
    name: 'Natural Gas',
    color: '#f97316',
    carbonIntensity: 490,
    basePercentage: 10,
    icon: '🔥'
  }
};

// Energy Efficiency Initiatives
const EFFICIENCY_INITIATIVES = {
  led_lighting: {
    name: 'LED Lighting Upgrade',
    category: 'Lighting',
    savingsPotential: 0.15, // 15% savings
    implementationCost: 5000,
    paybackMonths: 18,
    priority: 'high'
  },
  hvac_optimization: {
    name: 'HVAC System Optimization',
    category: 'HVAC',
    savingsPotential: 0.25,
    implementationCost: 15000,
    paybackMonths: 24,
    priority: 'high'
  },
  building_insulation: {
    name: 'Building Insulation',
    category: 'Building Envelope',
    savingsPotential: 0.20,
    implementationCost: 20000,
    paybackMonths: 36,
    priority: 'medium'
  },
  smart_controls: {
    name: 'Smart Building Controls',
    category: 'Automation',
    savingsPotential: 0.18,
    implementationCost: 12000,
    paybackMonths: 20,
    priority: 'high'
  },
  solar_panels: {
    name: 'Solar Panel Installation',
    category: 'Renewable',
    savingsPotential: 0.30,
    implementationCost: 50000,
    paybackMonths: 60,
    priority: 'medium'
  },
  energy_monitoring: {
    name: 'Real-time Energy Monitoring',
    category: 'Monitoring',
    savingsPotential: 0.12,
    implementationCost: 8000,
    paybackMonths: 15,
    priority: 'high'
  },
  equipment_upgrade: {
    name: 'Equipment Efficiency Upgrade',
    category: 'Equipment',
    savingsPotential: 0.22,
    implementationCost: 25000,
    paybackMonths: 30,
    priority: 'medium'
  },
  demand_response: {
    name: 'Demand Response Program',
    category: 'Grid Integration',
    savingsPotential: 0.10,
    implementationCost: 3000,
    paybackMonths: 12,
    priority: 'low'
  }
};

// Smart Building Technologies
const SMART_TECHNOLOGIES = {
  iot_sensors: {
    name: 'IoT Sensors',
    category: 'Sensing',
    maturityLevel: 'deployed',
    energyImpact: 'medium',
    dataPoints: 150
  },
  ai_optimization: {
    name: 'AI-Based Optimization',
    category: 'Analytics',
    maturityLevel: 'testing',
    energyImpact: 'high',
    dataPoints: 0
  },
  predictive_maintenance: {
    name: 'Predictive Maintenance',
    category: 'Maintenance',
    maturityLevel: 'deployed',
    energyImpact: 'medium',
    dataPoints: 85
  },
  occupancy_sensing: {
    name: 'Occupancy-based Control',
    category: 'Automation',
    maturityLevel: 'deployed',
    energyImpact: 'high',
    dataPoints: 200
  },
  energy_storage: {
    name: 'Battery Energy Storage',
    category: 'Storage',
    maturityLevel: 'planned',
    energyImpact: 'high',
    dataPoints: 0
  },
  smart_grid: {
    name: 'Smart Grid Integration',
    category: 'Grid',
    maturityLevel: 'testing',
    energyImpact: 'medium',
    dataPoints: 50
  }
};

// Consumption Categories
const CONSUMPTION_CATEGORIES = {
  hvac: { name: 'HVAC', percentage: 40, color: '#ef4444' },
  lighting: { name: 'Lighting', percentage: 25, color: '#f59e0b' },
  equipment: { name: 'Equipment', percentage: 20, color: '#3b82f6' },
  it_systems: { name: 'IT Systems', percentage: 10, color: '#8b5cf6' },
  other: { name: 'Other', percentage: 5, color: '#6b7280' }
};

/**
 * Calculate comprehensive energy metrics for projects
 * NOTE: Returns estimated data based on industry averages, NOT actual energy measurements
 */
export const calculateEnergyMetrics = (projects = []) => {
  const emptyMetrics = {
    // Counts
    totalProjects: 0,
    activeProjects: 0,
    highConsumers: 0,
    efficientProjects: 0,
    
    // Overall Scores
    overallEnergyScore: 0,
    efficiencyScore: 0,
    
    // Energy Consumption
    totalEnergyConsumption: 0,
    energyPerProject: 0,
    peakDemand: 0,
    consumptionTrend: 0,
    
    // Renewable Energy
    totalRenewableEnergy: 0,
    renewablePercentage: 0,
    carbonAvoided: 0,
    
    // Cost Metrics
    totalEnergyCost: 0,
    costPerProject: 0,
    avgCostPerKwh: ENERGY_PERFORMANCE.cost.baseline,
    potentialSavings: 0,
    
    // Efficiency Metrics
    avgEfficiencyScore: 0,
    initiativesImplemented: 0,
    totalSavingsAchieved: 0,
    
    // Smart Building
    smartTechAdoption: 0,
    automationLevel: 0,
    dataPointsCollected: 0,
    
    // Carbon Impact
    totalCarbonEmissions: 0,
    carbonIntensity: { value: 0, label: 'No Data' },
    carbonReduction: 0
  };

  if (!Array.isArray(projects) || projects.length === 0) {
    return {
      ...emptyMetrics,
      dataAvailable: false,
      message: 'No projects available for energy analysis'
    };
  }

  // Check if estimated data should be shown
  if (!ENERGY_FEATURES.showEstimatedData && ENERGY_FEATURES.showOnlyRealData) {
    return {
      ...emptyMetrics,
      dataAvailable: false,
      showEstimatedData: false,
      message: 'Energy tracking data not available in uploaded projects',
      detailedMessage: 'The uploaded projects contain quality and compliance data only. Energy consumption, source distribution, and efficiency data are not tracked. Enable estimated data mode to see industry-average calculations.',
      realDataAvailable: {
        projects: projects.length,
        qualityMetrics: true,
        complianceMetrics: true,
        energyMetrics: false
      },
      // Return only basic project count
      totalProjects: projects.length,
      activeProjects: projects.filter(p => 
        p.status === 'active' || p.status === 'in_progress' || p.status === 'ongoing'
      ).length
    };
  }

  // Continue with estimated calculations if enabled
  const activeProjects = projects.filter(p => 
    p.status === 'active' || p.status === 'in_progress' || p.status === 'ongoing'
  );

  // Calculate energy consumption for each project
  const projectMetrics = projects.map(project => {
    const manhours = parseFloat(project.manhours_spent || project.manhours || 0);
    const kpi = parseFloat(project.kpi_performance || project.overall_kpi || 75);
    const completion = parseFloat(project.completion_percentage || project.progress || 0);
    const issues = parseInt(project.issues || project.total_issues || 0);
    
    // Energy consumption based on manhours and efficiency
    const baseConsumption = manhours * ENERGY_PERFORMANCE.consumption.baseline;
    const efficiencyFactor = kpi / 100;
    const energyConsumption = baseConsumption * (2 - efficiencyFactor); // Lower KPI = higher consumption
    
    // Renewable energy percentage (varies by project performance)
    const renewablePercentage = Math.min(60, 15 + (kpi * 0.5));
    const renewableEnergy = energyConsumption * (renewablePercentage / 100);
    
    // Cost calculation
    const costPerKwh = ENERGY_PERFORMANCE.cost.baseline * (2 - efficiencyFactor);
    const energyCost = energyConsumption * costPerKwh;
    
    // Efficiency score
    const efficiencyScore = Math.min(100, kpi * 0.8 + (100 - issues * 2));
    
    // Carbon emissions
    const gridIntensity = ENERGY_SOURCES.grid.carbonIntensity;
    const renewableIntensity = 50; // Average renewable carbon intensity
    const carbonEmissions = 
      (energyConsumption - renewableEnergy) * gridIntensity + 
      renewableEnergy * renewableIntensity;
    
    return {
      ...project,
      energyConsumption,
      renewableEnergy,
      renewablePercentage,
      energyCost,
      costPerKwh,
      efficiencyScore,
      carbonEmissions,
      isHighConsumer: energyConsumption > manhours * 18,
      isEfficient: efficiencyScore >= 75
    };
  });

  // Aggregate metrics
  const totalEnergyConsumption = projectMetrics.reduce((sum, p) => sum + p.energyConsumption, 0);
  const totalRenewableEnergy = projectMetrics.reduce((sum, p) => sum + p.renewableEnergy, 0);
  const totalEnergyCost = projectMetrics.reduce((sum, p) => sum + p.energyCost, 0);
  const totalCarbonEmissions = projectMetrics.reduce((sum, p) => sum + p.carbonEmissions, 0);
  
  const highConsumers = projectMetrics.filter(p => p.isHighConsumer).length;
  const efficientProjects = projectMetrics.filter(p => p.isEfficient).length;
  
  const renewablePercentage = totalEnergyConsumption > 0 
    ? (totalRenewableEnergy / totalEnergyConsumption) * 100 
    : 0;
  
  const avgEfficiencyScore = projectMetrics.length > 0
    ? projectMetrics.reduce((sum, p) => sum + p.efficiencyScore, 0) / projectMetrics.length
    : 0;
  
  // Calculate overall energy score (0-100)
  const efficiencyComponent = avgEfficiencyScore * 0.4;
  const renewableComponent = Math.min(renewablePercentage * 0.6, 35);
  const consumptionComponent = Math.max(0, 25 - (highConsumers / projects.length) * 100);
  const overallEnergyScore = Math.min(100, efficiencyComponent + renewableComponent + consumptionComponent);
  
  // Cost metrics
  const avgCostPerKwh = totalEnergyConsumption > 0 
    ? totalEnergyCost / totalEnergyConsumption 
    : ENERGY_PERFORMANCE.cost.baseline;
  
  const potentialSavings = totalEnergyCost * 0.25; // Estimate 25% potential savings
  
  // Carbon metrics
  const carbonIntensity = totalEnergyConsumption > 0 
    ? totalCarbonEmissions / totalEnergyConsumption 
    : 0;
  
  const carbonCategory = 
    carbonIntensity < 100 ? 'Very Low' :
    carbonIntensity < 200 ? 'Low' :
    carbonIntensity < 350 ? 'Moderate' :
    carbonIntensity < 500 ? 'High' : 'Very High';
  
  const baselineCarbon = totalEnergyConsumption * ENERGY_SOURCES.grid.carbonIntensity;
  const carbonAvoided = baselineCarbon - totalCarbonEmissions;
  const carbonReduction = baselineCarbon > 0 ? (carbonAvoided / baselineCarbon) * 100 : 0;
  
  // Smart building metrics
  const deployedTech = Object.values(SMART_TECHNOLOGIES).filter(t => t.maturityLevel === 'deployed').length;
  const totalTech = Object.values(SMART_TECHNOLOGIES).length;
  const smartTechAdoption = (deployedTech / totalTech) * 100;
  
  const dataPointsCollected = Object.values(SMART_TECHNOLOGIES)
    .filter(t => t.maturityLevel === 'deployed')
    .reduce((sum, t) => sum + t.dataPoints, 0);
  
  // Initiative metrics (simulate implemented initiatives based on efficiency)
  const initiativesImplemented = Math.floor((avgEfficiencyScore / 100) * 5);
  const totalSavingsAchieved = totalEnergyCost * (initiativesImplemented * 0.04); // 4% per initiative
  
  return {
    // Counts
    totalProjects: projects.length,
    activeProjects: activeProjects.length,
    highConsumers,
    efficientProjects,
    
    // Overall Scores
    overallEnergyScore: Math.round(overallEnergyScore * 10) / 10,
    efficiencyScore: Math.round(avgEfficiencyScore * 10) / 10,
    
    // Energy Consumption
    totalEnergyConsumption: Math.round(totalEnergyConsumption),
    energyPerProject: Math.round(totalEnergyConsumption / projects.length),
    peakDemand: Math.round(Math.max(...projectMetrics.map(p => p.energyConsumption))),
    consumptionTrend: Math.round((renewablePercentage - 25) * 2), // Trend indicator
    
    // Renewable Energy
    totalRenewableEnergy: Math.round(totalRenewableEnergy),
    renewablePercentage: Math.round(renewablePercentage * 10) / 10,
    carbonAvoided: Math.round(carbonAvoided / 1000), // Convert to tons
    
    // Cost Metrics
    totalEnergyCost: Math.round(totalEnergyCost),
    costPerProject: Math.round(totalEnergyCost / projects.length),
    avgCostPerKwh: Math.round(avgCostPerKwh * 1000) / 1000,
    potentialSavings: Math.round(potentialSavings),
    
    // Efficiency Metrics
    avgEfficiencyScore: Math.round(avgEfficiencyScore * 10) / 10,
    initiativesImplemented,
    totalSavingsAchieved: Math.round(totalSavingsAchieved),
    
    // Smart Building
    smartTechAdoption: Math.round(smartTechAdoption),
    automationLevel: Math.round((smartTechAdoption + avgEfficiencyScore) / 2),
    dataPointsCollected,
    
    // Carbon Impact
    totalCarbonEmissions: Math.round(totalCarbonEmissions / 1000), // Convert to tons
    carbonIntensity: { 
      value: Math.round(carbonIntensity), 
      label: carbonCategory 
    },
    carbonReduction: Math.round(carbonReduction * 10) / 10,
    
    // Store processed projects for detailed views
    projectMetrics
  };
};

/**
 * Generate energy consumption breakdown by category
 */
export const generateConsumptionBreakdown = (totalConsumption) => {
  return Object.entries(CONSUMPTION_CATEGORIES).map(([key, category]) => ({
    name: category.name,
    value: Math.round(totalConsumption * (category.percentage / 100)),
    percentage: category.percentage,
    color: category.color,
    key
  }));
};

/**
 * Generate energy source distribution
 */
export const generateEnergySourceDistribution = (projects, energyData) => {
  const renewablePercentage = energyData.renewablePercentage || 0;
  const totalConsumption = energyData.totalEnergyConsumption || 0;
  
  return Object.entries(ENERGY_SOURCES).map(([key, source]) => {
    let percentage = source.basePercentage;
    
    // Adjust percentages based on renewable adoption
    if (['solar', 'wind', 'hydro', 'biomass'].includes(key)) {
      percentage = source.basePercentage * (renewablePercentage / 45); // Scale to renewable %
    } else {
      percentage = source.basePercentage * ((100 - renewablePercentage) / 55); // Scale non-renewable
    }
    
    return {
      name: source.name,
      value: Math.round(totalConsumption * (percentage / 100)),
      percentage: Math.round(percentage * 10) / 10,
      color: source.color,
      carbonIntensity: source.carbonIntensity,
      icon: source.icon,
      key,
      isRenewable: ['solar', 'wind', 'hydro', 'biomass'].includes(key)
    };
  }).filter(source => source.value > 0);
};

/**
 * Generate efficiency initiatives analysis
 */
export const generateEfficiencyInitiatives = (energyData) => {
  const currentCost = energyData.totalEnergyCost || 10000;
  
  return Object.entries(EFFICIENCY_INITIATIVES).map(([key, initiative]) => {
    const annualSavings = currentCost * initiative.savingsPotential;
    const roi = ((annualSavings * 12) / initiative.implementationCost) * 100;
    
    // Determine implementation status based on priority and payback
    let status = 'planned';
    if (initiative.priority === 'high' && initiative.paybackMonths < 24) {
      status = Math.random() > 0.3 ? 'implemented' : 'in_progress';
    } else if (initiative.priority === 'medium') {
      status = Math.random() > 0.6 ? 'implemented' : 'planned';
    }
    
    return {
      name: initiative.name,
      category: initiative.category,
      savingsPotential: initiative.savingsPotential * 100,
      implementationCost: initiative.implementationCost,
      annualSavings: Math.round(annualSavings),
      paybackMonths: initiative.paybackMonths,
      roi: Math.round(roi),
      priority: initiative.priority,
      status,
      key
    };
  }).sort((a, b) => b.roi - a.roi); // Sort by ROI
};

/**
 * Generate smart technology adoption status
 */
export const generateSmartTechnologies = () => {
  return Object.entries(SMART_TECHNOLOGIES).map(([key, tech]) => ({
    name: tech.name,
    category: tech.category,
    maturityLevel: tech.maturityLevel,
    energyImpact: tech.energyImpact,
    dataPoints: tech.dataPoints,
    isActive: tech.maturityLevel === 'deployed',
    key
  }));
};

/**
 * Generate consumption trend data (last 12 months)
 */
export const generateConsumptionTrend = (projects, energyData) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  const baseConsumption = energyData.totalEnergyConsumption / 12;
  
  return months.map((month, index) => {
    const isCurrentMonth = index === currentMonth;
    const variation = Math.sin(index * 0.5) * 0.15; // Seasonal variation
    const trend = -0.02 * (12 - Math.abs(index - currentMonth)); // Improvement trend
    
    const consumption = Math.round(baseConsumption * (1 + variation + trend));
    const renewable = Math.round(consumption * (energyData.renewablePercentage / 100));
    const grid = consumption - renewable;
    const cost = Math.round(consumption * energyData.avgCostPerKwh);
    
    return {
      month,
      consumption,
      renewable,
      grid,
      cost,
      efficiency: Math.round(70 + index * 2 + Math.random() * 10),
      isCurrentMonth
    };
  });
};

/**
 * Generate cost optimization opportunities
 */
export const generateCostOptimization = (energyData) => {
  const currentCost = energyData.totalEnergyCost || 10000;
  
  return [
    {
      category: 'Peak Demand Management',
      description: 'Shift non-critical loads to off-peak hours',
      potentialSavings: Math.round(currentCost * 0.15),
      savingsPercentage: 15,
      complexity: 'medium',
      timeframe: '3-6 months'
    },
    {
      category: 'Renewable Energy Expansion',
      description: 'Increase solar and wind capacity',
      potentialSavings: Math.round(currentCost * 0.25),
      savingsPercentage: 25,
      complexity: 'high',
      timeframe: '12-18 months'
    },
    {
      category: 'Energy Efficiency Upgrades',
      description: 'LED lighting and HVAC optimization',
      potentialSavings: Math.round(currentCost * 0.20),
      savingsPercentage: 20,
      complexity: 'low',
      timeframe: '1-3 months'
    },
    {
      category: 'Smart Building Automation',
      description: 'AI-based optimization and controls',
      potentialSavings: Math.round(currentCost * 0.18),
      savingsPercentage: 18,
      complexity: 'high',
      timeframe: '6-12 months'
    },
    {
      category: 'Energy Storage Integration',
      description: 'Battery systems for load balancing',
      potentialSavings: Math.round(currentCost * 0.12),
      savingsPercentage: 12,
      complexity: 'high',
      timeframe: '12-24 months'
    }
  ].sort((a, b) => b.potentialSavings - a.potentialSavings);
};

/**
 * Generate carbon reduction roadmap
 */
export const generateCarbonReductionRoadmap = (energyData) => {
  const currentEmissions = energyData.totalCarbonEmissions || 100;
  const targets = [
    { year: 2024, reduction: 15, initiative: 'LED Retrofit & HVAC Upgrade' },
    { year: 2025, reduction: 30, initiative: 'Solar Panel Installation Phase 1' },
    { year: 2026, reduction: 50, initiative: 'Smart Building Controls' },
    { year: 2027, reduction: 65, initiative: 'Solar Phase 2 & Wind Integration' },
    { year: 2028, reduction: 80, initiative: 'Battery Storage & Grid Optimization' },
    { year: 2030, reduction: 100, initiative: 'Net Zero Operations' }
  ];
  
  return targets.map(target => ({
    year: target.year,
    targetReduction: target.reduction,
    targetEmissions: Math.round(currentEmissions * (1 - target.reduction / 100)),
    cumulativeSavings: Math.round(currentEmissions * (target.reduction / 100)),
    initiative: target.initiative,
    status: target.year <= new Date().getFullYear() ? 'completed' : 
            target.year === new Date().getFullYear() + 1 ? 'in_progress' : 'planned'
  }));
};

// Export configurations for use in components
export {
  ENERGY_PERFORMANCE,
  ENERGY_SOURCES,
  EFFICIENCY_INITIATIVES,
  SMART_TECHNOLOGIES,
  CONSUMPTION_CATEGORIES
};
