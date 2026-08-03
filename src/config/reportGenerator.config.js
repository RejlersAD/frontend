/**
 * ============================================
 * REPORT GENERATOR CONFIGURATION
 * ============================================
 * 
 * @description Advanced report generation system with predictive analytics
 * @module reportGenerator.config
 * @purpose Centralized configuration for CEO reports and analytics
 */

import { REJLERS_COLORS } from './theme.config';

/**
 * ===========================================
 * REPORT TYPES & TEMPLATES
 * ===========================================
 */

export const REPORT_TYPES = {
  EXECUTIVE_SUMMARY: {
    id: 'executive_summary',
    name: 'Executive Summary',
    description: 'High-level overview for CEO and stakeholders',
    icon: '📊',
    frequency: ['weekly', 'monthly', 'quarterly', 'yearly'],
    sections: [
      'key_metrics',
      'usage_statistics',
      'performance_overview',
      'growth_trends',
      'predictions',
      'recommendations'
    ],
    priority: 1,
    estimatedTime: '5 mins',
    aiPowered: true
  },
  DEPARTMENT_PERFORMANCE: {
    id: 'department_performance',
    name: 'AIML Department Performance',
    description: 'Detailed analysis of department productivity and efficiency',
    icon: '🎯',
    frequency: ['weekly', 'monthly', 'quarterly'],
    sections: [
      'team_metrics',
      'feature_development',
      'deployment_statistics',
      'quality_metrics',
      'resource_utilization',
      'bottleneck_analysis'
    ],
    priority: 2,
    estimatedTime: '8 mins',
    aiPowered: true
  },
  FEATURE_ANALYTICS: {
    id: 'feature_analytics',
    name: 'Feature Usage Analytics',
    description: 'Comprehensive analysis of feature adoption and performance',
    icon: '🚀',
    frequency: ['weekly', 'monthly', 'yearly'],
    sections: [
      'active_features',
      'usage_by_module',
      'user_engagement',
      'feature_performance',
      'adoption_rate',
      'roi_analysis'
    ],
    priority: 3,
    estimatedTime: '10 mins',
    aiPowered: true
  },
  USER_ENGAGEMENT: {
    id: 'user_engagement',
    name: 'User Engagement Report',
    description: 'User behavior patterns and engagement metrics',
    icon: '👥',
    frequency: ['weekly', 'monthly'],
    sections: [
      'active_users',
      'session_analytics',
      'feature_usage_patterns',
      'user_satisfaction',
      'churn_prediction',
      'engagement_trends'
    ],
    priority: 4,
    estimatedTime: '7 mins',
    aiPowered: true
  },
  PREDICTIVE_INSIGHTS: {
    id: 'predictive_insights',
    name: 'Predictive Insights & Forecasting',
    description: 'AI-powered predictions and future trends',
    icon: '🔮',
    frequency: ['monthly', 'quarterly', 'yearly'],
    sections: [
      'growth_forecast',
      'resource_planning',
      'budget_predictions',
      'risk_assessment',
      'opportunity_analysis',
      'strategic_recommendations'
    ],
    priority: 5,
    estimatedTime: '12 mins',
    aiPowered: true
  },
  TECHNICAL_HEALTH: {
    id: 'technical_health',
    name: 'Technical Health & Performance',
    description: 'System performance, reliability, and technical metrics',
    icon: '⚙️',
    frequency: ['daily', 'weekly', 'monthly'],
    sections: [
      'system_uptime',
      'api_performance',
      'error_rates',
      'response_times',
      'infrastructure_health',
      'security_metrics'
    ],
    priority: 6,
    estimatedTime: '6 mins',
    aiPowered: true
  },
  FINANCIAL_IMPACT: {
    id: 'financial_impact',
    name: 'Financial Impact Analysis',
    description: 'ROI, cost savings, and financial performance',
    icon: '💰',
    frequency: ['monthly', 'quarterly', 'yearly'],
    sections: [
      'roi_metrics',
      'cost_savings',
      'revenue_impact',
      'budget_utilization',
      'cost_per_feature',
      'financial_forecast'
    ],
    priority: 7,
    estimatedTime: '15 mins',
    aiPowered: true
  },
  COMPETITIVE_ANALYSIS: {
    id: 'competitive_analysis',
    name: 'Competitive Analysis',
    description: 'Market positioning and competitive intelligence',
    icon: '🏆',
    frequency: ['monthly', 'quarterly'],
    sections: [
      'market_position',
      'feature_comparison',
      'innovation_index',
      'industry_benchmarks',
      'competitive_advantages',
      'gap_analysis'
    ],
    priority: 8,
    estimatedTime: '20 mins',
    aiPowered: true
  }
};

