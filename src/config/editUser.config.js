/**
 * Edit User Configuration
 * Centralized soft-coded configuration for editing user details
 * Easy to maintain and extend with new features
 */

export const EDIT_USER_CONFIG = {
  // Modal Configuration
  modal: {
    title: 'Edit User',
    maxWidth: 'max-w-4xl',
    maxHeight: 'max-h-[90vh]',
    closeOnOverlayClick: false
  },

  // Form Sections Configuration
  sections: [
    {
      id: 'basic_info',
      title: 'Basic Information',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      description: 'User\'s personal details',
      fields: [
        {
          name: 'first_name',
          label: 'First Name',
          type: 'text',
          placeholder: 'Enter first name',
          required: true,
          gridCols: 'md:col-span-1',
          validation: {
            minLength: 2,
            maxLength: 50,
            pattern: /^[a-zA-Z\s'-]+$/,
            message: 'First name should contain only letters'
          }
        },
        {
          name: 'last_name',
          label: 'Last Name',
          type: 'text',
          placeholder: 'Enter last name',
          required: true,
          gridCols: 'md:col-span-1',
          validation: {
            minLength: 2,
            maxLength: 50,
            pattern: /^[a-zA-Z\s'-]+$/,
            message: 'Last name should contain only letters'
          }
        },
        {
          name: 'email',
          label: 'Email Address',
          type: 'email',
          placeholder: 'user@example.com',
          required: true,
          gridCols: 'md:col-span-2',
          disabled: true,
          helpText: 'Email cannot be changed for security reasons',
          validation: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address'
          }
        }
      ]
    },
    {
      id: 'organization_info',
      title: 'Organization Details',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      description: 'Company and department information',
      fields: [
        {
          name: 'organization_id',
          label: 'Organization',
          type: 'select',
          placeholder: 'Select Organization',
          required: false,
          gridCols: 'md:col-span-1',
          options: [] // Populated dynamically
        },
        {
          name: 'department',
          label: 'Department',
          type: 'select',
          placeholder: 'Select Department',
          required: false,
          gridCols: 'md:col-span-1',
          helpText: 'User\'s department (from database)',
          options: [] // Populated dynamically from departments API
        },
        {
          name: 'job_title',
          label: 'Job Title',
          type: 'select',
          placeholder: 'Select Job Title',
          required: false,
          gridCols: 'md:col-span-1',
          helpText: 'User\'s job title (from database)',
          options: [] // Populated dynamically from job titles API
        },
        {
          name: 'phone',
          label: 'Phone Number',
          type: 'tel',
          placeholder: '+971 XX XXX XXXX',
          required: false,
          gridCols: 'md:col-span-1',
          validation: {
            pattern: /^[+]?[\d\s()-]+$/,
            message: 'Please enter a valid phone number'
          }
        }
      ]
    },
    {
      id: 'system_info',
      title: 'System Information',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      description: 'Account settings and status',
      readOnly: true,
      fields: [
        {
          name: 'status',
          label: 'Account Status',
          type: 'badge',
          gridCols: 'md:col-span-1'
        },
        {
          name: 'date_joined',
          label: 'Member Since',
          type: 'date-display',
          gridCols: 'md:col-span-1'
        },
        {
          name: 'last_login',
          label: 'Last Login',
          type: 'date-display',
          gridCols: 'md:col-span-1'
        },
        {
          name: 'login_count',
          label: 'Total Logins',
          type: 'number-display',
          gridCols: 'md:col-span-1'
        }
      ]
    },
    {
      id: 'module_access',
      title: 'Feature Access & Permissions',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      description: 'Manage user access to features and modules',
      collapsible: false,
      fields: [
        {
          name: 'module_ids',
          label: 'Accessible Modules',
          type: 'checkbox-group',
          required: false,
          gridCols: 'md:col-span-2',
          helpText: 'Select all modules/features the user can access',
          showSearch: true,
          showSelectAll: true,
          showCategoryGroups: true,
          options: [] // Populated dynamically
        }
      ]
    },
    {
      id: 'role_assignment',
      title: 'Role Assignment',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      description: 'Assign user roles for access control',
      fields: [
        {
          name: 'role_ids',
          label: 'User Roles',
          type: 'role-selector',
          required: false,
          gridCols: 'md:col-span-2',
          helpText: 'Assign one or more roles to define user permissions',
          options: [] // Populated dynamically
        }
      ]
    },
    {
      id: 'additional_features',
      title: 'Additional Features',
      icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
      description: 'Extended features and capabilities',
      collapsible: true,
      collapsed: true,
      fields: [
        {
          name: 'is_superuser',
          label: 'Superuser Access',
          type: 'toggle',
          gridCols: 'md:col-span-1',
          helpText: 'Grant full system access (use with caution)',
          requireConfirmation: true,
          confirmMessage: 'Are you sure you want to grant superuser access?'
        },
        {
          name: 'is_staff',
          label: 'Staff Status',
          type: 'toggle',
          gridCols: 'md:col-span-1',
          helpText: 'Allow access to admin panel'
        },
        {
          name: 'can_create_users',
          label: 'Can Create Users',
          type: 'toggle',
          gridCols: 'md:col-span-1',
          helpText: 'Permission to create new user accounts'
        },
        {
          name: 'can_delete_users',
          label: 'Can Delete Users',
          type: 'toggle',
          gridCols: 'md:col-span-1',
          helpText: 'Permission to delete user accounts'
        }
      ]
    }
  ],

  // Status Badge Colors
  statusColors: {
    active: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200'
    },
    inactive: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200'
    },
    suspended: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200'
    },
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200'
    }
  },

  // Button Configuration
  buttons: {
    cancel: {
      label: 'Cancel',
      className: 'px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'
    },
    save: {
      label: 'Save Changes',
      loadingLabel: 'Saving...',
      className: 'px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl',
      icon: 'M5 13l4 4L19 7'
    },
    reset: {
      label: 'Reset',
      className: 'px-6 py-2.5 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors font-medium',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
    }
  },

  // Validation Messages
  validationMessages: {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid phone number',
    minLength: (min) => `Must be at least ${min} characters`,
    maxLength: (max) => `Must be no more than ${max} characters`,
    pattern: 'Invalid format',
    custom: (message) => message
  },

  // Module Display Configuration
  moduleDisplay: {
    showDescription: true,
    showIcon: true,
    layout: 'grid', // 'grid' or 'list'
    gridColumns: 2,
    selectAllButton: true,
    clearAllButton: true,
    searchable: true,
    groupByCategory: true
  },

  // Role Display Configuration
  roleDisplay: {
    showPermissionCount: true,
    showDescription: true,
    layout: 'cards', // 'cards' or 'list'
    maxSelectable: null, // null = unlimited
    highlightAdmin: true,
    highlightColor: 'border-purple-500 bg-purple-50'
  },

  // Success/Error Messages
  messages: {
    success: {
      update: 'User updated successfully!',
      roleAssigned: 'Roles assigned successfully!',
      moduleAssigned: 'Module access updated successfully!'
    },
    error: {
      update: 'Failed to update user. Please try again.',
      validation: 'Please fix the validation errors before saving.',
      network: 'Network error. Please check your connection.',
      permission: 'You don\'t have permission to perform this action.'
    },
    confirmation: {
      save: 'Are you sure you want to save these changes?',
      superuser: 'Granting superuser access gives full system control. Continue?',
      removeModule: 'Removing this module will revoke user access. Continue?'
    }
  },

  // UI Behavior
  behavior: {
    autoSave: false,
    confirmBeforeSave: false,
    showUnsavedWarning: true,
    closeOnSuccess: true,
    refreshOnSave: true,
    scrollToError: true,
    highlightChanges: true
  },

  // Animation Configuration
  animation: {
    modalEntry: 'ease-out duration-300',
    modalExit: 'ease-in duration-200',
    fieldFocus: 'ring-2 ring-blue-500',
    saveButton: 'transition-all duration-200'
  }
};

