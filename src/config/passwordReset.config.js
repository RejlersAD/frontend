/**
 * Password Reset Configuration
 * Centralized configuration for password reset functionality
 * Soft-coded approach for easy maintenance and scalability
 */

/**
 * ─── Fallback Mode (Enquiry-based reset) ────────────────────────────────
 * When SMTP is unavailable, password reset requests are routed through the
 * public /enquiry/submit/ endpoint (persisted in the Enquiry table) so that
 * an administrator can review and manually reset the user's password from
 * the 9.6 Enquiry admin page.
 *
 * Flip USE_ENQUIRY_FALLBACK back to false once SMTP is configured; the
 * original email-based flow will be restored without any code changes.
 */
export const PASSWORD_RESET_FALLBACK = {
  USE_ENQUIRY_FALLBACK: true,           // set to false once SMTP is live
  enquiryEndpoint: '/enquiry/submit/',  // reuses existing public endpoint
  serviceCode: 'password-reset',        // tags enquiry as password-reset
  subject: 'Password Reset Request',
  urgency: 'high',                      // reset requests are usually urgent

  // Admin contact info shown on the request page so the user has a
  // fallback channel while waiting for the administrator to action their
  // request. Update centrally when the admin contact changes.
  adminContact: {
    name:  'System Administrator',
    email: 'tanzeem.agra@rejlers.ae',
    phone: '+971 50 560 6987',
    slaHours: 24,   // expected response time
  },

  // Steps shown in the "How it works" timeline. Reorder / extend freely.
  workflowSteps: [
    { icon: '✍️',  title: 'You submit',      body: 'Enter your registered email and (optionally) a reason.' },
    { icon: '🔔',  title: 'Admin alerted',   body: 'System notifies every administrator in real-time.' },
    { icon: '🛡️',  title: 'Identity check',  body: 'Admin verifies you and resets the password securely.' },
    { icon: '📞',  title: 'You get contacted', body: 'You receive a temporary password to change on first login.' },
  ],

  // Trust badges shown at the bottom of the hero column
  trustBadges: [
    { icon: '🔒', label: 'End-to-end encrypted' },
    { icon: '⚡', label: 'Fast admin response' },
    { icon: '🛡️', label: 'Zero self-serve resets' },
  ],

  messageTemplate: ({ email, reason }) =>
    `A user has requested a password reset via /forgot-password.

User email: ${email}
Reason: ${reason || '(not provided)'}

Please verify the user's identity and reset their password via User Management (/admin/users). After reset, share the temporary password securely and require change on first login.`,
}

/**
 * API Endpoints Configuration
 */
export const PASSWORD_RESET_API = {
  requestReset: '/users/request-password-reset/',
  verifyToken: '/users/verify-reset-token/',
  resetPassword: '/users/reset-password/',
  changePassword: '/users/change-password/',
  checkExpiry: '/users/check-password-expiry/',
}

/**
 * Password Expiry Configuration
 */
export const PASSWORD_EXPIRY_CONFIG = {
  policyDays: 30,
  warningDays: 3,
  graceDays: 3,
  checkInterval: 3600000, // Check every hour (in milliseconds)
}

/**
 * UI Configuration
 */
export const PASSWORD_RESET_UI = {
  page: {
    title: 'Reset Password',
    description: 'Enter your email address and we\'ll send you a link to reset your password.',
  },
  form: {
    emailLabel: 'Email Address',
    emailPlaceholder: 'your.email@example.com',
    submitButton: {
      idle: 'Send Reset Link',
      loading: 'Sending...',
    },
  },
  success: {
    title: 'Check Your Email',
    description: (email) => `If an account exists with ${email}, you will receive a password reset link shortly.`,
    tips: {
      title: "Didn't receive the email?",
      content: 'Check your spam folder or request a new link in a few minutes.',
    },
    backButton: 'Back to Login',
  },
  errors: {
    emptyEmail: 'Please enter your email address',
    invalidEmail: 'Please enter a valid email address',
    serverError: 'Failed to process password reset request. Please try again.',
  },
  links: {
    login: {
      text: 'Remember your password?',
      linkText: 'Login here',
      url: '/login',
    },
  },
}

/**
 * Styling Configuration (using Rejlers colors)
 */
