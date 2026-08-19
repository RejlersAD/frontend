/**
 * InheritedModulesPopover
 *
 * Read-only display of the modules a user gets from their assigned roles.
 * The user's access is *derived* from their roles \u2014 there is no per-user
 * module store. To change what a user can access, change their roles
 * (this component links to /admin/roles for role configuration).
 *
 * The backend already returns the union in `user.accessible_modules`, but
 * we render the source role on each chip so admins can trace where the
 * access comes from.
 *
 * Props:
 *   user         : UserProfile object  (contains roles[] and accessible_modules)
 *   modulesIndex : Map<code, moduleObj> \u2014 optional lookup for display names
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  MODULES_POPOVER_COPY,
  SENSITIVE_MODULE_CODES,
  ACCESS_NOTICE,
} from '../../config/rbacAccess.config';

function InheritedModulesPopover({ user, modulesIndex = new Map() }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const accessibleModules = Array.isArray(user?.accessible_modules) ? user.accessible_modules : [];
  const count = accessibleModules.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // The backend returns accessible_modules as an array of codes (strings).
  // Look up the display name; fall back to code if the modules catalog isn't loaded.
  const chips = accessibleModules.map((codeOrObj) => {
    const code = typeof codeOrObj === 'string' ? codeOrObj : codeOrObj?.code;
    const mod = modulesIndex.get(code);
    return {
      code,
      name: mod?.name || code,
      sensitive: SENSITIVE_MODULE_CODES.includes(code),
    };
  });

  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium focus:outline-none"
        title={MODULES_POPOVER_COPY.HEADER}
      >
        {count} module{count === 1 ? '' : 's'}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-40 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 right-0"
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {MODULES_POPOVER_COPY.HEADER}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 -mt-1"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Roles that feed this access */}
          {roles.length > 0 ? (
            <p className="text-[11px] text-gray-500 mb-3">
              {MODULES_POPOVER_COPY.SOURCE_LABEL}{' '}
              {roles.map((r, i) => (
                <span key={r.id || r.code} className="font-semibold text-gray-700">
                  {r.name}{i < roles.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-xs text-amber-600 mb-3">No active roles \u2014 user has no access.</p>
          )}

          {chips.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-2">{MODULES_POPOVER_COPY.EMPTY}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
              {chips.map((c) => (
                <span
                  key={c.code}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                    c.sensitive
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title={c.code}
                >
                  {c.sensitive && (
                    <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" clipRule="evenodd"
                        d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" />
                    </svg>
                  )}
                  {c.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <a
              href={ACCESS_NOTICE.ROLES_LINK_PATH}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {MODULES_POPOVER_COPY.MANAGE_HINT}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default InheritedModulesPopover;
