/**
 * Duplicate Detection Configuration
 * Centralized configuration for finding and handling duplicate records
 */

export const DUPLICATE_DETECTION_CONFIG = {
  // Fields to check for duplicates
  checkFields: {
    email: {
      enabled: true,
      priority: 1,
      caseSensitive: false,
      label: 'Email Address',
      description: 'Check for duplicate email addresses',
    },
    phone: {
      enabled: false,  // Can be enabled if needed
      priority: 2,
      caseSensitive: false,
      label: 'Phone Number',
      description: 'Check for duplicate phone numbers',
    },
  },

  // Duplicate resolution strategies
  resolution: {
    strategies: {
      KEEP_OLDEST: 'keep_oldest',
      KEEP_NEWEST: 'keep_newest',
      KEEP_MOST_ACTIVE: 'keep_most_active',
      MANUAL_SELECT: 'manual_select',
    },
    default: 'KEEP_OLDEST',
    descriptions: {
      KEEP_OLDEST: 'Keep the user account created first',
      KEEP_NEWEST: 'Keep the most recently created account',
      KEEP_MOST_ACTIVE: 'Keep the account with most recent login',
      MANUAL_SELECT: 'Manually choose which account to keep',
    },
  },

  // UI Configuration
  ui: {
    modal: {
      title: 'Duplicate Users Detected',
      description: 'The following duplicate email addresses were found in the system.',
      noDataMessage: '✅ No duplicate users found in the system.',
    },
    table: {
      columns: [
        { key: 'email', label: 'Email', sortable: true },
        { key: 'count', label: 'Count', sortable: true },
        { key: 'actions', label: 'Actions', sortable: false },
      ],
    },
    colors: {
      warning: 'text-amber-600',
      danger: 'text-red-600',
      success: 'text-green-600',
      info: 'text-blue-600',
    },
    icons: {
      warning: '⚠️',
      danger: '🚨',
      success: '✅',
      info: 'ℹ️',
    },
  },

  // API Endpoints
  api: {
    checkDuplicates: '/rbac/users/check-duplicates/',
    resolveDuplicate: '/rbac/users/resolve-duplicate/',
    getDuplicateDetails: '/rbac/users/duplicate-details/',
  },

  // Confirmation messages
  messages: {
    confirm: {
      delete: 'Are you sure you want to delete this duplicate user? This action cannot be undone.',
      resolve: 'This will keep one account and soft-delete the others. Continue?',
      resolveAll: 'This will resolve all duplicates using the selected strategy. Continue?',
    },
    success: {
      resolved: 'Duplicate resolved successfully',
      allResolved: 'All duplicates resolved successfully',
      deleted: 'User deleted successfully',
    },
    error: {
      checkFailed: 'Failed to check for duplicates',
      resolveFailed: 'Failed to resolve duplicate',
      deleteFailed: 'Failed to delete user',
      noSelection: 'Please select which account to keep',
    },
  },

  // Duplicate comparison criteria
  comparison: {
    criteria: [
      { key: 'created_at', label: 'Created Date', type: 'date', weight: 1 },
      { key: 'last_login', label: 'Last Login', type: 'date', weight: 3 },
      { key: 'is_staff', label: 'Staff Status', type: 'boolean', weight: 2 },
      { key: 'is_active', label: 'Active Status', type: 'boolean', weight: 4 },
      { key: 'module_count', label: 'Assigned Modules', type: 'number', weight: 2 },
    ],
    // Function to calculate which user to keep
    calculateBestMatch: (users) => {
      let bestUser = users[0];
      let bestScore = 0;

      users.forEach(user => {
        let score = 0;
        
        // Active users get priority
        if (user.is_active) score += 10;
        
        // Recent login adds points
        if (user.last_login) {
          const daysSinceLogin = (Date.now() - new Date(user.last_login)) / (1000 * 60 * 60 * 24);
          score += Math.max(0, 30 - daysSinceLogin); // Max 30 points for recent login
        }
        
        // Staff/admin status
        if (user.is_staff) score += 5;
        if (user.is_superuser) score += 10;
        
        // More modules assigned
        score += (user.module_count || 0) * 2;
        
        // Older account gets small bonus (established user)
        const accountAge = (Date.now() - new Date(user.date_joined)) / (1000 * 60 * 60 * 24);
        score += Math.min(accountAge / 30, 5); // Max 5 points for account age
        
        if (score > bestScore) {
          bestScore = score;
          bestUser = user;
        }
      });
      
      return bestUser;
    },
  },

  // Auto-resolution rules
  autoResolution: {
    enabled: false, // Disabled by default for safety
    rules: {
      // Auto-delete if user never logged in and was created more than 30 days ago
      autoDeleteInactive: {
        enabled: false,
        conditions: {
          last_login: null,
          days_since_created: 30,
          is_active: false,
        },
      },
      // Auto-keep most active user
      autoKeepActive: {
        enabled: false,
        minLoginCountDifference: 10, // Keep user with 10+ more logins
      },
    },
  },

  // Logging configuration
  logging: {
    enabled: true,
    prefix: '[DuplicateDetection]',
    actions: [
      'check_started',
      'duplicates_found',
      'resolution_started',
      'resolution_completed',
      'error',
    ],
  },
};

/**
 * Helper function to format duplicate data for display
 */
export const formatDuplicateData = (duplicate) => {
  return {
    email: duplicate.email,
    count: duplicate.count || duplicate.users?.length || 0,
    users: duplicate.users || [],
    severity: duplicate.count > 3 ? 'danger' : duplicate.count > 2 ? 'warning' : 'info',
  };
};

/**
 * Helper function to determine which user to keep
 */
export const determineUserToKeep = (users, strategy = 'KEEP_OLDEST') => {
  if (!users || users.length === 0) return null;
  if (users.length === 1) return users[0];

  const { strategies, comparison } = DUPLICATE_DETECTION_CONFIG.resolution;

  switch (strategy) {
    case strategies.KEEP_OLDEST:
      return users.reduce((oldest, user) => 
        new Date(user.date_joined) < new Date(oldest.date_joined) ? user : oldest
      );
    
    case strategies.KEEP_NEWEST:
      return users.reduce((newest, user) => 
        new Date(user.date_joined) > new Date(newest.date_joined) ? user : newest
      );
    
    case strategies.KEEP_MOST_ACTIVE:
      return users.reduce((mostActive, user) => {
        const userLastLogin = user.last_login ? new Date(user.last_login) : new Date(0);
        const mostActiveLastLogin = mostActive.last_login ? new Date(mostActive.last_login) : new Date(0);
        return userLastLogin > mostActiveLastLogin ? user : mostActive;
      });
    
    default:
      return comparison.calculateBestMatch(users);
  }
};

export default DUPLICATE_DETECTION_CONFIG;