/**
 * ===========================================
 * KEY METRICS CONFIGURATION
 * ===========================================
 */

export const KEY_METRICS = {
  platform: {
    totalModules: {
      label: 'Total Modules',
      icon: '📦',
      category: 'Platform',
      calculation: 'count',
      target: 10,
      critical: true,
      trend: true
    },
    totalFeatures: {
      label: 'Total Features',
      icon: '✨',
      category: 'Platform',
      calculation: 'count',
      target: 50,
      critical: true,
      trend: true
    },
    activeUsers: {
      label: 'Active Users',
      icon: '👤',
      category: 'Usage',
      calculation: 'count',
      target: 100,
      critical: true,
      trend: true
    },
    systemUptime: {
      label: 'System Uptime',
      icon: '⚡',
      category: 'Performance',
      calculation: 'percentage',
      target: 99.9,
      critical: true,
      trend: true,
      unit: '%'
    }
  },
  performance: {
    avgResponseTime: {
      label: 'Avg Response Time',
      icon: '⏱️',
      category: 'Performance',
      calculation: 'average',
      target: 200,
      critical: true,
      trend: true,
      unit: 'ms'
    },
    apiSuccessRate: {
      label: 'API Success Rate',
      icon: '✅',
      category: 'Performance',
      calculation: 'percentage',
      target: 99.5,
      critical: true,
      trend: true,
      unit: '%'
    },
    errorRate: {
      label: 'Error Rate',
      icon: '❌',
      category: 'Performance',
      calculation: 'percentage',
      target: 0.5,
      critical: true,
      trend: true,
      inverse: true,
      unit: '%'
    },
    throughput: {
      label: 'Requests/Sec',
      icon: '🚄',
      category: 'Performance',
      calculation: 'average',
      target: 1000,
      critical: false,
      trend: true
    }
  },
  usage: {
    dailyActiveUsers: {
      label: 'Daily Active Users',
      icon: '📅',
      category: 'Usage',
      calculation: 'count',
      target: 50,
      critical: true,
      trend: true
    },
    weeklyActiveUsers: {
      label: 'Weekly Active Users',
      icon: '📊',
      category: 'Usage',
      calculation: 'count',
      target: 80,
      critical: true,
      trend: true
    },
    monthlyActiveUsers: {
      label: 'Monthly Active Users',
      icon: '📈',
      category: 'Usage',
      calculation: 'count',
      target: 100,
      critical: true,
      trend: true
    },
    avgSessionDuration: {
      label: 'Avg Session Duration',
      icon: '⏰',
      category: 'Usage',
      calculation: 'average',
      target: 15,
      critical: false,
      trend: true,
      unit: 'min'
    },
    featureAdoptionRate: {
      label: 'Feature Adoption Rate',
      icon: '🎯',
      category: 'Usage',
      calculation: 'percentage',
      target: 75,
      critical: true,
      trend: true,
      unit: '%'
    }
  },
  business: {
    roiPercentage: {
      label: 'ROI Percentage',
      icon: '💹',
      category: 'Business',
      calculation: 'percentage',
      target: 150,
      critical: true,
      trend: true,
      unit: '%'
    },
    costSavings: {
      label: 'Cost Savings',
      icon: '💵',
      category: 'Business',
      calculation: 'sum',
      target: 100000,
      critical: true,
      trend: true,
      unit: 'SEK'
    },
    timeEfficiency: {
      label: 'Time Efficiency Gain',
      icon: '⚡',
      category: 'Business',
      calculation: 'percentage',
      target: 300,
      critical: true,
      trend: true,
      unit: '%'
    },
    automationRate: {
      label: 'Automation Rate',
      icon: '🤖',
      category: 'Business',
      calculation: 'percentage',
      target: 80,
      critical: true,
      trend: true,
      unit: '%'
    }
  },
  quality: {
    aiAccuracy: {
      label: 'AI Model Accuracy',
      icon: '🎯',
      category: 'Quality',
      calculation: 'percentage',
      target: 95,
      critical: true,
      trend: true,
      unit: '%'
    },
    userSatisfaction: {
      label: 'User Satisfaction',
      icon: '⭐',
      category: 'Quality',
      calculation: 'average',
      target: 4.5,
      critical: true,
      trend: true,
      unit: '/5'
    },
    bugResolutionTime: {
      label: 'Bug Resolution Time',
      icon: '🔧',
      category: 'Quality',
      calculation: 'average',
      target: 24,
      critical: false,
      trend: true,
      inverse: true,
      unit: 'hrs'
    },
    codeQualityScore: {
      label: 'Code Quality Score',
      icon: '💎',
      category: 'Quality',
      calculation: 'average',
      target: 85,
      critical: false,
      trend: true,
      unit: '/100'
    }
  }
};

