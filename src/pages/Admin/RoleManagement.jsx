import './RoleManagement.css';
import UserPermissionEditor from './UserPermissionEditor';
import RoleAccessEditor, { RoleHistory } from './RoleAccessEditor';
import { BUSINESS_SERVICES } from '../../config/serviceAccess.config';
import { radaiConfirm } from '../../services/radaiDialog'
/**
 * Role & Access Management — /admin/roles
 *
 * Unified control panel for the Super Administrator.
 * Two top-level tabs:
 *   • "Roles & Permissions"  — create/edit roles, assign modules, assign/remove users
 *   • "Access Requests (N)"  — review pending module access requests from regular users;
 *                               approve (grants module) or deny with optional admin note
 *
 * All thresholds, labels, role codes, module codes, and copy are soft-coded in
 * the constants section below.  Never hardcode magic values inline.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import * as HeroIcons from '@heroicons/react/24/outline';
import rbacService from '../../services/rbac.service';
import { getEngineeringDisciplines } from '../../config/engineeringStructure.config.js';
import { getRoleName } from '../../utils/roleDisplay.utils';
import { HIDDEN_ROLE_CODES } from '../../config/rbacAccess.config';

// ═══════════════════════════════════════════════════════════════════════════
// ── Soft-coded constants ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_LEVEL_COLORS = {
  1: { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500'    },
  2: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  3: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  4: { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  5: { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-500'   },
  6: { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-400'  },
};
const DEFAULT_LEVEL_COLOR = { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };

const ROLE_LEVEL_LABELS = {
  1: 'Super Administrator', 2: 'Admin', 3: 'Manager', 4: 'Engineer', 5: 'Reviewer', 6: 'Viewer',
};
// Custom roles (auto-created per user for module assignments) are excluded
// from the Role Management UI at the API level; this prefix constant is a
// defensive client-side guard that mirrors rbac_config.MODULE_ASSIGNMENT_CONFIG.
const CUSTOM_ROLE_PREFIX = 'custom_';

const SUPER_ADMIN_ROLE_CODE  = 'super_admin';
// SOFT-CODED: keep in sync with rbac_config.DEFAULT_ROLE_CONFIG['code']
const DEFAULT_ROLE_CODE      = 'default';
const SENSITIVE_ROLE_CODES   = ['hr_admin'];

const CUSTOM_ROLE_LEVEL_OPTIONS_ADMIN = [2, 3, 4, 5, 6];
const CUSTOM_ROLE_LEVEL_OPTIONS_SUPER = [1, 2, 3, 4, 5, 6];

const USER_SEARCH_MIN_CHARS   = 2;
const USER_SEARCH_DEBOUNCE_MS = 350;
const USER_SEARCH_PAGE_SIZE   = 20;

// SOFT-CODED: page size for the Users tab user list (role-user listing)
const ROLE_USERS_PAGE_SIZE    = 20;
// Debounce for the search bar inside the Users tab
const ROLE_USERS_SEARCH_DEBOUNCE_MS = 350;

const EMPTY_FORM = { name: '', code: '', level: 3, description: '' };

const AR_STATUS_FILTERS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'denied',   label: 'Denied'   },
  { key: '',         label: 'All'      },
];
const AR_STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  denied:   'bg-red-100 text-red-800',
};
const AR_STATUS_LABELS = {
  pending:  'Pending Review',
  approved: 'Approved',
  denied:   'Denied',
};

const MAIN_TAB_ROLES = 'roles';
const MAIN_TAB_AR    = 'access-requests';

// ═══════════════════════════════════════════════════════════════════════════
// ── Dynamic Module Catalog ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
//
// HOW TO ADD A NEW FEATURE GROUP:
//   • Engineering disciplines → edit engineeringStructure.config.js (auto-picked up)
//   • Non-engineering group   → add an entry to NON_ENGINEERING_GROUPS below
//
// That's it — no other file needs touching.

// Soft-coded non-engineering module groups.
// Add new groups here when new feature areas are introduced.
// Each entry: { id, label, color, description, moduleCodes }
// Valid colors: blue | orange | purple | yellow | gray | indigo | pink | green | red | teal
const NON_ENGINEERING_GROUPS = [
  {
    id: 'common',
    label: 'Common & Integration',
    color: 'purple',
    description: 'Cross-discipline tools and document management',
    moduleCodes: ['crs_documents', 'pfd_to_pid', 'designiq', 'data_mining', 'hr_self_service'],
  },
  {
    id: 'qhse',
    label: 'QHSE',
    color: 'red',
    description: 'Quality, Health, Safety & Environment',
    moduleCodes: ['qhse', 'qhse_detailed', 'qhse_quality', 'qhse_health_safety', 'qhse_environmental', 'qhse_energy'],
  },
  {
    id: 'finance',
    label: 'Finance',
    color: 'teal',
    description: 'Invoice tracking, billing and financial management',
    moduleCodes: [...BUSINESS_SERVICES.filter(service => service.parent === 'finance').map(service => service.code)],
  },
  {
    id: 'sales',
    label: 'Sales',
    color: 'orange',
    description: 'Internal sales pipeline and business development',
    moduleCodes: [...BUSINESS_SERVICES.filter(service => service.parent === 'sales').map(service => service.code)],
  },
  {
    id: 'project_control',
    label: 'Project Control',
    color: 'indigo',
    description: 'Project planning, tracking and schedule control',
    moduleCodes: ['project_control', 'planning_package'],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    color: 'yellow',
    description: 'Vendors, purchase orders, requisitions and receipts',
    // Each code maps to a Sidebar sub-feature (7.1–7.5)
    // Add new procurement sub-features here as the section grows
    moduleCodes: [
      'procurement',              // 7.1 Dashboard
      'procurement_vendors',      // 7.2 Vendors
      'procurement_requisitions', // 7.3 Recommendations / Requisitions
      'procurement_orders',       // 7.4 Purchase Orders
      'procurement_receipts',     // 7.5 Goods Receipt
    ],
  },
  {
    id: 'hr',
    label: 'Human Resources',
    color: 'green',
    description: 'HR management, payroll and employee lifecycle',
    moduleCodes: ['hr_management', 'payroll', 'timesheet', 'hr_onboarding'],  // SOFT-CODED: hr_self_service moved to COMMON group
  },
  {
    id: 'administration',
    label: 'Administration',
    color: 'gray',
    description: 'System administration — dashboard, user management, integrations and engagement analytics',
    moduleCodes: [
      'admin_dashboard',       // 9.1 Dashboard
      'user_mgmt',             // 9.2 Users & Roles
      'role_access_mgmt',      // 9.3 Role & Access Management
      'wrench_integration',    // 9.4 Wrench Integration
      'ai_champion',           // 9.5 AI Champion
      'org_settings', 'audit_logs', 'file_storage', 'reports', 'api_access',
      'enquiry_management',    // 9.6 Enquiry Operations
    ],
  },
];

// Tailwind colour map for group headers — extend as needed


/**
 * Build the ordered module catalog by merging:
 *   1. Engineering disciplines from engineeringStructure.config.js (auto-updated)
 *   2. NON_ENGINEERING_GROUPS defined above
 * Called once at module load — result is a static constant.
 */
