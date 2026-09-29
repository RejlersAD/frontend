import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  RefreshCw as ArrowPathIcon,
  ArrowRight as ArrowRightIcon,
  Mail as EnvelopeIcon,
  Search as MagnifyingGlassIcon,
  Paperclip as PaperClipIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Settings2,
  Plus,
  Filter,
  Sparkles,
} from "lucide-react";
import salesService from "../../services/sales.service";
import SalesEmailBody from "./SalesEmailBody";
import SalesEmailDetectedInformation from "./SalesEmailDetectedInformation";
import SalesEmailAnalysis from "./SalesEmailAnalysis";
import SalesEmailOpportunityForm from "./SalesEmailOpportunityForm";
import SalesEmailReader from "./SalesEmailReader";
import SalesEmailPageHeader from "./SalesEmailPageHeader";
import SalesEmailMessageHeader from "./SalesEmailMessageHeader";
import SalesEmailAssistant from "./SalesEmailAssistant";
import SalesEmailReview from "./SalesEmailReview";
import { EMAIL_CLASSIFICATIONS, classificationSuggestion, isOpportunityClassification } from "./salesEmailReviewState";
import useSalesEmailBatchReview from "./useSalesEmailBatchReview";
import useSalesEmailClients from "./useSalesEmailClients";
import useSalesEmailClientChoice from "./useSalesEmailClientChoice";
import { withoutCustomerMatch } from "./SalesEmailCustomerMatch";
import SalesEmailThreadRole, { selectedThreadSource, threadRole } from "./SalesEmailThreadRole";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const text = (value) => (typeof value === "string" ? value : "");
const senderInitials = (value) => {
  const parts = text(value).split(/[\s@._-]+/).filter(Boolean);
  return /^[A-Z]{2,3}$/.test(parts[0] || "") ? parts[0] : parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
};
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
    canCreateClient: payload.can_create_client === true,
    sourceToken: text(payload.source_token),
  };
};

const accessError = (status) => {
  if (status === 401) return "Sign in again to view mailbox emails.";
  if (status === 403) return "You do not have access to this mailbox.";
  if (status === 404) return "This mailbox is no longer available. Refresh emails.";
  return "";
};

export default function SalesSharedMailboxMessages({ preferredConnectionId = "", onConfigure, onAddMailbox }) {
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
          connections.push({
            id: record.id, address: record.mailbox_address, name: text(record.name),
            setup: {
              id: record.id, name: text(record.name), mailbox_address: record.mailbox_address,
              auth_mode: record.auth_mode, tenant_id: text(record.tenant_id), client_id: text(record.client_id),
              secret_configured: record.secret_configured, enabled: record.enabled,
              last_status: record.last_status, sync: record.sync,
            },
          });
        }
        page = Array.isArray(payload) ? null : connectionPage(payload.next, page, visited);
      }
      if (active()) {
        setState({ records: connections, loading: false, error: "" });
        setSelectedId(ids.has(preferredConnectionId) ? preferredConnectionId : connections.length === 1 ? connections[0].id : "");
      }
    } catch (error) {
      if (!active()) return;
      setState({
        records: null,
        loading: false,
        error: accessError(error?.response?.status) || "Shared mailboxes could not be loaded. Try again.",
      });
    }
  }, [preferredConnectionId]);

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
      {!connection && <SalesEmailPageHeader>{onAddMailbox && <button type="button" onClick={onAddMailbox} className="sales-email-button"><Plus aria-hidden="true" />Add shared mailbox</button>}</SalesEmailPageHeader>}
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
      {connection && <MailboxEmails key={connection.id} connection={connection} onConfigure={onConfigure} onAddMailbox={onAddMailbox} />}
    </div>
  );
}

SalesSharedMailboxMessages.propTypes = {
  preferredConnectionId: PropTypes.string,
  onConfigure: PropTypes.func,
  onAddMailbox: PropTypes.func,
};