/**
 * ===========================================
 * PREDICTIVE MODELS CONFIGURATION
 * ===========================================
 */

export const PREDICTIVE_MODELS = {
  userGrowth: {
    id: 'user_growth',
    name: 'User Growth Prediction',
    description: 'Forecast user base expansion',
    icon: '📈',
    type: 'regression',
    algorithm: 'ARIMA',
    accuracy: 92,
    timeHorizons: ['1_week', '1_month', '3_months', '6_months', '1_year'],
    factors: [
      { name: 'Historical Growth Rate', weight: 0.35 },
      { name: 'Marketing Activities', weight: 0.25 },
      { name: 'Seasonal Trends', weight: 0.20 },
      { name: 'Market Conditions', weight: 0.15 },
      { name: 'Feature Releases', weight: 0.05 }
    ],
    confidence: 'high'
  },
  featureAdoption: {
    id: 'feature_adoption',
    name: 'Feature Adoption Forecasting',
    description: 'Predict new feature uptake rates',
    icon: '🚀',
    type: 'classification',
    algorithm: 'Random Forest',
    accuracy: 88,
    timeHorizons: ['1_week', '2_weeks', '1_month', '3_months'],
    factors: [
      { name: 'Feature Complexity', weight: 0.30 },
      { name: 'User Training', weight: 0.25 },
      { name: 'UI/UX Quality', weight: 0.20 },
      { name: 'Documentation', weight: 0.15 },
      { name: 'Similar Feature Performance', weight: 0.10 }
    ],
    confidence: 'high'
  },
  churnPrediction: {
    id: 'churn_prediction',
    name: 'User Churn Prediction',
    description: 'Identify users at risk of churning',
    icon: '⚠️',
    type: 'classification',
    algorithm: 'Gradient Boosting',
    accuracy: 91,
    timeHorizons: ['1_week', '2_weeks', '1_month'],
    factors: [
      { name: 'Login Frequency', weight: 0.30 },
      { name: 'Feature Usage', weight: 0.25 },
      { name: 'Support Tickets', weight: 0.20 },
      { name: 'Error Encounters', weight: 0.15 },
      { name: 'Session Duration', weight: 0.10 }
    ],
    confidence: 'high',
    actionable: true
  },
  performanceAnomaly: {
    id: 'performance_anomaly',
    name: 'Performance Anomaly Detection',
    description: 'Predict potential system issues',
    icon: '🔍',
    type: 'anomaly_detection',
    algorithm: 'Isolation Forest',
    accuracy: 94,
    timeHorizons: ['real_time', '1_hour', '24_hours'],
    factors: [
      { name: 'CPU Usage Patterns', weight: 0.25 },
      { name: 'Memory Consumption', weight: 0.25 },
      { name: 'API Response Times', weight: 0.20 },
      { name: 'Error Rates', weight: 0.20 },
      { name: 'Traffic Patterns', weight: 0.10 }
    ],
    confidence: 'very_high',
    actionable: true
  },
  resourcePlanning: {
    id: 'resource_planning',
    name: 'Resource Planning Forecast',
    description: 'Predict infrastructure needs',
    icon: '🖥️',
    type: 'regression',
    algorithm: 'Neural Network',
    accuracy: 89,
    timeHorizons: ['1_month', '3_months', '6_months', '1_year'],
    factors: [
      { name: 'User Growth Trajectory', weight: 0.35 },
      { name: 'Feature Roadmap', weight: 0.25 },
      { name: 'Current Utilization', weight: 0.20 },
      { name: 'Peak Load Patterns', weight: 0.15 },
      { name: 'Technology Upgrades', weight: 0.05 }
    ],
    confidence: 'medium-high'
  },
  revenueImpact: {
    id: 'revenue_impact',
    name: 'Revenue Impact Prediction',
    description: 'Forecast financial outcomes',
    icon: '💰',
    type: 'regression',
    algorithm: 'XGBoost',
    accuracy: 87,
    timeHorizons: ['1_month', '1_quarter', '1_year'],
    factors: [
      { name: 'User Growth', weight: 0.30 },
      { name: 'Feature Adoption', weight: 0.25 },
      { name: 'Cost Savings', weight: 0.20 },
      { name: 'Efficiency Gains', weight: 0.15 },
      { name: 'Market Conditions', weight: 0.10 }
    ],
    confidence: 'medium-high'
  }
};

