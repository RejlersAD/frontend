/**
 * ========================================================================
 * DASHBOARD METRICS CONFIGURATION
 * ========================================================================
 * Purpose: Soft-coded configuration for all dashboard KPIs and metrics
 * Features: Real-time stats, feature utilization, user activity, documents
 * Pattern: Advanced intelligence with dynamic data aggregation
 * ========================================================================
 */

/**
 * Metric Categories
 */
export const METRIC_CATEGORIES = {
  SYSTEM: 'system',
  USERS: 'users',
  DOCUMENTS: 'documents',
  FEATURES: 'features',
  PERFORMANCE: 'performance',
  BUSINESS: 'business'
}

/**
 * Metric Types for Display
 */
export const METRIC_TYPES = {
  COUNT: 'count',
  PERCENTAGE: 'percentage',
  CURRENCY: 'currency',
  DURATION: 'duration',
  TREND: 'trend'
}

/**
 * Comprehensive Dashboard Metrics Configuration
 */
export const DASHBOARD_METRICS = {
  // =======================================================================
  // USER METRICS
  // =======================================================================
  activeUsers: {
    id: 'active_users',
    label: 'Active Users',
    category: METRIC_CATEGORIES.USERS,
    type: METRIC_TYPES.COUNT,
    icon: 'UserGroupIcon',
    description: 'Currently active users in the system',
    apiEndpoint: '/api/users/active-count/',
    color: 'blue',
    trend: true,
    refreshInterval: 30000, // 30 seconds
    calculation: 'real-time',
    filters: ['today', 'this_week', 'this_month'],
    defaultFilter: 'today'
  },

  totalUsers: {
    id: 'total_users',
    label: 'Total Users',
    category: METRIC_CATEGORIES.USERS,
    type: METRIC_TYPES.COUNT,
    icon: 'UsersIcon',
    description: 'Total registered users',
    apiEndpoint: '/api/users/',
    color: 'indigo',
    trend: true,
    refreshInterval: 60000, // 1 minute
    calculation: 'count',
    showPercentageChange: true
  },

  newUsersToday: {
    id: 'new_users_today',
    label: 'New Today',
    category: METRIC_CATEGORIES.USERS,
    type: METRIC_TYPES.COUNT,
    icon: 'UserPlusIcon',
    description: 'New users registered today',
    apiEndpoint: '/api/users/new-today/',
    color: 'green',
    trend: true,
    refreshInterval: 60000
  },

  // =======================================================================
  // DOCUMENT METRICS
  // =======================================================================
  totalDocuments: {
    id: 'total_documents',
    label: 'Total Documents',
    category: METRIC_CATEGORIES.DOCUMENTS,
    type: METRIC_TYPES.COUNT,
    icon: 'DocumentTextIcon',
    description: 'Total documents uploaded across all modules',
    apiEndpoint: '/api/documents/total-count/',
    color: 'purple',
    trend: true,
    refreshInterval: 60000,
    aggregation: [
      { module: 'pid', endpoint: '/pid/drawings/', field: 'count' },
      { module: 'pfd', endpoint: '/pfd/documents/', field: 'count' },
      { module: 'qhse', endpoint: '/qhse/documents/', field: 'count' },
      { module: 'crs', endpoint: '/crs/documents/', field: 'count' }
    ]
  },

  documentsToday: {
    id: 'documents_today',
    label: 'Uploaded Today',
    category: METRIC_CATEGORIES.DOCUMENTS,
    type: METRIC_TYPES.COUNT,
    icon: 'ArrowUpTrayIcon',
    description: 'Documents uploaded today',
    apiEndpoint: '/api/documents/today-count/',
    color: 'cyan',
    trend: true,
    refreshInterval: 30000
  },

  pidDrawings: {
    id: 'pid_drawings',
    label: 'P&ID Drawings',
    category: METRIC_CATEGORIES.DOCUMENTS,
    type: METRIC_TYPES.COUNT,
    icon: 'DocumentChartBarIcon',
    description: 'P&ID drawings uploaded',
    apiEndpoint: '/pid/drawings/',
    color: 'blue',
    trend: true,
    refreshInterval: 60000
  },

  pfdDocuments: {
    id: 'pfd_documents',
    label: 'PFD Documents',
    category: METRIC_CATEGORIES.DOCUMENTS,
    type: METRIC_TYPES.COUNT,
    icon: 'DocumentDuplicateIcon',
    description: 'PFD documents processed',
    apiEndpoint: '/pfd/documents/',
    color: 'indigo',
    trend: true,
    refreshInterval: 60000
  },

  // =======================================================================
  // FEATURE UTILIZATION METRICS
  // =======================================================================
  featureUsage: {
    id: 'feature_usage',
    label: 'Feature Utilization',
    category: METRIC_CATEGORIES.FEATURES,
    type: METRIC_TYPES.PERCENTAGE,
    icon: 'ChartBarIcon',
    description: 'Overall feature usage rate',
    apiEndpoint: '/api/features/utilization/',
    color: 'emerald',
    trend: true,
    refreshInterval: 120000, // 2 minutes
    calculation: 'percentage',
    threshold: {
      low: 30,
      medium: 60,
      high: 80
    }
  },

  mostUsedFeature: {
    id: 'most_used_feature',
    label: 'Most Used Feature',
    category: METRIC_CATEGORIES.FEATURES,
    type: METRIC_TYPES.TREND,
    icon: 'FireIcon',
    description: 'Most frequently used feature',
    apiEndpoint: '/api/features/top-used/',
    color: 'orange',
    refreshInterval: 120000
  },

  aiFeatureUsage: {
    id: 'ai_feature_usage',
    label: 'AI Features Usage',
    category: METRIC_CATEGORIES.FEATURES,
    type: METRIC_TYPES.COUNT,
    icon: 'SparklesIcon',
    description: 'AI-powered features utilized',
    apiEndpoint: '/api/features/ai-usage/',
    color: 'violet',
    trend: true,
    refreshInterval: 60000
  },

  // =======================================================================
  // BUSINESS METRICS
  // =======================================================================
  activeProjects: {
    id: 'active_projects',
    label: 'Active Projects',
    category: METRIC_CATEGORIES.BUSINESS,
    type: METRIC_TYPES.COUNT,
    icon: 'BriefcaseIcon',
    description: 'Currently active projects',
    apiEndpoint: '/projects/stats/',
    color: 'blue',
    trend: true,
    refreshInterval: 120000
  },

  pendingApprovals: {
    id: 'pending_approvals',
    label: 'Pending Approvals',
    category: METRIC_CATEGORIES.BUSINESS,
    type: METRIC_TYPES.COUNT,
    icon: 'ClockIcon',
    description: 'Items awaiting approval',
    apiEndpoint: '/api/approvals/pending/',
    color: 'amber',
    trend: false,
    refreshInterval: 60000,
    alert: true,
    alertThreshold: 10
  },

  // =======================================================================
  // PERFORMANCE METRICS
  // =======================================================================
  systemHealth: {
    id: 'system_health',
    label: 'System Health',
    category: METRIC_CATEGORIES.PERFORMANCE,
    type: METRIC_TYPES.PERCENTAGE,
    icon: 'HeartIcon',
    description: 'Overall system health status',
    apiEndpoint: '/api/system/health/',
    color: 'green',
    refreshInterval: 30000,
    threshold: {
      critical: 70,
      warning: 85,
      healthy: 95
    }
  },

  avgResponseTime: {
    id: 'avg_response_time',
    label: 'Avg Response Time',
    category: METRIC_CATEGORIES.PERFORMANCE,
    type: METRIC_TYPES.DURATION,
    icon: 'BoltIcon',
    description: 'Average API response time',
    apiEndpoint: '/api/system/performance/',
    color: 'yellow',
    refreshInterval: 60000,
    unit: 'ms'
  }
}

