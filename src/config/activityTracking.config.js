/**
 * ========================================================================
 * ACTIVITY TRACKING CONFIGURATION
 * ========================================================================
 * Purpose: Soft-coded configuration for real-time activity monitoring
 * Features: Track user actions, document uploads, system events, S3 activity
 * Pattern: Advanced intelligence with live feed
 * ========================================================================
 */

/**
 * Activity Types
 */
export const ACTIVITY_TYPES = {
  DOCUMENT_UPLOAD: 'document_upload',
  DOCUMENT_ANALYSIS: 'document_analysis',
  USER_LOGIN: 'user_login',
  USER_REGISTRATION: 'user_registration',
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  FEATURE_USAGE: 'feature_usage',
  APPROVAL_REQUEST: 'approval_request',
  APPROVAL_GRANTED: 'approval_granted',
  NOTIFICATION_SENT: 'notification_sent',
  COMMENT_ADDED: 'comment_added',
  FILE_SHARED: 'file_shared',
  EXPORT_GENERATED: 'export_generated',
  AI_ANALYSIS: 'ai_analysis',
  S3_UPLOAD: 's3_upload',
  SYSTEM_EVENT: 'system_event'
}

/**
 * Activity Categories for Filtering
 */
export const ACTIVITY_CATEGORIES = {
  DOCUMENTS: 'documents',
  USERS: 'users',
  PROJECTS: 'projects',
  FEATURES: 'features',
  APPROVALS: 'approvals',
  AI: 'ai',
  SYSTEM: 'system'
}

/**
 * Activity Icons Configuration
 */
export const ACTIVITY_ICONS = {
  [ACTIVITY_TYPES.DOCUMENT_UPLOAD]: {
    icon: 'ArrowUpTrayIcon',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200'
  },
  [ACTIVITY_TYPES.DOCUMENT_ANALYSIS]: {
    icon: 'DocumentMagnifyingGlassIcon',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200'
  },
  [ACTIVITY_TYPES.USER_LOGIN]: {
    icon: 'ArrowRightOnRectangleIcon',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
    borderColor: 'border-green-200'
  },
  [ACTIVITY_TYPES.USER_REGISTRATION]: {
    icon: 'UserPlusIcon',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200'
  },
  [ACTIVITY_TYPES.PROJECT_CREATED]: {
    icon: 'FolderPlusIcon',
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-200'
  },
  [ACTIVITY_TYPES.PROJECT_UPDATED]: {
    icon: 'PencilSquareIcon',
    color: 'cyan',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-600',
    borderColor: 'border-cyan-200'
  },
  [ACTIVITY_TYPES.FEATURE_USAGE]: {
    icon: 'CpuChipIcon',
    color: 'violet',
    bgColor: 'bg-violet-100',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-200'
  },
  [ACTIVITY_TYPES.APPROVAL_REQUEST]: {
    icon: 'ClockIcon',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200'
  },
  [ACTIVITY_TYPES.APPROVAL_GRANTED]: {
    icon: 'CheckCircleIcon',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
    borderColor: 'border-green-200'
  },
  [ACTIVITY_TYPES.AI_ANALYSIS]: {
    icon: 'SparklesIcon',
    color: 'pink',
    bgColor: 'bg-pink-100',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200'
  },
  [ACTIVITY_TYPES.S3_UPLOAD]: {
    icon: 'CloudArrowUpIcon',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200'
  },
  [ACTIVITY_TYPES.EXPORT_GENERATED]: {
    icon: 'ArrowDownTrayIcon',
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-600',
    borderColor: 'border-teal-200'
  },
  [ACTIVITY_TYPES.SYSTEM_EVENT]: {
    icon: 'BellIcon',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200'
  }
}

/**
 * Activity Sources Configuration
 */
export const ACTIVITY_SOURCES = {
  pid_drawings: {
    label: 'P&ID Drawings',
    endpoint: '/pid/drawings/',
    type: ACTIVITY_TYPES.DOCUMENT_UPLOAD,
    category: ACTIVITY_CATEGORIES.DOCUMENTS,
    fields: {
      timestamp: 'uploaded_at',
      user: 'uploaded_by',
      title: 'title',
      description: 'drawing_number'
    }
  },
  pfd_documents: {
    label: 'PFD Documents',
    endpoint: '/pfd/documents/',
    type: ACTIVITY_TYPES.DOCUMENT_UPLOAD,
    category: ACTIVITY_CATEGORIES.DOCUMENTS,
    fields: {
      timestamp: 'uploaded_at',
      user: 'uploaded_by',
      title: 'title',
      description: 'document_number'
    }
  },
  qhse_projects: {
    label: 'QHSE Projects',
    endpoint: '/qhse/running-projects/',
    type: ACTIVITY_TYPES.PROJECT_CREATED,
    category: ACTIVITY_CATEGORIES.PROJECTS,
    fields: {
      timestamp: 'created_at',
      user: 'created_by',
      title: 'project_name',
      description: 'project_number'
    }
  },
  feature_usage: {
    label: 'Feature Usage',
    endpoint: '/mlflow/features/recent-usage/',
    type: ACTIVITY_TYPES.FEATURE_USAGE,
    category: ACTIVITY_CATEGORIES.FEATURES,
    fields: {
      timestamp: 'timestamp',
      user: 'user_id',
      title: 'feature_name',
      description: 'status'
    }
  },
  user_registrations: {
    label: 'User Registrations',
    endpoint: '/api/users/recent/',
    type: ACTIVITY_TYPES.USER_REGISTRATION,
    category: ACTIVITY_CATEGORIES.USERS,
    fields: {
      timestamp: 'date_joined',
      user: 'email',
      title: 'full_name',
      description: 'department'
    }
  }
}