/**
 * ===========================================
 * CHART CONFIGURATIONS
 * ===========================================
 */

export const CHART_CONFIGS = {
  userGrowthTrend: {
    type: 'line',
    title: 'User Growth Trend',
    description: 'Historical and predicted user growth',
    dataPoints: ['daily', 'weekly', 'monthly'],
    colors: [REJLERS_COLORS.secondary.green.base, REJLERS_COLORS.secondary.turbine.base],
    showPrediction: true,
    showConfidenceInterval: true
  },
  featureUsageDistribution: {
    type: 'bar',
    title: 'Feature Usage Distribution',
    description: 'Usage across all platform features',
    orientation: 'vertical',
    colors: [REJLERS_COLORS.secondary.green.base],
    sortBy: 'usage',
    topN: 10
  },
  modulePerformance: {
    type: 'radar',
    title: 'Module Performance Metrics',
    description: 'Multi-dimensional performance analysis',
    metrics: ['usage', 'performance', 'satisfaction', 'reliability', 'innovation'],
    colors: [REJLERS_COLORS.primary.accent, REJLERS_COLORS.secondary.passion.base]
  },
  timeSeriesAnalysis: {
    type: 'area',
    title: 'Platform Activity Timeline',
    description: 'Activity patterns over time',
    dataPoints: ['hourly', 'daily', 'weekly'],
    colors: [REJLERS_COLORS.secondary.turbine.base],
    showMovingAverage: true,
    showTrendline: true
  },
  kpiDashboard: {
    type: 'gauge',
    title: 'KPI Performance Gauges',
    description: 'Real-time KPI monitoring',
    thresholds: {
      critical: { min: 0, max: 60, color: '#EF4444' },
      warning: { min: 60, max: 80, color: '#F59E0B' },
      good: { min: 80, max: 90, color: '#10B981' },
      excellent: { min: 90, max: 100, color: REJLERS_COLORS.secondary.green.base }
    }
  },
  heatmap: {
    type: 'heatmap',
    title: 'Usage Heatmap',
    description: 'Feature usage intensity by time and day',
    xAxis: 'time_of_day',
    yAxis: 'day_of_week',
    colorScale: 'sequential'
  },
  correlationMatrix: {
    type: 'heatmap',
    title: 'Metrics Correlation Matrix',
    description: 'Correlation between different metrics',
    colorScale: 'diverging',
    showValues: true
  },
  funnelAnalysis: {
    type: 'funnel',
    title: 'User Journey Funnel',
    description: 'Conversion rates through user journey',
    stages: ['Landing', 'Registration', 'First Login', 'Feature Use', 'Regular User'],
    colors: [REJLERS_COLORS.secondary.green.base]
  }
};

/**
 * ===========================================
 * EXPORT CONFIGURATIONS
 * ===========================================
 */