function buildCatalog() {
  const engGroups = getEngineeringDisciplines().map((d) => ({
    id:          d.id,
    label:       d.fullName,
    color:       d.color,
    description: d.description,
    moduleCodes: [...new Set(d.subFeatures.map((sf) => sf.moduleCode).filter(Boolean))],
  }));
  return [...engGroups, ...NON_ENGINEERING_GROUPS];
}

const MODULE_CATALOG    = buildCatalog();


// ── Helpers ────────────────────────────────────────────────────────────────
function getLevelColor(level) { return ROLE_LEVEL_COLORS[level] || DEFAULT_LEVEL_COLOR; }
function getLevelLabel(level) { return ROLE_LEVEL_LABELS[level] || `Level ${level}`; }
function toArray(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (d?.results) return d.results;
  if (Array.isArray(res)) return res;
  return [];
}

// ── Sub-components ──────────────────────────────────────────────────────────

function RoleBadge({ role, selected, onClick }) {
  const c = getLevelColor(role.level);
  const roleDisplayName = getRoleName(role); // Use centralized display logic
  // SOFT-CODED: Warn if role has no modules (users assigned to this role can't access any features)
  const hasNoModules = !role.modules || role.modules.length === 0;
  const isSensitive = SENSITIVE_ROLE_CODES.includes(role.code);
  
  return (
    <button
      type="button"
      onClick={() => onClick(role)}
      aria-current={selected ? 'page' : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
        selected
          ? 'bg-blue-50 text-blue-900'
          : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-blue-600" />}
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${selected ? 'bg-blue-100' : 'bg-white ring-1 ring-slate-200 group-hover:ring-slate-300'}`}>
        {role.is_system_role ? (
          <HeroIcons.ShieldCheckIcon className={`h-4 w-4 ${selected ? 'text-blue-700' : 'text-slate-500'}`} />
        ) : (
          <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-sm ${selected ? 'font-semibold text-blue-900' : 'font-medium text-slate-800'}`}>
            {roleDisplayName}
          </p>
          {role.is_system_role && <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">System</span>}
        </div>
        <p className={`mt-0.5 truncate text-xs ${selected ? 'text-blue-700' : 'text-slate-500'}`}>
          {role.user_count ?? 0} users · {role.modules?.length ?? 0} modules
        </p>
      </div>
      {isSensitive && (
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" title="Sensitive role" />
      )}
      {hasNoModules && !role.is_system_role && (
        <svg className="h-4 w-4 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-label="No modules assigned">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

function ArBadge({ status }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${AR_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
      {AR_STATUS_LABELS[status] || status}
    </span>
  );
}

function ActionModal({ request, action, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className={`text-lg font-bold mb-1 ${isApprove ? 'text-green-700' : 'text-red-700'}`}>
          {isApprove ? 'Approve Request' : 'Deny Request'}
        </h2>
        <p className="text-sm text-gray-600 mb-1">User: <strong>{request.user_name || request.user_email}</strong></p>
        <p className="text-sm text-gray-600 mb-4">Module: <strong>{request.module_name}</strong></p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Admin note <span className="text-gray-400">(optional)</span></label>
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
          rows={3} placeholder={isApprove ? 'Any message for the user…' : 'Reason for denial…'}
          value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-3 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={async () => { setBusy(true); await onConfirm(request.id, note); setBusy(false); }} disabled={busy}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-60 ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {busy ? 'Processing…' : isApprove ? 'Approve' : 'Deny'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main component ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function RoleManagement() {
  const { currentUser }    = useSelector((s) => s.rbac);
  const { user: authUser } = useSelector((s) => s.auth);

  const isSuperAdmin = useMemo(() => {
    return currentUser?.roles?.some((r) => ['super_admin','superadmin'].includes(r.code))
      || authUser?.is_superuser === true || authUser?.user?.is_superuser === true;
  }, [currentUser, authUser]);

  const isAdmin = useMemo(() => {
    if (isSuperAdmin) return true;
    return currentUser?.roles?.some((r) => r.code === 'admin')
      || authUser?.is_staff === true || authUser?.user?.is_staff === true;
  }, [isSuperAdmin, currentUser, authUser]);

  const [mainTab, setMainTab] = useState(MAIN_TAB_ROLES);
  const [draftDirty, setDraftDirty] = useState(false);
  const changeMainTab = async next => {
    if (next === mainTab) return;
    if (draftDirty && !(await radaiConfirm('Discard the unsaved access changes?'))) return;
    setDraftDirty(false); setMainTab(next);
  };
  const exportReport = () => {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "' $&").replaceAll('"', '""') + '"';
    const rows = [['Role', 'Type', 'Assigned users', 'Applications', 'Direct permissions'], ...roles.filter(role => !role.code.startsWith(CUSTOM_ROLE_PREFIX) && !HIDDEN_ROLE_CODES.includes(role.code)).map(role => [getRoleName(role), role.is_system_role ? 'System' : 'Custom', role.user_count ?? 0, role.modules?.length ?? 0, role.permissions?.length ?? 0])];
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(cell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'role-access-report.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const notify = useCallback((type, message) => {
    setNotification({ show: true, type, message });
    const t = setTimeout(() => setNotification({ show: false, type: '', message: '' }), 4500);
    return () => clearTimeout(t);
  }, []);

  // ── Roles tab state ────────────────────────────────────────────────────
  const [roles,         setRoles]         = useState([]);
  const [moduleCatalogue, setModuleCatalogue] = useState([]);
  const [modules,       setModules]       = useState([]);
  const [roleUsers,     setRoleUsers]     = useState([]);
  const [loadingRoles,  setLoadingRoles]  = useState(true);
  const [loadingUsers,  setLoadingUsers]  = useState(false);
  const [selectedRole,  setSelectedRole]  = useState(null);
  const [roleSearch,    setRoleSearch]    = useState('');
  const [roleScope,     setRoleScope]     = useState('all');
  const [assignSearch,  setAssignSearch]  = useState('');
  const [assignResults, setAssignResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [assigning,     setAssigning]     = useState(false);
  const [removingId,      setRemovingId]      = useState(null);
  const [showAddPanel,    setShowAddPanel]    = useState(false);   // 'Add User' inline panel
  const [editingUser,     setEditingUser]     = useState(null);    // UserProfile being edited
  const [setPrimaryLoading, setSetPrimaryLoading] = useState(false);
  const [syncing,       setSyncing]       = useState(false);   // sync role-less users → Default
  const [flushingCaches, setFlushingCaches] = useState(false); // flush all user module caches
  const [userListSearch, setUserListSearch] = useState('');    // search within Users tab
  const [userListPage,   setUserListPage]   = useState(1);     // current page in Users tab
  const [userListMeta,   setUserListMeta]   = useState(null);  // {count, total_pages}
  const [showCreate,    setShowCreate]    = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [createForm,    setCreateForm]    = useState(EMPTY_FORM);
  const [createError,   setCreateError]   = useState(null);
  const [permissionUser, setPermissionUser] = useState(null);
  const [detailTab,     setDetailTab]     = useState('users'); // 'users' | 'modules' | 'history'

  const canManageRoleUsers = useMemo(() => {
    if (!isAdmin || !selectedRole) return false;
    if (selectedRole.code === SUPER_ADMIN_ROLE_CODE) return isSuperAdmin;
    return true;
  }, [isAdmin, isSuperAdmin, selectedRole]);

  useEffect(() => {
    (async () => {
      try { setLoadingRoles(true); setRoles(toArray(await rbacService.getRoles())); }
      catch { notify('error', 'Failed to load roles.'); }
      finally { setLoadingRoles(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { const catalogue = toArray(await rbacService.getModules()).filter(module => module.is_active); setModuleCatalogue(catalogue); setModules(catalogue.filter(module => !['finance', 'sales'].includes(module.code))); }
      catch { notify('error', 'Failed to load modules.'); }

    })();
  }, []);

  const roleUsersRequest = useRef(0);
  const loadRoleUsers = useCallback(async (code, page = 1, search = '') => {
    const requestId = ++roleUsersRequest.current;
    try {
      setLoadingUsers(true);
      const res = await rbacService.getUsers({
        role: code,
        page,
        page_size: ROLE_USERS_PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      if (requestId !== roleUsersRequest.current) return;
      // Defensively handle both Axios (.data) and plain-data response shapes
      // Shape A: axios response  → res.data = { count, results, total_pages, ... }
      // Shape B: interceptor unwrapped → res = { count, results, total_pages, ... }
      const body = res?.data?.results !== undefined ? res.data
                 : res?.results        !== undefined ? res
                 : null;
      if (body) {
        setRoleUsers(Array.isArray(body.results) ? body.results : []);
        setUserListMeta({
          count:       body.count       ?? 0,
          total_pages: body.total_pages ?? 1,
          current_page: body.current_page ?? page,
        });
      } else {
        // Final fallback: plain array
        setRoleUsers(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        setUserListMeta(null);
      }
    } catch {
      if (requestId !== roleUsersRequest.current) return;
      setRoleUsers([]);
      setUserListMeta(null);
    } finally {
      if (requestId === roleUsersRequest.current) setLoadingUsers(false);
    }
  }, []);

  const refreshRoles = useCallback(async () => {
    const arr = toArray(await rbacService.getRoles());
    setRoles(arr);
    return arr;
  }, []);

  const handleSelectRole = useCallback(async (role) => {
    if (selectedRole?.id === role.id) return;
    if (draftDirty && !(await radaiConfirm('Discard the unsaved access changes?'))) return;
    setDraftDirty(false);
    setRoleUsers([]); setSelectedRole(role); setAssignSearch(''); setAssignResults([]);
    setShowAddPanel(false); setEditingUser(null);
    setUserListSearch(''); setUserListPage(1); setUserListMeta(null);
    loadRoleUsers(role.code, 1, ''); setDetailTab('users');
  }, [loadRoleUsers, draftDirty, selectedRole]);

  // Timer ref for debouncing the user-list search input.
  // SOFT-CODED: delay is ROLE_USERS_SEARCH_DEBOUNCE_MS.
  // Using a ref (not useEffect) keeps the debounce isolated to explicit
  // user typing and prevents spurious reloads when selectedRole changes.
  const userListSearchTimerRef = useRef(null);

  useEffect(() => {
    if (!assignSearch || assignSearch.length < USER_SEARCH_MIN_CHARS) { setAssignResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const list = toArray(await rbacService.getUsers({ search: assignSearch, page_size: USER_SEARCH_PAGE_SIZE }));
        const ids  = new Set(roleUsers.map((u) => u.id));
        setAssignResults(list.filter((u) => !ids.has(u.id)));
      } catch { setAssignResults([]); }
      finally { setSearchLoading(false); }
    }, USER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [assignSearch, roleUsers]);

  const handleAssignUser = useCallback(async (u) => {
    if (!selectedRole || assigning) return;
    setAssigning(true); setAssignSearch(''); setAssignResults([]);
    try {
      await rbacService.assignRole(u.id, selectedRole.id);
      await loadRoleUsers(selectedRole.code, 1, userListSearch);
      setUserListPage(1);
      const arr = await refreshRoles();
      const r   = arr.find((x) => x.id === selectedRole.id);
      if (r) setSelectedRole(r);
      const name = [u.user?.first_name, u.user?.last_name].filter(Boolean).join(' ') || u.user?.email;
      // SOFT-CODED: Notify admin that user needs to refresh browser/re-login for changes to take effect
      notify('success', `${name} assigned to ${selectedRole.name}. User must refresh browser or re-login to see new permissions.`);
    } catch (err) { notify('error', err?.response?.data?.error || err?.response?.data?.detail || 'Failed to assign.'); }
    finally { setAssigning(false); }
  }, [selectedRole, assigning, userListSearch, loadRoleUsers, refreshRoles, notify]);

  const handleSetPrimary = useCallback(async (u) => {
    if (!selectedRole || setPrimaryLoading) return;
    setSetPrimaryLoading(true);
    try {
      await rbacService.setPrimaryRole(u.id, selectedRole.id);
      await loadRoleUsers(selectedRole.code, userListPage, userListSearch);
      setEditingUser(null);
      const name = [u.user?.first_name, u.user?.last_name].filter(Boolean).join(' ') || u.user?.email;
      notify('success', `${name}'s primary role set to ${selectedRole.name}.`);
    } catch (err) { notify('error', err?.response?.data?.error || err?.response?.data?.detail || 'Failed to set primary role.'); }
    finally { setSetPrimaryLoading(false); }
  }, [selectedRole, setPrimaryLoading, userListPage, userListSearch, loadRoleUsers, notify]);

  const handleRemoveUser = useCallback(async (u) => {
    if (!selectedRole || removingId) return;
    setRemovingId(u.id); setEditingUser(null);
    try {
      await rbacService.revokeRole(u.id, selectedRole.id);
      setRoleUsers((prev) => prev.filter((x) => x.id !== u.id));
      const arr = await refreshRoles();
      const r   = arr.find((x) => x.id === selectedRole.id);
      if (r) setSelectedRole(r);
      const name = [u.user?.first_name, u.user?.last_name].filter(Boolean).join(' ') || u.user?.email;
      notify('success', `${name} removed from ${selectedRole.name}.`);
    } catch (err) { notify('error', err?.response?.data?.error || err?.response?.data?.detail || 'Failed to remove.'); }
    finally { setRemovingId(null); }
  }, [selectedRole, removingId, refreshRoles, notify]);

  // Assign the Default role to every user that has no active role
  const handleSyncDefaultRole = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await rbacService.syncDefaultRole();
      const data = res?.data ?? res;
      setUserListSearch(''); setUserListPage(1);
      await loadRoleUsers(selectedRole.code, 1, '');
      const arr = await refreshRoles();
      const r   = arr.find((x) => x.id === selectedRole.id);
      if (r) setSelectedRole(r);
      notify('success', data.message || `Assigned Default role to ${data.assigned ?? 0} user(s).`);
    } catch (err) {
      notify('error', err?.response?.data?.error || 'Failed to sync role-less users.');
    } finally {
      setSyncing(false);
    }
  }, [syncing, selectedRole, loadRoleUsers, refreshRoles, notify]);

  // Flush cached module/permission lists for every user (super-admin only).
  // Fixes stale sidebar access that persists after a role deactivation or RBAC fix
  // because Redis still holds the old module list (5-min TTL).
  const handleFlushModuleCaches = useCallback(async () => {
    if (flushingCaches) return;
    setFlushingCaches(true);
    try {
      const res = await rbacService.flushModuleCaches();
      const data = res?.data ?? res;
      notify('success', data.message || `Module caches cleared for ${data.profiles_cleared ?? 0} user(s).`);
    } catch (err) {
      notify('error', err?.response?.data?.error || 'Failed to flush module caches.');
    } finally {
      setFlushingCaches(false);
    }
  }, [flushingCaches, notify]);

  const handleCreateRole = useCallback(async () => {
    if (!createForm.name.trim() || !createForm.code.trim()) { setCreateError('Name and Code are required.'); return; }
    setCreating(true); setCreateError(null);
    try {
      const res  = await rbacService.createRole({
        name: createForm.name.trim(), code: createForm.code.trim().toLowerCase().replace(/\s+/g,'_'),
        level: createForm.level, description: createForm.description.trim(), is_system_role: false, is_active: true,
      });
      const role = res?.data ?? res;
      setRoles((prev) => [...prev, role]); setShowCreate(false); setCreateForm(EMPTY_FORM);
      
      // SOFT-CODED: Auto-select the new role and show modules tab
      // This guides admins to assign modules immediately after creation
      setSelectedRole(role);
      setDetailTab('users');
      setAssignSearch(''); setAssignResults([]);
      setShowAddPanel(false); setEditingUser(null);
      setUserListSearch(''); setUserListPage(1); setUserListMeta(null);
      
      notify('success', `Role "${role.name}" created. Now assign modules below →`);
      // SOFT-CODED: Show warning that role needs modules to be useful
      notify('warning', '⚠️ This role has no modules yet. Users assigned to this role cannot access any features until you assign modules.', 8000);
    } catch (err) {
      setCreateError(err?.response?.data?.detail || Object.values(err?.response?.data || {}).flat().join(' ') || 'Failed.');
    } finally { setCreating(false); }
  }, [createForm, notify]);

  const handleDeleteRole = useCallback(async (role) => {
    if (role.is_system_role || !(await radaiConfirm(`Delete "${role.name}"? This revokes it from all users.`))) return;
    try {
      await rbacService.deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      if (selectedRole?.id === role.id) setSelectedRole(null);
      notify('success', `Role "${role.name}" deleted.`);
    } catch (err) { notify('error', err?.response?.data?.detail || 'Failed to delete.'); }
  }, [selectedRole, notify]);

  const filteredRoles = useMemo(() => {
    // Exclude auto-generated custom roles and soft-coded hidden roles (HIDDEN_ROLE_CODES).
    const visible = roles.filter(
      (r) => !r.code.startsWith(CUSTOM_ROLE_PREFIX) && !HIDDEN_ROLE_CODES.includes(r.code)
    );
    const scoped = visible.filter((role) => (
      roleScope === 'all' || (roleScope === 'system' ? role.is_system_role : !role.is_system_role)
    ));
    const t = roleSearch.trim().toLowerCase();
    return t ? scoped.filter((r) => r.name.toLowerCase().includes(t) || r.code.toLowerCase().includes(t)) : scoped;
  }, [roles, roleSearch, roleScope]);

  const visibleRoleCounts = useMemo(() => {
    const visible = roles.filter(
      (role) => !role.code.startsWith(CUSTOM_ROLE_PREFIX) && !HIDDEN_ROLE_CODES.includes(role.code)
    );
    return {
      all: visible.length,
      system: visible.filter((role) => role.is_system_role).length,
      custom: visible.filter((role) => !role.is_system_role).length,
    };
  }, [roles]);

  useEffect(() => {
    if (!selectedRole && !loadingRoles && filteredRoles.length) {
      handleSelectRole(filteredRoles[0]);
    }
  }, [selectedRole, loadingRoles, filteredRoles, handleSelectRole]);


  // ── Access Requests tab state ─────────────────────────────────────────
  const [arStatusTab, setArStatusTab] = useState('pending');
  const [arRequests,  setArRequests]  = useState([]);
  const [arLoading,   setArLoading]   = useState(false);
  const [arError,     setArError]     = useState('');
  const [arSuccess,   setArSuccess]   = useState('');
  const [arModal,     setArModal]     = useState(null);
  const [pendingTotal,setPendingTotal]= useState(0);

  const loadArRequests = useCallback(async (filter) => {
    setArLoading(true); setArError('');
    try {
      const res  = await rbacService.getAccessRequests(filter ? { status: filter } : {});
      const list = res?.data?.results ?? res?.data ?? [];
      setArRequests(Array.isArray(list) ? list : []);
    } catch { setArError('Failed to load access requests.'); }
    finally { setArLoading(false); }
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      const res  = await rbacService.getAccessRequests({ status: 'pending' });
      const list = res?.data?.results ?? res?.data ?? [];
      setPendingTotal(res?.data?.count ?? (Array.isArray(list) ? list.length : 0));
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { refreshPending(); }, [refreshPending]);
  useEffect(() => { if (mainTab === MAIN_TAB_AR) loadArRequests(arStatusTab); }, [mainTab, arStatusTab, loadArRequests]);

  const handleArAction = useCallback(async (id, note) => {
    setArError(''); setArSuccess('');
    try {
      if (arModal.action === 'approve') {
        await rbacService.approveAccessRequest(id, note);
        setArSuccess('Approved — the user now has access to the module.');
      } else {
        await rbacService.denyAccessRequest(id, note);
        setArSuccess('Request denied.');
      }
      setArModal(null);
      await loadArRequests(arStatusTab);
      await refreshPending();
    } catch (err) {
      setArError(err?.response?.data?.detail || 'Action failed.');
      setArModal(null);
    }
  }, [arModal, arStatusTab, loadArRequests, refreshPending]);

  // ═══════════════════════════════════════════════════════════════════════
  // ── Render ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="roles-access">
      <div className="ra-workspace">

      {/* ── Floating toast notification ── */}
      {notification.show && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium max-w-sm transition-all ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {notification.type === 'success'
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />}
          </svg>
          {notification.message}
        </div>
      )}

      {/* ── Page header ── */}
      <header className="ra-page-header">
             <div className="ra-page-title"><div><h1>Roles &amp; Access</h1><p>Create roles, assign users and control application permissions.</p></div>
          <div className="ra-header-actions"><button onClick={exportReport}><HeroIcons.ArrowDownTrayIcon />Export access report</button><button onClick={() => changeMainTab(MAIN_TAB_AR)}><HeroIcons.UserGroupIcon />Review requests</button>{isSuperAdmin && <button className="ra-primary" onClick={() => { setShowCreate(true); setCreateError(null); setCreateForm(EMPTY_FORM); }}><HeroIcons.PlusIcon />Create role</button>}</div>
        </div>
        <div className="ra-notice ra-pending"><HeroIcons.ClockIcon /><span>{pendingTotal} access request{pendingTotal === 1 ? '' : 's'} awaiting review</span><button className="ra-link" onClick={() => changeMainTab(MAIN_TAB_AR)}>Review requests <HeroIcons.ArrowRightIcon /></button></div>
        <div className="ra-tabs" role="tablist" aria-label="Roles and access">{[[MAIN_TAB_ROLES, 'Roles'], [MAIN_TAB_AR, 'Access requests'], ['reviews', 'Access reviews'], ['audit', 'Audit']].map(([key, label]) => <button key={key} role="tab" aria-selected={mainTab === key} onClick={() => changeMainTab(key)}>{label}</button>)}</div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          TAB: Roles & Permissions
      ══════════════════════════════════════════════════════════ */}
      {mainTab === MAIN_TAB_ROLES && (
        <div className="ra-layout">

          {/* ── Left panel: role list ── */}
          <aside className="ra-role-list ra-panel">
            <div className="border-b border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Roles</p>

                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{visibleRoleCounts.all}</span>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search roles…" value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  aria-label="Search roles"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" aria-label="Filter roles">
                {[
                  ['all', 'All'],
                  ['system', 'System'],
                  ['custom', 'Custom'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setRoleScope(value)}
                    aria-pressed={roleScope === value}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${roleScope === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    {label} <span className="ml-0.5 text-[10px] text-slate-400">{visibleRoleCounts[value]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Available roles">
              {loadingRoles ? (
                <div className="py-10 text-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Loading…</p>
                </div>
              ) : filteredRoles.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <HeroIcons.MagnifyingGlassIcon className="mx-auto h-5 w-5 text-slate-300" />
                  <p className="mt-2 text-xs font-medium text-slate-600">No roles found</p>
                  <p className="mt-1 text-xs text-slate-400">Try another search or filter.</p>
                </div>
              ) : filteredRoles.map((role) => (
                <RoleBadge key={role.id} role={role} selected={selectedRole?.id === role.id} onClick={handleSelectRole} />
              ))}
            </div>
          </aside>

          {/* ── Right panel: role detail ── */}
          {selectedRole ? <RoleAccessEditor key={selectedRole.id} role={selectedRole} modules={modules} groups={MODULE_CATALOG}
            users={roleUsers} usersLoading={loadingUsers} isSuperAdmin={isSuperAdmin}
            ownRole={Boolean(currentUser?.roles?.some(role => role.id === selectedRole.id || role.code === selectedRole.code))}
            onReload={async () => { const refreshed = await refreshRoles(); const latest = refreshed.find(item => item.id === selectedRole.id); if (!latest) throw new Error('Role unavailable'); setSelectedRole(latest); }}
            tab={detailTab} setTab={setDetailTab} onDirtyChange={setDraftDirty} onDelete={handleDeleteRole}
            onSaved={role => { setSelectedRole(role); setRoles(previous => previous.map(item => item.id === role.id ? role : item)); notify('success', 'Reviewed access changes saved.'); }}>
                  {permissionUser && <UserPermissionEditor key={permissionUser.id} user={permissionUser} modules={moduleCatalogue} groups={MODULE_CATALOG} onClose={() => setPermissionUser(null)} />}
                  {detailTab === 'users' && (
                    <div className="ra-assigned-users">

                      {/* ── Super-admin-only guard notice ── */}
                      {isAdmin && !isSuperAdmin && selectedRole?.code === SUPER_ADMIN_ROLE_CODE && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-700">
                          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Only Super Administrators can manage this role.
                        </div>
                      )}

                      {/* ── Section header + Add User button ── */}
                      <div className="ra-users-toolbar">
                        <p className="ra-users-count">
                          {loadingUsers
                            ? 'Loading…'
                            : userListMeta
                              ? `${userListMeta.count} user${userListMeta.count !== 1 ? 's' : ''} assigned`
                              : `${roleUsers.length} user${roleUsers.length !== 1 ? 's' : ''} assigned`
                          }
                        </p>
                        <div className="flex items-center gap-2">

                          {/* Sync button — only visible on the Default role for super admins */}
                          {isSuperAdmin && selectedRole?.code === DEFAULT_ROLE_CODE && (
                            <button
                              onClick={handleSyncDefaultRole}
                              disabled={syncing}
                              title="Assign the Default role to every user that currently has no role"
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {syncing ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                              {syncing ? 'Syncing…' : 'Sync Role-less Users'}
                            </button>
                          )}
                          {/* Flush Caches — visible to super admins on any role.
                              Clears stale Redis module/permission caches so every user's
                              next login reflects the correct role-based module set. */}
                          {isSuperAdmin && (
                            <button
                              onClick={handleFlushModuleCaches}
                              disabled={flushingCaches}
                              title="Clear cached module lists for all users — fixes stale sidebar access after role changes"
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {flushingCaches ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                              {flushingCaches ? 'Flushing…' : 'Flush Module Caches'}
                            </button>
                          )}
                          {canManageRoleUsers && (
                          <button
                            onClick={() => { setShowAddPanel((v) => !v); setAssignSearch(''); setAssignResults([]); setEditingUser(null); }}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                              showAddPanel
                                ? 'bg-gray-100 text-gray-600 border-gray-200'
                                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'
                            }`}
                          >
                            {showAddPanel ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add User
                              </>
                            )}
                          </button>
                        )}
                        </div>{/* end flex gap-2 buttons row */}
                      </div>

                      {/* ── Add User inline panel ── */}
                      {showAddPanel && canManageRoleUsers && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Search &amp; Add User to &ldquo;{selectedRole?.name}&rdquo;</p>
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              autoFocus
                              type="text"
                              placeholder="Type a name or email to search…"
                              value={assignSearch}
                              onChange={(e) => setAssignSearch(e.target.value)}
                              className="w-full pl-10 pr-10 py-2.5 text-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm"
                            />
                            {(assigning || searchLoading) && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                          {assignSearch.length < USER_SEARCH_MIN_CHARS ? (
                            <p className="text-xs text-blue-500 px-1">Type at least {USER_SEARCH_MIN_CHARS} characters to search.</p>
                          ) : searchLoading ? (
                            <p className="text-xs text-blue-500 px-1">Searching…</p>
                          ) : assignResults.length === 0 ? (
                            <p className="text-xs text-blue-500 px-1">No matching users found, or all already assigned this role.</p>
                          ) : (
                            <div className="bg-white border border-blue-100 rounded-xl overflow-hidden shadow-sm max-h-56 overflow-y-auto">
                              {assignResults.map((u) => {
                                const email = u.user?.email || '—';
                                const name  = [u.user?.first_name, u.user?.last_name].filter(Boolean).join(' ') || email;
                                const meta  = [u.job_title, u.department].filter(Boolean).join(' · ');
                                return (
                                  <button key={u.id} onClick={() => { handleAssignUser(u); setShowAddPanel(false); }} disabled={assigning}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0 disabled:opacity-50 transition-colors">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                      <span className="text-white text-sm font-bold">{name.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                                      <p className="text-xs text-gray-400 truncate">{email}{meta ? ` · ${meta}` : ''}</p>
                                    </div>
                                    <span className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                      </svg>
                                      Add
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── User list search bar ── */}
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          aria-label="Filter assigned users" placeholder="Search assigned users by name or email…"
                          value={userListSearch}
                          onChange={(e) => {
                            const v = e.target.value;
                            setUserListSearch(v);
                            // Debounce: fire API call after ROLE_USERS_SEARCH_DEBOUNCE_MS
                            clearTimeout(userListSearchTimerRef.current);
                            userListSearchTimerRef.current = setTimeout(() => {
                              if (selectedRole) {
                                setUserListPage(1);
                                loadRoleUsers(selectedRole.code, 1, v);
                              }
                            }, ROLE_USERS_SEARCH_DEBOUNCE_MS);
                          }}
                          className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                        />
                        {userListSearch && (
                          <button
                            onClick={() => {
                              clearTimeout(userListSearchTimerRef.current);
                              setUserListSearch('');
                              setUserListPage(1);
                              if (selectedRole) loadRoleUsers(selectedRole.code, 1, '');
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* ── User list ── */}
                      <div className="ra-users-list">
                        {loadingUsers ? (
                          <div className="py-10 text-center">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Loading users…</p>
                          </div>
                        ) : roleUsers.length === 0 ? (
                          <div className="py-12 text-center">
                            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-gray-400">
                              {userListSearch ? 'No users match your search.' : 'No users have been assigned this role yet.'}
                            </p>
                            {!userListSearch && canManageRoleUsers && (
                              <button onClick={() => setShowAddPanel(true)} className="mt-2 text-xs text-blue-500 underline">
                                Add the first user
                              </button>
                            )}
                          </div>
                        ) : (
                          <ul className="ra-assignment-list" aria-label="Assigned users">
                            <li className="ra-users-columns" aria-hidden="true"><span>User</span><span>Department / title</span><span>Role assignments</span><span>Actions</span></li>
                            {roleUsers.map((u) => {
                              const email    = u.user?.email || u.email || '—';
                              const name     = [u.user?.first_name, u.user?.last_name].filter(Boolean).join(' ') || email;
                              const isPrimary = u.primary_role?.name === selectedRole?.name;
                              const isEditing = editingUser?.id === u.id;
                              return (
                                <li key={u.id} className="transition-colors">
                                  {/* ── Row ── */}
                                  <div className={`ra-assignment-row ${isEditing ? 'is-editing' : ''}`} onClick={event => { if (isSuperAdmin && !event.target.closest('button, input, a')) setPermissionUser(u); }}>
                                    <div className="ra-user-identity">
                                      <span className="ra-avatar">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
                                      <div><strong>{name}</strong><small>{email}</small></div>
                                    </div>
                                    <div className="ra-user-department"><span>{u.department || 'Not specified'}</span><small>{u.job_title || 'Title not specified'}</small></div>
                                    <div className="ra-user-roles">
                                      <span className={`ra-chip ${isPrimary ? 'ra-direct' : ''}`}>{isPrimary ? 'Primary role' : 'Additional role'}</span>
                                      {(Array.isArray(u.roles) ? u.roles : []).filter(r => r.code !== selectedRole?.code).map(r => <span className="ra-chip" key={r.id || r.code} title={r.name}>{r.name}</span>)}
                                    </div>
                                    {canManageRoleUsers && (
                                      <div className="ra-user-actions">
                                        {/* Edit button */}
                                        <button
                                          onClick={() => setPermissionUser(u)}
                                          title="Edit user permissions" disabled={!isSuperAdmin}
                                          aria-label={`Edit permissions for ${name}`}
                                          className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-all ${
                                            isEditing
                                              ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                              : 'text-gray-500 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                          }`}
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                          Edit
                                        </button>
                                        {/* Remove button */}
                                        <button
                                          onClick={() => handleRemoveUser(u)}
                                          disabled={!!removingId}
                                          title="Remove from role" aria-label={`Remove ${name} from role`}
                                          className="flex items-center gap-1 text-xs font-medium text-red-400 border border-red-100 hover:text-red-600 hover:bg-red-50 hover:border-red-200 px-2 py-1 rounded-lg transition-all disabled:opacity-30"
                                        >
                                          {removingId === u.id ? (
                                            <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <>
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                              </svg>
                                              Remove
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* ── Inline edit panel ── */}
                                  {isEditing && (
                                    <div className="ra-assignment-edit">
                                      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Edit Assignment — {name}</p>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                                        <span><span className="font-medium text-gray-700">Email:</span> {email}</span>
                                        {u.department && <span><span className="font-medium text-gray-700">Dept:</span> {u.department}</span>}
                                        {u.job_title  && <span><span className="font-medium text-gray-700">Title:</span> {u.job_title}</span>}
                                      </div>
                                      <div className="border-t border-indigo-100 pt-3 flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                          {isPrimary ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                              </svg>
                                              Already primary role for this user
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleSetPrimary(u)}
                                              disabled={setPrimaryLoading}
                                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                            >
                                              {setPrimaryLoading ? (
                                                <div className="w-3.5 h-3.5 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                              ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                </svg>
                                              )}
                                              Set as Primary Role
                                            </button>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => setEditingUser(null)}
                                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all"
                                        >
                                          Close
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      {/* ── Pagination controls ── */}
                      {userListMeta && userListMeta.total_pages > 1 && (
                        <div className="ra-users-pagination">
                          <span>
                            Page {userListMeta.current_page} of {userListMeta.total_pages}
                            {' '}({userListMeta.count} user{userListMeta.count !== 1 ? 's' : ''})
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { const p = userListPage - 1; setUserListPage(p); loadRoleUsers(selectedRole.code, p, userListSearch); }}
                              disabled={userListPage <= 1 || loadingUsers}
                              className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              ‹ Prev
                            </button>
                            {/* Page number pills — show up to 5 around current page */}
                            {Array.from({ length: userListMeta.total_pages }, (_, i) => i + 1)
                              .filter((p) => Math.abs(p - userListPage) <= 2)
                              .map((p) => (
                                <button
                                  key={p}
                                  onClick={() => { setUserListPage(p); loadRoleUsers(selectedRole.code, p, userListSearch); }}
                                  disabled={loadingUsers}
                                  className={`w-7 h-7 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
                                    p === userListPage
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            <button
                              onClick={() => { const p = userListPage + 1; setUserListPage(p); loadRoleUsers(selectedRole.code, p, userListSearch); }}
                              disabled={userListPage >= userListMeta.total_pages || loadingUsers}
                              className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              Next ›
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
          </RoleAccessEditor> : <div className="ra-panel ra-empty"><HeroIcons.ShieldCheckIcon /><h2>{loadingRoles ? 'Loading roles?' : 'Select a role'}</h2><p>Choose a role to review its permissions and assigned users.</p></div>}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: Access Requests
      ══════════════════════════════════════════════════════════ */}
      {['reviews', 'audit'].includes(mainTab) && <div className="ra-panel"><RoleHistory reviewsOnly={mainTab === 'reviews'} /></div>}
      {mainTab === MAIN_TAB_AR && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-6">
          <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Approval queue</p>
              <h2 className="text-xl font-bold text-slate-900">Access requests</h2>
              <p className="text-sm text-slate-500">Review requested capabilities and keep access aligned with job responsibilities.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-bold">{pendingTotal}</span> pending review{pendingTotal === 1 ? '' : 's'}
            </div>
          </div>
          {arSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {arSuccess}
            </div>
          )}
          {arError && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {arError}
            </div>
          )}

          {/* Status filter pills */}
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {AR_STATUS_FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setArStatusTab(key)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  arStatusTab === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}>
                {label}
                {key === 'pending' && pendingTotal > 0 && arStatusTab !== 'pending' && (
                  <span className="bg-amber-400 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-bold">{pendingTotal}</span>
                )}
              </button>
            ))}
          </div>

          {arLoading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading requests…</span>
            </div>
          ) : arRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-3">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-400">No {arStatusTab || ''} access requests.</p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {arRequests.map((req) => (
                <article key={req.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm">
                        <span className="text-white text-sm font-bold">
                          {(req.user_name || req.user_email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{req.user_name || req.user_email}</p>
                          <ArBadge status={req.status} />
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{req.user_email}</p>
                        <p className="text-sm text-gray-700">
                          Requesting access to{' '}
                          <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{req.module_name}</span>
                        </p>
                        {req.reason && (
                          <p className="text-xs text-gray-500 mt-1.5 italic bg-gray-50 px-2 py-1.5 rounded-lg">&ldquo;{req.reason}&rdquo;</p>
                        )}
                        {req.admin_note && (
                          <p className="text-xs text-blue-600 mt-1.5 bg-blue-50 px-2 py-1.5 rounded-lg">Admin note: {req.admin_note}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Submitted {new Date(req.created_at).toLocaleString()}
                          {req.reviewed_at && <> · Reviewed {new Date(req.reviewed_at).toLocaleString()}</>}
                          {req.reviewed_by_email && <> by {req.reviewed_by_email}</>}
                        </p>
                      </div>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 shrink-0 sm:pt-1">
                        <button onClick={() => setArModal({ request: req, action: 'approve' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve
                        </button>
                        <button onClick={() => setArModal({ request: req, action: 'deny' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* ── Create Role Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Create New Role</h2>
            </div>
            {createError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 mb-4 border border-red-100">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {createError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Role Name <span className="text-red-400">*</span></label>
                <input type="text" value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Project Engineer"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Code <span className="text-red-400">*</span> <span className="normal-case font-normal text-gray-400">(snake_case, auto-formatted)</span>
                </label>
                <input type="text" value={createForm.code}
                  onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'_') }))}
                  placeholder="e.g. project_engineer"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Access Level</label>
                <select value={createForm.level}
                  onChange={(e) => setCreateForm((f) => ({ ...f, level: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50">
                  {(isSuperAdmin ? CUSTOM_ROLE_LEVEL_OPTIONS_SUPER : CUSTOM_ROLE_LEVEL_OPTIONS_ADMIN).map((lvl) => (
                    <option key={lvl} value={lvl}>Level {lvl} — {getLevelLabel(lvl)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea rows={2} value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What can this role do?"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateRole} disabled={creating}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium">
                {creating ? 'Creating…' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve/Deny Modal ── */}
      {arModal && (
        <ActionModal request={arModal.request} action={arModal.action}
          onClose={() => setArModal(null)} onConfirm={handleArAction} />
      )}
      </div>
    </div>
  );

}

export default RoleManagement;
