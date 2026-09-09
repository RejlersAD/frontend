import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  LinkIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import salesService from "../../services/sales.service";

const rows = (payload) =>
  Array.isArray(payload) ? payload : (payload?.results ?? []);

const errorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail || error?.response?.data?.error;
  if (detail) return detail;
  const data = error?.response?.data;
  if (data && typeof data === "object") return JSON.stringify(data);
  return fallback;
};

export default function SalesMailboxConnectionDialog({ open, onClose }) {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");

    const query = new URLSearchParams(window.location.search);
    const outlookResult = query.get("outlook");
    const outlookReason = query.get("reason");
    if (outlookResult === "connected") {
      setNotice("Your Outlook account was connected successfully.");
    } else if (outlookResult === "error") {
      setError(outlookReason || "Microsoft sign-in could not be completed.");
    }
    if (outlookResult) {
      query.delete("outlook");
      query.delete("reason");
      const suffix = query.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${suffix ? `?${suffix}` : ""}`,
      );
    }

    salesService
      .getMailboxConnections({ mine: true })
      .then((payload) => {
        if (active) setConnection(rows(payload)[0] || null);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            errorMessage(
              requestError,
              "Mailbox connection status could not be loaded.",
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const connectOutlook = async () => {
    setConnecting(true);
    setError("");
    setNotice("");
    try {
      const result = await salesService.connectMyOutlook();
      window.location.assign(result.authorization_url);
    } catch (requestError) {
      setError(
        errorMessage(requestError, "Microsoft sign-in could not be started."),
      );
      setConnecting(false);
    }
  };

  const testConnection = async () => {
    if (!connection) return;
    setTesting(true);
    setError("");
    setNotice("");
    try {
      const result = await salesService.testMailboxConnection(connection.id);
      setConnection((current) => ({
        ...current,
        last_status: "connected",
        last_health_check_at: new Date().toISOString(),
        last_error: "",
        ...result,
      }));
      setNotice(
        `Connection verified. Inbox contains ${result.total_item_count ?? 0} messages (${result.unread_item_count ?? 0} unread).`,
      );
    } catch (requestError) {
      const message = errorMessage(
        requestError,
        "Microsoft Graph connection test failed.",
      );
      setConnection((current) => ({
        ...current,
        last_status: "error",
        last_error: message,
      }));
      setError(message);
    } finally {
      setTesting(false);
    }
  };

  const disconnectOutlook = async () => {
    if (!connection) return;
    setDisconnecting(true);
    setError("");
    setNotice("");
    try {
      const updated = await salesService.disconnectOutlook(connection.id);
      setConnection(updated);
      setNotice("Your Outlook account has been disconnected from RADAI.");
    } catch (requestError) {
      setError(errorMessage(requestError, "Outlook could not be disconnected."));
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = Boolean(connection?.delegated_connected);
  const busy = loading || testing || connecting || disconnecting;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-mailbox-dialog-title"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex gap-3">
            <span className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
              <EnvelopeIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="sales-mailbox-dialog-title"
                className="text-xl font-bold text-slate-950"
              >
                Connect Outlook
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Link your own Rejlers mailbox securely with Microsoft.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Outlook connection"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading Outlook connection…
            </p>
          ) : (
            <>
              <div
                className={`flex items-start gap-3 rounded-lg border px-4 py-4 ${
                  connected
                    ? "border-emerald-200 bg-emerald-50/70"
                    : connection?.last_status === "error"
                      ? "border-rose-200 bg-rose-50/70"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                {connected ? (
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : connection?.last_status === "error" ? (
                  <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                ) : (
                  <EnvelopeIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {connected
                      ? "Outlook connected"
                      : connection?.last_status === "error"
                        ? "Connection requires attention"
                        : "Outlook is not connected"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {connected
                      ? `${connection.delegated_account_name || "Microsoft account"} · ${connection.mailbox_address}`
                      : "Sign in with the Microsoft account whose inbox you want RADAI to process."}
                  </p>
                  {connection?.last_health_check_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      Last verified {new Date(connection.last_health_check_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {notice && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {notice}
                </p>
              )}
              {error && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </p>
              )}
            </>
          )}

          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            {connected && (
              <button
                type="button"
                onClick={testConnection}
                disabled={busy}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
            )}
            {connected ? (
              <button
                type="button"
                onClick={disconnectOutlook}
                disabled={busy}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect Outlook"}
              </button>
            ) : (
              <button
                type="button"
                onClick={connectOutlook}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
                {connecting ? "Opening Microsoft…" : "Continue with Microsoft"}
              </button>
            )}
          </footer>
        </div>
      </section>
    </div>
  );
}

SalesMailboxConnectionDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
