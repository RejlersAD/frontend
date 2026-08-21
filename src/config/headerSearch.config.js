/**
 * Header global-search destinations.
 *
 * This is intentionally navigation-focused: every result points to a real
 * application route. Record-level user/document search can be added later
 * when a unified, permission-aware backend endpoint is available.
 */
export const HEADER_SEARCH_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Open the AI Operations Center',
    category: 'Workspace',
    path: '/dashboard',
    icon: 'dashboard',
    keywords: ['home', 'operations', 'analytics', 'overview'],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    description: 'Review pending approval workflows',
    category: 'Workflows',
    path: '/approvals',
    icon: 'workflow',
    keywords: ['workflow', 'requests', 'pending', 'review'],
  },
  {
    id: 'users',
    label: 'Users & Roles',
    description: 'Manage user accounts and permissions',
    category: 'Administration',
    path: '/admin/users',
    icon: 'users',
    keywords: ['people', 'employees', 'accounts', 'permissions'],
    adminOnly: true,
    moduleCode: 'user_mgmt',
  },
  {
    id: 'roles',
    label: 'Role & Access Management',
    description: 'Configure roles and module access',
    category: 'Administration',
    path: '/admin/roles',
    icon: 'shield',
    keywords: ['rbac', 'permission', 'access', 'security'],
    adminOnly: true,
    moduleCode: 'role_access_mgmt',
  },
  {
    id: 'documents',
    label: 'CRS Documents',
    description: 'Search and manage engineering documents',
    category: 'Documents',
    path: '/crs/documents',
    icon: 'document',
    keywords: ['document', 'crs', 'revision', 'files', 'repository'],
    moduleCode: 'crs_documents',
  },
  {
    id: 'data-mining',
    label: 'Data Mining',
    description: 'Search connected project information',
    category: 'Documents',
    path: '/data-mining',
    icon: 'search',
    keywords: ['wrench', 'documents', 'data', 'integration'],
    moduleCode: 'data_mining',
  },
  {
    id: 'io-workflow',
    label: 'I/O List Workflow',
    description: 'Open the instrument datasheet workflow',
    category: 'Workflows',
    path: '/engineering/instrument/datasheet/io-list',
    icon: 'workflow',
    keywords: ['io', 'instrument', 'datasheet', 'generator'],
    moduleCode: 'instrument_datasheet',
  },
  {
    id: 'timesheet',
    label: 'Time Sheet',
    description: 'View biometric attendance analytics',
    category: 'People',
    path: '/hr/employees?tab=timesheet',
    icon: 'clock',
    keywords: ['biometric', 'attendance', 'employee', 'hours'],
    moduleCode: 'timesheet',
  },
  {
    id: 'profile',
    label: 'My Profile',
    description: 'View your account and personal details',
    category: 'Account',
    path: '/profile',
    icon: 'user',
    keywords: ['account', 'personal', 'email'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'View all alerts and updates',
    category: 'Account',
    path: '/notifications',
    icon: 'bell',
    keywords: ['alerts', 'messages', 'updates'],
  },
]

export const HEADER_SEARCH_CONFIG = {
  placeholder: 'Search users, documents, workflows...',
  emptyTitle: 'No destinations found',
  emptyHint: 'Try users, documents, approvals, timesheet, or workflows.',
  quickAccessLabel: 'Quick access',
  resultLimit: 8,
}

export default HEADER_SEARCH_ITEMS