/**
 * Real-Time Configuration
 */
export const REALTIME_CONFIG = {
  refreshInterval: 30000, // 30 seconds
  maxActivities: 50, // Maximum activities to show
  animationDuration: 500, // Animation duration in ms
  autoScroll: true, // Auto-scroll to new activities
  groupByTime: true, // Group activities by time periods
  showTimestamp: true, // Show relative timestamps
  enableNotifications: false // Browser notifications for new activities
}

/**
 * Time Grouping Configuration
 */
export const TIME_GROUPS = {
  NOW: { label: 'Just now', threshold: 60 }, // < 1 minute
  RECENT: { label: 'Recent', threshold: 300 }, // < 5 minutes
  TODAY: { label: 'Today', threshold: 86400 }, // < 24 hours
  YESTERDAY: { label: 'Yesterday', threshold: 172800 }, // < 48 hours
  THIS_WEEK: { label: 'This week', threshold: 604800 }, // < 7 days
  OLDER: { label: 'Older', threshold: Infinity }
}

/**
 * Activity Filters
 */
export const ACTIVITY_FILTERS = {
  ALL: { id: 'all', label: 'All Activity', icon: 'Squares2X2Icon' },
  DOCUMENTS: { id: ACTIVITY_CATEGORIES.DOCUMENTS, label: 'Documents', icon: 'DocumentTextIcon' },
  USERS: { id: ACTIVITY_CATEGORIES.USERS, label: 'Users', icon: 'UserGroupIcon' },
  PROJECTS: { id: ACTIVITY_CATEGORIES.PROJECTS, label: 'Projects', icon: 'BriefcaseIcon' },
  FEATURES: { id: ACTIVITY_CATEGORIES.FEATURES, label: 'Features', icon: 'CpuChipIcon' },
  AI: { id: ACTIVITY_CATEGORIES.AI, label: 'AI Analysis', icon: 'SparklesIcon' }
}

/**
 * Helper: Format activity timestamp
 */
export const formatActivityTime = (timestamp) => {
  const now = new Date()
  const activityTime = new Date(timestamp)
  const diffSeconds = Math.floor((now - activityTime) / 1000)

  if (diffSeconds < 60) return 'Just now'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`
  
  return activityTime.toLocaleDateString()
}

/**
 * Helper: Get time group for activity
 */
export const getTimeGroup = (timestamp) => {
  const now = new Date()
  const activityTime = new Date(timestamp)
  const diffSeconds = Math.floor((now - activityTime) / 1000)

  for (const [key, group] of Object.entries(TIME_GROUPS)) {
    if (diffSeconds < group.threshold) {
      return { key, ...group }
    }
  }
  
  return { key: 'OLDER', ...TIME_GROUPS.OLDER }
}

/**
 * Helper: Generate activity message
 */
export const generateActivityMessage = (activity) => {
  const { type, user, title, details } = activity

  const messages = {
    [ACTIVITY_TYPES.DOCUMENT_UPLOAD]: `uploaded "${title}"`,
    [ACTIVITY_TYPES.DOCUMENT_ANALYSIS]: `analyzed "${title}"`,
    [ACTIVITY_TYPES.USER_LOGIN]: `logged in`,
    [ACTIVITY_TYPES.USER_REGISTRATION]: `joined the platform`,
    [ACTIVITY_TYPES.PROJECT_CREATED]: `created project "${title}"`,
    [ACTIVITY_TYPES.PROJECT_UPDATED]: `updated project "${title}"`,
    [ACTIVITY_TYPES.FEATURE_USAGE]: `used ${title}`,
    [ACTIVITY_TYPES.APPROVAL_REQUEST]: `requested approval for "${title}"`,
    [ACTIVITY_TYPES.APPROVAL_GRANTED]: `approved "${title}"`,
    [ACTIVITY_TYPES.AI_ANALYSIS]: `ran AI analysis on "${title}"`,
    [ACTIVITY_TYPES.S3_UPLOAD]: `uploaded "${title}" to cloud storage`,
    [ACTIVITY_TYPES.EXPORT_GENERATED]: `generated export for "${title}"`
  }

  return messages[type] || `performed action on "${title}"`
}

/**
 * Helper: Get activity icon config
 */
export const getActivityIcon = (activityType) => {
  return ACTIVITY_ICONS[activityType] || ACTIVITY_ICONS[ACTIVITY_TYPES.SYSTEM_EVENT]
}

/**
 * Helper: Filter activities by category
 */
export const filterActivities = (activities, category) => {
  if (category === 'all') return activities
  return activities.filter(activity => activity.category === category)
}

/**
 * Helper: Group activities by time
 */
export const groupActivitiesByTime = (activities) => {
  const grouped = {}
  
  activities.forEach(activity => {
    const group = getTimeGroup(activity.timestamp)
    if (!grouped[group.key]) {
      grouped[group.key] = {
        label: group.label,
        activities: []
      }
    }
    grouped[group.key].activities.push(activity)
  })
  
  return grouped
}

/**
 * Export configuration
 */
export default {
  ACTIVITY_TYPES,
  ACTIVITY_CATEGORIES,
  ACTIVITY_ICONS,
  ACTIVITY_SOURCES,
  ACTIVITY_FILTERS,
  REALTIME_CONFIG,
  TIME_GROUPS,
  formatActivityTime,
  getTimeGroup,
  generateActivityMessage,
  getActivityIcon,
  filterActivities,
  groupActivitiesByTime
}
