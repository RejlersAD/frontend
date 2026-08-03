/**
 * Real-time Activity Stream Configuration
 * Soft-coded settings for activity monitoring
 */

export const ACTIVITY_CONFIG = {
  // Activity categories
  categories: [
    { id: 'all', label: 'All Activities', icon: '📊', color: 'blue' },
    { id: 'authentication', label: 'Authentication', icon: '🔐', color: 'purple' },
    { id: 'authorization', label: 'Authorization', icon: '🛡️', color: 'indigo' },
    { id: 'data_management', label: 'Data Management', icon: '📁', color: 'green' },
    { id: 'system_operation', label: 'System Operations', icon: '⚙️', color: 'gray' },
    { id: 'security', label: 'Security', icon: '🔒', color: 'red' },
    { id: 'api', label: 'API Requests', icon: '🔌', color: 'blue' },
    { id: 'ml_ai', label: 'ML/AI', icon: '🤖', color: 'pink' },
    { id: 'communication', label: 'Communication', icon: '💬', color: 'cyan' },
    { id: 'maintenance', label: 'Maintenance', icon: '🔧', color: 'orange' },
  ],

  // Activity types with display configuration
  activityTypes: {
    user_login: {
      label: 'User Login',
      icon: '👤',
      color: 'green',
      description: 'User logged in'
    },
    user_logout: {
      label: 'User Logout',
      icon: '👋',
      color: 'gray',
      description: 'User logged out'
    },
    user_created: {
      label: 'User Created',
      icon: '➕',
      color: 'blue',
      description: 'New user created'
    },
    user_updated: {
      label: 'User Updated',
      icon: '✏️',
      color: 'yellow',
      description: 'User profile updated'
    },
    document_uploaded: {
      label: 'Document Upload',
      icon: '📤',
      color: 'purple',
      description: 'Document uploaded'
    },
    document_processed: {
      label: 'Document Processed',
      icon: '⚙️',
      color: 'blue',
      description: 'Document processing completed'
    },
    project_created: {
      label: 'Project Created',
      icon: '🚀',
      color: 'green',
      description: 'New project created'
    },
    api_request: {
      label: 'API Request',
      icon: '🔌',
      color: 'blue',
      description: 'API endpoint accessed'
    },
    system_error: {
      label: 'System Error',
      icon: '⚠️',
      color: 'red',
      description: 'System error occurred'
    },
    security_event: {
      label: 'Security Event',
      icon: '🛡️',
      color: 'red',
      description: 'Security event detected'
    },
    role_assigned: {
      label: 'Role Assigned',
      icon: '🎭',
      color: 'purple',
      description: 'Role assigned to user'
    },
    data_export: {
      label: 'Data Export',
      icon: '📥',
      color: 'indigo',
      description: 'Data exported'
    },
    ai_analysis: {
      label: 'AI Analysis',
      icon: '🤖',
      color: 'pink',
      description: 'AI analysis completed'
    },
    notification_sent: {
      label: 'Notification Sent',
      icon: '📧',
      color: 'cyan',
      description: 'Notification delivered'
    },
    report_generated: {
      label: 'Report Generated',
      icon: '📊',
      color: 'green',
      description: 'Report generated'
    },
  },

  // Severity levels
  severityLevels: {
    info: {
      label: 'Info',
      color: 'blue',
      bgClass: 'bg-blue-100',
      textClass: 'text-blue-700',
      borderClass: 'border-blue-300'
    },
    low: {
      label: 'Low',
      color: 'gray',
      bgClass: 'bg-gray-100',
      textClass: 'text-gray-700',
      borderClass: 'border-gray-300'
    },
    normal: {
      label: 'Normal',
      color: 'green',
      bgClass: 'bg-green-100',
      textClass: 'text-green-700',
      borderClass: 'border-green-300'
    },
    high: {
      label: 'High',
      color: 'orange',
      bgClass: 'bg-orange-100',
      textClass: 'text-orange-700',
      borderClass: 'border-orange-300'
    },
    critical: {
      label: 'Critical',
      color: 'red',
      bgClass: 'bg-red-100',
      textClass: 'text-red-700',
      borderClass: 'border-red-300'
    },
  },

  // Display settings
  display: {
    defaultLimit: 50,
    autoRefreshInterval: 3000, // 3 seconds
    animationDuration: 300,
    showTimestamps: true,
    showUserInfo: true,
    groupSimilar: true,
    highlightCritical: true,
  },

  // Filters
  filters: {
    timeRanges: [
      { id: 'realtime', label: 'Real-time', minutes: null },
      { id: '5m', label: 'Last 5 min', minutes: 5 },
      { id: '15m', label: 'Last 15 min', minutes: 15 },
      { id: '1h', label: 'Last hour', minutes: 60 },
      { id: '24h', label: 'Last 24 hours', minutes: 1440 },
    ],
    severityFilters: ['all', 'critical', 'high', 'normal', 'low', 'info'],
  },

  // WebSocket settings
  websocket: {
    reconnectDelay: 3000,
    maxReconnectAttempts: 10,
    pingInterval: 30000,
  },
};


/**
 * Activity formatting utilities
 */
export const formatActivityDescription = (activity) => {
  const config = ACTIVITY_CONFIG.activityTypes[activity.activity_type];
  
  if (!config) {
    return activity.description;
  }
  
  // Customize description based on activity type
  switch (activity.activity_type) {
    case 'user_login':
      return `${activity.user_name || activity.user_email} logged in`;
    case 'user_logout':
      return `${activity.user_name || activity.user_email} logged out`;
    case 'api_request':
      return `API: ${activity.details?.method || 'GET'} ${activity.details?.path || ''}`;
    case 'document_uploaded':
      return `${activity.user_name || activity.user_email} uploaded a document`;
    default:
      return activity.description;
  }
};


/**
 * Get activity icon and color
 */
export const getActivityStyle = (activity) => {
  const typeConfig = ACTIVITY_CONFIG.activityTypes[activity.activity_type];
  const severityConfig = ACTIVITY_CONFIG.severityLevels[activity.severity];
  
  return {
    icon: typeConfig?.icon || '📌',
    color: typeConfig?.color || 'gray',
    severity: severityConfig || ACTIVITY_CONFIG.severityLevels.normal,
  };
};


/**
 * Format timestamp
 */
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else {
    return date.toLocaleString();
  }
};
