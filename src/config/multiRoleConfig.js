// Multi-Role Management Configuration
// Centralized soft-coded configuration for user role assignment UI

export const MULTI_ROLE_CONFIG = {
  // UI Display Settings
  maxVisibleRoles: 2, // Number of roles to show before "+N more" badge
  badgeColors: {
    primary: 'bg-blue-100 text-blue-800 border-blue-300',
    secondary: 'bg-gray-100 text-gray-700 border-gray-300',
    recommended: 'bg-green-100 text-green-800 border-green-300',
  },
  
  // Modal Settings
  modalSettings: {
    title: 'Manage User Roles',
    subtitle: 'Assign multiple roles and set primary role for user access control',
    maxHeight: 'max-h-[600px]',
    width: 'max-w-2xl',
  },
  
  // Role Selection
  roleSelectionConfig: {
    searchPlaceholder: 'Search roles...',
    emptyStateMessage: 'No roles available',
    noResultsMessage: 'No roles match your search',
    selectAllText: 'Select All',
    clearAllText: 'Clear All',
  },
  
  // Primary Role Settings
  primaryRoleConfig: {
    label: 'Primary Role',
    tooltip: 'The primary role determines the user\'s default permissions and sidebar menu',
    requiredMessage: 'At least one role must be marked as primary',
    autoSetPrimary: true, // Automatically set first selected role as primary
  },
  
  // Recommended Roles
  recommendedRoles: ['default', 'viewer', 'engineering_common_access'],
  recommendedBadgeText: '⭐ Recommended',
  
  // Validation
  validation: {
    minRoles: 0, // Minimum roles required (0 = optional)
    maxRoles: 10, // Maximum roles allowed per user
    requirePrimary: true, // Require at least one primary role
    protectedRoles: ['super_admin'], // Roles that require special permission
  },
  
  // Messages
  messages: {
    assignSuccess: 'Roles updated successfully',
    assignError: 'Failed to update roles',
    removeSuccess: 'Role removed successfully',
    removeError: 'Failed to remove role',
    setPrimarySuccess: 'Primary role updated',
    setPrimaryError: 'Failed to set primary role',
    confirmRemoveLast: 'Are you sure you want to remove this user\'s last role?',
    confirmRemovePrimary: 'This is the primary role. A new primary will be set automatically.',
    confirmProtectedRole: 'This is a protected role. Are you sure you want to assign it?',
  },
  
  // Actions
  actions: {
    addRole: {
      label: 'Add Role',
      icon: 'plus',
      color: 'blue',
    },
    removeRole: {
      label: 'Remove',
      icon: 'trash',
      color: 'red',
      confirmRequired: true,
    },
    setPrimary: {
      label: 'Set as Primary',
      icon: 'star',
      color: 'yellow',
    },
    manageRoles: {
      label: 'Manage Roles',
      icon: 'cog',
      color: 'gray',
    },
  },
  
  // Badge Display
  badgeConfig: {
    showRoleLevel: true, // Show role level (e.g., "Level 4")
    showModuleCount: false, // Show number of modules (e.g., "19 modules")
    showPrimaryIndicator: true, // Show "PRIMARY" badge
    maxRoleNameLength: 25, // Truncate long role names
    hoverShowFullName: true, // Show full name on hover
  },
  
  // Feature Flags
  features: {
    enableMultiRole: true, // Enable multiple role assignment
    enableInlineEdit: true, // Enable inline editing in table
    enableBulkRoleAssignment: false, // Enable assigning roles to multiple users
    enableRoleSearch: true, // Enable search in role dropdown
    enableRoleGrouping: true, // Group roles by category (admin, user, custom)
  },
  
  // Sorting
  sortOptions: {
    byLevel: 'level', // Sort by role level (ascending)
    byName: 'name', // Sort by role name (alphabetical)
    byModuleCount: 'modules', // Sort by module count (descending)
    default: 'level', // Default sort option
  },
};

export default MULTI_ROLE_CONFIG;
