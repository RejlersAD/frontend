import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  NavLink,
  Navigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  LightBulbIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  PresentationChartLineIcon,
  RectangleStackIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import salesService from "../../services/sales.service";
import SalesActionDialog from "./SalesActionDialog";
import SalesOpportunityHistory from "./SalesOpportunityHistory";
import SalesOpportunityRegistrationDialog from "./SalesOpportunityRegistrationDialog";
import { opportunityMoney } from "./salesOpportunityRegistration";
import SalesOpportunityRegister from "./SalesOpportunityRegister.jsx";
import { loadOpportunityRegister, typeLabel as opportunityTypeLabel } from "./salesOpportunityRegister.js";
import SalesProposalRegister from "./SalesProposalRegister.jsx";
import SalesClientRegister from "./SalesClientRegister.jsx";
import { loadClientPages } from "./salesClientRegister.js";
import { loadProposalRegister } from "./salesProposalRegister.js";
import SalesForecastWorkspace from "./SalesForecastWorkspace.jsx";
import { loadForecastRegister } from "./salesForecastWorkspace.js";
import SalesFrameworkRegister from "./SalesFrameworkRegister.jsx";
import { loadFrameworkRegister } from "./salesFrameworkRegister.js";
import SalesProposalTextField from './SalesProposalTextField';
import { proposalText, proposalTextFields, proposalEditPayload, proposalLines } from './salesProposalDraft';

const AREAS = {
  opportunities: {
    title: "Opportunity",
    icon: LightBulbIcon,
    purpose:
      "Capture and qualify consulting assignments before significant proposal effort is committed.",
    owner: "Business Development Manager or Opportunity Owner",
    controls: [
      "A named owner is mandatory",
      "Proposal work follows minimum qualification",
      "Lost work requires a recorded reason",
    ],
    load: () => loadOpportunityRegister((params) => salesService.getDeals(params)),
    loadCount: () => salesService.getDeals({ page_size: 1 }),
    get: (id) => salesService.getDeal(id),
    update: (id, payload) => salesService.patchDeal(id, payload),
    locked: (row) =>
      ["awarded", "converted", "lost", "no_bid", "cancelled"].includes(
        row.stage,
      ),
    details: [
      "deal_code",
      "deal_name",
      "opportunity_type",
      "open_date",
      "submission_due_date",
      "owner_name",
      "client_reference",
      "stage",
    ],
    editFields: [
      ["deal_name", "Opportunity name"],
      ["opportunity_type", "Opportunity type", "select", ["", "eio", "budgetary", "technical", "commercial", "techno_commercial", "other", "tender", "rfq", "eoi", "direct_enquiry"]],
      ["open_date", "Open date", "date"],
      ["submission_due_date", "Due date", "date"],
      ["client_reference", "Client reference"],
    ],
    columns: [
      "VF code",
      "Title",
      "Client",
      "Open date",
      "Submission deadline",
      "Stage",
      "Owner",
      "Value",
      "Next action",
    ],
    cells: (row) => [
      row.deal_code || "Not provided",
      row.deal_name,
      row.client_name,
      dateLabel(row.open_date),
      dateLabel(row.submission_due_date),
      row.stage === "lead" ? "Open" : row.stage_display || row.stage,
      row.owner_name || "Unassigned",
      opportunityMoney(row.estimated_value, row.currency),
      row.next_action || dateLabel(row.next_action_date),
    ],
  },
  proposals: {
    title: "Proposal",
    icon: DocumentTextIcon,
    purpose:
      "Develop, approve, submit, and control the technical and commercial offer sent to the client.",
    owner: "Proposal Manager or Bid Manager",
    controls: [
      "Only approved versions can be submitted",
      "Submitted versions are immutable",
      "Proposal owners can review and approve their own revisions",
    ],
    load: () => loadProposalRegister((params) => salesService.getQuotes(params)),
    loadCount: () => salesService.getQuotes({ page_size: 1 }),
    get: (id) => salesService.getQuote(id),
    update: (id, payload) => salesService.patchQuote(id, payload),
    locked: (row) =>
      [
        "submitted",
        "sent",
        "viewed",
        "won",
        "lost",
        "withdrawn",
        "cancelled",
        "expired",
      ].includes(row.status),
    details: [
      "quote_number",
      "version",
      "status",
      "scope",
      "total_amount",
      "estimated_cost",
      "expected_margin_percent",
      "currency",
      "issue_date",
      "valid_until",
      "payment_terms",
      "submission_recipient",
    ],
    editFields: [
      ["scope", "Scope", "textarea"],
      ["deliverables", "Deliverables", "textarea"],
      ["assumptions", "Assumptions", "textarea"],
      ["exclusions", "Exclusions", "textarea"],
      ["total_amount", "Proposed price", "number"],
      ["estimated_cost", "Estimated cost", "number"],
      ["valid_until", "Valid until", "date"],
      ["payment_terms", "Payment terms", "textarea"],
    ],
    columns: [
      "Proposal",
      "Opportunity",
      "Client",
      "Status",
      "Price",
      "Valid until",
    ],
    cells: (row) => [
      `${row.quote_number} · v${row.version}`,
      row.deal_name,
      row.client_name,
      label(row.status),
      money(row.total_amount, row.currency),
      dateLabel(row.valid_until),
    ],
  },
  clients: {
    title: "Client",
    icon: BuildingOffice2Icon,
    purpose:
      "Maintain the shared commercial identity and relationship record for organizations buying consulting services.",
    owner: "Client Account Manager",
    controls: [
      "Duplicate identity checks are required",
      "Inactive records retain their history",
      "Client status controls whether new proposals are permitted",
    ],
    load: () => loadClientPages((params) => salesService.getClients(params)),
    loadCount: () => salesService.getClients({ page_size: 1 }),
    get: (id) => salesService.getClient(id),
    update: (id, payload) => salesService.patchClient(id, payload),
    locked: () => false,
    details: [
      "client_code",
      "company_name",
      "legal_name",
      "industry_type",
      "client_tier",
      "status",
      "verification_status",
      "new_proposals_permitted",
      "country",
      "health_score",
      "churn_risk",
      "commercial_risks",
      "notes",
    ],
    editFields: [
      ["company_name", "Company name"],
      ["legal_name", "Legal name"],
      [
        "status",
        "Status",
        "select",
        ["prospect", "active", "inactive", "former"],
      ],
      ["new_proposals_permitted", "New proposals permitted", "checkbox"],
      ["commercial_risks", "Commercial risks", "textarea"],
      ["notes", "Notes", "textarea"],
    ],
    columns: [
      "Client",
      "Code",
      "Sector",
      "Owner",
      "Verification",
      "Active opportunities",
    ],
    cells: (row) => [
      row.company_name,
      row.client_code,
      label(row.industry_type),
      row.account_manager_name || "Unassigned",
      label(row.verification_status),
      row.active_deals_count ?? 0,
    ],
  },
  frameworks: {
    title: "Framework",
    icon: RectangleStackIcon,
    purpose:
      "Control recurring-service agreements, rates, eligibility, call-offs, value ceilings, and validity.",
    owner: "Framework or Key Account Manager",
    controls: [
      "Expired agreements cannot be silently used",
      "Rate versions retain effective dates",
      "Committed, invoiced, and remaining values stay distinct",
    ],
    load: () => loadFrameworkRegister(params => salesService.getFrameworks(params)),
    loadCount: () => salesService.getFrameworks({ page_size: 1 }),
    get: (id) => salesService.getFramework(id),
    update: (id, payload) => salesService.patchFramework(id, payload),
    locked: (row) => ["expired", "closed"].includes(row.status),
    details: [
      "framework_number",
      "title",
      "status",
      "effective_date",
      "expiry_date",
      "renewal_action_date",
      "currency",
      "ceiling_value",
      "committed_value",
      "invoiced_value",
      "payment_terms",
      "call_off_procedure",
    ],
    editFields: [
      ["title", "Framework title"],
      ["renewal_action_date", "Renewal action date", "date"],
      ["ceiling_value", "Value ceiling", "number"],
      ["committed_value", "Committed value", "number"],
      ["invoiced_value", "Invoiced value", "number"],
      ["payment_terms", "Payment terms", "textarea"],
      ["signed_document", "Signed agreement path"],
    ],
    columns: [
      "Framework",
      "Client",
      "Status",
      "Validity",
      "Ceiling",
      "Remaining",
    ],
    cells: (row) => [
      row.framework_number,
      row.client_name,
      label(row.status),
      `${dateLabel(row.effective_date)} – ${dateLabel(row.expiry_date)}`,
      money(row.ceiling_value, row.currency),
      money(row.remaining_value, row.currency),
    ],
  },
  forecasts: {
    title: "Forecast",
    icon: PresentationChartLineIcon,
    purpose:
      "Provide a controlled forward view of expected awards, revenue, workload, and commercial performance.",
    owner: "Sales Director or Commercial Manager",
    controls: [
      "Probabilities are stage-controlled",
      "Manual adjustments require evidence",
      "Approved snapshots cannot be overwritten",
    ],
    load: () => loadForecastRegister((params) => salesService.getForecasts(params)),
    loadCount: () => salesService.getForecasts({ page_size: 1 }),
    get: (id) => salesService.getForecast(id),
    update: (id, payload) => salesService.patchForecast(id, payload),
    locked: (row) => ["approved", "superseded"].includes(row.status),
    details: [
      "forecast_period",
      "forecast_date",
      "status",
      "predicted_revenue",
      "best_case",
      "worst_case",
      "actual_revenue",
      "confidence_level",
      "exchange_rate_date",
      "exchange_rate_source",
    ],
    editFields: [
      ["forecast_period", "Forecast period"],
      ["predicted_revenue", "Weighted revenue", "number"],
      ["best_case", "Best case", "number"],
      ["worst_case", "Worst case", "number"],
      [
        "status",
        "Review status",
        "select",
        ["draft", "owner_review", "management_review"],
      ],
    ],
    columns: [
      "Period",
      "Snapshot",
      "Status",
      "Weighted revenue",
      "Best case",
      "Actual",
    ],
    cells: (row) => [
      row.forecast_period,
      dateLabel(row.forecast_date),
      label(row.status),
      money(row.predicted_revenue),
      money(row.best_case),
      row.actual_revenue === null ? "Not reported" : money(row.actual_revenue),
    ],
  },
  "project-handovers": {
    title: "Project Handover",
    icon: ArrowRightStartOnRectangleIcon,
    purpose:
      "Transfer the approved sale into delivery without re-entry, omissions, or commercial misunderstanding.",
    owner: "Opportunity Owner until accepted by the Project Manager",
    controls: [
      "Won does not mean ready for delivery",
      "Critical checklist items block project creation",
      "Delivery acceptance and corrections create audit events",
    ],
    load: () => salesService.getProjectHandovers({ page_size: 500 }),
    loadCount: () => salesService.getProjectHandovers({ page_size: 1 }),
    get: (id) => salesService.getProjectHandover(id),
    update: (id, payload) => salesService.updateProjectHandover(id, payload),
    locked: (row) =>
      ["accepted", "project_created", "closed"].includes(row.status),
    details: [
      "opportunity_code",
      "opportunity_name",
      "proposal_number",
      "status",
      "owner_name",
      "project_manager_name",
      "signed_contract_reference",
      "purchase_order_reference",
      "contract_value",
      "currency",
      "contract_start_date",
      "contract_end_date",
      "acceptance_comment",
      "returned_reason",
    ],
    editFields: [
      ["purchase_order_reference", "Purchase-order reference"],
      ["contract_start_date", "Contract start", "date"],
      ["contract_end_date", "Contract completion", "date"],
      ["returned_reason", "Correction notes", "textarea"],
    ],
    columns: [
      "Opportunity",
      "Client",
      "Proposal",
      "Status",
      "Project manager",
      "Contract value",
    ],
    cells: (row) => [
      row.opportunity_code,
      row.client_name,
      row.proposal_number,
      label(row.status),
      row.project_manager_name,
      money(row.contract_value, row.currency),
    ],
  },
};

