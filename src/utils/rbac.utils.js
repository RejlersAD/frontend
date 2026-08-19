/**
 * Smart RBAC Utility Functions
 * Handles nested user object structure and multiple admin detection sources
 */

/**
 * Check if user is an administrator
 * SECURITY FIX: Only is_superuser OR super_admin/admin/ict_admin role grants admin access
 * is_staff flag does NOT grant admin access (only Django admin panel)
 * 
 * Checks multiple sources for comprehensive admin detection:
 * 1. Django User is_superuser flag (emergency access only)
 * 2. Super Administrator role in roles array
 * 3. Administrator role in roles array
 * 4. ICT Administrator role in roles array (soft-coded from rbac_config.py)
 * 
 * @param {Object} user - User object from Redux store (may have nested user.user structure)
 * @returns {boolean} - True if user is admin, false otherwise
 */
export const isUserAdmin = (user) => {
  if (!user) return false

  // Extract nested user data (API returns {user: {is_staff: true}, roles: [...]})
  const userData = user.user || user

  // SECURITY: Only is_superuser bypasses (emergency access)
  // is_staff does NOT grant admin access
  const isSuperuser = userData?.is_superuser === true

  // Check for Administrator, Super Administrator, or ICT Administrator role (soft-coded RBAC)
  const hasAdminRole = user.roles?.some(role => 
    role.code === 'super_admin' || 
    role.code === 'admin' ||
    role.code === 'ict_admin' ||  // ICT Admin added (soft-coded from rbac_config.py)
    role.name === 'Super Administrator' ||
    role.name === 'Administrator' ||
    role.name === 'ICT Administrator'
  )

  return isSuperuser || hasAdminRole
}

/**
 * Check if user is a superuser (highest level admin)
 * 
 * @param {Object} user - User object from Redux store
 * @returns {boolean} - True if user is superuser
 */
export const isUserSuperuser = (user) => {
  if (!user) return false

  const userData = user.user || user

  // Check Django superuser flag
  if (userData?.is_superuser === true) return true

  // Check for Super Administrator role
  return user.roles?.some(role => 
    role.code === 'super_admin' || 
    role.name === 'Super Administrator'
  )
}

/**
 * Check if user is staff (can access admin panel)
 * 
 * @param {Object} user - User object from Redux store
 * @returns {boolean} - True if user is staff
 */
export const isUserStaff = (user) => {
  if (!user) return false

  const userData = user.user || user
  return userData?.is_staff === true
}

/**
 * Check if user has access to a specific module
 * Admins have access to all modules automatically
 * 
 * @param {Object} user - User object from Redux store
 * @param {string} moduleCode - Module code to check (e.g., 'crs_documents', 'user_mgmt')
 * @param {Array} userModules - Array of module codes user has access to
 * @returns {boolean} - True if user has access to the module
 */
export const hasModuleAccess = (user, moduleCode, userModules = []) => {
  if (!user || !moduleCode) return false

  // Admins have access to all modules
  if (isUserAdmin(user)) return true

  // Check if module code is in user's accessible modules
  return userModules.includes(moduleCode)
}

/**
 * Get user's display role name
 * 
 * @param {Object} user - User object from Redux store
 * @returns {string} - User's role display name
 */
export const getUserRole = (user) => {
  if (!user) return 'Guest'

  // Check roles array first (most accurate)
  if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
    const superAdminRole = user.roles.find(role => 
      role.code === 'super_admin' || role.name === 'Super Administrator'
    )
    if (superAdminRole) return 'Super Administrator'
    return user.roles[0].name
  }

  // Fallback to Django flags
  const userData = user.user || user
  if (userData?.is_superuser) return 'Super Administrator'
  if (userData?.is_staff) return 'Staff'

  return 'User'
}

/**
 * Get all module codes the user has access to
 * 
 * @param {Object} user - User object from Redux store
 * @returns {Array} - Array of module codes
 */
export const getUserModules = (user) => {
  if (!user) return []
  
  // Return modules array if available
  if (user.modules && Array.isArray(user.modules)) {
    return user.modules.map(m => m.code)
  }

  return []
}

export default {
  isUserAdmin,
  isUserSuperuser,
  isUserStaff,
  hasModuleAccess,
  getUserRole,
  getUserModules
}
