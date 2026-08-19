/**
 * Sales Module Configuration
 * Soft-coded, intelligent configuration for Sales features
 * Supports dynamic theming, metrics, and module organization
 */

export const SALES_CONFIG = {
  // Module Metadata
  meta: {
    id: 'dept_of_sales',
    name: 'Department of Sales',
    shortName: 'Sales',
    icon: '🏢',
    description: 'AI-Powered Sales Intelligence & CRM Platform',
    version: '2.0.0',
    category: 'sales'
  },

  // Visual Theme Configuration
  theme: {
    primary: {
      gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
      solid: 'bg-blue-600',
      light: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-500'
    },
    accent: {
      gradient: 'from-purple-500 to-pink-500',
      solid: 'bg-purple-600',
      light: 'bg-purple-50',
      text: 'text-purple-600'
    },
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    danger: 'text-red-600 bg-red-50 border-red-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200'
  },

  // Tab Navigation Configuration
  tabs: [
    {
      id: 'overview',
      label: 'Sales Hub',
      icon: '🎯',
      description: 'Executive dashboard with AI insights',
      color: 'blue',
      order: 1,
      subFeatures: [
        {
          id: 'performance_metrics',
          title: 'Performance Metrics',
          description: 'Real-time sales KPIs and analytics',
          icon: '📊',
          color: 'blue',
          gradient: 'from-blue-500 to-indigo-600',
          action: 'view',
          enabled: true
        },
        {
          id: 'revenue_forecast',
          title: 'Revenue Forecast',
          description: 'AI-powered revenue predictions',
          icon: '📈',
          color: 'green',
          gradient: 'from-green-500 to-emerald-600',
          action: 'analyze',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'team_performance',
          title: 'Team Performance',
          description: 'Sales team leaderboard & stats',
          icon: '👥',
          color: 'purple',
          gradient: 'from-purple-500 to-pink-600',
          action: 'view',
          enabled: true
        },
        {
          id: 'sales_reports',
          title: 'Sales Reports',
          description: 'Generate custom reports & exports',
          icon: '📄',
          color: 'gray',
          gradient: 'from-gray-600 to-gray-800',
          action: 'generate',
          enabled: true
        }
      ]
    },
    {
      id: 'clients',
      label: 'Client 360°',
      icon: '👥',
      description: 'Complete customer relationship view',
      color: 'cyan',
      order: 2,
      subFeatures: [
        {
          id: 'client_directory',
          title: 'Client Directory',
          description: 'Browse and search all clients',
          icon: '📇',
          color: 'cyan',
          gradient: 'from-cyan-500 to-blue-600',
          action: 'browse',
          enabled: true
        },
        {
          id: 'add_client',
          title: 'Add New Client',
          description: 'Register new customer relationship',
          icon: '➕',
          color: 'green',
          gradient: 'from-green-500 to-emerald-600',
          action: 'create',
          enabled: true
        },
        {
          id: 'client_insights',
          title: 'Client Insights',
          description: 'AI-powered client behavior analysis',
          icon: '🔍',
          color: 'purple',
          gradient: 'from-purple-500 to-pink-600',
          action: 'analyze',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'contact_manager',
          title: 'Contact Manager',
          description: 'Manage client contacts & touchpoints',
          icon: '📞',
          color: 'blue',
          gradient: 'from-blue-500 to-indigo-600',
          action: 'manage',
          enabled: true
        },
        {
          id: 'client_segmentation',
          title: 'Client Segmentation',
          description: 'Smart client grouping & targeting',
          icon: '🎯',
          color: 'amber',
          gradient: 'from-amber-500 to-orange-600',
          action: 'segment',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'interaction_history',
          title: 'Interaction History',
          description: 'Complete timeline of client interactions',
          icon: '📋',
          color: 'indigo',
          gradient: 'from-indigo-500 to-purple-600',
          action: 'view',
          enabled: true
        }
      ]
    },
    {
      id: 'pipeline',
      label: 'Deal Pipeline',
      icon: '📈',
      description: 'Visual sales funnel & forecasting',
      color: 'indigo',
      order: 3,
      subFeatures: [
        {
          id: 'pipeline_view',
          title: 'Pipeline View',
          description: 'Visual kanban board of all deals',
          icon: '📊',
          color: 'indigo',
          gradient: 'from-indigo-500 to-blue-600',
          action: 'view',
          enabled: true
        },
        {
          id: 'create_deal',
          title: 'Create Deal',
          description: 'Start new sales opportunity',
          icon: '➕',
          color: 'green',
          gradient: 'from-green-500 to-emerald-600',
          action: 'create',
          enabled: true
        },
        {
          id: 'deal_scoring',
          title: 'Deal Scoring',
          description: 'AI-powered win probability analysis',
          icon: '🎯',
          color: 'purple',
          gradient: 'from-purple-500 to-pink-600',
          action: 'analyze',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'stage_automation',
          title: 'Stage Automation',
          description: 'Automated deal progression rules',
          icon: '⚡',
          color: 'amber',
          gradient: 'from-amber-500 to-orange-600',
          action: 'configure',
          enabled: true
        },
        {
          id: 'deal_analytics',
          title: 'Deal Analytics',
          description: 'Performance by stage & conversion',
          icon: '📈',
          color: 'blue',
          gradient: 'from-blue-500 to-cyan-600',
          action: 'analyze',
          enabled: true
        },
        {
          id: 'pipeline_forecast',
          title: 'Pipeline Forecast',
          description: 'Predict future deal closures',
          icon: '🔮',
          color: 'purple',
          gradient: 'from-purple-600 to-indigo-700',
          action: 'forecast',
          enabled: true,
          badge: 'AI'
        }
      ]
    },
    {
      id: 'insights',
      label: 'AI Insights',
      icon: '🤖',
      description: 'Predictive analytics & recommendations',
      color: 'purple',
      order: 4,
      subFeatures: [
        {
          id: 'smart_recommendations',
          title: 'Smart Recommendations',
          description: 'AI-powered next best actions',
          icon: '💡',
          color: 'purple',
          gradient: 'from-purple-500 to-pink-600',
          action: 'view',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'churn_prediction',
          title: 'Churn Prediction',
          description: 'Identify at-risk clients early',
          icon: '⚠️',
          color: 'red',
          gradient: 'from-red-500 to-pink-600',
          action: 'predict',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'lead_scoring',
          title: 'Lead Scoring',
          description: 'Intelligent lead prioritization',
          icon: '🎯',
          color: 'green',
          gradient: 'from-green-500 to-emerald-600',
          action: 'score',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'market_intelligence',
          title: 'Market Intelligence',
          description: 'Industry trends & opportunities',
          icon: '🌍',
          color: 'blue',
          gradient: 'from-blue-500 to-cyan-600',
          action: 'analyze',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'sentiment_analysis',
          title: 'Sentiment Analysis',
          description: 'Client sentiment from interactions',
          icon: '😊',
          color: 'amber',
          gradient: 'from-amber-500 to-orange-600',
          action: 'analyze',
          enabled: true,
          badge: 'AI'
        },
        {
          id: 'competitor_tracking',
          title: 'Competitor Tracking',
          description: 'Monitor competitive landscape',
          icon: '🔍',
          color: 'indigo',
          gradient: 'from-indigo-500 to-purple-600',
          action: 'monitor',
          enabled: true
        }
      ]
    },
    {
      id: 'analytics',
      label: 'Usage Analytics',
      icon: '📊',
      description: 'User metering & system usage insights',
      color: 'emerald',
      order: 5,
      subFeatures: [
        {
          id: 'usage_overview',
          title: 'Usage Overview',
          description: 'Real-time usage metrics & KPIs',
          icon: '📈',
          color: 'emerald',
          gradient: 'from-emerald-500 to-green-600',
          action: 'view',
          enabled: true
        },
        {
          id: 'department_analytics',
          title: 'Department Analytics',
          description: 'Usage breakdown by department',
          icon: '🏢',
          color: 'blue',
          gradient: 'from-blue-500 to-indigo-600',
          action: 'analyze',
          enabled: true
        },
        {
          id: 'feature_analytics',
          title: 'Feature Analytics',
          description: 'Most used features & modules',
          icon: '🎯',
          color: 'purple',
          gradient: 'from-purple-500 to-pink-600',
          action: 'analyze',
          enabled: true
        },
        {
          id: 'top_users',
          title: 'Top Users',
          description: 'User activity leaderboard',
          icon: '👥',
          color: 'amber',
          gradient: 'from-amber-500 to-orange-600',
          action: 'view',
          enabled: true
        },
        {
          id: 'usage_trends',
          title: 'Usage Trends',
          description: 'Historical usage patterns & trends',
          icon: '📊',
          color: 'cyan',
          gradient: 'from-cyan-500 to-blue-600',
          action: 'analyze',
          enabled: true
        }
      ]
    }
  ],

  // Metrics Configuration with AI-Enhanced Labels
  metrics: [
    {
      id: 'revenue',
      title: 'Total Revenue',
      icon: '💰',
      apiKey: 'total_revenue',
      growthKey: 'revenue_growth',
      format: 'currency',
      color: 'emerald',
      gradient: 'from-emerald-500 to-green-600',
      insights: [
        'Track revenue trends',
        'Compare against targets',
        'AI-powered forecasting'
      ],
      priority: 1
    },
    {
      id: 'deals',
      title: 'Active Deals',
      icon: '🎯',
      apiKey: 'active_deals',
      growthKey: 'new_deals_this_month',
      format: 'number',
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-600',
      insights: [
        'Pipeline health score',
        'Deal velocity tracking',
        'Conversion predictions'
      ],
      priority: 2
    },
    {
      id: 'conversion',
      title: 'Win Rate',
      icon: '🏆',
      apiKey: 'win_rate',
      growthKey: 'win_rate_change',
      format: 'percentage',
      color: 'amber',
      gradient: 'from-amber-500 to-orange-600',
      insights: [
        'Performance benchmarking',
        'Success pattern analysis',
        'Improvement opportunities'
      ],
      priority: 3
    },
    {
      id: 'pipeline_value',
      title: 'Pipeline Value',
      icon: '📊',
      apiKey: 'pipeline_value',
      growthKey: 'pipeline_growth',
      format: 'currency',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-600',
      insights: [
        'Forecast accuracy',
        'Risk assessment',
        'Opportunity sizing'
      ],
      priority: 4
    }
  ],

  // Quick Action Cards Configuration
  quickActions: [
    {
      id: 'new_client',
      title: 'Add New Client',
      description: 'Register new customer relationship',
      icon: '➕',
      iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
      action: 'navigate',
      target: 'clients',
      color: 'green',
      order: 1
    },
    {
      id: 'create_deal',
      title: 'Create Deal',
      description: 'Start new sales opportunity',
      icon: '🎯',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      action: 'navigate',
      target: 'pipeline',
      color: 'blue',
      order: 2
    },
    {
      id: 'ai_recommendations',
      title: 'AI Recommendations',
      description: 'Get intelligent deal insights',
      icon: '🤖',
      iconBg: 'bg-gradient-to-br from-purple-500 to-pink-600',
      action: 'navigate',
      target: 'insights',
      color: 'purple',
      order: 3
    },
    {
      id: 'export_report',
      title: 'Export Report',
      description: 'Generate sales analytics report',
      icon: '📄',
      iconBg: 'bg-gradient-to-br from-gray-600 to-gray-800',
      action: 'modal',
      target: 'export',
      color: 'gray',
      order: 4
    }
  ],

  // AI Features Configuration
  aiFeatures: {
    enabled: true,
    features: [
      {
        id: 'deal_scoring',
        name: 'Deal Scoring',
        description: 'AI-powered win probability analysis',
        icon: '🎯',
        status: 'active'
      },
      {
        id: 'lead_prioritization',
        name: 'Lead Prioritization',
        description: 'Intelligent lead ranking & routing',
        icon: '🚀',
        status: 'active'
      },
      {
        id: 'forecasting',
        name: 'Revenue Forecasting',
        description: 'Predictive revenue modeling',
        icon: '📈',
        status: 'active'
      },
      {
        id: 'churn_prediction',
        name: 'Churn Prediction',
        description: 'Early warning system for at-risk clients',
        icon: '⚠️',
        status: 'beta'
      }
    ]
  },

  // Data Refresh Configuration
  refresh: {
    auto: true,
    interval: 30000, // 30 seconds
    showIndicator: true
  },

  // Display Preferences
  display: {
    recentDealsLimit: 5,
    showEmptyStates: true,
    animateTransitions: true,
    compactMode: false
  },

  // Status Labels (Soft-coded)
  statusLabels: {
    deal_stages: {
      prospecting: { label: 'Prospecting', color: 'gray', icon: '🔍' },
      qualification: { label: 'Qualification', color: 'blue', icon: '✓' },
      proposal: { label: 'Proposal', color: 'yellow', icon: '📝' },
      negotiation: { label: 'Negotiation', color: 'orange', icon: '🤝' },
      closed_won: { label: 'Closed Won', color: 'green', icon: '✅' },
      closed_lost: { label: 'Closed Lost', color: 'red', icon: '❌' }
    },
    client_status: {
      active: { label: 'Active', color: 'green' },
      inactive: { label: 'Inactive', color: 'gray' },
      at_risk: { label: 'At Risk', color: 'red' }
    }
  }
};

// Helper Functions
export const formatValue = (value, format) => {
  if (!value && value !== 0) return format === 'currency' ? '$0' : '0';
  
  switch (format) {
    case 'currency':
      return `$${parseFloat(value).toLocaleString('en-US', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      })}`;
    case 'percentage':
      return `${parseFloat(value).toFixed(1)}%`;
    case 'number':
      return value.toLocaleString('en-US');
    default:
      return String(value);
  }
};

export const getMetricByKey = (key) => {
  return SALES_CONFIG.metrics.find(m => m.apiKey === key);
};

export const getTabByPath = (path) => {
  return SALES_CONFIG.tabs.find(t => t.id === path);
};

export default SALES_CONFIG;
