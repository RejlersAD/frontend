import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import {
  RefreshCw as ArrowPathIcon,
  ExternalLink as ArrowTopRightOnSquareIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  Copy as DocumentDuplicateIcon,
  Mail as EnvelopeIcon,
  MailOpen as EnvelopeOpenIcon,
  AlertTriangle as ExclamationTriangleIcon,
  Filter as FunnelIcon,
  Search as MagnifyingGlassIcon,
  Ban as NoSymbolIcon,
  Paperclip as PaperClipIcon,
  User as UserIcon,
  X as XMarkIcon,
} from "lucide-react";
import salesService from "../../services/sales.service";
import SalesSharedMailboxMessages from "./SalesSharedMailboxMessages";
import SalesSharedMailboxSetup from "./SalesSharedMailboxSetup";
import useSalesMailboxSetupAccess from "./useSalesMailboxSetupAccess";
import SalesEmailReader from "./SalesEmailReader";
import SalesEmailPageHeader from "./SalesEmailPageHeader";
import SalesEmailAssistant from "./SalesEmailAssistant";
import SalesEmailReview from "./SalesEmailReview";
import { isOpportunityClassification } from "./salesEmailReviewState";
import SalesEmailOpportunityForm from "./SalesEmailOpportunityForm";
import { withoutCustomerMatch } from "./SalesEmailCustomerMatch";
import useSalesEmailClients from "./useSalesEmailClients";
import useSalesEmailClientChoice from "./useSalesEmailClientChoice";
import SalesEmailThreadRole, { selectedThreadSource } from "./SalesEmailThreadRole";
import "./SalesEmailIntake.css";

