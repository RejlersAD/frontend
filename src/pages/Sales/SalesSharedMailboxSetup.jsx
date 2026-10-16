import { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { XMarkIcon } from "@heroicons/react/24/outline";
import useModalAccessibility from "../../hooks/useModalAccessibility";
import salesService from "../../services/sales.service";

const fields = [
  ["name", "Connection name", 120],
  ["mailbox_address", "Mailbox address", 254],
  ["tenant_id", "Directory (tenant) ID", 100],
  ["client_id", "Application (client) ID", 100],
];
const valuesFrom = (record) => Object.fromEntries(fields.map(([key]) => [key, record?.[key] || ""]));
const normalized = (values) => ({
  ...Object.fromEntries(fields.map(([key]) => [key, values[key].trim()])),
  mailbox_address: values.mailbox_address.trim().toLowerCase(),
});
const matches = (record, values) => record?.auth_mode === "application"
  && typeof record.id === "string" && Boolean(record.id)
  && record.mailbox_address?.toLowerCase() === values.mailbox_address
  && record.tenant_id === values.tenant_id && record.client_id === values.client_id;
const syncLabels = {
  not_configured: "Not configured", paused: "Paused", queued: "Queued",
  running: "Syncing", retrying: "Retrying", blocked: "Needs attention", up_to_date: "Up to date",
};
const inputClass = "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const primaryClass = "rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";

export default function SalesSharedMailboxSetup({ initialConnection, access, onClose }) {
  const headingId = useId();
  const descriptionId = useId();
  const [values, setValues] = useState(() => valuesFrom(initialConnection));
  const [connection, setConnection] = useState(initialConnection);
  const [editing, setEditing] = useState(!initialConnection);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [denied, setDenied] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [tested, setTested] = useState(false);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const operation = useRef(0);
  const pending = useRef(false);
  const currentAccess = useRef(access);
  currentAccess.current = access;
  const close = () => onClose(connection);
  const dialogRef = useModalAccessibility(true, close, Boolean(busy));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current += 1; };
  }, []);

  const start = (name) => {
    if (pending.current || denied || !currentAccess.current.canManage) return null;
    pending.current = true;
    const request = ++operation.current;
    setBusy(name);
    setError("");
    setNotice("");
    return () => mounted.current && request === operation.current && currentAccess.current.canManage;
  };
  const finish = (active) => {
    if (active()) { pending.current = false; setBusy(""); }
  };
  const failure = (requestError, fallback) => {
    const status = requestError?.response?.status;
    if (status === 401 || status === 403 || status === 404) {
      setDenied(true);
      setError(status === 401 ? "Sign in again to configure this mailbox."
        : "You no longer have access to configure this mailbox. Your entered details are retained.");
    } else setError(fallback);
  };
  const remember = (record) => {
    setConnection(record);
    setValues(valuesFrom(record));
    setEditing(false);
    setUncertain(false);
    setFieldErrors({});
    setTested(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (uncertain || !(connection ? currentAccess.current.canUpdate : currentAccess.current.canCreate)) return;
    const payload = normalized(values);
    const invalid = Object.fromEntries(fields.filter(([key]) => !payload[key]).map(([key]) => [key, "This field is required."]));
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) return;
    const active = start("save");
    if (!active) return;
    try {
      const result = connection
        ? await salesService.patchMailboxConnection(connection.id, payload)
        : await salesService.createMailboxConnection({ ...payload, auth_mode: "application", enabled: false });
      if (!active()) return;
      if (!matches(result, payload)) throw new Error("Unconfirmed connection response");
      remember(result);
      setNotice("Mailbox details saved. Test the Microsoft connection next.");
    } catch (requestError) {
      if (!active()) return;
      const data = requestError?.response?.data;
      const errors = Object.fromEntries(fields.flatMap(([key, label]) => {
        const message = Array.isArray(data?.[key]) ? data[key][0] : data?.[key];
        if (typeof message !== "string") return [];
        const duplicate = key === "mailbox_address" && /already exists|already configured/i.test(message);
        return [[key, duplicate ? "This mailbox connection already exists. Check the saved mailbox."
          : `Check ${label.toLowerCase()} and try again.`]];
      }));
      setFieldErrors(errors);
      const status = requestError?.response?.status;
      const ambiguous = !status || status >= 500;
      setUncertain(ambiguous);
      failure(requestError, ambiguous
        ? "The save could not be confirmed. Check for the saved mailbox before trying again."
        : "Mailbox details could not be saved. Review the highlighted fields or check for an existing mailbox.");
    } finally { finish(active); }
  };

  const checkSaved = async () => {
    const active = start("check");
    if (!active) return;
    try {
      const wanted = normalized(values);
      const matching = [];
      let page = 1;
      while (page !== null) {
        const payload = await salesService.getMailboxConnections({ page, page_size: 100 });
        if (!active()) return;
        const rows = Array.isArray(payload) ? payload : payload?.results;
        if (!Array.isArray(rows)) throw new Error("Invalid mailbox list");
        matching.push(...rows.filter((record) => matches(record, wanted)));
        const next = Array.isArray(payload) ? null : payload.next;
        if (next == null) page = null;
        else {
          if (typeof next !== "string" || !next.trim()) throw new Error("Invalid mailbox page");
          const pages = new URL(next, window.location.origin).searchParams.getAll("page");
          const nextPage = Number(pages[0]);
          if (pages.length !== 1 || !/^[1-9]\d*$/.test(pages[0]) || nextPage !== page + 1 || page >= 100) throw new Error("Invalid mailbox page");
          page = nextPage;
        }
      }
      if (!active()) return;
      if (matching.length === 1) {
        remember(matching[0]);
        setNotice("A matching saved mailbox was found. Review its details and test the connection.");
      } else if (matching.length === 0) {
        setUncertain(false);
        setNotice("No saved mailbox matches these details. You can review them and retry saving.");
      } else setError("More than one mailbox matches. Ask an administrator to review the connections.");
    } catch (requestError) {
      if (active()) failure(requestError, "Saved mailboxes could not be checked. Your entered details are retained.");
    } finally { finish(active); }
  };

  const testConnection = async () => {
    const active = start("test");
    if (!active) return;
    setTested(false);
    try {
      const result = await salesService.testMailboxConnection(connection.id);
      if (!active()) return;
      if (result?.connected !== true) throw new Error("Connection not verified");
      if (result.mailbox_address?.trim().toLowerCase() !== connection.mailbox_address.trim().toLowerCase()) {
        setError("Mailbox details changed or could not be confirmed. Close and reopen setup to review them before testing again.");
        return;
      }
      setConnection((current) => ({ ...current, secret_configured: true, last_status: "connected" }));
      setTested(true);
      setNotice("Microsoft connection verified. You can now browse this mailbox.");
    } catch (requestError) {
      if (active()) failure(requestError, "Microsoft connection could not be verified. Check the mailbox, application IDs, server credential and Microsoft mailbox access, then test again.");
    } finally { finish(active); }
  };

  const configureSync = async (enabled) => {
    if (!currentAccess.current.canSync || (enabled && !tested)) return;
    const active = start("sync");
    if (!active) return;
    try {
      const result = await salesService.configureMailboxSync(connection.id, enabled, {
        mailbox_address: connection.mailbox_address,
        tenant_id: connection.tenant_id,
        client_id: connection.client_id,
      });
      if (!active()) return;
      if (result?.enabled !== enabled || result?.sync?.enabled !== enabled || !Object.hasOwn(syncLabels, result.sync.status)) throw new Error("Unconfirmed sync response");
      setConnection((current) => ({ ...current, enabled, sync: result.sync }));
      setNotice(enabled ? "Automatic sync enabled. Capture progress depends on the running background services."
        : "Automatic sync paused. Saved emails and sync progress are retained.");
    } catch (requestError) {
      if (active()) {
        if (requestError?.response?.status === 409) {
          setTested(false);
          setError("Mailbox details changed. Close and reopen setup to review them before enabling sync.");
        } else failure(requestError, "The sync change could not be confirmed. Refresh mailbox setup to check its status. Automatic sync requires the server setting, worker and scheduler.");
      }
    } finally { finish(active); }
  };

  const identityProtected = connection && (connection.sync?.saved_count > 0
    || (connection.sync?.status && connection.sync.status !== "not_configured"));
  const syncEnabled = connection?.sync?.enabled === true;
  const syncStatus = connection?.sync?.status;
  const syncLabel = syncStatus === "up_to_date" && connection.sync.initial_sync_complete !== true
    ? "Syncing" : syncLabels[syncStatus] || "Unavailable";

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId} tabIndex={-1} className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
        <div><h2 id={headingId} className="text-lg font-semibold text-slate-900">{initialConnection ? "Shared mailbox setup" : "Add shared mailbox"}</h2>
          <p id={descriptionId} className="mt-1 text-sm text-slate-600">Connect an existing Microsoft mailbox to Email Intake.</p></div>
        <button type="button" onClick={close} disabled={Boolean(busy)} aria-label="Close mailbox setup" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><XMarkIcon className="h-5 w-5" aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto p-5">
        <p className="mb-4 text-sm leading-6 text-slate-600">Use the IDs from your Microsoft Entra application. Its client secret is managed on the server.</p>
        {error && <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
        {denied && <p className="mb-4 text-sm text-slate-600">Close this dialog and reload Email Intake after your access is restored.</p>}
        <form onSubmit={save}>
          <fieldset disabled={Boolean(busy) || denied || uncertain || !editing} className="grid min-w-0 gap-4">
            {fields.map(([key, label, maxLength]) => <div key={key} className="min-w-0">
              <label htmlFor={`${headingId}-${key}`} className="text-sm font-semibold text-slate-700">{label}</label>
              <input id={`${headingId}-${key}`} name={key} type={key === "mailbox_address" ? "email" : "text"} autoComplete="off" spellCheck={false} required disabled={Boolean(busy) || denied || uncertain || !editing} maxLength={maxLength} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `${headingId}-${key}-error` : undefined} className={inputClass} />
              {fieldErrors[key] && <p id={`${headingId}-${key}-error`} className="mt-1 text-sm text-rose-800">{fieldErrors[key]}</p>}
            </div>)}
          </fieldset>
          {editing && <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" disabled={Boolean(busy) || denied || uncertain || !(connection ? access.canUpdate : access.canCreate)} className={primaryClass}>{busy === "save" ? "Saving…" : connection ? "Save changes" : "Save mailbox"}</button>
            {(uncertain || error) && <button type="button" onClick={checkSaved} disabled={Boolean(busy) || denied} className="sales-email-button">{busy === "check" ? "Checking…" : "Check saved mailbox"}</button>}
          </div>}
        </form>
        {connection && !editing && <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-700">Mailbox saved. {tested ? "Connection verified in this session." : "Test the connection to verify current Microsoft access."}</p>
          {connection.secret_configured === false && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The Microsoft application credential was missing when these details were loaded. Ask your server administrator to configure it, then test again.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={testConnection} disabled={Boolean(busy) || denied} className="sales-email-button">{busy === "test" ? "Testing…" : "Test connection"}</button>
            {!identityProtected && access.canUpdate && <button type="button" onClick={() => { setEditing(true); setTested(false); setError(""); setNotice(""); }} disabled={Boolean(busy) || denied} className="sales-email-button">Edit details</button>}
          </div>
          {identityProtected && <p className="text-xs leading-5 text-slate-600">Mailbox identity is protected once saved email or sync history exists.</p>}
          <section aria-label="Automatic email sync" className="rounded-md border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Automatic email sync</h3>
            <p className="mt-1 text-sm text-slate-700">Status: {syncLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enabling sync saves existing and new incoming emails in RADAI. Initial import may take time.</p>
            {syncEnabled && connection.sync.initial_sync_complete !== true && <p className="mt-2 text-sm text-slate-600">Initial import is not yet confirmed complete.</p>}
            {access.canSync && <button type="button" onClick={() => configureSync(!syncEnabled)} disabled={Boolean(busy) || denied || (!syncEnabled && !tested)} className="sales-email-button mt-3">{busy === "sync" ? "Updating…" : syncEnabled ? "Pause automatic sync" : "Enable automatic sync"}</button>}
            {access.canSync && !syncEnabled && !tested && <p className="mt-2 text-xs text-slate-600">Test the connection successfully before enabling sync.</p>}
            {!access.canSync && <p className="mt-2 text-xs text-slate-600">Your account does not have permission to change automatic sync.</p>}
          </section>
        </div>}
      </div>
      <footer className="flex justify-end border-t border-slate-200 p-4">
        <button type="button" onClick={close} disabled={Boolean(busy)} className="sales-email-button">{connection ? "Done" : "Cancel"}</button>
      </footer>
    </section>
  </div>;
}

SalesSharedMailboxSetup.propTypes = {
  initialConnection: PropTypes.object,
  access: PropTypes.shape({ canManage: PropTypes.bool, canCreate: PropTypes.bool, canUpdate: PropTypes.bool, canSync: PropTypes.bool }).isRequired,
  onClose: PropTypes.func.isRequired,
};