function MailboxEmails({ connection, onConfigure, onAddMailbox }) {
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
  const [showFilters, setShowFilters] = useState(false);
  const [insightsView, setInsightsView] = useState({ id: null, tab: "summary" });
  const [reviewSummaries, setReviewSummaries] = useState({});
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [confirmedClassification, setConfirmedClassification] = useState("");
  const [conversion, setConversion] = useState(null);
  const redactClientMatch = useCallback(() => {
    setDetail((current) => current.message ? { ...current, message: { ...current.message, information: withoutCustomerMatch(current.message.information) } } : current);
  }, []);

  const loadPage = useCallback(async (cursor = null, history = []) => {
    setConfirmedClassification("");
    const currentRequest = ++pageRequest.current;
    const active = () => mounted.current && currentRequest === pageRequest.current;
    detailRequest.current += 1;
    setNextStepMessageId(null);
    setSelectedId(null);
    setShowOpportunityForm(false);
    setConversion(null);
    setDetail({ message: null, loading: false, error: "" });
    setReviewSummaries({});
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
    target.querySelector('button[aria-label="Expand AI insights"]')?.click();
    target.querySelector('[role="tab"]')?.click();
    const pane = target.closest(".sales-email-source-panel");
    if (pane) pane.scrollTop = 0;
    const context = target.querySelector(".sales-email-context__scroll");
    if (context) context.scrollTop = 0;
    const reader = target.closest(".sales-email-preview")?.querySelector(".sales-email-reading-pane");
    const stacked = pane && reader && Math.abs(pane.getBoundingClientRect().left - reader.getBoundingClientRect().left) < 2;
    target.focus({ preventScroll: true });
    const heading = target.querySelector("h3") || target;
    if (stacked) {
      let scrollContainer = heading.parentElement;
      while (scrollContainer && scrollContainer !== document.body) {
        if (["auto", "scroll"].includes(window.getComputedStyle(scrollContainer).overflowY) && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
          scrollContainer.scrollTop += heading.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
          return;
        }
        scrollContainer = scrollContainer.parentElement;
      }
    }
    heading.scrollIntoView({ block: stacked ? "start" : "nearest", inline: "nearest" });
  }, []);

  useEffect(() => {
    if (nextStepMessageId && detail.message?.id === nextStepMessageId && selectedId === nextStepMessageId) {
      focusNextStep();
      setNextStepMessageId(null);
    }
  }, [detail.message, selectedId, nextStepMessageId, focusNextStep]);

  const loadMessage = useCallback(async (record, openNextStep = false) => {
    setConfirmedClassification("");
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
      const message = messageDetail(payload, record.id);
      const suggestion = classificationSuggestion(message.information);
      setReviewSummaries((current) => ({ ...current, [record.id]: {
        status: message.information?.ai_review?.version === 1 && message.information.ai_review.status === "validated" ? "validated" : "rules",
        classificationCode: suggestion?.status === "classified" ? suggestion.code : "",
      } }));
      setDetail({
        loading: false, error: "",
        message,
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
        setReviewSummaries({});
        return;
      }
      setDetail({ message: null, loading: false, error: "Email could not be loaded. Try again." });
    }
  }, [connection.id]);

  const openNextStep = (record) => {
    if (detail.message?.id === record.id && !detail.loading) {
      focusNextStep();
    } else if (selectedId === record.id && detail.loading) {
      setNextStepMessageId(record.id);
    } else {
      loadMessage(record, true);
    }
  };

  const selected = page.records?.find((record) => record.id === selectedId);
  const mailboxUnavailable = () => {
    setConfirmedClassification("");
    pageRequest.current += 1;
    detailRequest.current += 1;
    setNextStepMessageId(null);
    setSelectedId(null);
    setShowOpportunityForm(false);
    setConversion(null);
    setReviewSummaries({});
    setDetail({ message: null, loading: false, error: "" });
    setPage({ records: null, nextCursor: null, cursor: null, history: [], loading: false, refreshRequired: true, error: "This mailbox or email is no longer available. Refresh emails." });
  };
  const batch = useSalesEmailBatchReview({ connectionId: connection.id, records: page.records, pageKey: `${pageRequest.current}:${page.cursor || "first"}`, onUnavailable: mailboxUnavailable,
    onReviewed: (id, result) => setReviewSummaries((current) => ({ ...current, [id]: result })),
  });
  const summaries = reviewSummaries;
  const unreadEligible = (page.records || []).filter((record) => record.is_read === false && !record.is_draft && record.direction === "incoming").length;
  const aiReviewedCount = (page.records || []).filter((record) => summaries[record.id]?.status === "validated").length;
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (page.records || []).filter((record) => {
      if (readFilter === "unread" && record.is_read !== false) return false;
      if (readFilter === "read" && record.is_read !== true) return false;
      if (readFilter === "drafts" && !record.is_draft) return false;
      if (readFilter === "ai" && summaries[record.id]?.status !== "validated") return false;
      if (readFilter === "needs_review" && (record.direction !== "incoming" || record.is_draft)) return false;
      return !query || [record.subject, record.sender_name, record.sender_email, record.body_preview]
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [page.records, readFilter, search, summaries]);
  useEffect(() => {
    if (!page.loading && !page.error && selectedId === null && visibleRecords.length) {
      loadMessage(visibleRecords[0]);
    }
  }, [page.loading, page.error, selectedId, visibleRecords, loadMessage]);
  const changeFilter = (nextFilter, nextSearch = search) => {
    setConfirmedClassification("");
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
    ["all", "Inbox", page.records?.length],
    ["unread", "Unread", page.records?.filter((record) => record.is_read === false).length],
    ["ai", "AI suggestions", aiReviewedCount],
    ["drafts", "Drafts", page.records?.filter((record) => record.is_draft).length],
  ];
  return (
    <section aria-label="Shared mailbox messages" className="sales-email-mailbox">
      <SalesEmailPageHeader>
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
            placeholder="Search emails…"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-[13px] placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          />
        </label>
        <button type="button" className="sales-email-analyze" disabled={page.loading || Boolean(page.error) || (!batch.running && !unreadEligible)} onClick={batch.running ? batch.cancel : batch.analyzeUnread} title="Analyze incoming unread emails on this page"><Sparkles aria-hidden="true" />{batch.running ? `Stop analysis (${batch.completed}/${batch.total})` : `Analyze unread (${unreadEligible})`}</button>
        <button type="button" className="sales-email-button sales-email-icon-button" title="Refresh emails" aria-label="Refresh emails" onClick={() => loadPage()} disabled={page.loading}><ArrowPathIcon className={page.loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" /></button>
        <button type="button" className="sales-email-button sales-email-icon-button" title="Email filters" aria-label="Email filters" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)}><Filter aria-hidden="true" /></button>
        {(onConfigure || onAddMailbox) && <details className="sales-email-options"><summary className="sales-email-button sales-email-icon-button" aria-label="Mailbox options" title="Mailbox options"><MoreHorizontal aria-hidden="true" /></summary><div>
          {onConfigure && <button type="button" onClick={() => onConfigure(connection.setup)}><Settings2 aria-hidden="true" />Mailbox setup</button>}
          {onAddMailbox && <button type="button" onClick={onAddMailbox}><Plus aria-hidden="true" />Add shared mailbox</button>}
        </div></details>}
        {showFilters && <div className="sales-email-filter-popover"><p>Filters apply to this page.</p>{[...readFilters, ["read", "Read"]].map(([value, label]) => <button key={value} type="button" aria-pressed={readFilter === value} onClick={() => { changeFilter(value); setShowFilters(false); }}>{label}</button>)}</div>}
        </div>
      </div>
      </SalesEmailPageHeader>
      {batch.total > 0 && <p className="sales-email-batch-status" role="status">{batch.running ? `Reviewing ${batch.completed} of ${batch.total} emails on this page.` : `${batch.completed} of ${batch.total} emails reviewed · ${Object.values(batch.results).filter((result) => result.status === "validated").length} AI results. Saved read states are unchanged.`}{batch.error && <span> {batch.error}</span>}</p>}
      <div className="sales-email-card">
      {page.error && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 p-4">
        <p role="alert" className="text-sm text-amber-900">{page.error}</p>
        {!page.refreshRequired && <button type="button" className={buttonClass} onClick={() => loadPage(page.cursor, page.history)}>Try again</button>}
      </div>}
      <div className="sales-email-grid">
        <aside aria-label="Mailbox emails" className="sales-email-list">
          <div className="sales-email-list-summary"><h2>Inbox</h2><span>Newest first <ChevronDown size={14} aria-hidden="true" /></span></div>
          <nav aria-label="Inbox quick filters" className="sales-email-list-filters">{[["all", "All"], ["unread", "Unread"], ["needs_review", "Needs review"]].map(([value, label]) => <button key={value} type="button" title={value === "needs_review" ? "Incoming non-draft messages; review is required before opportunity creation." : undefined} aria-pressed={readFilter === value} onClick={() => changeFilter(value)}>{label}</button>)}</nav>
          <div className="sr-only" role="status">
            Page {page.history.length + 1}{page.records !== null && ` · ${page.records.length} emails on this page`}
          </div>
          {page.loading && <p role="status" className="p-5 text-sm text-slate-600">Loading mailbox emails…</p>}
          {!page.loading && !page.error && page.records?.length === 0 && <p className="p-5 text-sm text-slate-600">
            {page.cursor === null && page.nextCursor === null ? "No emails in this mailbox." : "No emails on this page."}
          </p>}
          {!page.loading && !page.error && page.records?.length > 0 && visibleRecords.length === 0 && <p className="p-5 text-sm text-slate-600">No matching emails on this page.</p>}
          <ul className="sales-email-list-scroll">
            {visibleRecords.map((record) => <li key={record.id} className={`sales-email-row sales-email-row-with-actions ${record.is_read === false ? "sales-email-row-unread" : ""} ${selectedId === record.id ? "sales-email-row-selected" : ""}`}>
              <button
                type="button"
                aria-label={`Open email: ${record.subject || "No subject"}`}
                aria-pressed={selectedId === record.id}
                onClick={() => {
                  if (selectedId !== record.id || (!detail.loading && !detail.message)) loadMessage(record);
                }}
                className="sales-email-row-open"
              >
                <span className="sales-email-row-avatar" aria-hidden="true">{senderInitials(record.sender_name || record.sender_email)}</span>
                <span className="sales-email-row-copy">
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-slate-900">{record.sender_name || record.sender_email || "Sender unavailable"}</span>
                  <span className="shrink-0 text-xs text-slate-600">{dateLabel(record.received_at || record.sent_at, false).replace(/ \d{4}$/, "")}</span>
                </span>
                <span className={`mt-1 block line-clamp-2 break-words text-slate-800 ${record.is_read === false ? "font-semibold" : "font-medium"}`}>{record.subject || "No subject"}</span>
                <span className="sales-email-row-snippet">{record.body_preview || "No email preview available."}</span>
                {summaries[record.id]?.classificationCode && <span className="sales-email-row-suggestion">Suggested: {EMAIL_CLASSIFICATIONS[summaries[record.id].classificationCode]}</span>}
                </span>
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
          <nav aria-label="Email pages" className="sales-email-pagination">
            <button type="button" className={buttonClass} aria-label="Previous page" disabled={page.loading || page.history.length === 0} onClick={() => loadPage(page.history.at(-1), page.history.slice(0, -1))}><ChevronLeft aria-hidden="true" /></button>
            <span>Page {page.history.length + 1}</span>
            <button type="button" className={buttonClass} aria-label="Next page" disabled={page.loading || !page.nextCursor} onClick={() => loadPage(page.nextCursor, [...page.history, page.cursor])}><ChevronRight aria-hidden="true" /></button>
          </nav>
        </aside>
        <section aria-label="Email preview" className="sales-email-preview">
          {detail.loading ? <p role="status" className="p-5 text-sm text-slate-600">Loading email…</p> : detail.error ? <div className="space-y-3 p-5">
            <p role="alert" className="text-sm text-amber-900">{detail.error}</p>
            {selected && <button type="button" className={buttonClass} onClick={() => loadMessage(selected)}>Retry email</button>}
          </div> : detail.message ? <>
            <header className="sales-email-preview-header">
              <SalesEmailMessageHeader key={detail.message.id} subject={detail.message.subject} senderName={detail.message.sender_name} senderEmail={detail.message.sender_email}
                to={detail.message.to} receivedAt={detail.message.received_at} dateLabel={dateLabel(detail.message.received_at)}>
              <div className="sales-email-message-state flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded bg-slate-100 px-2 py-1">{readState(detail.message)}</span>
                {directionBadge(detail.message)}
                <SalesEmailThreadRole role={detail.message.thread_role} reason={detail.message.thread_role_reason} selected hideDraft={detail.message.is_draft || detail.message.direction === "draft"} />
                <button type="button" className="sales-email-next-step" onClick={() => openNextStep(detail.message)}>Next step <ArrowRightIcon className="h-3 w-3" aria-hidden="true" /></button>
                {detail.message.importance === "high" && <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">High importance</span>}
                {detail.message.has_attachments && <span className="inline-flex items-center gap-1"><PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />Has attachments</span>}
              </div>
              </div>
              </SalesEmailMessageHeader>
              {conversion && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><p role="status">{conversion.created ? "Opportunity created." : "This email already has an opportunity."}</p><Link to={`/sales/opportunities?record=${encodeURIComponent(conversion.opportunity.id)}`} className="font-semibold underline underline-offset-2">Open opportunity</Link></div>}
            </header>
            <div className="sales-email-detail-grid">
              <section className="sales-email-reading-pane" aria-label="Email content" tabIndex={0}>
                <SalesEmailReader key={detail.message.id} information={detail.message.information} subject={detail.message.subject} bodyText={detail.message.body || "This email has no text content."} bodyContent={detail.message.bodyContent} hasAttachments={detail.message.has_attachments}
                  onReply={() => {
                    nextStepRef.current?.querySelector('button[aria-label="Expand AI insights"]')?.click();
                    setInsightsView({ id: detail.message.id, tab: "ask" });
                    requestAnimationFrame(() => nextStepRef.current?.querySelector('[data-assistant-action="draft_reply"]')?.focus());
                  }} />
              </section>
              <aside className="sales-email-source-panel" aria-label="Email review" tabIndex={0}>
                <SalesEmailReview key={`${detail.message.id}:${detail.message.sourceToken}`} information={detail.message.information} subject={detail.message.subject}
                  activeTab={insightsView.id === detail.message.id ? insightsView.tab : "summary"} onTabChange={(tab) => setInsightsView({ id: detail.message.id, tab })}
                  assistant={<SalesEmailAssistant source={{ connectionId: connection.id, messageId: detail.message.id }} information={detail.message.information} onUnavailable={mailboxUnavailable} />}
                  senderName={detail.message.sender_name} senderEmail={detail.message.sender_email} sentAt={detail.message.sent_at || detail.message.received_at}
                  receivedAt={detail.message.received_at}
                  confirmedClassification={confirmedClassification} onConfirmClassification={setConfirmedClassification}
                  onClassificationChange={() => setConfirmedClassification("")} nextStepRef={nextStepRef}
                  canCreateOpportunity={detail.message.canCreateOpportunity} converted={Boolean(conversion)}
                  onCreateOpportunity={() => { if (isOpportunityClassification(confirmedClassification)) setShowOpportunityForm(true); }}>
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
                </SalesEmailReview>
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
        classificationCode={confirmedClassification}
        onClose={() => setShowOpportunityForm(false)}
        onUnavailable={mailboxUnavailable}
        onSourceReloaded={(message) => setDetail({ message, loading: false, error: "" })}
        onClassificationChange={setConfirmedClassification}
        onClientAccessDenied={redactClientMatch}
        onCreated={(result) => { setConversion(result); setShowOpportunityForm(false); }}
      />}
    </section>
  );
}

function MailboxOpportunityForm({ connection, message, classificationCode, onClassificationChange, onClose, onCreated, onUnavailable, onSourceReloaded, onClientAccessDenied }) {
  const mounted = useRef(false);
  const actionRequest = useRef(0);
  const submitting = useRef(false);
  const currentSource = useRef(message);
  const clients = useSalesEmailClients();
  const { clientChoice, newClientName, chooseClient: setClientChoice } = useSalesEmailClientChoice({
    information: clients.denied ? withoutCustomerMatch(message.information) : message.information,
    clients, canCreateClient: message.canCreateClient === true, reviewKey: message.id,
  });
  const [reviewedClassification, setReviewedClassification] = useState(classificationCode);
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
    if (submitting.current || clients.loading || clients.error || !clientChoice || state.reloadRequired || state.reloading || !isOpportunityClassification(reviewedClassification)) return;
    const createClient = clientChoice === "__new__";
    if (createClient ? !newClientName : !clients.records.some((record) => record.id === clientChoice)) return;
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
        classification_code: reviewedClassification,
        classification_confirmed: true,
        deal_name: form.get("deal_name"),
        client: createClient ? undefined : clientChoice,
        new_client: createClient ? { company_name: newClientName } : undefined,
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
      const duplicateTender = status === 409 && error?.response?.data?.code === "email_tender_already_exists";
      const customerConflict = status === 409 && error?.response?.data?.code === "email_customer_conflict";
      const tokenInvalid = status === 400 && Boolean(error?.response?.data?.source_token);
      const classificationInvalid = status === 400 && Boolean(error?.response?.data?.classification_code || error?.response?.data?.classification_confirmed);
      if (classificationInvalid) { setReviewedClassification(""); onClassificationChange(""); }
      setState((current) => ({
        ...current,
        error: alreadyConverted
          ? "An opportunity already exists for this email with different details. Your entries have been kept."
          : duplicateTender ? "An opportunity already exists for this tender. Your entries have been kept."
          : customerConflict ? "The customer cannot be resolved safely. Select an accessible client and try again."
          : classificationInvalid ? "Confirm the email classification before creating an opportunity."
          : tokenInvalid
            ? "Reload email details before creating the opportunity."
            : messages[status] || "Opportunity creation could not be confirmed. Try again.",
        fieldErrors,
        reloadRequired: (status === 409 && !alreadyConverted && !duplicateTender && !customerConflict) || status === 410 || tokenInvalid,
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
      setReviewedClassification("");
      onClassificationChange("");
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
    newClientName={newClientName}
    onSubmit={submit}
    onClose={onClose}
    submitting={state.submitting}
    error={state.error}
    fieldErrors={state.fieldErrors}
    loadingClients={clients.loading}
    clientError={clients.error}
    onRetryClients={clients.load}
    requireSourceReload={state.reloadRequired || !isOpportunityClassification(reviewedClassification)}
    onReloadEmail={state.reloadRequired ? reloadEmail : null}
    reloadingEmail={state.reloading}
    reviewPanel={<>
      {(state.refreshed || !isOpportunityClassification(reviewedClassification)) && <SalesEmailReview key={state.refreshed?.sourceToken || message.sourceToken}
        disabled={state.submitting || state.reloading}
        information={(state.refreshed || message).information} subject={(state.refreshed || message).subject}
        confirmedClassification={reviewedClassification} canCreateOpportunity={false}
        onConfirmClassification={(code) => { setReviewedClassification(code); onClassificationChange(code); }}
        onClassificationChange={() => { setReviewedClassification(""); onClassificationChange(""); }} />}
      {state.refreshed && <div className="mb-4 min-w-0 rounded-md border border-blue-200 bg-blue-50 p-3">
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
    </>}
  />;
}

MailboxEmails.propTypes = {
  connection: PropTypes.shape({
    id: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    name: PropTypes.string,
    setup: PropTypes.object,
  }).isRequired,
  onConfigure: PropTypes.func,
  onAddMailbox: PropTypes.func,
};

MailboxOpportunityForm.propTypes = {
  connection: MailboxEmails.propTypes.connection,
  message: PropTypes.object.isRequired,
  classificationCode: PropTypes.string.isRequired,
  onClassificationChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
  onUnavailable: PropTypes.func.isRequired,
  onSourceReloaded: PropTypes.func.isRequired,
  onClientAccessDenied: PropTypes.func.isRequired,
};
