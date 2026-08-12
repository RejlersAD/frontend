/*
 * DEPLOYMENT TRIGGER - Vercel Preprod Rebuild
 * Timestamp: 2026-08-12 10:51:26
 * Reason: Force redeploy to apply role filtering fix (commit 33b813a)
 * 
 * This file ensures Vercel preprod builds with the latest role alignment fixes.
 * The UserManagement.jsx role filtering is now consistent with RoleManagement.jsx.
 * 
 * Key Changes Applied:
 * - HIDDEN_ROLE_CODES imported from rbacAccess.config
 * - assignableRoles computed with proper filtering
 * - EditUserModal receives filtered roles only
 * - 12 deprecated roles hidden from UI
 */
