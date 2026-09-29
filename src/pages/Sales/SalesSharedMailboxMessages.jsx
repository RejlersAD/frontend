import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import salesService from "../../services/sales.service";
import SalesEmailBody from "./SalesEmailBody";
import SalesEmailDetectedInformation from "./SalesEmailDetectedInformation";
import SalesEmailAnalysis from "./SalesEmailAnalysis";
import SalesEmailOpportunityForm from "./SalesEmailOpportunityForm";
import useSalesEmailClients from "./useSalesEmailClients";
import { withoutCustomerMatch } from "./SalesEmailCustomerMatch";
import SalesEmailThreadRole, { selectedThreadSource, threadRole } from "./SalesEmailThreadRole";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const text = (value) => (typeof value === "string" ? value : "");
const directionLabels = { incoming: "Incoming", outgoing: "Outgoing", draft: "Draft", unknown: "Direction unknown" };
const directionBadge = (record) => {
  const direction = record.is_draft ? "draft" : record.direction;
  return <span className={`sales-email-status sales-email-direction-${direction}`} title={
    direction === "incoming" ? "Received by this shared mailbox"
      : direction === "outgoing" ? "Sent from or by this shared mailbox"
        : direction === "draft" ? "This message has not been sent"
          : "The available sender and recipient details do not establish the direction"
  }>{directionLabels[direction]}</span>;
};
const dateLabel = (value, includeTime = true) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

const connectionPage = (next, current, visited) => {
  if (next == null) return null;
  if (typeof next !== "string" || !next.trim()) throw new Error("Invalid page.");
  const pages = new URL(next, window.location.origin).searchParams.getAll("page");
  if (pages.length !== 1 || !/^[1-9]\d*$/.test(pages[0])) throw new Error("Invalid page.");
  const page = Number(pages[0]);
  if (!Number.isSafeInteger(page) || page !== current + 1 || visited.has(page) || visited.size >= 100) {
    throw new Error("Invalid page.");
  }
  return page;
};

const messageRecord = (record) => {
  if (!record || typeof record.id !== "string" || !record.id.trim()) {
    throw new Error("Invalid message.");
  }
  return {
    id: record.id,
    subject: text(record.subject),
    sender_name: text(record.sender_name),
    sender_email: text(record.sender_email),
    received_at: text(record.received_at),
    sent_at: text(record.sent_at),
    body_preview: text(record.body_preview),
    has_attachments: record.has_attachments === true,
    is_read: typeof record.is_read === "boolean" ? record.is_read : null,
    is_draft: record.is_draft === true,
    importance: text(record.importance),
    direction: typeof record.direction === "string" && Object.hasOwn(directionLabels, record.direction) ? record.direction : "unknown",
    thread_role: record.is_draft === true ? "draft" : threadRole(record.thread_role),
    thread_role_reason: text(record.thread_role_reason),
  };
};

const readState = (record) =>
  record.is_read === true ? "Read" : record.is_read === false ? "Unread" : "Read status unavailable";

const recipients = (records) => {
  if (!Array.isArray(records)) throw new Error("Invalid recipients.");
  return records.map((record) => {
    if (!record || typeof record !== "object") throw new Error("Invalid recipient.");
    const name = text(record.name);
    const email = text(record.email);
    return name && email ? `${name} <${email}>` : name || email;
  }).filter(Boolean).join(", ");
};

const messageDetail = (payload, expectedId) => {
  const message = messageRecord(payload);
  if (message.id !== expectedId || typeof payload.body_text !== "string") throw new Error("Invalid email.");
  const selectedSource = selectedThreadSource(payload.extracted_information?.analysis);
  return {
    ...message,
    thread_role: message.is_draft ? "draft" : selectedSource ? threadRole(selectedSource.thread_role) : message.thread_role,
    thread_role_reason: selectedSource ? text(selectedSource.thread_role_reason) : message.thread_role_reason,
    body: payload.body_text,
    bodyContent: Array.isArray(payload.body_content) ? payload.body_content : null,
    to: recipients(payload.to_recipients),
    cc: recipients(payload.cc_recipients),
    information: payload.extracted_information && typeof payload.extracted_information === "object" && !Array.isArray(payload.extracted_information) ? payload.extracted_information : {},
    canCreateOpportunity: payload.can_create_opportunity === true,
    sourceToken: text(payload.source_token),
  };
};

