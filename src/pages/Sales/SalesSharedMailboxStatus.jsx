import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowPathIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import salesService from "../../services/sales.service";

const STATUSES = {
  connected: {
    label: "Connected",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  error: {
    label: "Needs attention",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  not_tested: {
    label: "Not tested",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
};
const UNKNOWN_STATUS = {
  label: "Unknown",
  tone: "border-slate-200 bg-slate-50 text-slate-700",
};

const nextPage = (next, currentPage, visited) => {
  if (next == null) return null;
  if (typeof next !== "string" || !next.trim()) {
    throw new Error("Invalid mailbox pagination.");
  }
  const values = new URL(next, window.location.origin).searchParams.getAll("page");
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) {
    throw new Error("Invalid mailbox pagination.");
  }
  const page = Number(values[0]);
  if (
    !Number.isSafeInteger(page) ||
    page !== currentPage + 1 ||
    visited.has(page) ||
    visited.size >= 100
  ) {
    throw new Error("Invalid mailbox pagination.");
  }
  return page;
};

const checkedDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function SalesSharedMailboxStatus() {
  const headingId = useId();
  const mounted = useRef(false);
  const requestId = useRef(0);
  const [state, setState] = useState({
    mailboxes: null,
    loading: true,
    error: "",
    outdated: false,
  });

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const active = () => mounted.current && requestId.current === currentRequest;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    try {
      const mailboxes = [];
      const visited = new Set();
      let page = 1;
      while (page !== null) {
        visited.add(page);
        const payload = await salesService.getMailboxConnections({
          page,
          page_size: 100,
        });
        if (!active()) return;
        const records = Array.isArray(payload) ? payload : payload?.results;
        if (
          !Array.isArray(records) ||
          records.some(
            (record) =>
              !record ||
              typeof record !== "object" ||
              typeof record.auth_mode !== "string",
          )
        ) {
          throw new Error("Invalid mailbox response.");
        }
        records.forEach((record) => {
          if (record.auth_mode !== "application") return;
          if (
            typeof record.mailbox_address !== "string" ||
            !record.mailbox_address.trim()
          ) {
            throw new Error("Invalid mailbox response.");
          }
          mailboxes.push({
            address: record.mailbox_address,
            name: typeof record.name === "string" ? record.name : "",
            status:
              typeof record.last_status === "string" ? record.last_status : "",
            checkedAt:
              typeof record.last_health_check_at === "string"
                ? record.last_health_check_at
                : null,
            enabled: record.enabled,
          });
        });
        page = Array.isArray(payload)
          ? null
          : nextPage(payload.next, page, visited);
      }
      if (active()) {
        setState({ mailboxes, loading: false, error: "", outdated: false });
      }
    } catch (error) {
      if (!active()) return;
      const status = error?.response?.status;
      const denied = status === 401 || status === 403;
      setState((previous) => ({
        mailboxes: denied ? null : previous.mailboxes,
        loading: false,
        outdated: !denied && previous.mailboxes !== null,
        error:
          status === 401
            ? "Sign in again to view shared mailbox status."
            : status === 403
              ? "You do not have access to shared mailbox status."
              : previous.mailboxes !== null
                ? "Mailbox status is outdated. Refresh failed. Try again."
                : "Mailbox status could not be loaded. Try again.",
      }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [load]);

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-md border border-slate-200 bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-base font-semibold text-slate-900"
        >
          <EnvelopeIcon className="h-5 w-5 text-blue-700" aria-hidden="true" />
          Shared mailbox
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={state.loading}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"
        >
          <ArrowPathIcon
            className={`h-4 w-4 shrink-0 ${state.loading ? "animate-spin motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
          Refresh mailbox status
        </button>
      </header>
      <div className="border-t border-slate-200 px-5 py-4">
        <p
          role="status"
          className={state.loading ? "text-sm text-slate-600" : "sr-only"}
        >
          {state.loading
            ? state.mailboxes === null
              ? "Loading shared mailbox status…"
              : "Refreshing mailbox status…"
            : state.error
              ? ""
              : "Mailbox status loaded."}
        </p>
        {state.error && (
          <p
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {state.error}
          </p>
        )}
        {state.outdated && state.loading && (
          <p className="mt-2 text-sm text-amber-900">Mailbox status is outdated.</p>
        )}
        {state.mailboxes?.length > 0 && (
          <ul
            className={`divide-y divide-slate-200 ${state.loading || state.error ? "mt-3" : ""}`}
          >
            {state.mailboxes.map((mailbox) => {
              const status = Object.prototype.hasOwnProperty.call(
                STATUSES,
                mailbox.status,
              )
                ? STATUSES[mailbox.status]
                : UNKNOWN_STATUS;
              const checkedAt = checkedDate(mailbox.checkedAt);
              return (
                <li
                  key={mailbox.address}
                  className="flex min-w-0 flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    {mailbox.name && (
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {mailbox.name}
                      </p>
                    )}
                    <p className="break-all text-sm text-slate-700">
                      {mailbox.address}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Last checked:{" "}
                      {checkedAt ? (
                        <time dateTime={checkedAt.toISOString()}>
                          {checkedAt.toLocaleString()}
                        </time>
                      ) : mailbox.checkedAt ? (
                        "Unavailable"
                      ) : (
                        "Not checked"
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-xs text-slate-600">
                      {mailbox.enabled === true
                        ? "Email intake enabled"
                        : mailbox.enabled === false
                          ? "Email intake off"
                          : "Email intake status unknown"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!state.loading && !state.error && state.mailboxes?.length === 0 && (
          <p className="text-sm text-slate-600">
            No shared mailbox is available to your account.
          </p>
        )}
      </div>
    </section>
  );
}
