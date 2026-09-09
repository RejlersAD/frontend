import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  KeyIcon,
  LinkIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import salesService from "../../services/sales.service";

const emptyForm = {
  name: "Sales Outlook intake",
  tenant_id: "",
  client_id: "",
  mailbox_address: "",
  auth_mode: "delegated",
  enabled: true,
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

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
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
        if (!active) return;
        const existing = rows(payload)[0] || null;
        setConnection(existing);
        setForm(
          existing
            ? {
                name: existing.name,
                tenant_id: existing.tenant_id,
                client_id: existing.client_id,
                mailbox_address: existing.mailbox_address,
                auth_mode: "delegated",
                enabled: existing.enabled,
              }
            : emptyForm,
        );
      })
      .catch((requestError) => {
        if (active)
          setError(
            errorMessage(
              requestError,
              "Mailbox configuration could not be loaded.",
            ),
          );
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

  const persist = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = connection
        ? await salesService.patchMailboxConnection(connection.id, form)
        : await salesService.createMailboxConnection(form);
      setConnection(saved);
      setNotice("Mailbox configuration saved.");
      return saved;
    } catch (requestError) {
      setError(
        errorMessage(requestError, "Mailbox configuration could not be saved."),
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    await persist();
  };

  const testConnection = async () => {
    const saved = await persist();
    if (!saved) return;
    setTesting(true);
    setError("");
    setNotice("");
    try {
      const result = await salesService.testMailboxConnection(saved.id);
      setConnection((current) => ({
        ...current,
        last_status: "connected",
        last_health_check_at: new Date().toISOString(),
        last_error: "",
        ...result,
      }));
      setNotice(
        `Connected to ${result.mailbox_address}. Inbox contains ${result.total_item_count ?? 0} messages (${result.unread_item_count ?? 0} unread).`,
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

  const connectOutlook = async () => {
    const saved = await persist();
    if (!saved) return;
    setConnecting(true);
    setError("");
    try {
      const result = await salesService.connectOutlook(saved.id);
      window.location.assign(result.authorization_url);
    } catch (requestError) {
      setError(
        errorMessage(requestError, "Microsoft sign-in could not be started."),
      );
      setConnecting(false);
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
      setError(
        errorMessage(requestError, "Outlook could not be disconnected."),
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = connection?.last_status === "connected";
  const tested = Boolean(connection?.last_health_check_at);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-mailbox-dialog-title"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex gap-3">
            <span className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
              <EnvelopeIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                Sales administration
              </p>
              <h2
                id="sales-mailbox-dialog-title"
                className="mt-0.5 text-xl font-bold text-slate-950"
              >
                Outlook mailbox connection
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Connect your Rejlers mailbox using Microsoft sign-in.
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

        <form onSubmit={submit} className="space-y-5 p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading mailbox configuration…
            </p>
          ) : (
            <>
              <div
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                  connected
                    ? "border-emerald-200 bg-emerald-50/70"
                    : connection?.last_status === "error"
                      ? "border-rose-200 bg-rose-50/70"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                {connected ? (
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 text-emerald-600" />
                ) : connection?.last_status === "error" ? (
                  <ExclamationCircleIcon className="mt-0.5 h-5 w-5 text-rose-600" />
                ) : (
                  <EnvelopeIcon className="mt-0.5 h-5 w-5 text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {connected
                      ? "Connection verified"
                      : connection?.last_status === "error"
                        ? "Connection requires attention"
                        : "Connection not tested"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {tested
                      ? `Last tested ${new Date(connection.last_health_check_at).toLocaleString()}`
                      : "Save the Microsoft application details, then sign in."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Connection name
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    required
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Microsoft Entra tenant ID
                  <input
                    value={form.tenant_id}
                    onChange={(event) =>
                      setForm({ ...form, tenant_id: event.target.value })
                    }
                    required
                    autoComplete="off"
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Application / client ID
                  <input
                    value={form.client_id}
                    onChange={(event) =>
                      setForm({ ...form, client_id: event.target.value })
                    }
                    required
                    autoComplete="off"
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Your Outlook email
                  <input
                    type="email"
                    value={form.mailbox_address}
                    onChange={(event) =>
                      setForm({ ...form, mailbox_address: event.target.value })
                    }
                    required
                    placeholder="your.name@rejlers.ae"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
                <div className="flex gap-3">
                  <KeyIcon className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="text-sm font-semibold text-amber-950">
                      Runtime credential
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      Application credential:{" "}
                      <strong>
                        {connection?.secret_configured
                          ? "configured"
                          : "not configured"}
                      </strong>
                      . Token encryption:{" "}
                      <strong>
                        {connection?.token_encryption_configured
                          ? "configured"
                          : "not configured"}
                      </strong>
                      . These protected values are never displayed here.
                    </p>
                  </div>
                </div>
              </div>

              {connection?.delegated_connected && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-950">
                    {connection.delegated_account_name || "Microsoft account"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Connected as {connection.mailbox_address}. RADAI can read
                    only mailbox content permitted for your Microsoft account.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm({ ...form, enabled: event.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Enable this mailbox for Sales intake
              </label>

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
            <button
              type="submit"
              disabled={
                loading || saving || testing || connecting || disconnecting
              }
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            >
              {saving && !testing ? "Saving…" : "Save configuration"}
            </button>
            <button
              type="button"
              onClick={testConnection}
              disabled={
                loading ||
                saving ||
                testing ||
                connecting ||
                disconnecting ||
                !connection?.delegated_connected
              }
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            >
              {testing ? "Testing connection…" : "Save & test connection"}
            </button>
            {connection?.delegated_connected ? (
              <button
                type="button"
                onClick={disconnectOutlook}
                disabled={
                  loading || saving || testing || connecting || disconnecting
                }
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {disconnecting ? "Disconnectingâ€¦" : "Disconnect Outlook"}
              </button>
            ) : (
              <button
                type="button"
                onClick={connectOutlook}
                disabled={
                  loading || saving || testing || connecting || disconnecting
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
                {connecting
                  ? "Opening Microsoftâ€¦"
                  : "Connect my Outlook account"}
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}

SalesMailboxConnectionDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