/**
 * Dashboard Layout Configuration
 * Defines how metrics are organized on the dashboard
 */
export const DASHBOARD_LAYOUT = {
  // Top Priority Metrics (Large Cards)
  hero: [
    'totalDocuments',
    'activeUsers',
    'totalUsers',
    'featureUsage'
  ],

  // Secondary Metrics (Medium Cards)
  primary: [
    'documentsToday',
    'newUsersToday',
    'activeProjects',
    'aiFeatureUsage'
  ],

  // Detailed Metrics (Small Cards / Grid)
  secondary: [
    'pidDrawings',
    'pfdDocuments',
    'mostUsedFeature',
    'pendingApprovals'
  ],

  // System Metrics (Bottom Row)
  system: [
    'systemHealth',
    'avgResponseTime'
  ]
}

/**
 * Metric Color Scheme
 */
export const METRIC_COLORS = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    gradient: 'from-blue-500 to-blue-600'
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-200',
    icon: 'text-indigo-500',
    gradient: 'from-indigo-500 to-indigo-600'
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    icon: 'text-purple-500',
    gradient: 'from-purple-500 to-purple-600'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
    icon: 'text-green-500',
    gradient: 'from-green-500 to-green-600'
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    gradient: 'from-emerald-500 to-emerald-600'
  },
  cyan: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
    icon: 'text-cyan-500',
    gradient: 'from-cyan-500 to-cyan-600'
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
    icon: 'text-orange-500',
    gradient: 'from-orange-500 to-orange-600'
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    gradient: 'from-amber-500 to-amber-600'
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    border: 'border-yellow-200',
    icon: 'text-yellow-500',
    gradient: 'from-yellow-500 to-yellow-600'
  },
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-200',
    icon: 'text-violet-500',
    gradient: 'from-violet-500 to-violet-600'
  }
}

/**
 * Helper function to get metric configuration
 */
export const getMetricConfig = (metricId) => {
  return DASHBOARD_METRICS[metricId] || null
}

/**
 * Helper function to get metrics by category
 */
export const getMetricsByCategory = (category) => {
  return Object.values(DASHBOARD_METRICS).filter(
    metric => metric.category === category
  )
}

/**
 * Helper function to format metric value
 */
export const formatMetricValue = (value, type, unit = '') => {
  if (value === null || value === undefined) return 'N/A'

  switch (type) {
    case METRIC_TYPES.COUNT:
      return new Intl.NumberFormat().format(value)
    
    case METRIC_TYPES.PERCENTAGE:
      return `${value.toFixed(1)}%`
    
    case METRIC_TYPES.CURRENCY:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value)
    
    case METRIC_TYPES.DURATION:
      if (unit === 'ms') {
        return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(2)}s`
      }
      return `${value}${unit}`
    
    default:
      return value
  }
}

/**
 * Helper function to calculate trend
 */
export const calculateTrend = (current, previous) => {
  if (!previous || previous === 0) return { value: 0, direction: 'neutral' }
  
  const change = ((current - previous) / previous) * 100
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  
  return {
    value: Math.abs(change).toFixed(1),
    direction,
    isPositive: change > 0
  }
}

/**
 * Helper function to get color scheme for metric
 */
export const getMetricColors = (colorName) => {
  return METRIC_COLORS[colorName] || METRIC_COLORS.blue
}

/**
 * Export configuration
 */
export default {
  METRIC_CATEGORIES,
  METRIC_TYPES,
  DASHBOARD_METRICS,
  DASHBOARD_LAYOUT,
  METRIC_COLORS,
  getMetricConfig,
  getMetricsByCategory,
  formatMetricValue,
  calculateTrend,
  getMetricColors
}
