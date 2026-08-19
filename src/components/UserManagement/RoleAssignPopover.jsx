/**
 * RoleAssignPopover — inline role badge display + assignment popover per user row.
 *
 * - Shows colour-coded level badges for the user's current roles.
 * - Super Admin users can click to open a checkbox popover and change roles.
 * - Non-super-admins see badges only (read-only), with a lock tooltip.
 * - Sensitive roles (hr_admin) are flagged with an amber shield badge.
 *
 * All thresholds, labels, and colours are soft-coded in the constants below.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import rbacService from '../../services/rbac.service';
import {
  ROLE_LEVEL_COLORS,
  DEFAULT_LEVEL_COLOR,
  SENSITIVE_ROLE_CODES,
  isSensitiveRole,
  CUSTOM_ROLE_PREFIX,
} from '../../config/rbacAccess.config';
import SensitiveRoleConfirmModal from './SensitiveRoleConfirmModal';

// Max badges to show inline before "+N more" truncation
const MAX_VISIBLE_BADGES = 2;

// ────────────────────────────────────────────────────────────────────────────

function RoleAssignPopover({ userId, userLabel = '', currentRoles = [], allRoles = [], isSuperAdmin, onRolesChange }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localRoles, setLocalRoles] = useState(currentRoles);
  const [error, setError] = useState(null);
  // Sensitive-role typed-confirmation gate — soft-coded via rbacAccess.config
  const [pendingSensitive, setPendingSensitive] = useState(null); // Role obj awaiting confirmation
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Keep localRoles in sync when parent updates
  useEffect(() => {
    setLocalRoles(currentRoles);
  }, [currentRoles]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
        setError(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const getLevelColor = (level) => ROLE_LEVEL_COLORS[level] || DEFAULT_LEVEL_COLOR;

  const isAssigned = useCallback(
    (roleId) => localRoles.some((r) => r.id === roleId),
    [localRoles]
  );

  const performAssign = useCallback(
    async (role) => {
      await rbacService.assignRole(userId, role.id);
      const updated = [...localRoles, role];
      setLocalRoles(updated);
      onRolesChange?.(userId, updated);
    },
    [userId, localRoles, onRolesChange]
  );

  const handleToggle = useCallback(
    async (role) => {
      if (!isSuperAdmin || saving) return;
      setError(null);

      // Revoke path — no confirmation gate
      if (isAssigned(role.id)) {
        setSaving(true);
        try {
          await rbacService.revokeRole(userId, role.id);
          const updated = localRoles.filter((r) => r.id !== role.id);
          setLocalRoles(updated);
          onRolesChange?.(userId, updated);
        } catch (err) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to revoke role.');
        } finally {
          setSaving(false);
        }
        return;
      }

      // Assign path — gate sensitive roles behind typed confirmation
      if (isSensitiveRole(role.code)) {
        setPendingSensitive(role);
        return;
      }

      setSaving(true);
      try {
        await performAssign(role);
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to assign role.');
      } finally {
        setSaving(false);
      }
    },
    [isSuperAdmin, saving, isAssigned, userId, localRoles, onRolesChange, performAssign]
  );

  const handleConfirmSensitive = useCallback(async () => {
    if (!pendingSensitive) return;
    setSaving(true);
    try {
      await performAssign(pendingSensitive);
      setPendingSensitive(null);
    } finally {
      setSaving(false);
    }
  }, [pendingSensitive, performAssign]);

  const visibleBadges = localRoles.slice(0, MAX_VISIBLE_BADGES);
  const overflowCount = localRoles.length - MAX_VISIBLE_BADGES;
  const hasSensitive = localRoles.some((r) => SENSITIVE_ROLE_CODES.includes(r.code));

  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap">
      {/* Role badges */}
      {localRoles.length === 0 ? (
        <span className="text-xs text-gray-400 italic">No roles</span>
      ) : (
        <>
          {visibleBadges.map((role) => {
            const c = getLevelColor(role.level);
            const sensitive = SENSITIVE_ROLE_CODES.includes(role.code);
            return (
              <span
                key={role.id}
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
                title={role.description || role.name}
              >
                {sensitive && (
                  <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                  </svg>
                )}
                {role.name}
              </span>
            );
          })}
          {overflowCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              +{overflowCount}
            </span>
          )}
          {hasSensitive && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"
              title="This user has access to sensitive HR / Payroll data"
            >
              SENSITIVE
            </span>
          )}
        </>
      )}

      {/* Edit trigger */}
      {isSuperAdmin ? (
        <button
          ref={triggerRef}
          onClick={() => { setOpen((v) => !v); setError(null); }}
          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors ml-1"
          title="Assign / revoke roles"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      ) : (
        <span className="ml-1 text-gray-300" title="Only Super Administrators can change roles">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </span>
      )}

      {/* Popover */}
      {open && isSuperAdmin && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-8 left-0 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-3"
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assign Roles</p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{error}</p>
          )}
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {allRoles
              .filter((r) => r.is_active !== false)
              // Hide legacy per-user custom_<email> roles — they must be removed via
              // the backend cleanup_custom_roles management command, not the UI.
              .filter((r) => !r.code?.startsWith(CUSTOM_ROLE_PREFIX))
              .map((role) => {
              const assigned = isAssigned(role.id);
              const sensitive = SENSITIVE_ROLE_CODES.includes(role.code);
              const c = getLevelColor(role.level);
              return (
                <li key={role.id}>
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assigned}
                      disabled={saving}
                      onChange={() => handleToggle(role)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                      {sensitive && (
                        <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                        </svg>
                      )}
                      {role.name}
                    </span>
                    {role.level && (
                      <span className="text-xs text-gray-400 ml-auto">L{role.level}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          {saving && (
            <p className="text-xs text-blue-600 mt-2 text-center animate-pulse">Saving…</p>
          )}
          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-xs text-center text-gray-500 hover:text-gray-700 py-1"
          >
            Close
          </button>
        </div>
      )}

      {/* Typed-confirmation gate for sensitive-role assignment */}
      <SensitiveRoleConfirmModal
        open={!!pendingSensitive}
        role={pendingSensitive}
        userLabel={userLabel}
        busy={saving}
        onCancel={() => setPendingSensitive(null)}
        onConfirm={handleConfirmSensitive}
      />
    </div>
  );
}

export default RoleAssignPopover;