export const EXPORT_FORMATS = {
  pdf: {
    id: 'pdf',
    name: 'PDF Report',
    icon: '📄',
    description: 'Professional PDF document',
    extensions: ['.pdf'],
    mimeType: 'application/pdf',
    features: ['charts', 'tables', 'images', 'branding', 'headers', 'footers'],
    quality: 'high',
    fileSize: 'medium',
    recommended: true
  },
  excel: {
    id: 'excel',
    name: 'Excel Workbook',
    icon: '📊',
    description: 'Interactive Excel spreadsheet',
    extensions: ['.xlsx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    features: ['raw_data', 'formulas', 'pivot_tables', 'charts', 'multiple_sheets'],
    quality: 'high',
    fileSize: 'small',
    recommended: true
  },
  powerpoint: {
    id: 'powerpoint',
    name: 'PowerPoint Presentation',
    icon: '🎯',
    description: 'Executive presentation slides',
    extensions: ['.pptx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    features: ['slides', 'charts', 'images', 'branding', 'animations'],
    quality: 'high',
    fileSize: 'large',
    recommended: true
  },
  csv: {
    id: 'csv',
    name: 'CSV Data',
    icon: '📋',
    description: 'Raw data in CSV format',
    extensions: ['.csv'],
    mimeType: 'text/csv',
    features: ['raw_data', 'simple_format'],
    quality: 'medium',
    fileSize: 'very_small',
    recommended: false
  },
  json: {
    id: 'json',
    name: 'JSON Data',
    icon: '{ }',
    description: 'Structured JSON data',
    extensions: ['.json'],
    mimeType: 'application/json',
    features: ['raw_data', 'structured', 'api_compatible'],
    quality: 'medium',
    fileSize: 'small',
    recommended: false
  },
  html: {
    id: 'html',
    name: 'HTML Report',
    icon: '🌐',
    description: 'Interactive web report',
    extensions: ['.html'],
    mimeType: 'text/html',
    features: ['interactive', 'charts', 'responsive', 'sharable'],
    quality: 'high',
    fileSize: 'medium',
    recommended: true
  }
};

/**
 * ===========================================
 * SCHEDULING OPTIONS
 * ===========================================
 */

export const SCHEDULING_OPTIONS = {
  frequencies: {
    daily: {
      id: 'daily',
      label: 'Daily',
      icon: '📅',
      description: 'Every day',
      cronPattern: '0 8 * * *',
      available: true
    },
    weekly: {
      id: 'weekly',
      label: 'Weekly',
      icon: '📊',
      description: 'Every week',
      cronPattern: '0 8 * * 1',
      available: true,
      options: ['day_of_week']
    },
    monthly: {
      id: 'monthly',
      label: 'Monthly',
      icon: '📈',
      description: 'Every month',
      cronPattern: '0 8 1 * *',
      available: true,
      options: ['day_of_month']
    },
    quarterly: {
      id: 'quarterly',
      label: 'Quarterly',
      icon: '📉',
      description: 'Every quarter',
      cronPattern: '0 8 1 */3 *',
      available: true
    },
    yearly: {
      id: 'yearly',
      label: 'Yearly',
      icon: '🗓️',
      description: 'Every year',
      cronPattern: '0 8 1 1 *',
      available: true,
      options: ['month', 'day']
    },
    custom: {
      id: 'custom',
      label: 'Custom',
      icon: '⚙️',
      description: 'Custom schedule',
      available: true,
      requiresInput: true
    }
  },
  deliveryMethods: {
    email: {
      id: 'email',
      label: 'Email',
      icon: '📧',
      description: 'Send via email',
      available: true,
      requiresRecipients: true
    },
    dashboard: {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      description: 'Available on dashboard',
      available: true
    },
    slack: {
      id: 'slack',
      label: 'Slack',
      icon: '💬',
      description: 'Send to Slack channel',
      available: true,
      requiresChannel: true
    },
    teams: {
      id: 'teams',
      label: 'Microsoft Teams',
      icon: '👥',
      description: 'Send to Teams channel',
      available: true,
      requiresChannel: true
    },
    download: {
      id: 'download',
      label: 'Download',
      icon: '⬇️',
      description: 'Manual download',
      available: true
    }
  }
};

/**
 * ===========================================
 * AI INSIGHTS TEMPLATES
 * ===========================================
 */

export const AI_INSIGHTS = {
  anomalyDetection: {
    title: 'Anomaly Detection',
    description: 'AI-detected unusual patterns',
    icon: '🔍',
    severity: ['critical', 'warning', 'info'],
    templates: {
      performance: 'Performance degradation detected: {metric} is {percentage}% {direction} from baseline',
      usage: 'Unusual usage pattern: {feature} has {percentage}% {direction} activity',
      user: 'User behavior anomaly: {count} users showing abnormal patterns',
      system: 'System anomaly: {component} requires attention'
    }
  },
  recommendations: {
    title: 'AI Recommendations',
    description: 'Smart suggestions for improvement',
    icon: '💡',
    categories: ['performance', 'user_experience', 'cost_optimization', 'feature_development'],
    templates: {
      scale: 'Consider scaling {resource} by {percentage}% based on growth trends',
      optimize: 'Optimize {feature} - potential {percentage}% performance improvement',
      promote: 'Promote {feature} to increase adoption - only {percentage}% currently using',
      investigate: 'Investigate {metric} - showing concerning trend over last {period}'
    }
  },
  predictions: {
    title: 'Predictive Insights',
    description: 'Future trend predictions',
    icon: '🔮',
    timeframes: ['next_week', 'next_month', 'next_quarter', 'next_year'],
    templates: {
      growth: 'Predicted growth: {metric} will reach {value} by {date} ({confidence}% confidence)',
      capacity: 'Capacity planning: {resource} will reach {percentage}% utilization by {date}',
      milestone: 'Milestone prediction: {milestone} expected on {date}',
      risk: 'Risk alert: {percentage}% probability of {event} within {timeframe}'
    }
  },
  benchmarking: {
    title: 'Benchmarking Insights',
    description: 'Industry comparison and positioning',
    icon: '🏆',
    categories: ['industry_average', 'best_in_class', 'competitors'],
    templates: {
      above: '{metric} is {percentage}% above industry average - excellent performance',
      below: '{metric} is {percentage}% below industry average - room for improvement',
      leader: 'Leading in {category} - {percentage}% ahead of competitors',
      gap: 'Gap identified in {category} - {percentage}% behind best-in-class'
    }
  }
};

/**
 * ===========================================
 * DASHBOARD WIDGETS
 * ===========================================
 */

export const DASHBOARD_WIDGETS = [
  {
    id: 'quick_stats',
    title: 'Quick Stats',
    type: 'stats_grid',
    size: 'large',
    refreshInterval: 30000, // 30 seconds
    metrics: ['totalModules', 'totalFeatures', 'activeUsers', 'systemUptime'],
    showTrend: true,
    showSparkline: true
  },
  {
    id: 'real_time_activity',
    title: 'Real-Time Activity',
    type: 'live_feed',
    size: 'medium',
    refreshInterval: 5000, // 5 seconds
    maxItems: 10,
    showTimestamp: true
  },
  {
    id: 'performance_gauges',
    title: 'Performance Gauges',
    type: 'gauge_cluster',
    size: 'medium',
    refreshInterval: 60000, // 1 minute
    metrics: ['avgResponseTime', 'apiSuccessRate', 'errorRate'],
    showThresholds: true
  },
  {
    id: 'usage_trends',
    title: 'Usage Trends',
    type: 'line_chart',
    size: 'large',
    refreshInterval: 300000, // 5 minutes
    timeRange: '7_days',
    showPrediction: true
  },
  {
    id: 'feature_adoption',
    title: 'Feature Adoption',
    type: 'bar_chart',
    size: 'medium',
    refreshInterval: 300000,
    showComparison: true,
    sortBy: 'adoption_rate'
  },
  {
    id: 'ai_insights',
    title: 'AI Insights',
    type: 'insight_cards',
    size: 'large',
    refreshInterval: 600000, // 10 minutes
    maxInsights: 5,
    prioritize: 'critical'
  },
  {
    id: 'top_modules',
    title: 'Top Performing Modules',
    type: 'ranking',
    size: 'small',
    refreshInterval: 300000,
    topN: 5,
    showMetric: 'usage'
  },
  {
    id: 'alerts',
    title: 'Active Alerts',
    type: 'alert_list',
    size: 'medium',
    refreshInterval: 10000, // 10 seconds
    showSeverity: true,
    maxAlerts: 8
  }
];

/**
 * ===========================================
 * BRANDING & STYLING
 * ===========================================
 */

export const REPORT_BRANDING = {
  header: {
    showLogo: true,
    showCompanyName: true,
    showReportTitle: true,
    showGeneratedDate: true,
    backgroundColor: REJLERS_COLORS.neutral.white,
    textColor: REJLERS_COLORS.neutral.gray900
  },
  footer: {
    showPageNumbers: true,
    showConfidentiality: true,
    showGeneratedBy: true,
    text: 'Confidential - For Internal Use Only',
    backgroundColor: REJLERS_COLORS.neutral.gray100,
    textColor: REJLERS_COLORS.neutral.gray600
  },
  colors: {
    primary: REJLERS_COLORS.secondary.green.base,
    secondary: REJLERS_COLORS.secondary.turbine.base,
    accent: REJLERS_COLORS.primary.accent,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6'
  },
  typography: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    code: 'Consolas, Monaco, monospace'
  }
};

export default {
  REPORT_TYPES,
  KEY_METRICS,
  PREDICTIVE_MODELS,
  CHART_CONFIGS,
  EXPORT_FORMATS,
  SCHEDULING_OPTIONS,
  AI_INSIGHTS,
  DASHBOARD_WIDGETS,
  REPORT_BRANDING
};
