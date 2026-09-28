import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  IdentificationIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PaperClipIcon,
  PlusIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import salesService from "../../services/sales.service";
import SalesSharedMailboxMessages from "./SalesSharedMailboxMessages";
import SalesEmailBody from "./SalesEmailBody";
import SalesEmailDetectedInformation from "./SalesEmailDetectedInformation";
import SalesEmailOpportunityForm from "./SalesEmailOpportunityForm";
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
const fieldClass =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

const normalizeCompany = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") === "imported" ? "imported" : "shared";
  return (
    <section className="sales-email-workspace" aria-label="Email Intake workspace">
      <header className="sales-email-page-header">
        <div className="flex min-w-0 items-start gap-3">
          <button type="button" onClick={() => navigate("/sales")} aria-label="Back to Sales and Proposals" className="sales-email-back">
            <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1>Email Intake</h1>
            <p className="mt-1 text-sm text-slate-600">Browse shared emails and review imported client enquiries.</p>
          </div>
        </div>
      </header>
      {view === "shared" ? <SalesSharedMailboxMessages /> : <ImportedEmailIntakes />}
    </section>
  );
}

function ImportedEmailIntakes() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [clientChoice, setClientChoice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [intakeResponse, clientResponse] = await Promise.all([
        salesService.getEmailIntakes({ page_size: 500, ordering: "-received_at" }),
        salesService.getClients({ page_size: 500, ordering: "company_name" }),
      ]);
      const nextRecords = list(intakeResponse);
      setRecords(nextRecords);
      setClients(list(clientResponse));
      setSelectedId((current) =>
        nextRecords.some((row) => row.id === current)
          ? current
          : nextRecords[0]?.id ?? null,
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Email intake records could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
  const selected = records.find((row) => row.id === selectedId) ?? null;
  const extracted = selected?.extracted_information ?? {};
  const detectedCompany = normalizeCompany(extracted.company_name);
  const matchingClients = clients.filter((client) => {
    const clientNames = [client.company_name, client.legal_name, client.trading_name]
      .map(normalizeCompany)
      .filter(Boolean);
    return detectedCompany && clientNames.some((name) => name === detectedCompany);
  });
  const matchedClient = matchingClients.length === 1 ? matchingClients[0] : null;
  const suggestedClientName = String(extracted.company_name || "").trim();
  const unresolved = records.filter((row) =>
    ["received", "under_review"].includes(row.status),
  ).length;

  useEffect(() => {
    if (dialog === "convert") {
      setClientChoice(matchedClient?.id || "");
    }
  }, [dialog, matchedClient?.id, suggestedClientName]);

  const updateRecord = (record) => {
    setRecords((current) =>
      current.map((row) => (row.id === record.id ? record : row)),
    );
  };

  const startReview = async () => {
    if (!selected) return;
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
    if (!selected) return;
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
    if (!selected || selected.can_create_opportunity !== true || saving) return;
    const form = new FormData(event.currentTarget);
    const createClient = clientChoice === "__new__";
    if (createClient && !suggestedClientName) {
      setError("A client name could not be detected from this email.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await salesService.convertEmailIntake(selected.id, {
        client: createClient ? undefined : clientChoice,
        new_client:
          createClient
            ? {
                company_name: suggestedClientName,
                industry_type: extracted.industry_type || "other",
                email: extracted.contact_email || "",
                phone: extracted.contact_phone || "",
                website: extracted.declared_client_domain
                  ? `https://${extracted.declared_client_domain}`
                  : "",
                country: extracted.location?.split(",").at(-1)?.trim() || "",
                contact_name: extracted.contact_name || "",
                contact_email: extracted.contact_email || "",
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
      setError(
        data?.client?.[0] ||
          data?.expected_close_date?.[0] ||
          data?.estimated_value?.[0] ||
          data?.status?.[0] ||
          "The opportunity could not be created.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sales-email-view text-slate-950">
      <div className="sales-email-mailbox">
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
                  onClick={() => setStatusFilter(value)}
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
                onChange={(event) => setSearch(event.target.value)}
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
                    <span className="mt-2 flex items-center justify-between">
                      <StatusBadge value={row.status} />
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
                            disabled={saving}
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
                              onClick={() => setDialog("duplicate")}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => setDialog("reject")}
                              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <NoSymbolIcon className="h-4 w-4" />
                              Reject
                            </button>
                            {selected.can_create_opportunity === true && <button
                              type="button"
                              onClick={() => setDialog("convert")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[#f04b2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d83f26]"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Create opportunity
                            </button>}
                          </>
                        )}
                      </div>
                    </div>
                  </header>

                  <div className="sales-email-detail-grid">
                    <section className="sales-email-reading-pane" aria-label="Email content" tabIndex={0}>
                      <SalesEmailDetectedInformation information={extracted} subject={selected.subject} />
                      <h3 className="mt-6 text-sm font-bold text-[#102a47]">Email preview</h3>
                      <div className="sales-email-body-panel mt-3">
                        <SalesEmailBody bodyText={selected.body_preview || "No email preview was supplied."} />
                      </div>
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
                    </section>

                    <aside className="sales-email-source-panel" aria-label="Source traceability" tabIndex={0}>
                      <div className="flex items-center gap-2">
                        <IdentificationIcon className="h-5 w-5 text-blue-700" />
                        <h3 className="text-sm font-bold text-[#102a47]">Source traceability</h3>
                      </div>
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
                      {selected.duplicate_of && (
                        <button
                          type="button"
                          onClick={() => setSelectedId(selected.duplicate_of)}
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
          subject={selected.subject}
          information={extracted}
          bodyPreview={selected.body_preview}
          clients={clients}
          clientChoice={clientChoice}
          onClientChange={setClientChoice}
          matchedClientId={matchedClient?.id || ""}
          newClientName={matchingClients.length === 0 ? suggestedClientName : ""}
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
              <button disabled={saving} className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${dialog === "reject" ? "bg-rose-700 hover:bg-rose-800" : "bg-violet-700 hover:bg-violet-800"}`}>{saving ? "Saving…" : dialog === "reject" ? "Reject intake" : "Mark duplicate"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
