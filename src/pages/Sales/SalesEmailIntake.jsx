import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [clientMode, setClientMode] = useState("existing");

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
  const matchedClient = clients.find(
    (client) =>
      extracted.company_name &&
      client.company_name.trim().toLowerCase() ===
        extracted.company_name.trim().toLowerCase(),
  );
  const unresolved = records.filter((row) =>
    ["received", "under_review"].includes(row.status),
  ).length;

  useEffect(() => {
    if (dialog === "convert") {
      setClientMode(matchedClient ? "existing" : "new");
    }
  }, [dialog, matchedClient]);

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
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const result = await salesService.convertEmailIntake(selected.id, {
        client: clientMode === "existing" ? form.get("client") : undefined,
        new_client:
          clientMode === "new"
            ? {
                company_name: form.get("new_client_company_name"),
                industry_type: form.get("new_client_industry_type"),
                email: form.get("new_client_email"),
                phone: form.get("new_client_phone"),
                website: form.get("new_client_website"),
                country: form.get("new_client_country"),
                contact_name: form.get("new_client_contact_name"),
                contact_email: form.get("new_client_email"),
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
    <div className="min-h-full bg-slate-100 text-slate-950">
      <main className="space-y-4 p-5">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("/sales")}
              aria-label="Back to Sales and Proposals"
              className="mt-1 rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                Sales workspace
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#102a47]">
                Email Intake
              </h1>
              <p className="text-sm text-slate-600">
                Review client emails and convert qualified requests into traceable opportunities.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <b>{unresolved}</b> awaiting review
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#102a47] hover:bg-slate-50"
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

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Email intake status" className="flex flex-wrap gap-1">
              {["all", ...Object.keys(STATUS)].map((value) => (
                <button
                  type="button"
                  key={value}
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
            <label className="relative block min-w-64">
              <span className="sr-only">Search email intake</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sender or subject"
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="grid min-h-[590px] lg:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="border-r border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span>{filtered.length} messages</span>
                <FunnelIcon className="h-4 w-4" />
              </div>
              <div className="max-h-[650px] overflow-y-auto">
                {filtered.map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`block w-full border-b border-slate-200 px-4 py-4 text-left transition ${
                      selectedId === row.id
                        ? "border-l-4 border-l-blue-700 bg-blue-50/80 pl-3"
                        : "border-l-4 border-l-transparent bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[#102a47]">
                        {row.sender_name || row.sender_email}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatDate(row.received_at)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold text-slate-800">
                      {row.subject || "No subject"}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {row.body_preview || "No email preview available."}
                    </span>
                    <span className="mt-3 flex items-center justify-between">
                      <StatusBadge value={row.status} />
                      {row.has_attachments && (
                        <PaperClipIcon className="h-4 w-4 text-slate-500" />
                      )}
                    </span>
                  </button>
                ))}
                {!loading && !filtered.length && (
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

            <article className="min-w-0">
              {selected ? (
                <>
                  <header className="border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={selected.status} />
                          {selected.importance && (
                            <span className="text-xs font-semibold text-slate-500">
                              {selected.importance} importance
                            </span>
                          )}
                        </div>
                        <h2 className="mt-3 text-xl font-bold text-[#102a47]">
                          {selected.subject || "No subject"}
                        </h2>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
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
                            <button
                              type="button"
                              onClick={() => setDialog("convert")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[#f04b2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d83f26]"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Create opportunity
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </header>

                  <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section>
                      <h3 className="text-sm font-bold text-[#102a47]">Detected information</h3>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          ["Request type", selected.extracted_information?.request_type || "General client email"],
                          ["Client domain", selected.extracted_information?.client_domain || "Not detected"],
                          ["Tender reference", selected.extracted_information?.tender_reference || "Not detected"],
                          ["Stated deadline", selected.extracted_information?.deadline_text || "Not detected"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                            <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <h3 className="mt-6 text-sm font-bold text-[#102a47]">Email preview</h3>
                      <div className="mt-3 min-h-44 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                        {selected.body_preview || "No email preview was supplied."}
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

                    <aside className="rounded-lg border border-slate-200 bg-white p-4">
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
                <div className="flex min-h-[590px] items-center justify-center text-center">
                  <div>
                    <EnvelopeOpenIcon className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">Select an email to review</p>
                  </div>
                </div>
              )}
            </article>
          </div>
        </section>
      </main>

      {dialog === "convert" && selected && (
        <Modal
          title="Create opportunity from email"
          description="Verify inherited information before creating the governed opportunity record."
          onClose={() => setDialog(null)}
        >
          <form onSubmit={convert} className="grid max-h-[72vh] gap-4 overflow-y-auto p-6 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Opportunity name
              <input name="deal_name" required defaultValue={selected.subject} maxLength="300" className={fieldClass} />
            </label>
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-slate-700">Client</p>
              <div className="mt-1.5 inline-flex rounded-md border border-slate-300 bg-slate-50 p-1">
                <button type="button" onClick={() => setClientMode("existing")} className={`rounded px-3 py-1.5 text-xs font-semibold ${clientMode === "existing" ? "bg-white text-blue-800 shadow-sm" : "text-slate-600"}`}>Existing client</button>
                <button type="button" onClick={() => setClientMode("new")} className={`rounded px-3 py-1.5 text-xs font-semibold ${clientMode === "new" ? "bg-white text-blue-800 shadow-sm" : "text-slate-600"}`}>Create from email</button>
              </div>
            </div>
            {clientMode === "existing" ? (
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Select client
                <select name="client" required defaultValue={matchedClient?.id || ""} className={fieldClass}>
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.company_name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 sm:col-span-2 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  New client name
                  <input name="new_client_company_name" required defaultValue={extracted.company_name} className={fieldClass} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Contact name
                  <input name="new_client_contact_name" defaultValue={extracted.contact_name} className={fieldClass} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Contact email
                  <input name="new_client_email" type="email" defaultValue={extracted.contact_email} className={fieldClass} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Contact phone
                  <input name="new_client_phone" defaultValue={extracted.contact_phone} className={fieldClass} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Industry
                  <select name="new_client_industry_type" defaultValue={extracted.industry_type || "other"} className={fieldClass}>
                    <option value="power_generation">Power &amp; Utilities</option>
                    <option value="oil_gas">Oil &amp; Gas</option>
                    <option value="water_treatment">Water &amp; Wastewater</option>
                    <option value="construction">Construction &amp; EPC</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Website
                  <input name="new_client_website" type="url" defaultValue={extracted.declared_client_domain ? `https://${extracted.declared_client_domain}` : ""} className={fieldClass} />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Country
                  <input name="new_client_country" defaultValue={extracted.location?.split(",").at(-1)?.trim() || ""} className={fieldClass} />
                </label>
              </div>
            )}
            <label className="text-sm font-semibold text-slate-700">
              Client reference
              <input name="client_reference" defaultValue={extracted.tender_reference} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Estimated value
              <input name="estimated_value" type="number" min="0" step="0.01" required defaultValue={extracted.estimated_value} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Currency
              <select name="currency" defaultValue={extracted.currency || "AED"} className={fieldClass}>
                {["AED", "USD", "EUR", "GBP", "SAR", "QAR"].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Expected award date
              <input name="expected_close_date" type="date" required className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Proposal deadline
              <input name="submission_due_date" type="date" defaultValue={extracted.deadline_date} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Scope type
              <select name="scope_type" defaultValue={extracted.scope_type || "other"} className={fieldClass}>
                {["conceptual", "pre_feed", "feed", "basic_engineering", "detailed_engineering", "epcm", "epc", "pmc", "owner_engineer", "feasibility", "other"].map((value) => (
                  <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Project location
              <input name="location" defaultValue={extracted.location} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Scope summary
              <textarea name="description" rows="4" defaultValue={selected.body_preview} className={fieldClass} />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
              <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button disabled={saving} className="rounded-md bg-[#f04b2f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : clientMode === "new" ? "Create client & opportunity" : "Create opportunity"}</button>
            </div>
          </form>
        </Modal>
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