const FLOW = [
  ["clients", "Client"],
  ["frameworks", "Framework"],
  ["opportunities", "Opportunity"],
  ["proposals", "Proposal"],
  ["forecasts", "Forecast"],
  ["project-handovers", "Project handover"],
];
const CREATE_LABELS = {
  clients: "New client",
  frameworks: "New framework",
  opportunities: "New opportunity",
  proposals: "Create proposal",
  forecasts: "Generate forecast",
};

const list = (data) =>
  Array.isArray(data) ? data : (data?.results ?? data?.clients ?? []);
const count = (data) => Number(data?.count ?? list(data).length);
const label = (value) =>
  String(value || "Not set")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not set";
const money = (value, currency = "AED") =>
  value === null || value === undefined
    ? "Not set"
    : new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency: currency || "AED",
        maximumFractionDigits: 0,
      }).format(Number(value || 0));

const opportunityTypeText = (typeValue) => {
  const value = String(typeValue || "").toLowerCase();
  if (value === "eoi") return "EOI (Expression of Interest)";
  if (value === "rfq") return "RFQ";
  return label(typeValue || "Not provided");
};

const dateTimeText = (value, fallbackTime = "12:00 PM") => {
  if (!value) return "Not provided";
  const raw = String(value);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) return "Not provided";
    const datePart = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return `${datePart} at ${fallbackTime}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "Not provided";
  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(parsed)
    .replace("am", "AM")
    .replace("pm", "PM");
  return `${datePart} at ${timePart}`;
};

const buildQualificationSpecialNote = (record) => {
  const eventType =
    record?.qualification_data?.event_type ||
    record?.custom_fields?.event_type ||
    record?.qualification_data?.request_type ||
    record?.custom_fields?.request_type ||
    opportunityTypeText(record?.opportunity_type);
  const publishedAt =
    record?.qualification_data?.published_at ||
    record?.custom_fields?.published_at ||
    record?.created_at;
  const submissionDeadline =
    record?.qualification_data?.submission_deadline_at ||
    record?.custom_fields?.submission_deadline_at ||
    record?.submission_due_date;
  const dueDate =
    record?.qualification_data?.due_date ||
    record?.custom_fields?.due_date ||
    submissionDeadline;
  const owner = record?.owner_name || "Not assigned";
  return [
    `A new ${opportunityTypeText(record?.opportunity_type)} has been received from ${record?.client_name || "Not provided"}.`,
    `Opportunity/Reference Number: ${record?.deal_code || "Not provided"}`,
    `Project Name: ${record?.deal_name || "Not provided"}`,
    `Submission Deadline: ${dateTimeText(submissionDeadline)}`,
    `Owner: ${owner}`,
    `Event Type: ${eventType}`,
    `Published: ${dateTimeText(publishedAt)}`,
    `Due Date: ${dateTimeText(dueDate)}`,
    "Special Note: Prioritize this for Monday kickoff.",
  ].join("\n");
};

function Metric({ label: metricLabel, value, tone = "blue" }) {
  const tones =
    tone === "amber"
      ? "border-amber-200 from-white to-amber-50 text-amber-700"
      : tone === "green"
        ? "border-emerald-200 from-white to-emerald-50 text-emerald-700"
        : "border-slate-200 from-white to-sky-50 text-blue-700";
  return (
    <article
      className={`rounded-md border bg-gradient-to-br px-4 py-3 ${tones}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {metricLabel}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