export const PASSWORD_RESET_STYLES = {
  background: {
    light: 'from-blue-50 via-white to-purple-50',
    dark: 'from-gray-900 via-gray-800 to-gray-900',
  },
  container: {
    light: 'bg-white',
    dark: 'bg-gray-800',
  },
  primary: {
    button: {
      idle: 'bg-blue-600 hover:bg-blue-700',
      loading: 'bg-gray-400 cursor-not-allowed',
    },
    text: 'text-blue-600 hover:text-blue-700',
  },
  success: {
    icon: 'bg-green-100 text-green-600',
    tip: {
      light: 'bg-blue-50 border-blue-200 text-blue-800',
      dark: 'bg-blue-900/30 border-blue-700 text-blue-300',
    },
  },
  error: {
    background: {
      light: 'bg-red-50 border-red-200',
      dark: 'bg-red-900/30 border-red-700',
    },
    icon: 'text-red-600',
    text: {
      light: 'text-red-800',
      dark: 'text-red-300',
    },
  },
}

/**
 * Validation Configuration
 */
export const PASSWORD_RESET_VALIDATION = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
}

/**
 * Security Configuration
 */
export const PASSWORD_RESET_SECURITY = {
  // Always show success message for security (don't reveal if user exists)
  alwaysShowSuccess: true,
  // Token expiry hours (should match backend)
  tokenExpiryHours: 24,
}

/**
 * Helper Functions
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: PASSWORD_RESET_UI.errors.emptyEmail }
  }
  
  if (!PASSWORD_RESET_VALIDATION.email.pattern.test(email)) {
    return { isValid: false, error: PASSWORD_RESET_UI.errors.invalidEmail }
  }
  
  return { isValid: true, error: null }
}

export const buildRequestPayload = (email) => {
  return {
    email: email.trim(),
  }
}

/**
 * Create axios config for unauthenticated requests
 * This ensures no Authorization header is sent for public endpoints
 */
export const getPublicRequestConfig = () => {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
    // Don't include credentials for password reset
    withCredentials: false,
  }
}

/**
 * ================================================================
 * ADMIN RESET CONFIRM MODAL — soft-coded copy & behaviour
 * Replaces native window.confirm() — no browser dialog popups.
 * ================================================================
 */
export const RESET_CONFIRM_MODAL_CONFIG = {
  title:          'Reset User Password',
  bodyLine1:      'The password for this account will be reset to the default password below.',
  bodyLine2:      'The user will be required to change it on next login.',
  defaultPwLabel: 'New Default Password',
  userLabel:      'User',
  confirmBtn:     'Reset Password',
  cancelBtn:      'Cancel',
  successMsg:     'Password reset successfully.',
  errorMsg:       'Failed to reset password. Please try again.',
  // icon keys must match HeroIcons outline names
  icon:           'KeyIcon',
  iconBg:         'bg-orange-100',
  iconColor:      'text-orange-600',
}

/**
 * ================================================================
 * ADMIN PASSWORD RESET CONFIGURATION
 * ================================================================
 */

export const ADMIN_PASSWORD_RESET_CONFIG = {
  // Default password for reset
  DEFAULT_PASSWORD: 'Rejlers@123',
  
  // Password requirements (for display)
  REQUIREMENTS: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
  },
  
  // UI Configuration
  UI: {
    confirmationMessage: 'Are you sure you want to reset this user\'s password?',
    warningMessage: 'The password will be reset to the default password. The user should change it on first login.',
    successMessage: 'Password reset successfully. Default password: Rejlers@123',
    errorMessage: 'Failed to reset password',
    buttonLabel: 'Reset Password',
    buttonIcon: '🔑',
    tooltipText: 'Reset user password to default',
  },
  
  // Security Settings
  SECURITY: {
    requireAdminConfirmation: true,
    logPasswordReset: true,
    forcePasswordChangeOnNextLogin: true,
  },
  
  // API Endpoint
  API: {
    resetPasswordEndpoint: (userId) => `/api/v1/rbac/users/${userId}/reset-password/`,
    method: 'POST',
  },
};

/**
 * Get password requirements as display text
 */
export const getPasswordRequirementsText = () => {
  const req = ADMIN_PASSWORD_RESET_CONFIG.REQUIREMENTS;
  return `
• Minimum ${req.minLength} characters
${req.requireUppercase ? '• At least one uppercase letter' : ''}
${req.requireLowercase ? '• At least one lowercase letter' : ''}
${req.requireNumbers ? '• At least one number' : ''}
${req.requireSpecialChars ? `• At least one special character (${req.specialChars})` : ''}
  `.trim();
};

/**
 * @deprecated Use RESET_CONFIRM_MODAL_CONFIG + a React modal instead.
 * Kept for backward-compatibility only. Always returns true (no popup).
 */
export const confirmAdminPasswordReset = (_userEmail) => true;
