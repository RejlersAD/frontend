/**
 * User Management Configuration
 * Centralized configuration for user creation, validation, and management
 * Soft-coded for easy updates without touching component code
 */

export const USER_MANAGEMENT_CONFIG = {
  // 🔧 VALIDATION CONTROL FLAGS - Easy Enable/Disable
  validationFlags: {
    enableEmailValidation: false,        // ⚠️ Temporarily disabled - set true to re-enable
    enablePasswordStrengthCheck: false,  // ⚠️ Temporarily disabled for testing
    enablePhoneValidation: false,        // Phone is optional
    requireRoles: false,                 // Don't require roles selection
    requireModules: false,               // Don't require modules selection
    strictMode: false                    // Lenient validation
  },

  // Email Validation Configuration
  email: {
    // Email format validation regex
    formatRegex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    
    // Allowed email domains (empty array = all domains allowed)
    allowedDomains: [
      // 'radai.ae',
      // 'rejlers.ae',
      // Add specific domains here if needed, or leave empty to allow all
    ],
    
    // Blocked email providers (disposable/temporary email services)
    blockedProviders: [
      'tempmail.com',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email'
    ],
    
    // Email validation messages
    messages: {
      required: 'Email is required',
      invalid: 'Please enter a valid email address',
      exists: 'A user with this email already exists',
      blocked: 'This email provider is not allowed',
      domainNotAllowed: 'Email domain is not allowed'
    }
  },

  // Password Configuration
  password: {
    minLength: 8,
    maxLength: 128,
    
    // Password strength requirements
    requirements: {
      minUppercase: 1,
      minLowercase: 1,
      minNumbers: 1,
      minSpecialChars: 1,
      allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    },
    
    // Password validation messages
    messages: {
      required: 'Password is required',
      tooShort: `Password must be at least 8 characters long`,
      tooWeak: 'Password must contain uppercase, lowercase, number, and special character',
      mismatch: 'Passwords do not match'
    }
  },

  // Name Validation
  name: {
    minLength: 2,
    maxLength: 50,
    // Allow letters, spaces, hyphens, and apostrophes
    regex: /^[a-zA-Z\s'-]+$/,
    
    messages: {
      firstNameRequired: 'First name is required',
      lastNameRequired: 'Last name is required',
      invalid: 'Name can only contain letters, spaces, hyphens, and apostrophes',
      tooShort: 'Name must be at least 2 characters long',
      tooLong: 'Name cannot exceed 50 characters'
    }
  },

  // Phone Validation
  phone: {
    // International phone format
    regex: /^\+?[1-9]\d{1,14}$/,
    
    messages: {
      invalid: 'Please enter a valid phone number (e.g., +971501234567)',
      required: 'Phone number is required'
    }
  },

  // Organization and Role Requirements
  requirements: {
    organizationRequired: false,
    roleRequired: true,
    moduleRequired: false,
    departmentRequired: false,
    jobTitleRequired: false
  },

  // Form Field Validation Messages
  validationMessages: {
    requiredField: 'This field is required',
    invalidFormat: 'Invalid format',
    minLength: (min) => `Minimum ${min} characters required`,
    maxLength: (max) => `Maximum ${max} characters allowed`
  },

  // Backend Error Messages Mapping
  backendErrorMapping: {
    'email': 'Email validation failed',
    'password': 'Password does not meet requirements',
    'user': 'User creation failed',
    'role_ids': 'Invalid role selection',
    'module_ids': 'Invalid module selection',
    'organization_id': 'Invalid organization',
    'default': 'Failed to create user. Please check all fields and try again.'
  },

  // Success Messages
  successMessages: {
    userCreated: '✓ User created successfully!',
    userUpdated: '✓ User updated successfully!',
    userDeleted: '✓ User deleted successfully!',
    userActivated: '✓ User activated successfully!',
    userDeactivated: '✓ User deactivated successfully!',
    passwordReset: '✓ Password reset link sent successfully!',
    roleAssigned: '✓ Role assigned successfully!',
    moduleAssigned: '✓ Modules assigned successfully!'
  },

  // Default Values
  defaults: {
    status: 'active',
    is_mfa_enabled: false,
    organization_id: null,
    department: null,
    job_title: null,
    phone: null
  }
}

/**
 * Validate email format and domain
 */
export const validateEmail = (email) => {
  const flags = USER_MANAGEMENT_CONFIG.validationFlags;

  // Basic check - email must exist
  if (!email || email.trim() === '') {
    return { valid: false, message: USER_MANAGEMENT_CONFIG.email.messages.required }
  }

  // If email validation is disabled, just check it's not empty
  if (!flags.enableEmailValidation) {
    return { valid: true, message: '' }
  }

  // Format validation
  if (!USER_MANAGEMENT_CONFIG.email.formatRegex.test(email)) {
    return { valid: false, message: USER_MANAGEMENT_CONFIG.email.messages.invalid }
  }

  // Extract domain
  const domain = email.split('@')[1].toLowerCase()

  // Check blocked providers
  if (USER_MANAGEMENT_CONFIG.email.blockedProviders.includes(domain)) {
    return { valid: false, message: USER_MANAGEMENT_CONFIG.email.messages.blocked }
  }

  // Check allowed domains (if configured)
  if (USER_MANAGEMENT_CONFIG.email.allowedDomains.length > 0) {
    if (!USER_MANAGEMENT_CONFIG.email.allowedDomains.includes(domain)) {
      return { valid: false, message: USER_MANAGEMENT_CONFIG.email.messages.domainNotAllowed }
    }
  }

  return { valid: true, message: '' }
}

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  const config = USER_MANAGEMENT_CONFIG.password
  const flags = USER_MANAGEMENT_CONFIG.validationFlags

  if (!password || password.trim() === '') {
    return { valid: false, message: config.messages.required }
  }

  // If password strength check is disabled, only validate minimum length
  if (!flags.enablePasswordStrengthCheck) {
    if (password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' }
    }
    return { valid: true, message: '' }
  }

  if (password.length < config.minLength) {
    return { valid: false, message: config.messages.tooShort }
  }

  if (password.length > config.maxLength) {
    return { valid: false, message: `Password cannot exceed ${config.maxLength} characters` }
  }

  // Check strength requirements
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = new RegExp(`[${config.requirements.allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar) {
    return { valid: false, message: config.messages.tooWeak }
  }

  return { valid: true, message: '' }
}

/**
 * Validate name
 */
export const validateName = (name, fieldName = 'Name') => {
  const config = USER_MANAGEMENT_CONFIG.name

  if (!name || name.trim() === '') {
    return { valid: false, message: `${fieldName} is required` }
  }

  if (name.length < config.minLength) {
    return { valid: false, message: config.messages.tooShort }
  }

  if (name.length > config.maxLength) {
    return { valid: false, message: config.messages.tooLong }
  }

  if (!config.regex.test(name)) {
    return { valid: false, message: config.messages.invalid }
  }

  return { valid: true, message: '' }
}

/**
 * Validate phone number
 */
export const validatePhone = (phone) => {
  const config = USER_MANAGEMENT_CONFIG.phone
  const flags = USER_MANAGEMENT_CONFIG.validationFlags

  if (!phone || phone.trim() === '') {
    // Phone is optional
    return { valid: true, message: '' }
  }

  // If phone validation is disabled, accept any non-empty value
  if (!flags.enablePhoneValidation) {
    return { valid: true, message: '' }
  }

  if (!config.regex.test(phone)) {
    return { valid: false, message: config.messages.invalid }
  }

  return { valid: true, message: '' }
}

/**
 * Validate complete user form
 */
export const validateUserForm = (formData) => {
  const errors = {}
  const flags = USER_MANAGEMENT_CONFIG.validationFlags

  // Email validation (always required - but with flexible checking)
  const emailValidation = validateEmail(formData.email)
  if (!emailValidation.valid) {
    errors.email = emailValidation.message
  }

  // Password validation (only for new users)
  if (!formData.id) {
    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.message
    }

    // Confirm password (always check if passwords are provided)
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = USER_MANAGEMENT_CONFIG.password.messages.mismatch
    }
  }

  // First name validation
  const firstNameValidation = validateName(formData.first_name, 'First name')
  if (!firstNameValidation.valid) {
    errors.first_name = firstNameValidation.message
  }

  // Last name validation
  const lastNameValidation = validateName(formData.last_name, 'Last name')
  if (!lastNameValidation.valid) {
    errors.last_name = lastNameValidation.message
  }

  // Phone validation (only if enabled)
  if (flags.enablePhoneValidation && formData.phone) {
    const phoneValidation = validatePhone(formData.phone)
    if (!phoneValidation.valid) {
      errors.phone = phoneValidation.message
    }
  }

  // Role/Module validation (only if flags require them)
  if (flags.requireRoles && flags.requireModules) {
    // Strict mode: require BOTH roles and modules
    if (!formData.role_ids || formData.role_ids.length === 0) {
      errors.role_ids = 'Please select at least one role'
    }
    if (!formData.module_ids || formData.module_ids.length === 0) {
      errors.module_ids = 'Please select at least one module'
    }
  } else if (flags.requireRoles || flags.requireModules) {
    // Flexible mode: require at least one
    const hasRoles = formData.role_ids && formData.role_ids.length > 0
    const hasModules = formData.module_ids && formData.module_ids.length > 0
    
    if (!hasRoles && !hasModules) {
      errors.access = 'Please select at least one role or module'
    }
  }
  // If both flags are false, roles and modules are optional

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Parse backend error response
 */
export const parseBackendError = (error) => {
  if (!error.response || !error.response.data) {
    return USER_MANAGEMENT_CONFIG.backendErrorMapping.default
  }

  const data = error.response.data

  // If there's a detail message, use it
  if (data.detail) {
    return data.detail
  }

  // If there's a message field, use it
  if (data.message) {
    return data.message
  }

  // Check for field-specific errors
  if (typeof data === 'object') {
    const fieldErrors = []
    
    for (const [field, messages] of Object.entries(data)) {
      if (Array.isArray(messages)) {
        const fieldName = USER_MANAGEMENT_CONFIG.backendErrorMapping[field] || field
        fieldErrors.push(`${fieldName}: ${messages.join(', ')}`)
      } else if (typeof messages === 'string') {
        fieldErrors.push(messages)
      }
    }

    if (fieldErrors.length > 0) {
      return fieldErrors.join('; ')
    }
  }

  return USER_MANAGEMENT_CONFIG.backendErrorMapping.default
}

/**
 * Prepare user payload for backend
 */
export const prepareUserPayload = (formData) => {
  return {
    email: formData.email?.trim().toLowerCase(),
    first_name: formData.first_name?.trim(),
    last_name: formData.last_name?.trim(),
    password: formData.password,
    organization_id: formData.organization_id || null,
    department: formData.department?.trim() || null,
    job_title: formData.job_title?.trim() || null,
    phone: formData.phone?.trim() || null,
    role_ids: formData.role_ids || [],
    module_ids: formData.module_ids || []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE DISPLAY CONFIG (soft-coded)
// Maps role.code → label, badge color (Tailwind), and description.
// Synced with backend SYSTEM_ROLES_CONFIG in rbac_config.py.
// Add/edit entries here to change how roles appear in the UI — no JSX changes needed.
// ─────────────────────────────────────────────────────────────────────────────
export const ROLE_DISPLAY_CONFIG = {
  super_admin: {
    label: 'Super Administrator',
    shortLabel: 'Super Admin',
    badge: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
    description: 'Full platform access. Bypasses all module checks.',
    discipline: 'Platform',
  },
  admin: {
    label: 'Administrator',
    shortLabel: 'Admin',
    badge: 'bg-orange-100 text-orange-800',
    dot: 'bg-orange-500',
    description: 'Manages users, roles, modules, and org settings.',
    discipline: 'Platform',
  },
  process_engineer: {
    label: 'Process Engineer',
    shortLabel: 'Process',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    description: 'Process datasheets, P&ID analysis, PFD tools.',
    discipline: 'Process',
  },
  electrical_engineer: {
    label: 'Electrical Engineer',
    shortLabel: 'Electrical',
    badge: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-500',
    description: 'Electrical datasheets and SLD analysis.',
    discipline: 'Electrical',
  },
  instrument_engineer: {
    label: 'Instrument Engineer',
    shortLabel: 'Instrument',
    badge: 'bg-purple-100 text-purple-800',
    dot: 'bg-purple-500',
    description: 'Instrument datasheets and instrument index.',
    discipline: 'Instrument',
  },
  mechanical_engineer: {
    label: 'Mechanical Engineer',
    shortLabel: 'Mechanical',
    badge: 'bg-gray-100 text-gray-800',
    dot: 'bg-gray-500',
    description: 'Mechanical equipment datasheets.',
    discipline: 'Mechanical',
  },
  civil_engineer: {
    label: 'Civil Engineer',
    shortLabel: 'Civil',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    description: 'Civil and structural engineering datasheets.',
    discipline: 'Civil',
  },
  piping_engineer: {
    label: 'Piping Engineer',
    shortLabel: 'Piping',
    badge: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-500',
    description: 'Piping datasheets and material specifications.',
    discipline: 'Piping',
  },
  qhse_engineer: {
    label: 'QHSE Engineer',
    shortLabel: 'QHSE',
    badge: 'bg-teal-100 text-teal-800',
    dot: 'bg-teal-500',
    description: 'Quality, Health, Safety and Environment.',
    discipline: 'QHSE',
  },
  design_engineer: {
    label: 'Design Engineer',
    shortLabel: 'Design',
    badge: 'bg-cyan-100 text-cyan-800',
    dot: 'bg-cyan-500',
    description: 'DesignIQ, PFD to P&ID, and P&ID analysis.',
    discipline: 'Design',
  },
  project_manager: {
    label: 'Project Manager',
    shortLabel: 'PM',
    badge: 'bg-pink-100 text-pink-800',
    dot: 'bg-pink-500',
    description: 'Cross-discipline read access and reporting.',
    discipline: 'Management',
  },
  viewer: {
    label: 'Viewer',
    shortLabel: 'Viewer',
    badge: 'bg-slate-100 text-slate-800',
    dot: 'bg-slate-400',
    description: 'Read-only access. No modules unless explicitly assigned.',
    discipline: 'General',
  },
  // Fallback for unknown / legacy roles
  _default: {
    label: 'User',
    shortLabel: 'User',
    badge: 'bg-gray-100 text-gray-600',
    dot: 'bg-gray-400',
    description: 'Custom role.',
    discipline: 'General',
  },
}

/**
 * Get display config for a role by its code.
 * Falls back to `_default` for unknown role codes.
 * @param {string} roleCode  e.g. "process_engineer"
 */
export const getRoleDisplay = (roleCode) =>
  ROLE_DISPLAY_CONFIG[roleCode] ?? ROLE_DISPLAY_CONFIG._default

/**
 * Discipline-grouping order for the Create User roles picker.
 * Roles are shown grouped by discipline in this order.
 */
export const ROLE_DISCIPLINE_ORDER = [
  'Platform',
  'Process',
  'Electrical',
  'Instrument',
  'Mechanical',
  'Civil',
  'Piping',
  'QHSE',
  'Design',
  'Management',
  'General',
]

/**
 * OPERATIONAL ADMINS
 * Users with full user management capabilities (view, edit, deactivate, reset password, delete)
 * These users manage day-to-day operations and user access control
 * 
 * SOFT-CODED: Add/remove operational admin emails here without modifying core logic
 * 
 * Operational admins have the same user management permissions as super admins, including:
 * - View user details
 * - Edit user information and roles
 * - Deactivate/Activate users
 * - Reset passwords to default
 * - Delete users (soft delete)
 */
export const OPERATIONAL_ADMINS = [
  'radai@rejlers.ae',           // RADAI Operational Admin - Full user management
  'mohammed.agra@rejlers.ae',   // System Administrator
  // Add more operational admin emails here as needed
  // Example: 'admin@rejlers.ae',
]

/**
 * USER MANAGEMENT ACTION PERMISSIONS
 * Soft-coded configuration for user management actions visibility
 */
export const USER_ACTION_PERMISSIONS = {
  view: {
    enabled: true,
    label: 'View Details',
    requiredPermission: 'all', // Available to all admins
  },
  edit: {
    enabled: true,
    label: 'Edit User',
    requiredPermission: 'all', // Available to all admins
  },
  deactivate: {
    enabled: true,
    label: 'Deactivate / Activate',
    requiredPermission: 'operational_admin', // Requires operational admin or super admin
  },
  resetPassword: {
    enabled: true,
    label: 'Reset Password to Default',
    requiredPermission: 'operational_admin', // Requires operational admin or super admin
    defaultPassword: 'Rejlers@123',
  },
  delete: {
    enabled: true,
    label: 'Delete User',
    requiredPermission: 'operational_admin', // Requires operational admin or super admin
  },
}

/**
 * Helper: Check if user is an operational admin
 * @param {string} email - User's email address
 * @returns {boolean} True if user is in OPERATIONAL_ADMINS list
 */
export function isOperationalAdmin(email) {
  if (!email) return false
  return OPERATIONAL_ADMINS.includes(email.toLowerCase())
}

/**
 * Helper: Check if user has permission for specific action
 * Used in UserManagement.jsx to show/hide action buttons
 * 
 * @param {string} email - User's email address
 * @param {boolean} isSuperAdmin - Whether user is a super admin
 * @param {string} actionType - Type of action (view, edit, deactivate, resetPassword, delete)
 * @returns {boolean} True if user has permission for the action
 */
export function hasActionPermission(email, isSuperAdmin, actionType) {
  const action = USER_ACTION_PERMISSIONS[actionType]
  if (!action || !action.enabled) return false

  // Super admins have all permissions
  if (isSuperAdmin) return true

  // Check if action requires operational admin permission
  if (action.requiredPermission === 'operational_admin') {
    return isOperationalAdmin(email)
  }

  // Actions with 'all' permission are available to all admins
  if (action.requiredPermission === 'all') {
    return true
  }

  return false
}

/**
 * Helper: Check if user can perform enhanced user management actions
 * @param {string} email - User's email address
 * @param {boolean} isSuperAdmin - Whether user is a super admin
 * @returns {boolean} True if user can deactivate, delete, and reset passwords
 */
export function canPerformEnhancedActions(email, isSuperAdmin) {
  return isSuperAdmin || isOperationalAdmin(email)
}

export default USER_MANAGEMENT_CONFIG
