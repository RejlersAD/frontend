/**
 * PendingActivationAlert
 * ----------------------
 * Surfaces users whose account is **not active** (status !== 'active') at the
 * top of `/admin/users` so administrators can see — and one-click activate —
 * accounts that are stuck in onboarding limbo.
 *
 * BACKGROUND
 * ----------
 * The login endpoint (`backend/apps/users/serializers_jwt.py`) gates
 * authentication on `user.is_active`. When `is_active=False`, the user sees:
 *
 *   "Your account is pending administrator approval. You will be notified
 *    once your account is activated."
 *
 * That error is correct security behavior — it is NOT a password problem.
 * The fix is a single admin action: activate the account. This component
 * just makes that fix discoverable without changing any core logic.
 *
 * SOFT-CODED
 * ----------
 * Every threshold, label, color and "what counts as pending" rule lives in
 * `PENDING_ALERT_CONFIG` below. Tune freely — no JSX edits needed.
 */
import React, { useMemo, useState } from 'react'

// ────────────────────────────────────────────────────────────────────────────
// Soft-coded configuration
// ────────────────────────────────────────────────────────────────────────────
const PENDING_ALERT_CONFIG = {
  // Statuses considered "needs activation". Order = display priority.
  pendingStatuses: ['pending', 'inactive', 'on_leave'],
  // Visual maximum before collapsing into a "+N more" pill.
  maxInlineRows: 5,
  // Friendly status badge palettes
  statusPalette: {
    pending:  { dot: 'bg-amber-500',  pill: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'Pending approval' },
    inactive: { dot: 'bg-slate-400',  pill: 'bg-slate-50 text-slate-700 border-slate-200',  label: 'Inactive' },
    on_leave: { dot: 'bg-blue-500',   pill: 'bg-blue-50 text-blue-700 border-blue-200',     label: 'On leave' },
    suspended:{ dot: 'bg-red-500',    pill: 'bg-red-50 text-red-700 border-red-200',        label: 'Suspended' },
  },
  // Copy
  copy: {
    titleSingular: '1 account is pending activation',
    titlePlural:   'accounts are pending activation',
    subtitle:
      'These users have correct credentials but cannot log in until an administrator activates their account. ' +
      'Click "Activate" to unblock them instantly. No password reset needed.',
    activateBtn: 'Activate',
    activatingBtn: 'Activating…',
    activateAllBtn: 'Activate all visible',
    expandBtn: 'Show all',
    collapseBtn: 'Show less',
    dismissBtn: 'Dismiss for this session',
    emptyHidden:
      'All accounts are active. New sign-ups awaiting approval will appear here automatically.',
  },
}

const PENDING_ALERT_DISMISS_KEY = 'radai.userMgmt.pendingAlert.dismissed.v1'

// ────────────────────────────────────────────────────────────────────────────
// Helpers (pure)
// ────────────────────────────────────────────────────────────────────────────
const getEmail = (u) => u?.user?.email || u?.email || u?.user?.username || ''
const getName  = (u) => {
  const f = u?.user?.first_name || u?.first_name || ''
  const l = u?.user?.last_name  || u?.last_name  || ''
  return `${f} ${l}`.trim() || u?.full_name || getEmail(u) || 'Unnamed user'
}
const getInitials = (u) => {
  const n = getName(u)
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────
const PendingActivationAlert = ({ users = [], onActivate, actionLoading = {} }) => {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(PENDING_ALERT_DISMISS_KEY) === '1'
  )

  // Derive pending list — soft-coded match rule
  const pending = useMemo(() => {
    if (!Array.isArray(users)) return []
    const set = new Set(PENDING_ALERT_CONFIG.pendingStatuses)
    return users.filter((u) => {
      const s = (u?.status || '').toLowerCase()
      // Treat explicit pending statuses OR is_active=false as needing activation
      return set.has(s) || u?.is_active === false || u?.user?.is_active === false
    })
  }, [users])

  if (dismissed || pending.length === 0) return null

  const visible = expanded ? pending : pending.slice(0, PENDING_ALERT_CONFIG.maxInlineRows)
  const hiddenCount = pending.length - visible.length

  const handleDismiss = () => {
    sessionStorage.setItem(PENDING_ALERT_DISMISS_KEY, '1')
    setDismissed(true)
  }

  const handleActivateAll = async () => {
    for (const u of visible) {
      if (typeof onActivate === 'function') {
        // Sequential to keep API friendly and notifications coherent
        // eslint-disable-next-line no-await-in-loop
        await onActivate(u.id, u.status).catch(() => {})
      }
    }
  }

  const title = pending.length === 1
    ? PENDING_ALERT_CONFIG.copy.titleSingular
    : `${pending.length} ${PENDING_ALERT_CONFIG.copy.titlePlural}`

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-amber-100">
        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.34 16a2 2 0 001.73 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-amber-900">{title}</h3>
          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
            {PENDING_ALERT_CONFIG.copy.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-amber-700 hover:text-amber-900 hover:underline flex-shrink-0"
          title={PENDING_ALERT_CONFIG.copy.dismissBtn}
        >
          ✕
        </button>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-amber-100">
        {visible.map((u) => {
          const status = (u.status || '').toLowerCase()
          const palette = PENDING_ALERT_CONFIG.statusPalette[status] || PENDING_ALERT_CONFIG.statusPalette.pending
          const isLoading = !!actionLoading[`status_${u.id}`]
          return (
            <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 bg-white/40">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {getInitials(u)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{getName(u)}</div>
                <div className="text-xs text-slate-500 truncate">{getEmail(u) || '—'}</div>
              </div>
              <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${palette.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
                {palette.label}
              </span>
              <button
                type="button"
                onClick={() => typeof onActivate === 'function' && onActivate(u.id, u.status)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
              >
                {isLoading ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 1v3a8 8 0 100 16v-4l-3.5 3.5L12 23v-3a8 8 0 01-8-8z" />
                    </svg>
                    {PENDING_ALERT_CONFIG.copy.activatingBtn}
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    {PENDING_ALERT_CONFIG.copy.activateBtn}
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50/50 border-t border-amber-100">
        <div className="text-[11px] text-amber-800">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="font-semibold hover:underline"
            >
              + {hiddenCount} more {PENDING_ALERT_CONFIG.copy.expandBtn.toLowerCase()}
            </button>
          )}
          {expanded && pending.length > PENDING_ALERT_CONFIG.maxInlineRows && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="font-semibold hover:underline"
            >
              {PENDING_ALERT_CONFIG.copy.collapseBtn}
            </button>
          )}
        </div>
        {visible.length > 1 && (
          <button
            type="button"
            onClick={handleActivateAll}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
          >
            ⚡ {PENDING_ALERT_CONFIG.copy.activateAllBtn} ({visible.length})
          </button>
        )}
      </div>
    </div>
  )
}

export default PendingActivationAlert