const accessError = (status) => {
  if (status === 401) return "Sign in again to view mailbox emails.";
  if (status === 403) return "You do not have access to this mailbox.";
  if (status === 404) return "This mailbox is no longer available. Refresh emails.";
  return "";
};

export default function SalesSharedMailboxMessages() {
  const requestId = useRef(0);
  const mounted = useRef(false);
  const [state, setState] = useState({ records: null, loading: true, error: "" });
  const [selectedId, setSelectedId] = useState("");

  const loadConnections = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const active = () => mounted.current && currentRequest === requestId.current;
    setState({ records: null, loading: true, error: "" });
    setSelectedId("");
    try {
      const connections = [];
      const ids = new Set();
      const visited = new Set();
      let page = 1;
      while (page !== null) {
        visited.add(page);
        const payload = await salesService.getMailboxConnections({ page, page_size: 100 });
        if (!active()) return;
        const records = Array.isArray(payload) ? payload : payload?.results;
        if (!Array.isArray(records)) throw new Error("Invalid connections.");
        for (const record of records) {
          if (!record || typeof record.auth_mode !== "string") throw new Error("Invalid connection.");
          if (record.auth_mode !== "application") continue;
          if (typeof record.id !== "string" || !record.id || !text(record.mailbox_address).trim() || ids.has(record.id)) {
            throw new Error("Invalid connection.");
          }
          ids.add(record.id);
          connections.push({ id: record.id, address: record.mailbox_address, name: text(record.name) });
        }
        page = Array.isArray(payload) ? null : connectionPage(payload.next, page, visited);
      }
      if (active()) {
        setState({ records: connections, loading: false, error: "" });
        setSelectedId(connections.length === 1 ? connections[0].id : "");
      }
    } catch (error) {
      if (!active()) return;
      setState({
        records: null,
        loading: false,
        error: accessError(error?.response?.status) || "Shared mailboxes could not be loaded. Try again.",
      });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadConnections();
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [loadConnections]);

  const connection = state.records?.find((record) => record.id === selectedId);
  return (
    <div className="sales-email-view">
      {state.loading && <p role="status" className="text-sm text-slate-600">Loading shared mailboxes…</p>}
      {state.error && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p role="alert" className="text-sm text-amber-900">{state.error}</p>
          <button type="button" onClick={loadConnections} className={buttonClass}>Try again</button>
        </div>
      )}
      {!state.loading && !state.error && state.records?.length === 0 && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">No shared mailbox is available to your account.</p>
          <button type="button" onClick={loadConnections} className={buttonClass}>Refresh mailboxes</button>
        </div>
      )}
      {state.records?.length > 1 && (
        <label className="block min-w-0 text-sm font-semibold text-slate-700">
          Mailbox
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="mt-1 block w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <option value="">Choose a mailbox</option>
            {state.records.map((record) => <option key={record.id} value={record.id}>{record.name ? `${record.name} · ` : ""}{record.address}</option>)}
          </select>
        </label>
      )}
      {connection && <MailboxEmails key={connection.id} connection={connection} />}
    </div>
  );
}

