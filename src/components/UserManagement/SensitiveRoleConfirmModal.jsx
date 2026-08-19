/**
 * SensitiveRoleConfirmModal
 *
 * Blocks the assignment of a sensitive role (e.g. hr_admin) behind a
 * typed-confirmation gate. All copy comes from SENSITIVE_CONFIRM_CONFIG in
 * the shared rbacAccess.config so behavior can be tuned without touching
 * this component.
 *
 * Props:
 *   open      : boolean
 *   role      : { code, name, level } — the role being assigned
 *   userLabel : string  (e.g. "john.doe@radai.ae")
 *   onCancel  : () => void
 *   onConfirm : () => Promise<void>   — perform the actual assignment
 *   busy      : boolean               — external loading flag
 */
import React, { useState, useEffect } from 'react';
import { SENSITIVE_CONFIRM_CONFIG } from '../../config/rbacAccess.config';

function SensitiveRoleConfirmModal({ open, role, userLabel, onCancel, onConfirm, busy = false }) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTyped('');
      setError('');
    }
  }, [open]);

  if (!open || !role) return null;

  const matches = typed.trim() === SENSITIVE_CONFIRM_CONFIG.CONFIRM_TOKEN;

  const handleConfirm = async () => {
    if (!matches || busy) {
      setError(SENSITIVE_CONFIRM_CONFIG.MISMATCH_MSG);
      return;
    }
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to grant role.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-200">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{SENSITIVE_CONFIRM_CONFIG.TITLE}</h3>
            <p className="text-xs text-amber-100">Audited action — Super Administrator only</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {SENSITIVE_CONFIRM_CONFIG.WARNING}
          </p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Role:</span>
              <span className="font-semibold text-amber-800">
                {role.name}
                <span className="ml-2 text-xs text-amber-600">({role.code})</span>
              </span>
            </div>
            {userLabel && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-600">User:</span>
                <span className="font-medium text-gray-900 truncate ml-2">{userLabel}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {SENSITIVE_CONFIRM_CONFIG.INSTRUCTION}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                if (error) setError('');
              }}
              placeholder={SENSITIVE_CONFIRM_CONFIG.CONFIRM_TOKEN}
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-mono tracking-widest uppercase
                ${matches ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white'}
                focus:outline-none focus:ring-2 focus:ring-amber-400`}
            />
            {error && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" clipRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" />
                </svg>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
          >
            {SENSITIVE_CONFIRM_CONFIG.CANCEL_BTN}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!matches || busy}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition shadow-sm
              ${matches && !busy
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                : 'bg-gray-300 cursor-not-allowed'}`}
          >
            {busy ? 'Granting…' : SENSITIVE_CONFIRM_CONFIG.CONFIRM_BTN}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SensitiveRoleConfirmModal;