/**
 * Helper Functions
 */

// Soft-coded normalizer: accepts an array of UUID strings, role/module objects,
// or a mix of both, and returns a flat array of UUID strings.
// Prevents "Must be a valid UUID" backend errors when the frontend feeds the
// original user.roles / user.accessible_modules arrays (which contain objects)
// into checkbox handlers that append plain UUID strings.
const toIdArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'string') return item;
      if (typeof item === 'object') return item.id || item.uuid || null;
      return null;
    })
    .filter(Boolean);
};

export const getFieldValue = (user, fieldName) => {
  const fieldMap = {
    'first_name': user?.user?.first_name || user?.first_name || '',
    'last_name': user?.user?.last_name || user?.last_name || '',
    'email': user?.user?.email || user?.email || '',
    'organization_id': user?.organization?.id || user?.organization_id || '',
    'department': user?.department || '',
    'job_title': user?.job_title || '',
    'phone': user?.phone || user?.phone_number || '',
    'status': user?.status || 'active',
    'date_joined': user?.user?.date_joined || user?.created_at || null,
    'last_login': user?.last_login_at || user?.user?.last_login || null,
    'login_count': user?.login_count || 0,
    // Normalize to UUID strings — backend expects PrimaryKeyRelatedField list
    'module_ids': toIdArray(user?.accessible_modules ?? user?.module_ids ?? []),
    'role_ids': toIdArray(user?.roles ?? user?.role_ids ?? []),
    'is_superuser': user?.user?.is_superuser || user?.is_superuser || false,
    'is_staff': user?.user?.is_staff || user?.is_staff || false
  };

  return fieldMap[fieldName] !== undefined ? fieldMap[fieldName] : '';
};

export const initializeFormData = (user) => {
  return {
    first_name: getFieldValue(user, 'first_name'),
    last_name: getFieldValue(user, 'last_name'),
    email: getFieldValue(user, 'email'),
    organization_id: getFieldValue(user, 'organization_id'),
    department: getFieldValue(user, 'department'),
    job_title: getFieldValue(user, 'job_title'),
    phone: getFieldValue(user, 'phone'),
    module_ids: getFieldValue(user, 'module_ids'),
    role_ids: getFieldValue(user, 'role_ids'),
    is_superuser: getFieldValue(user, 'is_superuser'),
    is_staff: getFieldValue(user, 'is_staff')
  };
};

export const validateField = (field, value) => {
  if (field.required && !value) {
    return EDIT_USER_CONFIG.validationMessages.required;
  }

  if (field.validation) {
    const { pattern, minLength, maxLength, message } = field.validation;

    if (minLength && value.length < minLength) {
      return EDIT_USER_CONFIG.validationMessages.minLength(minLength);
    }

    if (maxLength && value.length > maxLength) {
      return EDIT_USER_CONFIG.validationMessages.maxLength(maxLength);
    }

    if (pattern && !pattern.test(value)) {
      return message || EDIT_USER_CONFIG.validationMessages.pattern;
    }
  }

  return null;
};

export const hasChanges = (originalData, currentData) => {
  return JSON.stringify(originalData) !== JSON.stringify(currentData);
};
