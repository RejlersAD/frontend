/**
 * Admin — Access Requests — /admin/access-requests
 *
 * Lists all module access requests submitted by users.
 * Admins can approve or deny each pending request with an optional note.
 * Status tabs allow quick filtering.
 */

import React, { useEffect, useState, useCallback } from 'react';
import rbacService from '../../services/rbac.service';

// ── Soft-coded constants ─────────────────────────────────────────────────────
const TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'denied',   label: 'Denied'   },
  { key: '',         label: 'All'      },
];

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

function Badge({ status }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ActionModal({ request, action, onClose, onConfirm }) {
  const [note, setNote]     = useState('');
  const [busy, setBusy]     = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await onConfirm(request.id, note);
    setBusy(false);
  }

  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className={`text-lg font-bold mb-1 ${isApprove ? 'text-green-700' : 'text-red-700'}`}>
          {isApprove ? 'Approve Request' : 'Deny Request'}
        </h2>
        <p className="text-sm text-gray-600 mb-1">
          User: <strong>{request.user_name || request.user_email}</strong>
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Module: <strong>{request.module_name}</strong>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Admin note <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
          rows={3}
          placeholder={isApprove ? 'Any message for the user…' : 'Reason for denial…'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-3 mt-5 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-60 ${
              isApprove
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy ? 'Processing…' : isApprove ? 'Approve' : 'Deny'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccessRequests() {
  const [tab,        setTab]        = useState('pending');
  const [requests,   setRequests]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [modal,      setModal]      = useState(null); // { request, action }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = tab ? { status: tab } : {};
      const res = await rbacService.getAccessRequests(params);
      setRequests(res?.data?.results ?? res?.data ?? []);
    } catch {
      setError('Failed to load access requests.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // ── Count pending for badge ──────────────────────────────────────────────
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  // ── Approve / Deny handlers ──────────────────────────────────────────────
  async function handleAction(id, note) {
    setError('');
    setSuccessMsg('');
    try {
      if (modal.action === 'approve') {
        await rbacService.approveAccessRequest(id, note);
        setSuccessMsg('Request approved. The user now has access to the module.');
      } else {
        await rbacService.denyAccessRequest(id, note);
        setSuccessMsg('Request denied.');
      }
      setModal(null);
      load();
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        'Action failed.';
      setError(detail);
      setModal(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Access Requests</h1>
            <p className="text-sm text-gray-500 mt-1">
              Review and manage module access requests from users.
            </p>
          </div>
          {tab !== 'pending' && pendingCount > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-800 font-semibold px-3 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
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

        {/* Status tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {TABS.map(({ key, label }) => (
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
              {key === 'pending' && pendingCount > 0 && tab !== 'pending' && (
                <span className="ml-1.5 bg-yellow-400 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-12">
            No {tab || ''} access requests found.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  {/* Left: user + module info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-800 text-sm">
                        {req.user_name || req.user_email}
                      </p>
                      <Badge status={req.status} />
                    </div>
                    <p className="text-xs text-gray-500">{req.user_email}</p>
                    <p className="text-sm text-gray-700 mt-1">
                      Module:{' '}
                      <span className="font-medium">{req.module_name}</span>{' '}
                      <span className="text-xs text-gray-400">({req.module_code})</span>
                    </p>
                    {req.reason && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Reason: "{req.reason}"
                      </p>
                    )}
                    {req.admin_note && (
                      <p className="text-xs text-blue-600 mt-1">
                        Admin note: {req.admin_note}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Submitted {new Date(req.created_at).toLocaleString()}
                      {req.reviewed_at && (
                        <> · Reviewed {new Date(req.reviewed_at).toLocaleString()}</>
                      )}
                      {req.reviewed_by_email && (
                        <> by {req.reviewed_by_email}</>
                      )}
                    </p>
                  </div>

                  {/* Right: action buttons (pending only) */}
                  {req.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setModal({ request: req, action: 'approve' })}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setModal({ request: req, action: 'deny' })}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action modal */}
      {modal && (
        <ActionModal
          request={modal.request}
          action={modal.action}
          onClose={() => setModal(null)}
          onConfirm={handleAction}
        />
      )}
    </div>
  );
}