const fieldLabel = (key) => ({ deal_code: "VF code", deal_name: "Title", client_name: "Client", owner_name: "Owner", created_by_name: "Created by", created_at: "Created date", submission_due_date: "Submission deadline", expected_close_date: "Expected award date", description: "Scope summary" })[key] || label(key);
const displayValue = (value) => {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const lifecycleActions = (area, record) => {
  if (!record) return [];
  if (area === "opportunities") {
    const actions = [];
    if (record.stage === "lead")
      actions.push({ id: "qualify", label: "Submit qualification" });
    if (record.stage === "qualified")
      actions.push({ id: "bid_decision", label: "Record bid/no-bid" });
    if (record.stage === "proposal")
      actions.push({ id: "ceo_decision", label: "Record CEO go/no-go" });
    if (record.stage === "proposal")
      actions.push({ id: "negotiate", label: "Enter negotiation" });
    if (record.stage === "negotiation")
      actions.push({ id: "submit_award", label: "Submit award" });
    if (record.stage === "award_pending")
      actions.push(
        { id: "approve_award", label: "Approve award" },
        { id: "reject_award", label: "Reject award", danger: true },
      );
    if (record.stage === "awarded")
      actions.push({ id: "convert_project", label: "Convert to project" });
    if (
      !["awarded", "converted", "lost", "no_bid", "cancelled"].includes(
        record.stage,
      )
    )
      actions.push({
        id: "close_opportunity",
        label: "Close opportunity",
        danger: true,
      });
    return actions;
  }
  if (area === "proposals") {
    if (
      [
        "draft",
        "scope_development",
        "estimation",
        "internal_review",
        "approval",
      ].includes(record.status)
    )
      return [{ id: "approve_proposal", label: "Review and approve" }];
    if (record.status === "ready_to_submit")
      return [{ id: "submit_proposal", label: "Submit to client" }];
  }
  if (
    area === "frameworks" &&
    ["draft", "internal_review", "pending_signature"].includes(record.status)
  )
    return [{ id: "activate_framework", label: "Activate framework" }];
  if (
    area === "forecasts" &&
    !["approved", "superseded"].includes(record.status)
  )
    return [{ id: "approve_forecast", label: "Approve snapshot" }];
  if (area === "project-handovers") {
    if (
      [
        "initiated",
        "contract_verification",
        "delivery_preparation",
        "commercial_review",
        "meeting",
        "returned",
      ].includes(record.status)
    )
      return [{ id: "complete_handover", label: "Complete and submit" }];
    if (record.status === "acceptance_pending")
      return [
        { id: "accept_handover", label: "Accept handover" },
        { id: "return_handover", label: "Return for correction", danger: true },
      ];
    if (record.status === "accepted")
      return [{ id: "convert_handover", label: "Convert to project" }];
  }
  return [];
};

const handoverChecklist = [
  ["authorization_to_proceed", "Signed contract or authorization to proceed"],
  ["final_scope", "Final scope and deliverables confirmed"],
  ["client_governance", "Client contacts and governance confirmed"],
  ["contract_value", "Contract value and currency verified"],
  ["approved_hours_budget", "Approved hours and delivery budget confirmed"],
  ["project_dates", "Project start and completion dates confirmed"],
  ["billing_milestones", "Billing milestones confirmed"],
  ["payment_terms", "Payment terms confirmed"],
  ["risks", "Risks, assumptions and exclusions transferred"],
  ["project_manager", "Nominated Project Manager confirmed"],
];
const todayInput = () => new Date().toISOString().slice(0, 10);
const apiError = (requestError, fallback) => {
  const response = requestError?.response?.data;
  if (!response) return fallback;
  if (typeof response === "string") {
    const text = response.trim();
    if (/^(?:<!doctype\s+html|<html)/i.test(text)) return fallback;
    return text;
  }
  if (response.detail) return response.detail;
  return Object.entries(response)
    .map(
      ([key, value]) =>
        `${fieldLabel(key)}: ${Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : value}`,
    )
    .join(" | ");
};

function RecordDrawer({
  config,
  record,
  loading,
  editing,
  draft,
  saving,
  onClose,
  onEdit,
  onCancelEdit,
  onChange,
  onSave,
  error,
  loadError = "",
  onRetry,
  actions,
  onAction,
  editEpoch = 0,
}) {
  const locked = record ? config.locked(record) : false;
  useEffect(() => {
    const closeOnEscape = (event) =>
      event.key === "Escape" && !editing && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editing, onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-slate-950/30"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !editing && onClose()
      }
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${config.title} record`}
        className="flex h-full w-full min-w-0 max-w-xl flex-col border-l border-slate-200 bg-white"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              {config.title} record
            </p>
            <h2 className="text-xl font-bold text-[#102a47] [overflow-wrap:anywhere]">
              {record ? displayValue(record[config.details[0]]) : "Loading..."}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record"
            className="shrink-0 rounded-md p-2 text-slate-500 hover:bg-slate-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Loading record...
            </p>
          ) : loadError ? (
            <div className="space-y-3 py-10 text-center text-sm text-slate-600">
              <p>The full record is unavailable. Reload it before editing or taking an action.</p>
              <button type="button" className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-blue-700" onClick={onRetry}>Retry record</button>
            </div>
          ) : editing ? (
            <form
              id="sales-record-form"
              onSubmit={onSave}
              className="space-y-4"
            >
              <fieldset disabled={saving} className="space-y-4">
              {config.editFields.map(
                ([key, text, type = "text", options = []]) => config.title === 'Proposal' && proposalTextFields.includes(key) ? (
                  <SalesProposalTextField key={key} field={key} label={text} value={draft[key] || ''} values={draft} opportunityId={String(record.deal || record.deal_details?.id || '')} quoteId={String(record.id)} contextVersion={`${record.updated_at || ''}:${editEpoch}`} busy={saving} enabled={['draft', 'scope_development', 'estimation', 'internal_review', 'approval'].includes(record.status) && !record.approved_at} onChange={(value, metadata) => onChange(key, value, metadata)} />
                ) : (
                  <label
                    key={key}
                    className={
                      type === "checkbox"
                        ? "flex items-center gap-3 text-sm font-medium text-slate-700"
                        : "block text-sm font-medium text-slate-700"
                    }
                  >
                    {type === "checkbox" ? (
                      <>
                        <input
                          type="checkbox"
                          checked={Boolean(draft[key])}
                          onChange={(event) =>
                            onChange(key, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-700"
                        />
                        {text}
                      </>
                    ) : (
                      <>
                        {text}
                        {type === "textarea" ? (
                          <textarea
                            rows="4"
                            value={draft[key] ?? ""}
                            onChange={(event) =>
                              onChange(key, event.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                          />
                        ) : type === "select" ? (
                          <select
                            value={draft[key] ?? ""}
                            onChange={(event) =>
                              onChange(key, event.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                          >
                            {[...new Set([...(draft[key] ? [draft[key]] : []), ...options])].map((option) => (
                              <option key={option} value={option}>
                                {key === "opportunity_type" && option ? opportunityTypeLabel(option) : label(option)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={type}
                            step={type === "number" ? "0.01" : undefined}
                            value={draft[key] ?? ""}
                            onChange={(event) =>
                              onChange(key, event.target.value)
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                          />
                        )}
                      </>
                    )}
                  </label>
                ),
              )}
              </fieldset>
            </form>
          ) : (
            <dl className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {config.details.map((key) => (
                <div
                  key={key}
                  className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {fieldLabel(key)}
                  </dt>
                  <dd className="min-w-0 whitespace-pre-wrap text-sm leading-6 text-slate-900 [overflow-wrap:anywhere]">
                    {key === "stage" && record?.stage === "lead" ? "Open" : key === "estimated_value" ? opportunityMoney(record?.estimated_value, record?.currency) : displayValue(record?.[key])}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {!loading && !editing && !loadError && actions.length > 0 && (
            <section className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Governed actions
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onAction(action.id)}
                    className={`rounded-md border bg-white px-3 py-2 text-sm font-semibold ${action.danger ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-blue-200 text-blue-800 hover:bg-blue-50"}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          )}
          {!loading && !editing && !loadError && config.title === "Proposal" && <NavLink to={`/sales/proposals/${encodeURIComponent(record.id)}/preview`} className="mt-4 inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800"><EyeIcon className="h-4 w-4" />Preview &amp; comment</NavLink>}
          {!loading && !editing && !loadError && config.title === "Opportunity" && (
            <SalesOpportunityHistory events={record?.stage_history} />
          )}
          {!editing && locked && (
            <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <LockClosedIcon className="h-5 w-5 shrink-0" />
              <p>
                This record is governed and read-only in its current state. Use
                the applicable approval or lifecycle action to change it.
              </p>
            </div>
          )}
        </div>

        {!loading && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
            {editing ? (
              <>
                <button
                  key="cancel-edit"
                  type="button"
                  onClick={onCancelEdit}
                  disabled={saving}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  key="save-record"
                  type="submit"
                  form="sales-record-form"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </>
            ) : (
              <>
                <button
                  key="close-record"
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
                >
                  Close
                </button>
                {!locked && !loadError && (
                  <button
                    key="edit-record"
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}

export default function SalesLifecycleArea() {
  const { area } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = AREAS[area];
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [fullRecordOpen, setFullRecordOpen] = useState(false);
  const recordRequest = useRef(0);
  const listRequest = useRef(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [editEpoch, setEditEpoch] = useState(0);
  const editBaseline = useRef(null);
  const [saving, setSaving] = useState(false);
  const [workspaceCounts, setWorkspaceCounts] = useState({});
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);
  const [actionValues, setActionValues] = useState({});
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionWarnings, setActionWarnings] = useState([]);

  useEffect(() => {
    ++recordRequest.current;
    setRecord(null); setRecordError(""); setRecordLoading(false); setFullRecordOpen(false);
    setRows([]); setQuery(""); setError(""); setEditing(false); setSaving(false);
    setRegistrationOpen(false); setActionDialog(null); setActionWarnings([]);
  }, [area]);

  const load = useCallback(async () => {
    if (!config) return;
    const request = ++listRequest.current;
    setLoading(true);
    setError("");
    try {
      const data = await config.load();
      if (request !== listRequest.current) return;
      setRows(list(data));
      setWorkspaceCounts((current) => ({ ...current, [area]: count(data) }));
      return list(data);
    } catch (requestError) {
      if (request !== listRequest.current) return;
      setRows([]);
      if (["opportunities", "proposals", "clients", "forecasts", "frameworks"].includes(area)) { ++recordRequest.current; setRecord(null); setRecordLoading(false); setFullRecordOpen(false); }
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          `${config.title} records could not be loaded.`,
      );
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }, [area, config]);

  useEffect(() => {
    const requests = [listRequest, recordRequest];
    load();
    return () => { requests.forEach((request) => { ++request.current; }); };
  }, [load]);

  useEffect(() => {
    if (["opportunities", "proposals", "clients", "forecasts", "frameworks"].includes(area)) return undefined;
    let mounted = true;
    Promise.allSettled(
      FLOW.map(async ([id]) => [id, count(await AREAS[id].loadCount())]),
    ).then((results) => {
      if (!mounted) return;
      setWorkspaceCounts(
        Object.fromEntries(
          results
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value),
        ),
      );
    });
    return () => {
      mounted = false;
    };
  }, [area]);

  const openRecord = useCallback(
    async (rowOrId, showFull = true, workspaceView = null) => {
      if (!config) return;
      const id = typeof rowOrId === "string" ? rowOrId : rowOrId.id;
      const request = ++recordRequest.current;
      setRecord(typeof rowOrId === "string" ? { id } : rowOrId);
      setRecordLoading(true);
      setRecordError("");
      setFullRecordOpen(showFull);
      setEditing(false);
      setSaving(false);
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.set('record', id);
        if (workspaceView?.open) { next.set('workspace', '1'); if (workspaceView.folder) next.set('folder', workspaceView.folder); else next.delete('folder'); }
        else if (workspaceView || previous.get('record') !== id) { next.delete('workspace'); next.delete('folder'); }
        return next;
      }, { replace: true });
      try {
        const detail = await config.get(id);
        if (request === recordRequest.current) setRecord(detail);
      } catch (requestError) {
        if (request !== recordRequest.current) return;
        setRecordError(
          requestError?.response?.data?.detail ||
            `${config.title} record could not be loaded.`,
        );
      } finally {
        if (request === recordRequest.current) setRecordLoading(false);
      }
    },
    [config, setSearchParams],
  );

  const selectOpportunity = useCallback((row) => openRecord(row, false, { open: false }), [openRecord]);
  const selectProposal = useCallback((row) => openRecord(row, false), [openRecord]);
  const selectClient = useCallback((row) => openRecord(row, false), [openRecord]);
  const selectForecast = useCallback((row) => openRecord(row, false), [openRecord]);
  const selectFramework = useCallback((row) => openRecord(row, false), [openRecord]);
  const openOpportunityWorkspace = useCallback((row, folder = '') => {
    if (!row) return;
    if (record?.id !== row.id) openRecord(row, false, { open: true, folder });
    else { setFullRecordOpen(false); setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('record', row.id); next.set('workspace', '1'); if (folder) next.set('folder', folder); else next.delete('folder'); return next; }); }
  }, [openRecord, record?.id, setSearchParams]);
  const closeOpportunityWorkspace = () => setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('workspace'); next.delete('folder'); return next; });

  const refreshOpportunities = async () => {
    const selectedId = record?.id;
    const request = recordRequest.current;
    const refreshed = await load();
    if (!refreshed || !selectedId || request !== recordRequest.current) return;
    if (refreshed.some((row) => row.id === selectedId)) {
      await openRecord(selectedId, fullRecordOpen);
    } else {
      ++recordRequest.current;
      setRecord(null); setRecordError(""); setFullRecordOpen(false); setEditing(false);
      setSearchParams({}, { replace: true });
    }
  };

  const refreshPreparedProposal = async (proposalId) => {
    const request = recordRequest.current;
    const detail = await salesService.getQuote(proposalId);
    if (request !== recordRequest.current) return;
    setRecord(current => current?.id === proposalId ? detail : current);
    await load();
  };

  useEffect(() => {
    const recordId = searchParams.get("record");
    if (recordId && record?.id !== recordId) openRecord(recordId, !['proposals', 'clients', 'forecasts', 'frameworks'].includes(area) && searchParams.get('workspace') !== '1', { open: searchParams.get('workspace') === '1', folder: searchParams.get('folder') || '' });
  }, [area, openRecord, record?.id, searchParams]);

  const closeRecord = useCallback(() => {
    if (["opportunities", "proposals", "clients", "forecasts", "frameworks"].includes(area)) { setFullRecordOpen(false); setEditing(false); return; }
    ++recordRequest.current;
    setRecord(null);
    setEditing(false);
    setSearchParams({}, { replace: true });
  }, [area, setSearchParams]);

  const beginEdit = () => {
    if (recordLoading || recordError) return;
    setError("");
    editBaseline.current = structuredClone(record);
    setDraft(
      Object.fromEntries(
        config.editFields.map(([key]) => [key, area === 'proposals' && proposalTextFields.includes(key) ? proposalText(record?.[key]) : record?.[key] ?? ""]),
      ),
    );
    setEditing(true);
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    if (saving) return;
    const request = recordRequest.current;
    const selectedId = record.id;
    setSaving(true);
    setError("");
    try {
      let payload;
      if (area === "opportunities") {
        payload = { ...draft };
        if (Object.prototype.hasOwnProperty.call(draft, "estimated_value")) {
          payload.estimated_value = draft.estimated_value === "" ? null : draft.estimated_value;
        }
        if (Object.prototype.hasOwnProperty.call(draft, "expected_close_date")) {
          payload.expected_close_date = draft.expected_close_date || null;
        }
        if (Object.prototype.hasOwnProperty.call(draft, "submission_due_date")) {
          payload.submission_due_date = draft.submission_due_date || null;
        }
        if (Object.prototype.hasOwnProperty.call(draft, "open_date")) {
          payload.open_date = draft.open_date || null;
        }
        if (Object.prototype.hasOwnProperty.call(draft, "next_action_date")) {
          payload.next_action_date = draft.next_action_date || null;
        }
      } else if (area === "proposals") {
        payload = proposalEditPayload(draft, editBaseline.current || record);
      } else {
        payload = draft;
      }
      const updated = await config.update(selectedId, payload);
      if (request !== recordRequest.current) return;
      setRecord(updated);
      setEditing(false);
      await load();
      if (area === "clients" && request === recordRequest.current) {
        try { const detail = await config.get(selectedId); if (request === recordRequest.current) setRecord(detail); }
        catch { if (request === recordRequest.current) setRecordError("Client saved, but its details could not be refreshed. Please retry."); }
      }
    } catch (requestError) {
      if (request === recordRequest.current) setError(apiError(requestError, `${config.title} could not be updated.`));
    } finally {
      if (request === recordRequest.current) setSaving(false);
    }
  };

  const showAction = (definition, initialValues = {}) => {
    setActionDialog(definition);
    setActionValues(initialValues);
    setActionError("");
    setActionWarnings([]);
  };

  const openCreate = async (preselectedOpportunity = null) => {
    const suffix = Date.now().toString().slice(-6);
    try {
      if (area === "clients") {
        showAction(
          {
            title: "Register client",
            submitLabel: "Create client",
            description:
              "Create the governed client identity before linking opportunities or frameworks.",
            fields: [
              { name: "company_name", label: "Company name", required: true },
              { name: "legal_name", label: "Legal name", required: true },
              {
                name: "industry_type",
                label: "Industry",
                type: "select",
                required: true,
                options: [
                  "oil_gas",
                  "petrochemical",
                  "power_generation",
                  "water_treatment",
                  "manufacturing",
                  "construction",
                  "government",
                  "other",
                ],
              },
              {
                name: "client_tier",
                label: "Client tier",
                type: "select",
                required: true,
                options: ["bronze", "silver", "gold", "platinum"],
              },
              { name: "country", label: "Country", required: true },
              { name: "city", label: "City" },
              {
                name: "notes",
                label: "Relationship notes",
                type: "textarea",
                full: true,
              },
            ],
            execute: (values) =>
              salesService.createClient({
                ...values,
                status: "active",
                verification_status: "unverified",
                new_proposals_permitted: true,
              }),
          },
          {
            industry_type: "oil_gas",
            client_tier: "bronze",
            country: "United Arab Emirates",
          },
        );
        return;
      }

      if (area === "opportunities") { setRegistrationOpen(true); return; }
      if (area === "frameworks") {
        const clients = list(
          await salesService.getClients({ status: "active", page_size: 500 }),
        );
        const clientOptions = clients.map((client) => ({
          value: client.id,
          label: `${client.client_code} - ${client.company_name}`,
        }));
        if (area === "frameworks") {
          showAction(
            {
              title: "Register framework",
              submitLabel: "Create framework",
              description:
                "Register the agreement as Draft. Activation requires a signed document and independent approval.",
              fields: [
                {
                  name: "framework_number",
                  label: "Framework number",
                  required: true,
                },
                { name: "title", label: "Framework title", required: true },
                {
                  name: "client",
                  label: "Client",
                  type: "select",
                  required: true,
                  options: clientOptions,
                },
                {
                  name: "effective_date",
                  label: "Effective date",
                  type: "date",
                  required: true,
                },
                {
                  name: "expiry_date",
                  label: "Expiry date",
                  type: "date",
                  required: true,
                },
                {
                  name: "currency",
                  label: "Currency",
                  type: "select",
                  required: true,
                  options: ["AED", "USD", "EUR", "GBP", "SAR", "QAR"],
                },
                {
                  name: "ceiling_value",
                  label: "Value ceiling",
                  type: "number",
                  min: 0,
                },
                { name: "payment_terms", label: "Payment terms" },
                {
                  name: "signed_document",
                  label: "Signed agreement path",
                  help: "Can be added later before activation.",
                  full: true,
                },
              ],
              execute: (values) =>
                salesService.createFramework({
                  ...values,
                  ceiling_value: values.ceiling_value || null,
                  status: "draft",
                  committed_value: 0,
                  invoiced_value: 0,
                }),
            },
            {
              framework_number: `FW-${new Date().getFullYear()}-${suffix}`,
              currency: "AED",
              effective_date: todayInput(),
            },
          );
          return;
        }
      }

      if (area === "proposals") {
        showAction(
          {
            title: "Create proposal from opportunity",
            requiresOpportunity: true,
            submitLabel: "Create draft proposal",
            description:
              "Choose an opportunity with a Go decision. Client identity is inherited and current eligibility is checked.",
            fields: [
              {
                name: "deal",
                label: "Qualified opportunity",
                type: "proposal_candidate",
                required: true,
              },
              {
                name: "quote_number",
                label: "Proposal number",
                required: true,
              },
              {
                name: "valid_until",
                label: "Valid until",
                type: "date",
                required: true,
              },
              {
                name: "total_amount",
                label: "Proposed price",
                type: "number",
                min: 0,
                required: true,
              },
              {
                name: "estimated_cost",
                label: "Estimated delivery cost",
                type: "number",
                min: 0,
                required: true,
              },
              {
                name: "estimated_hours",
                label: "Total estimated hours",
                type: "number",
                min: 0,
                required: true,
              },
              {
                name: "currency",
                label: "Currency",
                type: "select",
                required: true,
                options: ["AED", "USD", "EUR", "GBP", "SAR", "QAR"],
              },
              {
                name: "scope",
                label: "Scope and execution approach",
                type: "proposal_text",
                required: true,
                full: true,
              },
              {
                name: "deliverables",
                label: "Deliverables",
                type: "proposal_text",
                required: true,
                full: true,
                help: "Enter one deliverable per line.",
              },
              {
                name: "assumptions",
                label: "Assumptions",
                type: "proposal_text",
                full: true,
              },
              {
                name: "exclusions",
                label: "Exclusions",
                type: "proposal_text",
                full: true,
              },
            ],
            execute: (values) => {
              const deal = values._opportunity;
              const payload = Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith('_')));
              if (!deal?.can_create_proposal || String(deal.id) !== String(values.deal)) throw new Error('Choose an eligible opportunity before creating the proposal.');
              return salesService.createQuote({
                ...payload,
                client: deal.client,
                version: 1,
                status: "draft",
                subtotal: values.total_amount,
                tax_amount: 0,
                discount_amount: 0,
                estimated_hours: { total: Number(values.estimated_hours) },
                deliverables: proposalLines(values.deliverables),
                assumptions: proposalLines(values.assumptions),
                exclusions: proposalLines(values.exclusions),
              });
            },
          },
          {
            quote_number: `PROP-${new Date().getFullYear()}-${suffix}`,
            currency: preselectedOpportunity?.currency || "AED",
            deal: preselectedOpportunity?.id ? String(preselectedOpportunity.id) : '',
            _opportunity: null,
          },
        );
        return;
      }

      if (area === "forecasts") {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        showAction(
          {
            title: "Generate forecast",
            submitLabel: "Generate snapshot",
            description:
              "Calculates a new draft from governed opportunity values and stage probabilities.",
            fields: [
              {
                name: "period",
                label: "Forecast period",
                required: true,
                placeholder: "2026-Q4 or 2026-10",
              },
              {
                name: "historical_months",
                label: "Historical months",
                type: "number",
                min: 1,
                required: true,
              },
            ],
            execute: (values) => salesService.generateForecast(values),
          },
          { period: nextMonth.toISOString().slice(0, 7), historical_months: 6 },
        );
      }
    } catch (requestError) {
      setError(
        apiError(requestError, `Unable to prepare the ${config.title} form.`),
      );
    }
  };

  const openLifecycleAction = (actionId) => {
    if (!record || recordLoading || recordError) return;
    const confirm = (title, description, execute, submitLabel = title) =>
      showAction({ title, description, execute, submitLabel, fields: [] });
    if (actionId === "qualify")
      return showAction(
        {
          title: "Submit qualification",
          submitLabel: "Submit qualification",
          description:
            "Submits the opportunity for Internal Sales Review. Missing scope type or attachments are reported as warnings and do not block submission.",
          fields: [
            {
              name: "special_note",
              label: "Special note to Sales team",
              type: "textarea",
              rows: 4,
              full: true,
              placeholder: "Add context, urgency, or handover notes for the team.",
            },
          ],
          execute: (values) =>
            salesService.submitQualification(record.id, {
              special_note: (values.special_note || "").trim(),
            }),
        },
        { special_note: buildQualificationSpecialNote(record) },
      );
    if (actionId === "bid_decision")
      return showAction(
        {
          title: "Record bid/no-bid decision",
          submitLabel: "Record decision",
          description:
            "Choose a decision and explain the reason. AI can help draft or rewrite your justification.",
          fields: [
            {
              name: "decision",
              label: "Decision*",
              type: "select",
              required: true,
              options: [
                { value: "bid", label: "Go" },
                { value: "no_bid", label: "No-go" },
              ],
            },
            {
              name: "reason",
              label: "Decision justification",
              type: "bid_justification",
              opportunityId: String(record.id),
              full: true,
            },
          ],
          execute: (values) =>
            salesService.recordBidDecision(
              record.id,
              values.decision,
              values.reason,
            ),
        },
        { decision: "bid" },
      );
    if (actionId === "ceo_decision")
      return showAction(
        {
          title: "Record CEO go/no-go",
          submitLabel: "Record CEO decision",
          description:
            "CEO decision is required before proposal drafting can proceed for this opportunity.",
          fields: [
            {
              name: "decision",
              label: "CEO decision",
              type: "select",
              required: true,
              options: ["go", "no_go"],
            },
            {
              name: "reason",
              label: "Reason",
              type: "textarea",
              full: true,
              placeholder: "Required when CEO decides no-go.",
            },
          ],
          execute: (values) =>
            salesService.recordCeoDecision(
              record.id,
              values.decision,
              values.reason,
            ),
        },
        { decision: "go" },
      );
    if (actionId === "negotiate")
      return showAction({
        title: "Enter negotiation",
        submitLabel: "Enter negotiation",
        description:
          "Requires at least one approved and submitted proposal version.",
        fields: [
          {
            name: "reason",
            label: "Negotiation context",
            type: "textarea",
            full: true,
          },
        ],
        execute: (values) =>
          salesService.enterNegotiation(record.id, values.reason),
      });
    if (actionId === "submit_award")
      return showAction(
        {
          title: "Submit award for approval",
          submitLabel: "Submit award",
          description:
            "Records the client award while preserving independent approval.",
          fields: [
            {
              name: "award_reference",
              label: "Contract or award reference",
              required: true,
            },
            {
              name: "award_date",
              label: "Award date",
              type: "date",
              required: true,
            },
            {
              name: "award_value",
              label: "Award value",
              type: "number",
              min: 0,
              required: true,
            },
          ],
          execute: (values) => salesService.submitAward(record.id, values),
        },
        { award_date: todayInput(), award_value: record.estimated_value },
      );
    if (actionId === "approve_award")
      return confirm(
        "Approve award",
        "The submitter cannot approve their own award. Approval creates the formal Project Handover.",
        () => salesService.approveAward(record.id),
        "Approve award",
      );
    if (actionId === "reject_award")
      return showAction({
        title: "Reject award submission",
        submitLabel: "Reject and return",
        danger: true,
        description:
          "Returns the opportunity to negotiation with an auditable reason.",
        fields: [
          {
            name: "reason",
            label: "Rejection reason",
            type: "textarea",
            required: true,
            full: true,
          },
        ],
        execute: (values) => salesService.rejectAward(record.id, values.reason),
      });
    if (actionId === "close_opportunity")
      return showAction(
        {
          title: "Close opportunity",
          submitLabel: "Close opportunity",
          danger: true,
          description:
            "Closed outcomes retain the record and its audit history.",
          fields: [
            {
              name: "outcome",
              label: "Outcome",
              type: "select",
              required: true,
              options: ["lost", "cancelled"],
            },
            {
              name: "reason",
              label: "Reason and lesson",
              type: "textarea",
              required: true,
              full: true,
            },
          ],
          execute: (values) =>
            salesService.closeOpportunity(
              record.id,
              values.outcome,
              values.reason,
            ),
        },
        { outcome: "lost" },
      );
    if (actionId === "convert_project" || actionId === "convert_handover")
      return showAction(
        {
          title: "Convert to project",
          submitLabel: "Create project",
          description:
            "Conversion requires an approved award and Project Manager-accepted handover.",
          fields: [
            {
              name: "project_code",
              label: "Reserved project code",
              required: true,
            },
            { name: "project_name", label: "Project name" },
          ],
          execute: (values) =>
            salesService.convertToProject(
              actionId === "convert_handover" ? record.opportunity : record.id,
              values,
            ),
        },
        { project_name: record.opportunity_name || record.deal_name || "" },
      );
    if (actionId === "approve_proposal")
      return showAction({
        title: "Review and approve proposal",
        submitLabel: "Approve proposal",
        description:
          "Confirm the proposal content is complete and ready for client submission.",
        fields: [
          {
            name: "comment",
            label: "Approval comment",
            type: "textarea",
            full: true,
          },
        ],
        execute: (values) =>
          salesService.approveProposal(record.id, values.comment),
      });
    if (actionId === "submit_proposal")
      return showAction(
        {
          title: "Submit proposal to client",
          submitLabel: "Record submission",
          description:
            "The approved version becomes immutable and submission evidence is retained.",
          fields: [
            {
              name: "recipient",
              label: "Client recipient",
              type: "email",
              required: true,
            },
            {
              name: "evidence",
              label: "Submission evidence or reference",
              required: true,
            },
          ],
          execute: (values) => salesService.submitProposal(record.id, values),
        },
        { recipient: record.submission_recipient || "" },
      );
    if (actionId === "activate_framework")
      return confirm(
        "Activate framework",
        "Requires a signed agreement, valid effective dates and independent approval.",
        () => salesService.activateFramework(record.id),
        "Activate framework",
      );
    if (actionId === "approve_forecast")
      return confirm(
        "Approve forecast snapshot",
        "Approval locks this reporting-period snapshot. The generator cannot approve their own forecast.",
        () => salesService.approveForecast(record.id),
        "Approve snapshot",
      );
    if (actionId === "complete_handover")
      return showAction(
        {
          title: "Complete handover checklist",
          submitLabel: "Submit for acceptance",
          description:
            "Confirm every critical transfer item before the Project Manager receives the handover.",
          fields: handoverChecklist.map(([name, fieldLabelText]) => ({
            name,
            label: fieldLabelText,
            type: "checkbox",
            required: true,
            full: true,
          })),
          execute: async (values) => {
            const checklist = Object.fromEntries(
              handoverChecklist.map(([key]) => [key, Boolean(values[key])]),
            );
            await salesService.updateProjectHandover(record.id, { checklist });
            return salesService.submitProjectHandover(record.id);
          },
        },
        Object.fromEntries(
          handoverChecklist.map(([key]) => [
            key,
            Boolean(record.checklist?.[key]),
          ]),
        ),
      );
    if (actionId === "accept_handover")
      return showAction({
        title: "Accept project handover",
        submitLabel: "Accept handover",
        description:
          "Acceptance transfers accountability to the Project Manager and enables Project creation.",
        fields: [
          {
            name: "comment",
            label: "Acceptance comment",
            type: "textarea",
            full: true,
          },
        ],
        execute: (values) =>
          salesService.acceptProjectHandover(record.id, values.comment),
      });
    if (actionId === "return_handover")
      return showAction({
        title: "Return handover for correction",
        submitLabel: "Return for correction",
        danger: true,
        description:
          "Specify exactly what Sales must correct before resubmission.",
        fields: [
          {
            name: "reason",
            label: "Correction reason",
            type: "textarea",
            required: true,
            full: true,
          },
        ],
        execute: (values) =>
          salesService.returnProjectHandover(record.id, values.reason),
      });
  };

  const submitAction = async (event) => {
    event.preventDefault();
    if (actionBusy) return;
    setActionBusy(true);
    setActionError("");
    const selectedId = record?.id;
    const request = recordRequest.current;
    try {
      const result = await actionDialog.execute(actionValues);
      setActionWarnings((result?.warnings || [])
        .map(warning => typeof warning === 'string' ? warning : warning?.message)
        .filter(Boolean));
      if (actionDialog.title === 'Submit qualification') {
        window.dispatchEvent(new Event('notifications-updated'));
      }
      setActionDialog(null);
      await load();
      if (area === 'proposals' && actionDialog.requiresOpportunity && result?.id) { await openRecord(String(result.id), false); return; }
      if (selectedId && request === recordRequest.current) {
        if (area === "frameworks") {
          await openRecord(selectedId, fullRecordOpen);
          return;
        }
        const updated = await config.get(selectedId);
        if (request === recordRequest.current) setRecord(updated);
      }
    } catch (requestError) {
      setActionError(
        apiError(requestError, `${actionDialog.title} could not be completed.`),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !config) return rows;
    return rows.filter((row) =>
      config.cells(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [config, query, rows]);

  if (!config) return <Navigate to="/sales" replace />;
  const Icon = config.icon;
  const activeCount = rows.filter(
    (row) =>
      !["lost", "cancelled", "closed", "expired", "superseded"].includes(
        row.status || row.stage,
      ),
  ).length;
  const attention = rows.filter((row) =>
    [
      "high",
      "critical",
      "restricted",
      "returned",
      "approval",
      "acceptance_pending",
    ].includes(row.risk_level || row.status || row.verification_status),
  ).length;

  return (
    <div className={area === "opportunities" ? "sales-opportunities-route" : area === "proposals" ? "sales-proposals-route" : area === "clients" ? "sales-clients-route" : area === "forecasts" ? "sales-forecasts-route" : area === "frameworks" ? "sales-frameworks-route" : "min-h-full bg-slate-100 p-4 text-slate-950 sm:p-5"}>
      {actionWarnings.length > 0 && (
        <div role="status" className="m-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionWarnings.map(warning => <p key={warning}>{warning}</p>)}
        </div>
      )}
      {area === "opportunities" ? (
        <SalesOpportunityRegister
          rows={rows} loading={loading} error={error}
          record={record} recordLoading={recordLoading} recordError={recordError}
          onRefresh={refreshOpportunities} onSelect={selectOpportunity}
          explorer={searchParams.get('workspace') === '1'} explorerFolder={searchParams.get('folder') || ''}
          onOpenWorkspace={openOpportunityWorkspace} onCloseWorkspace={closeOpportunityWorkspace}
          onRetryRecord={() => record && openRecord(record, false)}
          onOpenFullRecord={(row) => row && openRecord(row, true)}
          onEdit={() => { setFullRecordOpen(true); beginEdit(); }}
          onCreate={openCreate} onAction={openLifecycleAction}
          actions={lifecycleActions(area, record)} locked={!record || config.locked(record)}
        />
      ) : area === "proposals" ? (
        <SalesProposalRegister
          rows={rows} loading={loading} error={error}
          record={record} recordLoading={recordLoading} recordError={recordError}
          selectedId={searchParams.get('record') || ''}
          onRefresh={refreshOpportunities} onSelect={selectProposal}
          onPrepared={refreshPreparedProposal}
          onRetryRecord={() => record && openRecord(record, false)}
          onOpenFullRecord={(row) => row && openRecord(row, true)}
          onEdit={() => { setFullRecordOpen(true); beginEdit(); }}
          onCreate={openCreate} onAction={openLifecycleAction}
          actions={lifecycleActions(area, record)} locked={!record || config.locked(record)}
        />
      ) : area === "clients" ? (
        <SalesClientRegister
          rows={rows} loading={loading} error={error}
          record={record} recordLoading={recordLoading} recordError={recordError}
          selectedId={searchParams.get('record') || ''}
          onRefresh={refreshOpportunities} onSelect={selectClient}
          onRetryRecord={() => record && openRecord(record, false)}
          onOpenFullRecord={(row) => row && openRecord(row, true)}
          onEdit={() => { setFullRecordOpen(true); beginEdit(); }} onCreate={openCreate}
        />
      ) : area === "frameworks" ? (
        <SalesFrameworkRegister
          rows={rows} loading={loading} error={error}
          record={record} recordLoading={recordLoading} recordError={recordError}
          selectedId={searchParams.get('record') || ''}
          onRefresh={refreshOpportunities} onSelect={selectFramework}
          onRetryRecord={() => record && openRecord(record, false)}
          onOpenFullRecord={(row) => row && openRecord(row, true)}
          onEdit={() => { setFullRecordOpen(true); beginEdit(); }}
          onCreate={openCreate} onAction={openLifecycleAction}
          actions={recordError ? [] : lifecycleActions(area, record)} locked={!record || config.locked(record)}
        />
      ) : area === "forecasts" ? (
        <SalesForecastWorkspace
          rows={rows} loading={loading} error={error}
          record={record} recordLoading={recordLoading} recordError={recordError}
          selectedId={searchParams.get('record') || ''}
          onRefresh={refreshOpportunities} onSelect={selectForecast}
          onRetryRecord={() => record && openRecord(record, false)}
          onOpenFullRecord={() => record && openRecord(record, true)}
          onEdit={() => { setFullRecordOpen(true); beginEdit(); }}
          onCreate={openCreate} onAction={openLifecycleAction}
          actions={recordError ? [] : lifecycleActions(area, record)} locked={!record || config.locked(record)}
        />
      ) : <>
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <Icon
            aria-hidden="true"
            className="mt-0.5 h-8 w-8 shrink-0 text-blue-700"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#102a47]">
              {config.title}
            </h1>
            <p className="max-w-4xl text-sm text-slate-600">{config.purpose}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          {CREATE_LABELS[area] && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <PlusIcon className="h-4 w-4" />
              {CREATE_LABELS[area]}
            </button>
          )}
        </div>
      </header>

      <nav
        aria-label="Sales workspaces"
        className="mt-4 overflow-x-auto border-b border-slate-200 bg-transparent px-1.5"
      >
        <div className="flex min-w-max items-center gap-1 lg:min-w-0">
          {FLOW.map(([id, text]) => (
            <div key={id} className="flex flex-1 items-center">
              <NavLink
                to={`/sales/${id}`}
                className={({ isActive }) =>
                  `relative flex min-w-32 flex-1 items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold transition-colors duration-150 ${isActive ? "bg-blue-100 text-blue-950 after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:bg-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{text}</span>
                    {workspaceCounts[id] !== undefined && (
                      <span
                        aria-label={`${workspaceCounts[id]} records`}
                        className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isActive ? "bg-white text-blue-800" : "bg-slate-200/80 text-slate-500"}`}
                      >
                        {workspaceCounts[id]}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          ))}
        </div>
      </nav>

      {error && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Total records" value={rows.length} />
        <Metric label="Active / available" value={activeCount} tone="green" />
        <Metric label="Requires attention" value={attention} tone="amber" />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[#102a47]">
                {config.title} register
              </h2>
              <p className="text-xs text-slate-500">
                Authoritative records for this lifecycle responsibility
              </p>
            </div>
            <label className="relative block">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <span className="sr-only">Search {config.title}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${config.title.toLowerCase()}...`}
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {config.columns.map((column) => (
                    <th
                      key={column}
                      className="border-b border-slate-200 px-4 py-3 font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((row, index) => (
                  <tr key={row.id || index} className="hover:bg-slate-50">
                    {config.cells(row).map((cell, cellIndex) => (
                      <td
                        key={`${row.id || index}-${cellIndex}`}
                        className={`px-4 py-3 ${cellIndex === 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}
                      >
                        {cell}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      {area === "proposals" && <NavLink to={`/sales/proposals/${encodeURIComponent(row.id)}/preview`} className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50">Preview &amp; comment</NavLink>}
                      <button
                        type="button"
                        onClick={() => openRecord(row)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !filtered.length && (
                  <tr>
                    <td
                      colSpan={config.columns.length + 1}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No {config.title.toLowerCase()} records match this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="h-fit rounded-md border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 font-bold text-[#102a47]">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-700" />
            Governance
          </h2>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Accountable owner
          </p>
          <p className="mt-1 text-sm font-semibold">{config.owner}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Key controls
          </p>
          <ul className="mt-2 space-y-3">
            {config.controls.map((control) => (
              <li key={control} className="flex gap-2 text-sm text-slate-600">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {control}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex gap-2">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              <p>
                Inherited information must be verified here; source records
                remain traceable and are not re-entered.
              </p>
            </div>
          </div>
        </aside>
      </div>
      </>}
      {registrationOpen && <SalesOpportunityRegistrationDialog onClose={() => setRegistrationOpen(false)} onCreated={(created) => { setRegistrationOpen(false); load(); openRecord(created); }} />}
      {record && (!["opportunities", "proposals", "clients", "forecasts", "frameworks"].includes(area) || fullRecordOpen) && (
        <RecordDrawer
          config={config}
          record={record}
          loading={recordLoading}
          editing={editing}
          draft={draft}
          saving={saving}
          onClose={closeRecord}
          onEdit={beginEdit}
          onCancelEdit={() => setEditing(false)}
          onChange={(key, value, metadata) => { setDraft(current => ({ ...current, [key]: value })); if (!metadata?.ai) setEditEpoch(epoch => epoch + 1); }}
          editEpoch={editEpoch}
          onSave={saveRecord}
          error={recordError || error}
          loadError={recordError}
          onRetry={() => openRecord(record, true)}
          actions={recordError ? [] : lifecycleActions(area, record)}
          onAction={openLifecycleAction}
        />
      )}
      {actionDialog && (
        <SalesActionDialog
          action={actionDialog}
          values={actionValues}
          busy={actionBusy}
          error={actionError}
          onChange={(key, value, metadata) => setActionValues(current => ({ ...current, [key]: value, ...(actionDialog.requiresOpportunity ? { _editEpoch: (current._editEpoch || 0) + (metadata?.ai || key === '_opportunity' ? 0 : 1), ...(key === 'currency' ? { _currencyTouched: true } : {}), ...(key === '_opportunity' && value?.currency && !current._currencyTouched && !current._currencyInitialized ? { currency: value.currency, _currencyInitialized: true } : {}) } : {}) }))}
          onClose={() => setActionDialog(null)}
          onSubmit={submitAction}
          currentRecordId={record?.id}
        />
      )}
    </div>
  );
}

Metric.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tone: PropTypes.oneOf(["blue", "amber", "green"]),
};
Metric.defaultProps = { tone: "blue" };

RecordDrawer.propTypes = {
  config: PropTypes.shape({
    title: PropTypes.string.isRequired,
    details: PropTypes.arrayOf(PropTypes.string).isRequired,
    editFields: PropTypes.arrayOf(PropTypes.array).isRequired,
    locked: PropTypes.func.isRequired,
  }).isRequired,
  record: PropTypes.object.isRequired,
  loading: PropTypes.bool.isRequired,
  editing: PropTypes.bool.isRequired,
  draft: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onCancelEdit: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  error: PropTypes.string,
  loadError: PropTypes.string,
  onRetry: PropTypes.func,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      danger: PropTypes.bool,
    }),
  ).isRequired,
  onAction: PropTypes.func.isRequired,
  editEpoch: PropTypes.number,
};
RecordDrawer.defaultProps = { error: "" };
