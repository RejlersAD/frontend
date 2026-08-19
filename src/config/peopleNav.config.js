/**
 * People Navigation Configuration (soft-coded)
 * -----------------------------------------------------------------
 * Single source of truth for the cross-link tab bar that ties together
 * the three people-related surfaces:
 *
 *   /profile         — current user's own profile (UserProfileSerializer)
 *   /hr/employees    — HR directory (UserProfileListSerializer)
 *   /admin/users     — RBAC user management (UserProfileListSerializer)
 *
 * All three back-end endpoints now expose the same nested user shape
 * (see backend/apps/rbac/serializers.py · UserProfileListSerializer),
 * so the pages are data-aligned. This config powers the visual
 * inter-connection via <PeopleNav />.
 *
 * To add / rename / re-order tabs: edit only this file.
 */

// Tab visibility predicates — keyed by canonical capability codes.
// Receive the same `user` object used by `isUserAdmin()` (Redux auth user).
export const PEOPLE_NAV_VISIBILITY = {
  always:     () => true,
  adminOnly:  (user, helpers) => Boolean(helpers?.isUserAdmin?.(user)),
  // SOFT-CODED: set a tab's visibility to 'never' to hide it everywhere
  // without deleting the config entry (re-enable by changing back to 'always')
  never:      () => false,
}

// Soft-coded tab definitions. Order = display order (left → right).
export const PEOPLE_NAV_TABS = [
  {
    id: 'profile',
    label: 'My Profile',
    description: 'Personal details & engineering profile',
    to: '/profile',
    icon: 'UserCircleIcon',
    visibility: 'always',
    accent: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'hr',
    label: 'HR Directory',
    description: 'Workforce directory & competency view',
    to: '/hr/employees',
    icon: 'UserGroupIcon',
    // SOFT-CODED: hidden from My Profile nav — change to 'always' to re-enable
    visibility: 'never',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'ess',
    label: 'My Workspace',
    description: 'Leave, attendance, timesheet & payroll',
    to: '/hr/leave',
    icon: 'SparklesIcon',
    visibility: 'always',
    accent: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'payroll',
    label: 'Payroll & Salary',
    description: 'Attendance, leave management, payroll engine & salary structures',
    to: '/hr/payroll',
    icon: 'BanknotesIcon',
    // SOFT-CODED: hidden from My Profile nav — change to 'always' to re-enable
    visibility: 'never',
    accent: 'from-violet-500 to-purple-500',
  },
  {
    id: 'admin',
    label: 'User Management',
    description: 'Roles, modules & access control',
    to: '/admin/users',
    icon: 'ShieldCheckIcon',
    // SOFT-CODED: hidden from My Profile nav — change to 'adminOnly' to re-enable
    visibility: 'never',
    accent: 'from-purple-500 to-fuchsia-500',
  },
]

// Section header copy (rendered above the tabs).
export const PEOPLE_NAV_COPY = {
  title: 'People & Access',
  subtitle: 'One workforce, three lenses — switch any time.',
}

export default {
  PEOPLE_NAV_TABS,
  PEOPLE_NAV_VISIBILITY,
  PEOPLE_NAV_COPY,
}
