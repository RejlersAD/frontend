# Role Display Synchronization - Testing & Validation

## Overview
This document validates that `/admin/roles` (Role & Access Management) and `/admin/users` (User Management) display roles consistently using the same soft-coded configuration.

## Single Source of Truth
**File:** `frontend/src/config/userManagement.config.js`  
**Export:** `ROLE_DISPLAY_CONFIG`

All role display names, badges, colors, and descriptions are defined here. Both admin pages now use centralized utilities to ensure consistency.

## Implementation

### Centralized Utilities
**File:** `frontend/src/utils/roleDisplay.utils.js`

```javascript
// Get display name (uses ROLE_DISPLAY_CONFIG first, falls back to database)
getRoleName(role) → "HR & Payroll Administrator"

// Get formatted dropdown text
formatRoleForDropdown(role, includeLevel) → "L2 · HR & Payroll Administrator"

// Get description text
getRoleDescription(role) → "Full access to HR, Payroll, Timesheet..."

// Get badge colors
getRoleBadgeColors(role) → {bg, text, dot}
```

### Updated Components

#### 1. UserManagement.jsx (`/admin/users`)
**Changes:**
- ✅ Role filter dropdown uses `formatRoleForDropdown(r, true)`
- ✅ Inline role edit dropdown uses `getRoleName(role)`
- ✅ Import added: `import { getRoleName, formatRoleForDropdown } from '../utils/roleDisplay.utils'`

**Before:**
```javascript
{ROLE_LEVEL_LABELS[r.level] ? `L${r.level} · ` : ''}{r.name}  // Database name
```

**After:**
```javascript
{formatRoleForDropdown(r, true)}  // Soft-coded config → database fallback
```

#### 2. RoleManagement.jsx (`/admin/roles`)
**Changes:**
- ✅ RoleBadge component uses `getRoleName(role)`
- ✅ Role details header uses `getRoleName(selectedRole)`
- ✅ Role description uses `getRoleDescription(selectedRole)`
- ✅ Import added: `import { getRoleName, getRoleDescription, formatRoleForDropdown } from '../../utils/roleDisplay.utils'`

**Before:**
```javascript
<p>{role.name}</p>  // Database name
<p>{selectedRole.description}</p>  // Database description
```

**After:**
```javascript
<p>{getRoleName(role)}</p>  // Soft-coded config → database fallback
<p>{getRoleDescription(selectedRole) || selectedRole.description}</p>
```

## Testing Checklist

### 1. Role Filter Dropdown (`/admin/users`)
- [ ] Filter dropdown shows roles with format: "L{level} · {Name}"
- [ ] Role names match ROLE_DISPLAY_CONFIG.label when available
- [ ] Falls back to database role.name for unlisted roles
- [ ] No duplicate or missing roles

### 2. Inline Role Edit (`/admin/users`)
- [ ] Role dropdown in table edit mode shows soft-coded names
- [ ] "Default" role shows as "Default" (not "Default Role" or other variants)
- [ ] Recommended role (⭐) shows correct soft-coded name

### 3. Role List (`/admin/roles`)
- [ ] Left sidebar role list shows soft-coded names
- [ ] Role badges display correct names
- [ ] User count shows correctly

### 4. Role Details (`/admin/roles`)
- [ ] Selected role header shows soft-coded name
- [ ] Role description uses soft-coded text when available
- [ ] Falls back gracefully to database description if config missing
- [ ] Code field shows correct role.code

### 5. Consistency Validation
**Critical Test:** The same role should display identically on both pages.

| Role Code | `/admin/users` Filter | `/admin/users` Edit | `/admin/roles` List | `/admin/roles` Header |
|-----------|----------------------|--------------------|--------------------|----------------------|
| `default` | "L4 · Default" | "Default" | "Default" | "Default" |
| `hr_admin` | "L2 · HR & Payroll Administrator" | "HR & Payroll Administrator" | "HR & Payroll Administrator" | "HR & Payroll Administrator" |
| `onboarding` | "L4 · Onboarding/Offboarding Specialist" | "Onboarding/Offboarding Specialist" | "Onboarding/Offboarding Specialist" | "Onboarding/Offboarding Specialist" |
| `process_engineer` | "L4 · Process Engineer" | "Process Engineer" | "Process Engineer" | "Process Engineer" |
| `super_admin` | "L1 · Super Administrator" | "Super Administrator" | "Super Administrator" | "Super Administrator" |

