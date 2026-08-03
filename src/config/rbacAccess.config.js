/**
 * RBAC Access Control — Shared Soft-Coded Config
 *
 * Single source of truth for access-control constants shared by:
 *   • Admin › Roles & Access Management  (/admin/roles)
 *   • Admin › User Management            (/admin/users)
 *
 * RADAI holds sensitive Oil & Gas engineering data. Access is granted
 * exclusively through Roles — the User Management screen never assigns
 * modules or permissions directly to a user. To change a user's access,
 * change their Role assignment; to change what a Role grants, edit that
 * Role in the Roles & Access Management page.
 *
 * Keep this file backend-aligned with:
 *   backend/apps/rbac/rbac_config.py  (SENSITIVE_ROLE_CODES,
 *   SENSITIVE_MODULE_CODES, DEFAULT_ROLE_CONFIG, MODULE_ASSIGNMENT_CONFIG)
 */

// ─── Access model ────────────────────────────────────────────────────────
// 'role_based' → module access is derived from role assignments only.
// This is the ONLY supported mode. The alternate 'direct' mode is disabled.
export const ACCESS_CONTROL_MODE = 'role_based';

// Master switch that hides per-user module selectors across the UI.
// Set to `true` ONLY if you deliberately want to bring back the old
// custom-role-per-user hack — leave as `false` for production.
export const ALLOW_PER_USER_MODULE_ASSIGNMENT = false;

// Master switch for the "Access to All Users" bulk-module-assign flow.
// Keep `false` — bulk-module grants must be applied via a role.
export const ALLOW_BULK_MODULE_ASSIGNMENT = false;

// ─── Role level display ──────────────────────────────────────────────────
export const ROLE_LEVEL_COLORS = {
  1: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200',    dot: 'bg-red-500'    },
  2: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', dot: 'bg-orange-500' },
  3: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  4: { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  5: { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-200',   dot: 'bg-teal-500'   },
  6: { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
};

export const DEFAULT_LEVEL_COLOR = {
  bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400',
};

export const ROLE_LEVEL_LABELS = {
  1: 'Super Administrator',
  2: 'Admin',
  3: 'Manager',
  4: 'Engineer',
  5: 'Reviewer',
  6: 'Viewer',
};

export const getRoleLevelColor = (level) => ROLE_LEVEL_COLORS[level] || DEFAULT_LEVEL_COLOR;
export const getRoleLevelLabel = (level) => ROLE_LEVEL_LABELS[level] || 'Unknown Level';

// ─── Role codes (must match backend rbac_config.py) ──────────────────────
export const SUPER_ADMIN_ROLE_CODE = 'super_admin';
export const ADMIN_ROLE_CODE       = 'admin';
export const DEFAULT_ROLE_CODE     = 'default';
export const CUSTOM_ROLE_PREFIX    = 'custom_';

// ─── Sensitive assets (must match backend rbac_config.py) ────────────────
// Sensitive roles: assigning one of these requires typed confirmation and
// super-admin privileges. hr_admin exposes payroll + timesheet + HR data.
export const SENSITIVE_ROLE_CODES = ['hr_admin'];

// Sensitive modules: highlighted with an amber shield in module lists.
export const SENSITIVE_MODULE_CODES = ['hr_management', 'payroll', 'timesheet'];

export const isSensitiveRole   = (code) => SENSITIVE_ROLE_CODES.includes(code);
export const isSensitiveModule = (code) => SENSITIVE_MODULE_CODES.includes(code);

// ─── Custom role level dropdown options (Role Management "New Role" modal) ─
export const CUSTOM_ROLE_LEVEL_OPTIONS_ADMIN = [2, 3, 4, 5, 6];
export const CUSTOM_ROLE_LEVEL_OPTIONS_SUPER = [1, 2, 3, 4, 5, 6];

// ─── Sensitive-role confirmation modal ───────────────────────────────────
// The user must type CONFIRM_TOKEN exactly to enable the confirm button.
export const SENSITIVE_CONFIRM_CONFIG = {
  CONFIRM_TOKEN: 'CONFIRM',
  TITLE:         'Grant a Sensitive Role',
  WARNING:       'You are about to grant a role that unlocks sensitive data (HR, Payroll, Timesheet). This action is audited and irreversible from this dialog.',
  INSTRUCTION:   'Type CONFIRM below to proceed. Only Super Administrators can grant sensitive roles.',
  CONFIRM_BTN:   'Grant Sensitive Role',
  CANCEL_BTN:    'Cancel',
  MISMATCH_MSG:  'Type CONFIRM exactly to enable this button.',
};

// ─── Copy for the User Management "access derives from roles" notice ────
export const ACCESS_NOTICE = {
  TITLE: 'Access is granted through Roles',
  BODY:
    'Module and permission access is determined by the roles assigned to this user. ' +
    'To grant or revoke feature access, edit the user\'s roles below, or configure ' +
    'the role in Admin › Roles & Access Management.',
  ROLES_LINK_LABEL: 'Open Roles & Access Management',
  ROLES_LINK_PATH:  '/admin/roles',
};

// ─── User-list "Modules" column popover copy ─────────────────────────────
export const MODULES_POPOVER_COPY = {
  HEADER:         'Modules inherited from roles',
  EMPTY:          'This user has no active roles that grant module access.',
  SOURCE_LABEL:   'via',
  MANAGE_HINT:    'Manage in Roles & Access Management',
};