const STATUS = {
  received: {
    label: "Received",
    tone: "border-blue-200 bg-blue-50 text-blue-800",
    dot: "bg-blue-500",
  },
  under_review: {
    label: "Under review",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  converted: {
    label: "Converted",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    tone: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
  duplicate: {
    label: "Duplicate",
    tone: "border-violet-200 bg-violet-50 text-violet-800",
    dot: "bg-violet-500",
  },
};

const list = (data) => (Array.isArray(data) ? data : data?.results ?? []);
const withoutIntakeClientMatch = (record) => ({ ...record, extracted_information: withoutCustomerMatch(record.extracted_information), can_create_client: false });
const fieldClass =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

const formatDate = (value, includeTime = false) => {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
};

function StatusBadge({ value }) {
  const config = STATUS[value] ?? STATUS.received;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function Modal({ title, description, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-intake-dialog-title"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2
              id="email-intake-dialog-title"
              className="text-lg font-bold text-[#102a47]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

StatusBadge.propTypes = { value: PropTypes.string.isRequired };
Modal.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
Modal.defaultProps = { description: "" };

export default function SalesEmailIntake() {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  if (!isAuthenticated) return null;
  return <EmailIntakeViews key={String(user?.user?.id ?? user?.id ?? "")} />;
}

function EmailIntakeViews() {
  const [searchParams] = useSearchParams();
  const access = useSalesMailboxSetupAccess();
  const [setup, setSetup] = useState(null);
  const [mailboxes, setMailboxes] = useState({ revision: 0, selectedId: "" });
  useEffect(() => {
    if (!access.canManage || (setup && !setup.connection && !access.canCreate)) setSetup(null);
  }, [access.canManage, access.canCreate, setup]);
  const closeSetup = (connection) => {
    setSetup(null);
    if (connection) setMailboxes((current) => ({ revision: current.revision + 1, selectedId: connection.id }));
  };
  const view = searchParams.get("view") === "imported" ? "imported" : "shared";
  return (
    <section className="sales-email-workspace" aria-label="Email Intake workspace">
      {view === "shared" ? <SalesSharedMailboxMessages key={mailboxes.revision} preferredConnectionId={mailboxes.selectedId} onAddMailbox={access.canCreate ? () => setSetup({ connection: null }) : undefined} onConfigure={access.canManage ? (connection) => setSetup({ connection }) : undefined} /> : <ImportedEmailIntakes />}
      {view === "shared" && setup && access.canManage && (setup.connection || access.canCreate) && <SalesSharedMailboxSetup initialConnection={setup.connection} access={access} onClose={closeSetup} />}
    </section>
  );
}

function ImportedEmailIntakes() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const loadRequest = useRef(0);
  const detailRequest = useRef(0);
  const detailClientGeneration = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const [detailState, setDetailState] = useState({ id: null, loading: false, error: "" });
  const [sourceReloadRequired, setSourceReloadRequired] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [confirmedClassification, setConfirmedClassification] = useState("");
  const [reviewVersion, setReviewVersion] = useState(0);
  const [classificationReviewRequired, setClassificationReviewRequired] = useState(false);
  const clients = useSalesEmailClients(dialog === "convert");
  const clientAccess = clients.access;
  useEffect(() => {
    if (clients.denied) setRecords((current) => current.map(withoutIntakeClientMatch));
  }, [clients.denied]);

  const load = useCallback(async () => {
    setConfirmedClassification("");
    const request = ++loadRequest.current;
    const clientGeneration = clientAccess.current.generation;
    setLoading(true);
    setError("");
    try {
      const intakeResponse = await salesService.getEmailIntakes({ page_size: 500, ordering: "-received_at" });
      if (request !== loadRequest.current) return;
      const redactMatches = clientAccess.current.denied || clientGeneration !== clientAccess.current.generation;
      const nextRecords = list(intakeResponse).map((record) => redactMatches ? withoutIntakeClientMatch(record) : record);
      setConfirmedClassification("");
      setClassificationReviewRequired(true);
      setRecords(nextRecords);
      setReviewVersion((current) => current + 1);
      detailClientGeneration.current = clientGeneration;
      setDetailRevision((current) => current + 1);
      setSelectedId((current) =>
        nextRecords.some((row) => row.id === current)
          ? current
          : nextRecords[0]?.id ?? null,
      );
    } catch (requestError) {
      if (request !== loadRequest.current) return;
      if ([401, 403].includes(requestError?.response?.status)) {
        setRecords([]);
        setSelectedId(null);
        setDialog(null);
      }
      setError(
        [401, 403].includes(requestError?.response?.status)
          ? "You do not have access to saved email enquiries."
          : "Email intake records could not be loaded.",
      );
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [clientAccess]);

  useEffect(() => {
    load();
    return () => { loadRequest.current += 1; };
  }, [load]);

  const loadDetail = useCallback(async (id, sourceClientGeneration) => {
    if (!id) return;
    const request = ++detailRequest.current;
    const clientGeneration = sourceClientGeneration ?? clientAccess.current.generation;
    setDetailState({ id, loading: true, error: "" });
    setConfirmedClassification("");
    try {
      const record = await salesService.getEmailIntake(id);
      if (request !== detailRequest.current) return;
      if (!record || record.id !== id || typeof record.extracted_information !== "object" || Array.isArray(record.extracted_information)) throw new Error("Invalid email details.");
      const redactMatches = clientAccess.current.denied || clientGeneration !== clientAccess.current.generation;
      setRecords((current) => current.map((row) => row.id === id ? redactMatches ? withoutIntakeClientMatch(record) : record : row));
      setConfirmedClassification("");
      setClassificationReviewRequired(true);
      setReviewVersion((current) => current + 1);
      setSourceReloadRequired(false);
      setError("");
      setDetailState({ id, loading: false, error: "" });
    } catch (requestError) {
      if (request !== detailRequest.current) return;
      const denied = [401, 403, 404].includes(requestError?.response?.status);
      const message = denied ? "You do not have access to this saved email." : "Email details could not be loaded. Refresh emails and try again.";
      setDetailState({ id, loading: false, error: message });
      setError(message);
      if (denied) {
        setRecords((current) => current.filter((row) => row.id !== id));
        setSelectedId((current) => current === id ? null : current);
        setDialog(null);
      }
    }
  }, [clientAccess]);

  useEffect(() => {
    const clientGeneration = detailClientGeneration.current;
    detailClientGeneration.current = null;
    loadDetail(selectedId, clientGeneration);
    return () => { detailRequest.current += 1; };
  }, [selectedId, detailRevision, loadDetail]);

  const counts = useMemo(
    () =>
      records.reduce(
        (result, row) => ({
          ...result,
          [row.status]: (result[row.status] ?? 0) + 1,
        }),
        { all: records.length },
      ),
    [records],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!term) return true;
      return [row.subject, row.sender_name, row.sender_email, row.body_preview]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [records, search, statusFilter]);
  useEffect(() => {
    if (!loading && !filtered.some((row) => row.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
      setDialog(null);
    }
  }, [filtered, loading, selectedId]);
  const selected = filtered.find((row) => row.id === selectedId) ?? null;

  const detailPending = Boolean(selected && (detailState.id !== selectedId || detailState.loading));
  const reviewBlocked = saving || detailPending || Boolean(detailState.error && detailState.id === selectedId);
  useEffect(() => { setConfirmedClassification(""); setSourceReloadRequired(false); }, [selectedId]);
  const extracted = selected?.extracted_information ?? {};
  const { clientChoice, newClientName: suggestedClientName, chooseClient: setClientChoice } = useSalesEmailClientChoice({
    information: extracted, clients, canCreateClient: selected?.can_create_client === true,
    enabled: dialog === "convert", reviewKey: `${selectedId}:${dialog}`,
  });
  const unresolved = records.filter((row) =>
    ["received", "under_review"].includes(row.status),
  ).length;

  const updateRecord = (record) => {
    setConfirmedClassification("");
    setClassificationReviewRequired(true);
    setReviewVersion((current) => current + 1);
    setRecords((current) =>
      current.map((row) => (row.id === record.id ? (clientAccess.current.denied ? withoutIntakeClientMatch(record) : record) : row)),
    );
  };

  const startReview = async () => {
    if (!selected || reviewBlocked) return;
    setSaving(true);
    setError("");
    try {
      updateRecord(await salesService.startEmailIntakeReview(selected.id));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.status || "Review could not be started.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resolve = async (event) => {
    event.preventDefault();
    if (!selected || reviewBlocked) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const record =
        dialog === "reject"
          ? await salesService.rejectEmailIntake(selected.id, form.get("reason"))
          : await salesService.markEmailIntakeDuplicate(selected.id, {
              duplicate_of: form.get("duplicate_of") || undefined,
              reason: form.get("reason"),
            });
      updateRecord(record);
      setDialog(null);
    } catch (requestError) {
      const data = requestError?.response?.data;
      setError(
        data?.reason?.[0] || data?.status?.[0] || "The intake could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };

  const convert = async (event) => {
    event.preventDefault();
    if (!selected || selected.can_create_opportunity !== true || reviewBlocked || sourceReloadRequired || clients.loading || clients.error || !isOpportunityClassification(confirmedClassification)) return;
    const form = new FormData(event.currentTarget);
    const createClient = clientChoice === "__new__";
    if (createClient && !suggestedClientName) {
      setError("A client name could not be detected from this email.");
      return;
    }
    if (!createClient && !clients.records.some((client) => client.id === clientChoice)) return;
    setSaving(true);
    setError("");
    try {
      const result = await salesService.convertEmailIntake(selected.id, {
        source_token: typeof selected.source_token === "string" && selected.source_token ? selected.source_token : undefined,
        classification_code: confirmedClassification,
        classification_confirmed: true,
        client: createClient ? undefined : clientChoice,
        new_client:
          createClient
            ? {
                company_name: suggestedClientName,
              }
            : undefined,
        deal_name: form.get("deal_name"),
        estimated_value: form.get("estimated_value"),
        currency: form.get("currency"),
        expected_close_date: form.get("expected_close_date"),
        submission_due_date: form.get("submission_due_date") || null,
        scope_type: form.get("scope_type"),
        location: form.get("location"),
        client_reference: form.get("client_reference"),
        description: form.get("description"),
      });
      updateRecord(result.intake);
      setDialog(null);
    } catch (requestError) {
      const data = requestError?.response?.data;
      const sourceChanged = ([409, 410].includes(requestError?.response?.status) && !["email_already_converted", "email_tender_already_exists", "email_customer_conflict"].includes(data?.code)) || Boolean(data?.source_token);
      if (sourceChanged) {
        setSourceReloadRequired(true);
        setConfirmedClassification("");
        setClassificationReviewRequired(true);
      }
      if (data?.classification_code || data?.classification_confirmed) {
        setConfirmedClassification("");
        setClassificationReviewRequired(true);
      }
      const fieldError = (name) => {
        const value = data?.[name];
        const first = Array.isArray(value) ? value[0] : value;
        return typeof first === "string" ? first : "";
      };
      setError(
        fieldError("classification_code") || fieldError("classification_confirmed") || fieldError("client") ||
          fieldError("expected_close_date") || fieldError("estimated_value") || fieldError("status") ||
          (sourceChanged ? "Reload email details and confirm the classification. Your entries have been kept." : typeof data?.detail === "string" ? data.detail : "") ||
          "The opportunity could not be created.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sales-email-view text-slate-950">
      <div className="sales-email-mailbox">
        <SalesEmailPageHeader information={extracted} imported />
        <header className="sales-email-source-heading">
          <h2 className="text-base font-semibold text-slate-900">Imported enquiries</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
              <b>{unresolved}</b> awaiting review
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="sales-email-button"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="sales-email-card">
          <div className="sales-email-toolbar">
            <nav aria-label="Email intake status" className="flex flex-wrap gap-1">
              {["all", ...Object.keys(STATUS)].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={statusFilter === value}
                  onClick={() => { setStatusFilter(value); setSelectedId(null); setDialog(null); }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    statusFilter === value
                      ? "bg-blue-700 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {value === "all" ? "All" : STATUS[value].label}
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                      statusFilter === value ? "bg-white/20" : "bg-slate-100"
                    }`}
                  >
                    {counts[value] ?? 0}
                  </span>
                </button>
              ))}
            </nav>
            <label className="sales-email-search">
              <span className="sr-only">Search email intake</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setSelectedId(null); setDialog(null); }}
                placeholder="Search sender or subject"
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="sales-email-grid">
            <aside className="sales-email-list">
              <div className="sales-email-list-summary">
                <span>{filtered.length} messages</span>
                <FunnelIcon className="h-4 w-4" />
              </div>
              <div className="sales-email-list-scroll">
                {loading && <p role="status" className="p-4 text-sm text-slate-600">Loading imported enquiries…</p>}
                {filtered.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    aria-pressed={selectedId === row.id}
                    className={`sales-email-row ${
                      selectedId === row.id
                        ? "sales-email-row-selected"
                        : ""
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold text-slate-900">
                        {row.sender_name || row.sender_email}
                      </span>
                      <span className="shrink-0 text-xs text-slate-600">
                        {formatDate(row.received_at)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate font-semibold text-slate-800">
                      {row.subject || "No subject"}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                      {row.body_preview || "No email preview available."}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge value={row.status} />
                      <SalesEmailThreadRole role={selectedThreadSource(row.extracted_information?.analysis)?.thread_role} reason={selectedThreadSource(row.extracted_information?.analysis)?.thread_role_reason} />
                      {row.has_attachments && (
                        <PaperClipIcon className="h-4 w-4 text-slate-500" />
                      )}
                    </span>
                  </button>
                ))}
                {!loading && !error && !filtered.length && (
                  <div className="px-6 py-16 text-center">
                    <EnvelopeOpenIcon className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      No matching emails
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      New client emails appear here after Power Automate delivers them.
                    </p>
                  </div>
                )}
              </div>
            </aside>

            <article className="sales-email-preview">
              {selected ? (
                <>
                  <header className="sales-email-preview-header">
                    <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={selected.status} />
                          <SalesEmailThreadRole role={selectedThreadSource(extracted.analysis)?.thread_role} reason={selectedThreadSource(extracted.analysis)?.thread_role_reason} selected />
                          {selected.importance && (
                            <span className="text-xs font-semibold text-slate-600">
                              {selected.importance} importance
                            </span>
                          )}
                        </div>
                        <h2 className="sales-email-subject mt-3">
                          {selected.subject || "No subject"}
                        </h2>
                        <div className="sales-email-preview-meta mt-3">
                          <span className="inline-flex items-center gap-1.5">
                            <UserIcon className="h-4 w-4" />
                            {selected.sender_name || "Sender name unavailable"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <EnvelopeIcon className="h-4 w-4" />
                            {selected.sender_email}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <ClockIcon className="h-4 w-4" />
                            {formatDate(selected.received_at, true)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selected.status === "received" && (
                          <button
                            type="button"
                            disabled={reviewBlocked}
                            onClick={startReview}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                          >
                            Start review
                          </button>
                        )}
                        {["received", "under_review"].includes(selected.status) && (
                          <>
                            <button
                              type="button"
                              disabled={reviewBlocked}
                              onClick={() => setDialog("duplicate")}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              disabled={reviewBlocked}
                              onClick={() => setDialog("reject")}
                              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <NoSymbolIcon className="h-4 w-4" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </header>

                  <div className="sales-email-detail-grid">
                    <section className="sales-email-reading-pane" aria-label="Email content" tabIndex={0}>
                      <SalesEmailReader key={selected.id} information={extracted} subject={selected.subject} bodyText={selected.body_preview || "No email preview was supplied."} saved hasAttachments={selected.has_attachments}
                        assistant={<SalesEmailAssistant source={{ intakeId: selected.id }} information={extracted} disabled={reviewBlocked || sourceReloadRequired} onUnavailable={() => { setRecords((current) => current.filter((row) => row.id !== selected.id)); setSelectedId(null); setDialog(null); setError("You do not have access to this saved email."); }} />}>
                      {selected.resolution_note && (
                        <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Review note
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {selected.resolution_note}
                          </p>
                        </div>
                      )}
                      </SalesEmailReader>
                    </section>

                    <aside className="sales-email-source-panel" aria-label="Email review" tabIndex={0}>
                      <SalesEmailReview key={`${selected.id}:${reviewVersion}`} information={extracted} subject={selected.subject}
                        senderName={selected.sender_name} senderEmail={selected.sender_email} sentAt={selected.sent_at || selected.received_at}
                        disabled={reviewBlocked || sourceReloadRequired}
                        confirmedClassification={confirmedClassification} onConfirmClassification={setConfirmedClassification}
                        onClassificationChange={() => setConfirmedClassification("")}
                        canCreateOpportunity={selected.can_create_opportunity === true && ["received", "under_review"].includes(selected.status)}
                        converted={Boolean(selected.opportunity)} savedContent
                        onCreateOpportunity={() => { if (!reviewBlocked && !sourceReloadRequired && isOpportunityClassification(confirmedClassification)) { setClassificationReviewRequired(false); setDialog("convert"); } }}>
                      <details className="sales-email-analysis-metadata">
                      <summary>Source traceability</summary>
                      <dl className="mt-4 space-y-4 text-sm">
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">RADAI intake ID</dt>
                          <dd className="mt-1 break-all font-mono text-xs text-slate-700">{selected.id}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Outlook message ID</dt>
                          <dd className="mt-1 break-all font-mono text-xs text-slate-700">{selected.source_message_id}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Internet message ID</dt>
                          <dd className="mt-1 break-all font-mono text-xs text-slate-700">{selected.internet_message_id || "Not supplied"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Attachments</dt>
                          <dd className="mt-1 text-slate-700">{selected.has_attachments ? "Present on source email" : "None reported"}</dd>
                        </div>
                        {selected.reviewed_by_name && (
                          <div>
                            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Reviewed by</dt>
                            <dd className="mt-1 text-slate-700">{selected.reviewed_by_name} · {formatDate(selected.reviewed_at, true)}</dd>
                          </div>
                        )}
                      </dl>
                      </details>
                      {selected.opportunity && (
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/opportunities?record=${selected.opportunity}`)}
                          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Open {selected.opportunity_name || "opportunity"}
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </button>
                      )}
                      </SalesEmailReview>
                      {selected.duplicate_of && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!records.some((row) => row.id === selected.duplicate_of)) {
                              setError("The original email is not in the loaded enquiries.");
                              return;
                            }
                            setError("");
                            setStatusFilter("all");
                            setSearch("");
                            setSelectedId(selected.duplicate_of);
                          }}
                          className="mt-5 w-full rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100"
                        >
                          View original: {selected.duplicate_of_subject || "email"}
                        </button>
                      )}
                    </aside>
                  </div>
                </>
              ) : (
                <div className="sales-email-empty flex items-center justify-center text-center">
                  <div>
                    <EnvelopeOpenIcon className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">Select an email to review</p>
                  </div>
                </div>
              )}
            </article>
          </div>
        </section>
      </div>

      {dialog === "convert" && selected?.can_create_opportunity === true && (
        <SalesEmailOpportunityForm
          key={selected.id}
          requireSourceReload={reviewBlocked || sourceReloadRequired || !isOpportunityClassification(confirmedClassification)}
          onReloadEmail={sourceReloadRequired || detailState.error ? () => loadDetail(selectedId) : null}
          reloadingEmail={detailPending}
          reviewPanel={classificationReviewRequired && <SalesEmailReview key={reviewVersion} information={extracted} subject={selected.subject}
            disabled={reviewBlocked || sourceReloadRequired}
            confirmedClassification={confirmedClassification} onConfirmClassification={setConfirmedClassification}
            onClassificationChange={() => setConfirmedClassification("")} />}
          subject={selected.subject}
          information={extracted}
          bodyPreview={selected.body_preview}
          clients={clients.records}
          clientChoice={clientChoice}
          onClientChange={setClientChoice}
          newClientName={suggestedClientName}
          loadingClients={clients.loading}
          clientError={clients.error}
          onRetryClients={clients.load}
          onSubmit={convert}
          onClose={() => setDialog(null)}
          submitting={saving}
          error={error}
          showLocation
        />
      )}

      {["reject", "duplicate"].includes(dialog) && selected && (
        <Modal
          title={dialog === "reject" ? "Reject email intake" : "Mark as duplicate"}
          description={dialog === "reject" ? "Record why this request should not enter the opportunity pipeline." : "Link this email to its original record when one is known."}
          onClose={() => setDialog(null)}
        >
          <form onSubmit={resolve} className="space-y-4 p-6">
            {dialog === "duplicate" && (
              <label className="block text-sm font-semibold text-slate-700">
                Original email (optional)
                <select name="duplicate_of" className={fieldClass}>
                  <option value="">Automatically match or leave unlinked</option>
                  {records.filter((row) => row.id !== selected.id && row.status !== "duplicate").map((row) => (
                    <option key={row.id} value={row.id}>{formatDate(row.received_at)} · {row.subject}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm font-semibold text-slate-700">
              {dialog === "reject" ? "Rejection reason" : "Review note"}
              <textarea name="reason" rows="4" required={dialog === "reject"} className={fieldClass} />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button disabled={reviewBlocked} className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${dialog === "reject" ? "bg-rose-700 hover:bg-rose-800" : "bg-violet-700 hover:bg-violet-800"}`}>{saving ? "Saving…" : dialog === "reject" ? "Reject intake" : "Mark duplicate"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
