/**
 * Advanced Dashboard Configuration
 * Comprehensive configuration for predictive analytics, notifications, and KPIs
 * Soft-coded approach for easy customization and scalability
 */

import {
  ChartBarIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  CpuChipIcon,
  DocumentChartBarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  BeakerIcon,
  WrenchIcon,
  CogIcon,
  TruckIcon,
  DocumentTextIcon,
  FolderIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

/**
 * Dashboard Widget Configuration
 * Each widget represents a data visualization component
 */
export const DASHBOARD_WIDGETS = {
  // Section 1: Quick Stats
  quickStats: {
    id: 'quick-stats',
    title: 'Quick Stats',
    type: 'stats',
    order: 1,
    enabled: true,
    refreshInterval: 30000, // 30 seconds
    cards: [
      {
        id: 'total-projects',
        label: 'Active Projects',
        apiEndpoint: '/api/v1/projects/stats/',
        dataKey: 'active_count',
        icon: FolderIcon,
        color: 'blue',
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-50 to-cyan-50',
        format: 'number',
        showTrend: true
      },
      {
        id: 'engineering-drawings',
        label: 'Engineering Drawings',
        apiEndpoint: '/api/v1/pid/stats/',
        dataKey: 'total_drawings',
        icon: BeakerIcon,
        color: 'purple',
        gradient: 'from-purple-500 to-pink-500',
        bgGradient: 'from-purple-50 to-pink-50',
        format: 'number',
        showTrend: true
      },
      {
        id: 'pending-approvals',
        label: 'Pending Approvals',
        apiEndpoint: '/api/v1/approvals/stats/',
        dataKey: 'pending_count',
        icon: ClockIcon,
        color: 'yellow',
        gradient: 'from-yellow-500 to-orange-500',
        bgGradient: 'from-yellow-50 to-orange-50',
        format: 'number',
        alert: true,
        alertThreshold: 10
      },
      {
        id: 'ai-efficiency',
        label: 'AI Efficiency',
        apiEndpoint: '/api/v1/analytics/ai-efficiency/',
        dataKey: 'efficiency_percentage',
        icon: SparklesIcon,
        color: 'green',
        gradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-50 to-emerald-50',
        format: 'percentage',
        showTrend: true
      }
    ]
  },

  // Section 2: Predictive Analytics
  predictiveAnalytics: {
    id: 'predictive-analytics',
    title: 'Predictive Analytics',
    type: 'analytics',
    order: 2,
    enabled: true,
    refreshInterval: 60000, // 1 minute
    widgets: [
      {
        id: 'project-timeline-prediction',
        title: 'Project Timeline Prediction',
        description: 'AI-powered project completion forecasts',
        icon: ArrowTrendingUpIcon,
        apiEndpoint: '/api/v1/analytics/project-predictions/',
        chartType: 'timeline',
        color: 'blue',
        insights: [
          {
            metric: 'on-track',
            label: 'On Track',
            color: 'green'
          },
          {
            metric: 'at-risk',
            label: 'At Risk',
            color: 'yellow'
          },
          {
            metric: 'delayed',
            label: 'Delayed',
            color: 'red'
          }
        ]
      },
      {
        id: 'resource-utilization',
        title: 'Resource Utilization Forecast',
        description: 'Predict resource bottlenecks',
        icon: UsersIcon,
        apiEndpoint: '/api/v1/analytics/resource-forecast/',
        chartType: 'gauge',
        color: 'purple',
        thresholds: {
          optimal: { min: 70, max: 85, color: 'green' },
          underutilized: { max: 70, color: 'yellow' },
          overutilized: { min: 85, color: 'red' }
        }
      },
      {
        id: 'cost-variance',
        title: 'Cost Variance Analysis',
        description: 'Budget vs actual spending trends',
        icon: CurrencyDollarIcon,
        apiEndpoint: '/api/v1/analytics/cost-variance/',
        chartType: 'line',
        color: 'green',
        format: 'currency'
      },
      {
        id: 'quality-metrics',
        title: 'Quality Score Trends',
        description: 'Engineering quality metrics over time',
        icon: ShieldCheckIcon,
        apiEndpoint: '/api/v1/analytics/quality-trends/',
        chartType: 'area',
        color: 'indigo'
      }
    ]
  },

  // Section 3: Real-time Notifications
  notifications: {
    id: 'notifications',
    title: 'Real-time Alerts',
    type: 'notifications',
    order: 3,
    enabled: true,
    refreshInterval: 15000, // 15 seconds
    categories: [
      {
        id: 'critical',
        label: 'Critical',
        icon: ExclamationTriangleIcon,
        color: 'red',
        priority: 1,
        sound: true
      },
      {
        id: 'warning',
        label: 'Warning',
        icon: ExclamationTriangleIcon,
        color: 'yellow',
        priority: 2,
        sound: false
      },
      {
        id: 'info',
        label: 'Info',
        icon: BellIcon,
        color: 'blue',
        priority: 3,
        sound: false
      },
      {
        id: 'success',
        label: 'Success',
        icon: CheckCircleIcon,
        color: 'green',
        priority: 4,
        sound: false
      }
    ],
    apiEndpoint: '/api/v1/notifications/',
    maxDisplay: 10
  },

  // Section 4: Department Overview
  departmentOverview: {
    id: 'department-overview',
    title: 'Department Activity',
    type: 'grid',
    order: 4,
    enabled: true,
    refreshInterval: 45000, // 45 seconds
    departments: [
      {
        id: 'engineering',
        name: 'Engineering',
        icon: BeakerIcon,
        color: 'blue',
        metrics: [
          { key: 'active_designs', label: 'Active Designs', apiPath: '/engineering/stats/' },
          { key: 'pending_reviews', label: 'Pending Reviews', apiPath: '/engineering/stats/' },
          { key: 'completed_this_week', label: 'Completed This Week', apiPath: '/engineering/stats/' }
        ]
      },
      {
        id: 'procurement',
        name: 'Procurement',
        icon: TruckIcon,
        color: 'green',
        metrics: [
          { key: 'active_orders', label: 'Active Orders', apiPath: '/procurement/orders/dashboard/' },
          { key: 'pending_receipts', label: 'Pending Receipts', apiPath: '/procurement/receipts/dashboard/' },
          { key: 'vendor_count', label: 'Active Vendors', apiPath: '/procurement/vendors/stats/' }
        ]
      },
      {
        id: 'qhse',
        name: 'QHSE',
        icon: ShieldCheckIcon,
        color: 'red',
        metrics: [
          { key: 'open_incidents', label: 'Open Incidents', apiPath: '/qhse/incidents/stats/' },
          { key: 'pending_audits', label: 'Pending Audits', apiPath: '/qhse/audits/stats/' },
          { key: 'compliance_score', label: 'Compliance Score', apiPath: '/qhse/compliance/stats/', format: 'percentage' }
        ]
      },
      {
        id: 'finance',
        name: 'Finance',
        icon: CurrencyDollarIcon,
        color: 'yellow',
        metrics: [
          { key: 'pending_invoices', label: 'Pending Invoices', apiPath: '/finance/invoices/stats/' },
          { key: 'total_value', label: 'Total Value', apiPath: '/finance/invoices/stats/', format: 'currency' },
          { key: 'overdue_count', label: 'Overdue', apiPath: '/finance/invoices/stats/' }
        ]
      }
    ]
  },

  // Section 5: AI Insights
  aiInsights: {
    id: 'ai-insights',
    title: 'AI-Powered Insights',
    type: 'insights',
    order: 5,
    enabled: true,
    refreshInterval: 120000, // 2 minutes
    apiEndpoint: '/api/v1/analytics/ai-insights/',
    categories: [
      {
        id: 'recommendations',
        title: 'Recommendations',
        icon: SparklesIcon,
        color: 'purple'
      },
      {
        id: 'anomalies',
        title: 'Anomaly Detection',
        icon: ExclamationTriangleIcon,
        color: 'orange'
      },
      {
        id: 'optimizations',
        title: 'Optimization Opportunities',
        icon: BoltIcon,
        color: 'yellow'
      }
    ]
  },

  // Section 6: Recent Activity
  recentActivity: {
    id: 'recent-activity',
    title: 'Recent Activity',
    type: 'timeline',
    order: 6,
    enabled: true,
    refreshInterval: 20000, // 20 seconds
    apiEndpoint: '/api/v1/activity/recent/',
    maxItems: 15,
    groupBy: 'time', // time, user, department
    filters: ['all', 'engineering', 'procurement', 'finance', 'qhse']
  },

  // Section 7: Performance Metrics
  performanceMetrics: {
    id: 'performance-metrics',
    title: 'Performance Metrics',
    type: 'charts',
    order: 7,
    enabled: true,
    refreshInterval: 60000, // 1 minute
    charts: [
      {
        id: 'daily-completions',
        title: 'Daily Completions',
        chartType: 'bar',
        apiEndpoint: '/api/v1/analytics/daily-completions/',
        period: '7d',
        color: 'blue'
      },
      {
        id: 'department-workload',
        title: 'Department Workload',
        chartType: 'doughnut',
        apiEndpoint: '/api/v1/analytics/workload-distribution/',
        color: 'multi'
      },
      {
        id: 'efficiency-trend',
        title: 'Efficiency Trend',
        chartType: 'line',
        apiEndpoint: '/api/v1/analytics/efficiency-trend/',
        period: '30d',
        color: 'green'
      }
    ]
  }
}

/**
 * Dashboard Layout Configuration
 */
export const DASHBOARD_LAYOUT = {
  // Responsive grid configuration
  grid: {
    mobile: { columns: 1 },
    tablet: { columns: 2 },
    desktop: { columns: 3 },
    wide: { columns: 4 }
  },

  // Widget sizing
  widgetSizes: {
    small: { rows: 1, cols: 1 },
    medium: { rows: 1, cols: 2 },
    large: { rows: 2, cols: 2 },
    wide: { rows: 1, cols: 3 },
    full: { rows: 2, cols: 4 }
  },

  // Default layout positions
  defaultLayout: [
    { widget: 'quick-stats', size: 'full', position: { row: 1, col: 1 } },
    { widget: 'notifications', size: 'medium', position: { row: 2, col: 1 } },
    { widget: 'predictive-analytics', size: 'large', position: { row: 2, col: 3 } },
    { widget: 'department-overview', size: 'full', position: { row: 3, col: 1 } },
    { widget: 'ai-insights', size: 'wide', position: { row: 4, col: 1 } },
    { widget: 'recent-activity', size: 'medium', position: { row: 4, col: 4 } },
    { widget: 'performance-metrics', size: 'full', position: { row: 5, col: 1 } }
  ]
}

/**
 * Helper Functions
 */

// Get widget by ID
export const getWidget = (widgetId) => {
  for (const section of Object.values(DASHBOARD_WIDGETS)) {
    if (section.id === widgetId) return section
  }
  return null
}

// Get enabled widgets sorted by order
export const getEnabledWidgets = () => {
  return Object.values(DASHBOARD_WIDGETS)
    .filter(widget => widget.enabled)
    .sort((a, b) => a.order - b.order)
}

// Format value based on type
export const formatValue = (value, format) => {
  if (!value && value !== 0) return 'N/A'
  
  switch (format) {
    case 'percentage':
      return `${value}%`
    case 'currency':
      return `$${value.toLocaleString()}`
    case 'number':
      return value.toLocaleString()
    default:
      return value
  }
}

// Get color classes
export const getColorClasses = (color) => {
  const colors = {
    blue: {
      gradient: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200'
    },
    green: {
      gradient: 'from-green-500 to-emerald-500',
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200'
    },
    yellow: {
      gradient: 'from-yellow-500 to-orange-500',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200'
    },
    red: {
      gradient: 'from-red-500 to-pink-500',
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200'
    },
    purple: {
      gradient: 'from-purple-500 to-pink-500',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200'
    },
    indigo: {
      gradient: 'from-indigo-500 to-purple-500',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200'
    },
    orange: {
      gradient: 'from-orange-500 to-red-500',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200'
    }
  }
  return colors[color] || colors.blue
}

export default DASHBOARD_WIDGETS
