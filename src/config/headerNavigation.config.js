/**
 * Header Navigation Configuration
 * SOFT-CODED: Configure main navigation menu items for authenticated and public users
 * 
 * Usage:
 * - Define navigation items for both authenticated and unauthenticated states
 * - Configure RBAC (role-based access control) for each item
 * - Manage visibility, order, and styling centrally
 */

// ── Navigation Item Types ──────────────────────────────────────────────────
// Types of navigation items that can appear in the header
export const NAV_ITEM_TYPES = {
  LINK: 'link',           // Simple navigation link
  BUTTON: 'button',       // Call-to-action button
  HIGHLIGHT: 'highlight'  // Highlighted/featured link
}

// ── RBAC Configuration ─────────────────────────────────────────────────────
// Access control rules for navigation items
export const NAV_ACCESS_RULES = {
  PUBLIC: 'public',                    // Accessible to everyone
  AUTHENTICATED: 'authenticated',      // Requires authentication
  ADMIN: 'admin',                      // Requires admin/staff/super_admin
  MODULE: 'module'                     // Requires specific module access
}

// ── Authenticated User Navigation Items ────────────────────────────────────
// SOFT-CODED: Navigation items shown when user is logged in
// Order matters - items appear in the sequence defined here
export const AUTHENTICATED_NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 1
  },
  {
    id: 'approvals',
    label: 'Approvals',
    path: '/approvals',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 2,
    // SOFT-CODED: Role-based visibility rules
    // If requiresRole is set, only users with these roles can see this item
    // Leave empty or omit to show to all authenticated users
    requiresRole: [],  // Empty = all authenticated users can see
    // If requiresModule is set, only users with this module can see
    requiresModule: null,  // null = no module requirement
    // If adminOnly is true, only admins/staff/super_admin can see
    adminOnly: false
  },
  {
    id: 'solutions',
    label: 'Solutions',
    path: '/solutions',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 3
  },
  {
    id: 'about',
    label: 'About',
    path: '/about',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 4
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 5
  },
  {
    id: 'profile',
    label: 'Profile',
    path: '/profile',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 6
  },
  {
    id: 'change-password',
    label: 'Change Password',
    path: '/change-password',
    type: NAV_ITEM_TYPES.BUTTON,
    access: NAV_ACCESS_RULES.AUTHENTICATED,
    enabled: true,
    order: 7,
    icon: 'lock',  // Icon identifier for button styling
    style: 'primary'  // Button style variant
  }
]

// ── Public (Unauthenticated) Navigation Items ──────────────────────────────
// SOFT-CODED: Navigation items shown when user is NOT logged in
export const PUBLIC_NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.PUBLIC,
    enabled: true,
    order: 1
  },
  {
    id: 'solutions',
    label: 'Solutions',
    path: '/solutions',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.PUBLIC,
    enabled: true,
    order: 2
  },
  {
    id: 'about',
    label: 'About',
    path: '/about',
    type: NAV_ITEM_TYPES.LINK,
    access: NAV_ACCESS_RULES.PUBLIC,
    enabled: true,
    order: 3
  },
  {
    id: 'login',
    label: 'Login',
    path: '/login',
    type: NAV_ITEM_TYPES.BUTTON,
    access: NAV_ACCESS_RULES.PUBLIC,
    enabled: true,
    order: 4,
    style: 'cta'  // Call-to-action button style
  }
]

// ── Style Configuration ────────────────────────────────────────────────────
// SOFT-CODED: CSS classes for different navigation item types and styles
export const NAV_STYLES = {
  link: {
    base: 'text-blue-100 hover:text-amber-300 font-semibold transition-colors',
    active: 'text-amber-300'
  },
  button: {
    primary: 'px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-amber-500/50 transition-all transform hover:scale-105 flex items-center space-x-2',
    cta: 'px-5 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all transform hover:scale-105',
    secondary: 'px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-lg transition-all transform hover:scale-105'
  }
}

// ── Icon SVG Paths ─────────────────────────────────────────────────────────
// SOFT-CODED: SVG path data for inline icons in buttons
export const NAV_ICONS = {
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
}

// ── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get navigation items for authenticated users
 * Filters based on RBAC rules
 * 
 * @param {Object} user - User object from Redux auth state
 * @param {Object} rbacData - RBAC data from Redux rbac state
 * @returns {Array} Filtered and sorted navigation items
 */
export const getAuthenticatedNavItems = (user, rbacData) => {
  // Smart admin check
  const userData = user?.user || user
  const hasAdminFlags = userData?.is_staff || userData?.is_superuser
  const hasSuperAdminRole = user?.roles?.some(role => 
    role.code === 'super_admin' || role.name === 'Super Administrator'
  )
  const isAdmin = hasAdminFlags || hasSuperAdminRole

  // Get user modules
  const userModules = rbacData?.modules?.map(m => m.code) || []

  return AUTHENTICATED_NAV_ITEMS
    .filter(item => {
      if (!item.enabled) return false
      
      // Check admin-only items
      if (item.adminOnly && !isAdmin) return false
      
      // Check module requirements
      if (item.requiresModule && !userModules.includes(item.requiresModule)) {
        return false
      }
      
      // Check role requirements
      if (item.requiresRole && item.requiresRole.length > 0) {
        const userRoles = user?.roles?.map(r => r.code) || []
        const hasRequiredRole = item.requiresRole.some(role => userRoles.includes(role))
        if (!hasRequiredRole && !isAdmin) return false  // Admins bypass role checks
      }
      
      return true
    })
    .sort((a, b) => a.order - b.order)
}

/**
 * Get navigation items for public (unauthenticated) users
 * @returns {Array} Filtered and sorted navigation items
 */
export const getPublicNavItems = () => {
  return PUBLIC_NAV_ITEMS
    .filter(item => item.enabled)
    .sort((a, b) => a.order - b.order)
}

/**
 * Get CSS class for a navigation item
 * @param {Object} item - Navigation item object
 * @param {boolean} isActive - Whether this is the active route
 * @returns {string} CSS class string
 */
export const getNavItemClass = (item, isActive = false) => {
  if (item.type === NAV_ITEM_TYPES.LINK) {
    return isActive 
      ? `${NAV_STYLES.link.base} ${NAV_STYLES.link.active}`
      : NAV_STYLES.link.base
  }
  
  if (item.type === NAV_ITEM_TYPES.BUTTON) {
    return NAV_STYLES.button[item.style] || NAV_STYLES.button.primary
  }
  
  return NAV_STYLES.link.base
}

/**
 * Get icon SVG path for a navigation item
 * @param {string} iconName - Icon identifier
 * @returns {string} SVG path data or null
 */
export const getNavIcon = (iconName) => {
  return NAV_ICONS[iconName] || null
}