function MailboxEmails({ connection }) {
  const mounted = useRef(false);
  const pageRequest = useRef(0);
  const detailRequest = useRef(0);
  const nextStepRef = useRef(null);
  const [nextStepMessageId, setNextStepMessageId] = useState(null);
  const [page, setPage] = useState({
    records: null, loading: true, error: "", cursor: null, nextCursor: null, history: [],
  });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({ message: null, loading: false, error: "" });
  const [readFilter, setReadFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [conversion, setConversion] = useState(null);
  const redactClientMatch = useCallback(() => {
    setDetail((current) => current.message ? { ...current, message: { ...current.message, information: withoutCustomerMatch(current.message.information) } } : current);
  }, []);

  const loadPage = useCallback(async (cursor = null, history = []) => {
    const currentRequest = ++pageRequest.current;
    const active = () => mounted.current && currentRequest === pageRequest.current;
    detailRequest.current += 1;
    setNextStepMessageId(null);
    setSelectedId(null);
    setShowOpportunityForm(false);
    setConversion(null);
    setDetail({ message: null, loading: false, error: "" });
    setPage({ records: null, loading: true, error: "", cursor, nextCursor: null, history });
    try {
      const payload = await salesService.getMailboxMessages(connection.id, cursor ? { cursor } : {});
      if (!active()) return;
      if (
        !payload ||
        text(payload.mailbox_address).toLowerCase() !== connection.address.toLowerCase() ||
        !Array.isArray(payload.results) ||
        !(payload.next_cursor === null || (typeof payload.next_cursor === "string" && payload.next_cursor.trim())) ||
        (payload.next_cursor !== null && (payload.next_cursor === cursor || history.includes(payload.next_cursor)))
      ) throw new Error("Invalid mailbox page.");
      const records = payload.results.map(messageRecord);
      if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Duplicate messages.");
      setPage({ records, loading: false, error: "", cursor, nextCursor: payload.next_cursor, history });
    } catch (error) {
      if (!active()) return;
      const status = error?.response?.status;
      setPage({
        records: null, loading: false, cursor, nextCursor: null, history,
        refreshRequired: status === 400 || status === 404 || status === 410,
        error: accessError(status) || (status === 410
          ? "Mailbox page has expired. Refresh emails to continue."
          : status === 400
            ? "Mailbox page could not be opened. Refresh emails to continue."
            : "Mailbox emails could not be loaded. Try again."),
      });
    }
  }, [connection.id, connection.address]);

  useEffect(() => {
    mounted.current = true;
    loadPage();
    return () => {
      mounted.current = false;
      pageRequest.current += 1;
      detailRequest.current += 1;
    };
  }, [loadPage]);

  const focusNextStep = useCallback(() => {
    const target = nextStepRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  useEffect(() => {
    if (nextStepMessageId && detail.message?.id === nextStepMessageId && selectedId === nextStepMessageId) {
      focusNextStep();
      setNextStepMessageId(null);
    }
  }, [detail.message, selectedId, nextStepMessageId, focusNextStep]);

  const loadMessage = async (record, openNextStep = false) => {
    const currentRequest = ++detailRequest.current;
    const active = () => mounted.current && currentRequest === detailRequest.current;
    setSelectedId(record.id);
    setNextStepMessageId(openNextStep ? record.id : null);
    setShowOpportunityForm(false);
    setConversion(null);
    setDetail({ message: null, loading: true, error: "" });
    try {
      const payload = await salesService.getMailboxMessage(connection.id, record.id);
      if (!active()) return;
      setDetail({
        loading: false, error: "",
        message: messageDetail(payload, record.id),
      });
    } catch (error) {
      if (!active()) return;
      setNextStepMessageId(null);
      const status = error?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        pageRequest.current += 1;
        setSelectedId(null);
        setPage({
          records: null, nextCursor: null, cursor: null, history: [], loading: false,
          refreshRequired: status === 404,
          error: status === 404
            ? "This mailbox or email is no longer available. Refresh emails."
            : accessError(status),
        });
        setDetail({ message: null, loading: false, error: "" });
        return;
      }
      setDetail({ message: null, loading: false, error: "Email could not be loaded. Try again." });
    }
  };

  const openNextStep = (record) => {
    if (detail.message?.id === record.id && !detail.loading) {
      focusNextStep();
    } else {
      loadMessage(record, true);
    }
  };

  const selected = page.records?.find((record) => record.id === selectedId);
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (page.records || []).filter((record) => {
      if (readFilter === "unread" && record.is_read !== false) return false;
      if (readFilter === "read" && record.is_read !== true) return false;
      if (readFilter === "drafts" && !record.is_draft) return false;
      return !query || [record.subject, record.sender_name, record.sender_email, record.body_preview]
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [page.records, readFilter, search]);
  const changeFilter = (nextFilter, nextSearch = search) => {
    detailRequest.current += 1;
    setNextStepMessageId(null);
    setSelectedId(null);
    setShowOpportunityForm(false);
    setConversion(null);
    setDetail({ message: null, loading: false, error: "" });
    setReadFilter(nextFilter);
    setSearch(nextSearch);
  };
  const readFilters = [
    ["all", "All mail", page.records?.length],
    ["unread", "Unread", page.records?.filter((record) => record.is_read === false).length],
    ["read", "Read", page.records?.filter((record) => record.is_read === true).length],
    ["drafts", "Drafts", page.records?.filter((record) => record.is_draft).length],
  ];
  const mailboxUnavailable = () => {
    pageRequest.current += 1;
    detailRequest.current += 1;
    setNextStepMessageId(null);
    setSelectedId(null);
    setShowOpportunityForm(false);
    setConversion(null);
    setDetail({ message: null, loading: false, error: "" });
    setPage({ records: null, nextCursor: null, cursor: null, history: [], loading: false, refreshRequired: true, error: "This mailbox or email is no longer available. Refresh emails." });
  };
  return (
    <section aria-label="Shared mailbox messages" className="sales-email-mailbox">
      <div className="sales-email-card">
      <div className="sales-email-toolbar">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <nav aria-label="Email read status" aria-description="Filters and counts apply to the current page." className="flex flex-wrap items-center gap-1">
            {readFilters.map(([value, label, count]) => <button
              key={value}
              type="button"
              aria-pressed={readFilter === value}
              title={`${label} on this page`}
              onClick={() => changeFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${readFilter === value ? "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {label}<span className="rounded bg-white px-1.5 text-xs leading-5 text-slate-600">{count ?? "—"}</span>
            </button>)}
          </nav>
        </div>
        <div className="sales-email-toolbar-actions">
        <label className="sales-email-search">
          <span className="sr-only">Search emails on this page</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => changeFilter(readFilter, event.target.value)}
            placeholder="Search this page"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-[13px] placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          />
        </label>
        <button type="button" className={buttonClass} onClick={() => loadPage()} disabled={page.loading}>
          <ArrowPathIcon className={`h-4 w-4 ${page.loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
          Refresh emails
        </button>
        </div>
      </div>
      {page.error && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 p-4">
        <p role="alert" className="text-sm text-amber-900">{page.error}</p>
        {!page.refreshRequired && <button type="button" className={buttonClass} onClick={() => loadPage(page.cursor, page.history)}>Try again</button>}
      </div>}
      <div className="sales-email-grid">
        <aside aria-label="Mailbox emails" className="sales-email-list">
          <div className="sr-only" role="status">
            Page {page.history.length + 1}{page.records !== null && ` · ${page.records.length} emails on this page`}
          </div>
          {page.loading && <p role="status" className="p-5 text-sm text-slate-600">Loading mailbox emails…</p>}
          {!page.loading && !page.error && page.records?.length === 0 && <p className="p-5 text-sm text-slate-600">
            {page.cursor === null && page.nextCursor === null ? "No emails in this mailbox." : "No emails on this page."}
          </p>}
          {!page.loading && !page.error && page.records?.length > 0 && visibleRecords.length === 0 && <p className="p-5 text-sm text-slate-600">No matching emails on this page.</p>}
          <ul className="sales-email-list-scroll">
            {visibleRecords.map((record) => <li key={record.id} className={`sales-email-row sales-email-row-with-actions ${selectedId === record.id ? "sales-email-row-selected" : ""}`}>
              <button
                type="button"
                aria-label={`Open email: ${record.subject || "No subject"}`}
                aria-pressed={selectedId === record.id}
                onClick={() => loadMessage(record)}
                className="sales-email-row-open"
              >
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-slate-900">{record.sender_name || record.sender_email || "Sender unavailable"}</span>
                  <span className="shrink-0 text-xs text-slate-600">{dateLabel(record.received_at || record.sent_at, false)}</span>
                </span>
                <span className={`mt-1 block line-clamp-2 break-words text-slate-800 ${record.is_read === false ? "font-semibold" : "font-medium"}`}>{record.subject || "No subject"}</span>
                <span className="mt-1 block line-clamp-2 break-words text-xs leading-4 text-slate-600">{record.body_preview || "No email preview available."}</span>
              </button>
              <div className="sales-email-row-status">
                <span className="sales-email-status">{readState(record)}</span>
                {directionBadge(record)}
                <SalesEmailThreadRole role={record.thread_role} reason={record.thread_role_reason} hideDraft={record.is_draft || record.direction === "draft"} />
                <button type="button" className="sales-email-next-step" aria-label={`Next step: ${record.subject || "No subject"}`} onClick={() => openNextStep(record)}>
                  Next step <ArrowRightIcon className="h-3 w-3" aria-hidden="true" />
                </button>
                {record.has_attachments && <span className="inline-flex items-center gap-1"><PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />Attachments</span>}
              </div>
            </li>)}
          </ul>
          <nav aria-label="Email pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3">
            <button type="button" className={buttonClass} disabled={page.loading || page.history.length === 0} onClick={() => loadPage(page.history.at(-1), page.history.slice(0, -1))}>Previous page</button>
            <button type="button" className={buttonClass} disabled={page.loading || !page.nextCursor} onClick={() => loadPage(page.nextCursor, [...page.history, page.cursor])}>Next page</button>
          </nav>
        </aside>
        <section aria-label="Email preview" className="sales-email-preview">
          {detail.loading ? <p role="status" className="p-5 text-sm text-slate-600">Loading email…</p> : detail.error ? <div className="space-y-3 p-5">
            <p role="alert" className="text-sm text-amber-900">{detail.error}</p>
            {selected && <button type="button" className={buttonClass} onClick={() => loadMessage(selected)}>Retry email</button>}
          </div> : detail.message ? <>
            <header className="sales-email-preview-header">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded bg-slate-100 px-2 py-1">{readState(detail.message)}</span>
                {directionBadge(detail.message)}
                <SalesEmailThreadRole role={detail.message.thread_role} reason={detail.message.thread_role_reason} selected hideDraft={detail.message.is_draft || detail.message.direction === "draft"} />
                <button type="button" className="sales-email-next-step" onClick={() => openNextStep(detail.message)}>Next step <ArrowRightIcon className="h-3 w-3" aria-hidden="true" /></button>
                {detail.message.importance === "high" && <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">High importance</span>}
                {detail.message.has_attachments && <span className="inline-flex items-center gap-1"><PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />Has attachments</span>}
              </div>
              {detail.message.canCreateOpportunity && !conversion && <button type="button" onClick={() => setShowOpportunityForm(true)} className="inline-flex items-center gap-1.5 rounded-md bg-[#c83d25] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ac321e]"><PlusIcon className="h-4 w-4" aria-hidden="true" />Create opportunity</button>}
              </div>
              <h3 className="sales-email-subject mt-3">{detail.message.subject || "No subject"}</h3>
              <div className="sales-email-preview-meta mt-2">
                <span><span className="font-semibold">From: </span>{detail.message.sender_name && detail.message.sender_email ? `${detail.message.sender_name} <${detail.message.sender_email}>` : detail.message.sender_name || detail.message.sender_email || "Not available"}</span>
                <span><span className="font-semibold">Received: </span>{dateLabel(detail.message.received_at)}</span>
              </div>
              {conversion && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><p role="status">{conversion.created ? "Opportunity created." : "This email already has an opportunity."}</p><Link to={`/sales/opportunities?record=${encodeURIComponent(conversion.opportunity.id)}`} className="font-semibold underline underline-offset-2">Open opportunity</Link></div>}
            </header>
            <div className="sales-email-detail-grid">
              <section className="sales-email-reading-pane" aria-label="Email content" tabIndex={0}>
                <SalesEmailDetectedInformation information={detail.message.information} subject={detail.message.subject} />
                <h4 className="mt-6 text-sm font-semibold text-[#102a47]">Email preview</h4>
                <div className="sales-email-body-panel mt-3">
                <SalesEmailBody bodyText={detail.message.body || "This email has no text content."} bodyContent={detail.message.bodyContent} />
                </div>
              </section>
              <aside className="sales-email-source-panel" aria-label="Email analysis" tabIndex={0}>
                <SalesEmailAnalysis analysis={detail.message.information.analysis} nextStepRef={nextStepRef} />
                <details className="sales-email-analysis-metadata">
                <summary>Message details</summary>
                <dl className="mt-3 space-y-3 text-xs">
                  {[
                    ["Mailbox", connection.address],
                    ["To", detail.message.to || "Not available"],
                    ...(detail.message.cc ? [["Cc", detail.message.cc]] : []),
                    ["Received", dateLabel(detail.message.received_at)],
                    ...(detail.message.sent_at ? [["Sent", dateLabel(detail.message.sent_at)]] : []),
                  ].map(([label, value]) => <div key={label}>
                    <dt className="font-semibold text-slate-600">{label}</dt>
                    <dd className="mt-1 min-w-0 break-words leading-5 text-slate-800">{value}</dd>
                  </div>)}
                </dl>
                </details>
              </aside>
            </div>
          </> : <div className="py-12 text-center text-slate-500">
            <EnvelopeIcon className="mx-auto h-8 w-8" aria-hidden="true" />
            <p className="mt-3 text-sm">Select an email to read it.</p>
          </div>}
        </section>
      </div>
      </div>
      {showOpportunityForm && detail.message?.canCreateOpportunity && <MailboxOpportunityForm
        key={detail.message.id}
        connection={connection}
        message={detail.message}
        onClose={() => setShowOpportunityForm(false)}
        onUnavailable={mailboxUnavailable}
        onSourceReloaded={(message) => setDetail({ message, loading: false, error: "" })}
        onClientAccessDenied={redactClientMatch}
        onCreated={(result) => { setConversion(result); setShowOpportunityForm(false); }}
      />}
    </section>
  );
}

function MailboxOpportunityForm({ connection, message, onClose, onCreated, onUnavailable, onSourceReloaded, onClientAccessDenied }) {
  const mounted = useRef(false);
  const actionRequest = useRef(0);
  const submitting = useRef(false);
  const currentSource = useRef(message);
  const clients = useSalesEmailClients();
  const [clientChoice, setClientChoice] = useState("");
  const [state, setState] = useState({ submitting: false, error: message.sourceToken ? "" : "Reload email details before creating the opportunity.", fieldErrors: {}, reloadRequired: !message.sourceToken, reloading: false, refreshed: null });
  useEffect(() => {
    if (!clients.denied) return;
    currentSource.current = { ...currentSource.current, information: withoutCustomerMatch(currentSource.current.information) };
    setState((current) => current.refreshed ? { ...current, refreshed: { ...current.refreshed, information: withoutCustomerMatch(current.refreshed.information) } } : current);
    onClientAccessDenied();
  }, [clients.denied, onClientAccessDenied]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      actionRequest.current += 1;
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current || clients.loading || clients.error || !clientChoice || state.reloadRequired || state.reloading) return;
    if (!clients.records.some((record) => record.id === clientChoice)) return;
    const form = new FormData(event.currentTarget);
    const request = ++actionRequest.current;
    const active = () => mounted.current && request === actionRequest.current;
    const source = currentSource.current;
    submitting.current = true;
    setState((current) => ({ ...current, submitting: true, error: "", fieldErrors: {} }));
    try {
      const result = await salesService.convertMailboxMessage(connection.id, {
        message_id: source.id,
        source_token: source.sourceToken,
        deal_name: form.get("deal_name"),
        client: clientChoice,
        client_reference: form.get("client_reference"),
        estimated_value: form.get("estimated_value"),
        currency: form.get("currency"),
        expected_close_date: form.get("expected_close_date"),
        submission_due_date: form.get("submission_due_date") || null,
        scope_type: form.get("scope_type"),
        description: form.get("description"),
      });
      if (!active()) return;
      if (!text(result?.opportunity?.id) || typeof result.created !== "boolean") throw new Error("Invalid opportunity result.");
      onCreated({ opportunity: { id: result.opportunity.id }, created: result.created });
    } catch (error) {
      if (!active()) return;
      const status = error?.response?.status;
      if (status === 404) {
        onUnavailable();
        return;
      }
      const fieldErrors = {};
      if (status === 400) {
        for (const name of ["deal_name", "client", "client_reference", "estimated_value", "currency", "expected_close_date", "submission_due_date", "scope_type", "description"]) {
          const value = error?.response?.data?.[name];
          const first = Array.isArray(value) ? value[0] : value;
          if (typeof first === "string") fieldErrors[name] = first.slice(0, 500);
        }
      }
      const messages = {
        400: "Check the opportunity details and try again.",
        401: "Your session has expired. Sign in again to create an opportunity.",
        403: "You do not have permission to create an opportunity from this email.",
        409: "This email or opportunity has changed. Reload email details and review your entries.",
        410: "Email review has expired. Reload email details before creating the opportunity.",
      };
      const alreadyConverted = status === 409 && error?.response?.data?.code === "email_already_converted";
      const tokenInvalid = status === 400 && Boolean(error?.response?.data?.source_token);
      setState((current) => ({
        ...current,
        error: alreadyConverted
          ? "An opportunity already exists for this email with different details. Your entries have been kept."
          : tokenInvalid
            ? "Reload email details before creating the opportunity."
            : messages[status] || "Opportunity creation could not be confirmed. Try again.",
        fieldErrors,
        reloadRequired: (status === 409 && !alreadyConverted) || status === 410 || tokenInvalid,
      }));
    } finally {
      submitting.current = false;
      if (active()) setState((current) => ({ ...current, submitting: false }));
    }
  };

  const reloadEmail = async () => {
    if (submitting.current || state.reloading) return;
    const request = ++actionRequest.current;
    const active = () => mounted.current && request === actionRequest.current;
    const clientGeneration = clients.access.current.generation;
    setState((current) => ({ ...current, reloading: true }));
    try {
      const payload = await salesService.getMailboxMessage(connection.id, currentSource.current.id);
      if (!active()) return;
      const source = messageDetail(payload, currentSource.current.id);
      const refreshed = clients.access.current.denied || clientGeneration !== clients.access.current.generation
        ? { ...source, information: withoutCustomerMatch(source.information) } : source;
      if (!refreshed.sourceToken) throw new Error("Missing review token.");
      if (!refreshed.canCreateOpportunity) {
        setState((current) => ({ ...current, reloading: false, error: "You do not have permission to create an opportunity from this email." }));
        return;
      }
      currentSource.current = refreshed;
      onSourceReloaded(refreshed);
      setState((current) => ({ ...current, reloading: false, reloadRequired: false, error: "", fieldErrors: {}, refreshed }));
    } catch (error) {
      if (!active()) return;
      if ([401, 403, 404].includes(error?.response?.status)) {
        onUnavailable();
        return;
      }
      setState((current) => ({ ...current, reloading: false, error: "Email details could not be reloaded. Try again." }));
    }
  };

  return <SalesEmailOpportunityForm
    subject={message.subject}
    information={clients.denied ? withoutCustomerMatch(message.information) : message.information}
    clients={clients.records}
    clientChoice={clientChoice}
    onClientChange={setClientChoice}
    onSubmit={submit}
    onClose={onClose}
    submitting={state.submitting}
    error={state.error}
    fieldErrors={state.fieldErrors}
    loadingClients={clients.loading}
    clientError={clients.error}
    onRetryClients={clients.load}
    requireSourceReload={state.reloadRequired}
    onReloadEmail={state.reloadRequired ? reloadEmail : null}
    reloadingEmail={state.reloading}
    reviewPanel={state.refreshed && <div className="mb-4 min-w-0 rounded-md border border-blue-200 bg-blue-50 p-3">
      <p role="status" className="text-sm text-blue-900">Email details reloaded. Review the updated email and your entries.</p>
      <details className="mt-2 min-w-0">
        <summary className="w-fit cursor-pointer py-1 text-sm font-semibold text-blue-900">Review refreshed email</summary>
        <div className="mt-3 min-w-0 rounded-md border border-slate-200 bg-white p-3">
          <SalesEmailDetectedInformation information={clients.denied ? withoutCustomerMatch(state.refreshed.information) : state.refreshed.information} subject={state.refreshed.subject} />
          <div className="mt-4 border-t border-slate-200 pt-4"><SalesEmailAnalysis analysis={state.refreshed.information.analysis} /></div>
          <div className="mt-4"><SalesEmailBody bodyText={state.refreshed.body} bodyContent={state.refreshed.bodyContent} /></div>
        </div>
      </details>
    </div>}
  />;
}

MailboxEmails.propTypes = {
  connection: PropTypes.shape({
    id: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    name: PropTypes.string,
  }).isRequired,
};

MailboxOpportunityForm.propTypes = {
  connection: MailboxEmails.propTypes.connection,
  message: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
  onUnavailable: PropTypes.func.isRequired,
  onSourceReloaded: PropTypes.func.isRequired,
  onClientAccessDenied: PropTypes.func.isRequired,
};
