/**
 * User Display Configuration
 * Centralized configuration for user data display fallbacks and formatting
 */

export const USER_DISPLAY_CONFIG = {
  // Fallback values when user data is not available
  fallbacks: {
    firstName: 'Guest',
    lastName: 'User',
    email: 'guest@radai.ae',
    fullName: 'Guest User',
    initial: 'G',
    role: 'USER',
    profilePhoto: null,
  },

  // Display formatting
  formatting: {
    // Extract username from email (part before @)
    getUsernameFromEmail: (email) => {
      if (!email) return USER_DISPLAY_CONFIG.fallbacks.firstName
      return email.split('@')[0].replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    },

    // Get user initials for avatar
    getUserInitials: (user) => {
      if (!user) return USER_DISPLAY_CONFIG.fallbacks.initial

      // Handle nested user object from API response
      const userData = user.user || user

      // Priority: first_name, last_name, email
      if (userData.first_name) {
        const lastName = userData.last_name || ''
        return `${userData.first_name[0]}${lastName[0] || ''}`.toUpperCase()
      }

      if (userData.email) {
        return userData.email[0].toUpperCase()
      }

      return USER_DISPLAY_CONFIG.fallbacks.initial
    },

    // Get display name
    getDisplayName: (user) => {
      if (!user) return USER_DISPLAY_CONFIG.fallbacks.fullName

      // Handle nested user object from API response
      const userData = user.user || user

      // Priority: first_name, username from email, fallback
      if (userData.first_name) {
        return userData.last_name ? `${userData.first_name} ${userData.last_name}` : userData.first_name
      }

      if (userData.email) {
        return USER_DISPLAY_CONFIG.formatting.getUsernameFromEmail(userData.email)
      }

      return USER_DISPLAY_CONFIG.fallbacks.fullName
    },

    // Get email display
    getEmailDisplay: (user) => {
      if (!user) return USER_DISPLAY_CONFIG.fallbacks.email
      
      // Handle nested user object from API response
      const userData = user.user || user
      
      return userData.email || USER_DISPLAY_CONFIG.fallbacks.email
    },

    // Get role display
    getRoleDisplay: (user) => {
      if (!user) return USER_DISPLAY_CONFIG.fallbacks.role

      // Handle nested user object from API response
      const userData = user.user || user

      // Check roles array from RBAC profile first (most accurate)
      if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
        // Check for Super Administrator role
        const superAdminRole = user.roles.find(role => 
          role.code === 'super_admin' || role.name === 'Super Administrator'
        )
        if (superAdminRole) return 'SUPER ADMINISTRATOR'
        
        // Return first role name
        return user.roles[0].name.toUpperCase()
      }

      // Check admin status from Django User flags
      if (userData.is_superuser) return 'SUPER ADMIN'
      if (userData.is_staff) return 'ADMIN'
      
      // Check legacy role field
      if (user.role) {
        return user.role.toUpperCase()
      }

      return USER_DISPLAY_CONFIG.fallbacks.role
    },
  },

  // Avatar styling
  avatar: {
    sizes: {
      xs: 'w-6 h-6',
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    },
    gradients: {
      default: 'from-blue-500 to-indigo-600',
      admin: 'from-amber-500 to-orange-600',
      superadmin: 'from-purple-500 to-pink-600',
      guest: 'from-gray-400 to-gray-500',
    },
    getGradient: (user) => {
      if (!user) return USER_DISPLAY_CONFIG.avatar.gradients.guest
      if (user.is_superuser) return USER_DISPLAY_CONFIG.avatar.gradients.superadmin
      if (user.is_staff) return USER_DISPLAY_CONFIG.avatar.gradients.admin
      return USER_DISPLAY_CONFIG.avatar.gradients.default
    },
  },

  // Role badge styling
  roleBadge: {
    colors: {
      'SUPER ADMINISTRATOR': 'from-purple-500 to-pink-600',
      SUPERADMIN: 'from-purple-500 to-pink-600',
      ADMIN: 'from-amber-400 to-orange-500',
      USER: 'from-blue-400 to-indigo-500',
      GUEST: 'from-gray-400 to-gray-500',
    },
    getColor: (role) => {
      return USER_DISPLAY_CONFIG.roleBadge.colors[role] || USER_DISPLAY_CONFIG.roleBadge.colors.USER
    },
  },

  // Loading states
  loading: {
    displayName: 'Loading...',
    email: 'Loading...',
    initial: '...',
  },

  // Error states
  error: {
    displayName: 'Error Loading User',
    email: 'Error',
    initial: '!',
  },
}

export default USER_DISPLAY_CONFIG
