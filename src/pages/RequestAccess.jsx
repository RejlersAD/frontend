/**
 * RequestAccess — /request-access
 *
 * Shows all available modules grouped by discipline.
 * For each module the user does NOT yet have access to, a "Request Access"
 * button is shown.  Clicking it opens a short reason modal, then POSTs to
 * /rbac/access-requests/.
 *
 * My Requests tab shows the user's own pending / approved / denied history.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import rbacService from '../services/rbac.service';

// ── Soft-coded constants ────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL     = 'tanzeem.agra@rejlers.ae';
const MAX_REASON_CHARS      = 500;
const TAB_BROWSE            = 'browse';
const TAB_MY_REQUESTS       = 'my-requests';

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100  text-green-800',
  denied:   'bg-red-100    text-red-800',
};

const STATUS_LABELS = {
  pending:  'Pending Review',
  approved: 'Approved',
  denied:   'Denied',
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Small helpers ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function RequestModal({ module, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onSubmit(module.id, reason);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Request Access</h2>
        <p className="text-sm text-gray-500 mb-4">
          Module: <span className="font-medium text-gray-700">{module.name}</span>
        </p>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
            rows={4}
            maxLength={MAX_REASON_CHARS}
            placeholder="Why do you need access to this module?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">
            {reason.length}/{MAX_REASON_CHARS}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Your request will be reviewed by the Super Administrator (
            <a href={`mailto:${SUPER_ADMIN_EMAIL}`} className="underline">{SUPER_ADMIN_EMAIL}</a>
            ).
          </p>
          <div className="flex gap-3 mt-5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function RequestAccess() {
  const { user } = useSelector((s) => s.auth);

  const [tab,          setTab]          = useState(TAB_BROWSE);
  const [allModules,   setAllModules]   = useState([]);
  const [userModules,  setUserModules]  = useState([]); // codes the user already has
  const [myRequests,   setMyRequests]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [modalModule,  setModalModule]  = useState(null); // module obj for request modal

  // ── Load data ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [modsRes, reqsRes, meRes] = await Promise.all([
        rbacService.getModules(),
        rbacService.getAccessRequests(),
        rbacService.getCurrentUser(),
      ]);

      const mods   = modsRes?.data?.results   ?? modsRes?.data   ?? [];
      const reqs   = reqsRes?.data?.results   ?? reqsRes?.data   ?? [];
      const me     = meRes?.data ?? meRes;

      setAllModules(mods);
      setMyRequests(reqs);

      // Extract module codes already granted to this user
      const grantedCodes = (me?.modules ?? []).map((m) =>
        typeof m === 'string' ? m : m.code
      );
      setUserModules(grantedCodes);
    } catch {
      setError('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Set of module IDs with a pending request (prevent double submit) ────────
  const pendingModuleIds = useMemo(
    () => new Set(myRequests.filter((r) => r.status === 'pending').map((r) => r.module)),
    [myRequests]
  );

  // ── Modules the user does NOT have ─────────────────────────────────────────
  const availableModules = useMemo(
    () => allModules.filter((m) => m.is_active && !userModules.includes(m.code)),
    [allModules, userModules]
  );

  // ── Submit request ──────────────────────────────────────────────────────────
  async function handleSubmit(moduleId, reason) {
    setError('');
    setSuccessMsg('');
    try {
      await rbacService.createAccessRequest({ module: moduleId, reason });
      setSuccessMsg('Request submitted! The Super Administrator will review it shortly.');
      setModalModule(null);
      load(); // refresh lists
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        'Failed to submit request.';
      setError(detail);
      setModalModule(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Request Access</h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse available modules and request access from your administrator.
            Requests are reviewed by{' '}
            <a href={`mailto:${SUPER_ADMIN_EMAIL}`} className="text-blue-600 underline">
              {SUPER_ADMIN_EMAIL}
            </a>.
          </p>
        </div>

        {/* Flash messages */}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {[
            { key: TAB_BROWSE,      label: 'Browse Modules'  },
            { key: TAB_MY_REQUESTS, label: `My Requests${myRequests.length ? ` (${myRequests.length})` : ''}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Loading…
          </div>
        ) : tab === TAB_BROWSE ? (

          /* ── Browse tab ─────────────────────────────────────────────────── */
          availableModules.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-12">
              You already have access to all available modules.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableModules.map((mod) => {
                const isPending = pendingModuleIds.has(mod.id);
                return (
                  <div
                    key={mod.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{mod.name}</p>
                        <p className="text-xs text-gray-400">{mod.code}</p>
                      </div>
                      {isPending && <Badge status="pending" />}
                    </div>
                    {mod.description && (
                      <p className="text-xs text-gray-500">{mod.description}</p>
                    )}
                    <button
                      disabled={isPending}
                      onClick={() => !isPending && setModalModule(mod)}
                      className={`mt-auto self-start text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        isPending
                          ? 'bg-gray-100 text-gray-400 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isPending ? 'Request Pending' : 'Request Access'}
                    </button>
                  </div>
                );
              })}
            </div>
          )

        ) : (

          /* ── My Requests tab ────────────────────────────────────────────── */
          myRequests.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-12">
              You have not submitted any access requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm"
                >
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{req.module_name}</p>
                    <p className="text-xs text-gray-400">{req.module_code}</p>
                    {req.reason && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{req.reason}"</p>
                    )}
                    {req.admin_note && (
                      <p className="text-xs text-blue-600 mt-1">Admin note: {req.admin_note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge status={req.status} />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {modalModule && (
        <RequestModal
          module={modalModule}
          onClose={() => setModalModule(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