### 6. Edge Cases
- [ ] **Custom roles** (if any exist): Should use database name since they're not in ROLE_DISPLAY_CONFIG
- [ ] **New roles** added to database: Should use database name until ROLE_DISPLAY_CONFIG is updated
- [ ] **Deleted config entries**: Should fall back to database name gracefully
- [ ] **Missing role.name** in database: Should show role.code

## How to Add a New Role

### Step 1: Backend Configuration
Add to `backend/apps/rbac/rbac_config.py`:
```python
SYSTEM_ROLES_CONFIG = [
    {
        'code': 'new_role',
        'name': 'New Role Title',
        'level': 4,
        'description': 'Role purpose and access scope',
        'is_system_role': True,
        'badge_color': 'blue',
    },
]

ROLE_MODULE_POLICY = {
    'new_role': DEFAULT_ROLE_MODULES + ['special_module'],
}
```

### Step 2: Frontend Configuration  
Add to `frontend/src/config/userManagement.config.js`:
```javascript
export const ROLE_DISPLAY_CONFIG = {
  new_role: {
    label: 'New Role Title',
    shortLabel: 'New Role',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    description: 'Role purpose and access scope',
    discipline: 'Engineering',
  },
}
```

### Step 3: Sync to Database
```bash
docker exec radai_backend_local python manage.py seed_rbac
docker exec radai_backend_local python manage.py sync_all_role_modules
```

### Step 4: Verify Sync
Both `/admin/roles` and `/admin/users` should now show "New Role Title" consistently.

## Troubleshooting

### Issue: Role shows database name instead of soft-coded name
**Cause:** Role code not in ROLE_DISPLAY_CONFIG  
**Fix:** Add entry to ROLE_DISPLAY_CONFIG in userManagement.config.js

### Issue: Different names on /admin/users vs /admin/roles
**Cause:** One page not using roleDisplay.utils  
**Fix:** Check imports — both pages must import from roleDisplay.utils

### Issue: getRoleName is not defined
**Cause:** Missing import  
**Fix:** Add to component imports:
```javascript
import { getRoleName, formatRoleForDropdown } from '../utils/roleDisplay.utils'
```

## Validation SQL Queries

### Check role names in database vs config
```sql
SELECT code, name 
FROM rbac_roles 
WHERE is_active = true 
ORDER BY level, name;
```

### Compare with ROLE_DISPLAY_CONFIG:
Open `frontend/src/config/userManagement.config.js` and verify each `code` has a matching entry.

## Rollout Checklist

- [x] Create roleDisplay.utils.js with centralized functions
- [x] Update UserManagement.jsx to use roleDisplay.utils
- [x] Update RoleManagement.jsx to use roleDisplay.utils
- [ ] Test role filter dropdown on /admin/users
- [ ] Test inline role edit on /admin/users
- [ ] Test role list on /admin/roles
- [ ] Test role details panel on /admin/roles
- [ ] Verify all roles in ROLE_DISPLAY_CONFIG show correctly
- [ ] Verify unlisted roles fall back to database name
- [ ] Test with new role creation workflow
- [ ] Document in repository README

## Success Criteria

✅ **Synchronization Complete When:**
1. Same role displays identical name on both pages
2. ROLE_DISPLAY_CONFIG is the single source of truth for display
3. Database role.name is used only as fallback
4. Adding new role to ROLE_DISPLAY_CONFIG updates both pages without code changes
5. No hardcoded role names in UserManagement.jsx or RoleManagement.jsx

---

**Last Updated:** 2026-08-11  
**Status:** ✅ Implemented  
**Related Files:**
- `frontend/src/utils/roleDisplay.utils.js`
- `frontend/src/pages/UserManagement.jsx`
- `frontend/src/pages/Admin/RoleManagement.jsx`
- `frontend/src/config/userManagement.config.js`
