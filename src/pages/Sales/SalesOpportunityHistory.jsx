import PropTypes from "prop-types";

const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const words = (value) => text(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const scalar = (value) => typeof value === "boolean" ? value ? "Yes" : "No"
  : typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);
const knownLabel = (labels, value) => Object.hasOwn(labels, text(value)) ? labels[text(value)] : "";

const eventLabels = {
  opportunity_created: "Opportunity created",
  opportunity_created_from_email: "Opportunity created from incoming email",
  qualification_submitted: "Qualification submitted",
  bid_decision: "Bid decision recorded",
  proposal_revision_created: "Proposal revision created",
  proposal_revision_approved: "Proposal revision approved",
  proposal_revision_issued: "Proposal revision issued to client",
  negotiation_entered: "Negotiation started",
  award_submitted: "Award submitted for approval",
  award_approved: "Award approved",
  award_rejected: "Award rejected",
  handover_submitted: "Project handover submitted",
  handover_accepted: "Project handover accepted",
  handover_returned: "Project handover returned",
  project_converted: "Converted to project",
  opportunity_closed: "Opportunity closed",
};
const noticeLabels = {
  new_request: "New request", reminder: "Reminder", deadline_update: "Deadline update",
  clarification: "Clarification", cancellation: "Cancellation", other: "Other",
};
const sourceFields = [
  ["organization_name", "Customer"], ["customer_name", "Customer"],
  ["tender_reference", "Tender reference"], ["procurement_reference", "Procurement reference"],
  ["pr_reference", "PR reference"], ["source_portal", "Portal"],
  ["due_date", "Proposal deadline"], ["deadline_time", "Submission time"],
  ["deadline_timezone", "Submission timezone"], ["scope_summary", "Scope summary"],
  ["estimated_value", "Estimated value"], ["currency", "Currency"],
  ["expected_award_date", "Expected award date"], ["scope_type", "Scope type"],
];
// Present business facts deliberately; an expanded audit payload must not become
// a new customer-facing dump of internal IDs, hashes, provider data or JSON.
const businessFields = [
  ["opportunity_source", "Source"], ["decision", "Decision"], ["outcome", "Outcome"],
  ["award_reference", "Award reference"], ["award_value", "Award value"], ["currency", "Currency"],
  ["proposal_number", "Proposal number"], ["version", "Version"],
  ["recipient", "Recipient"], ["evidence", "Submission evidence"],
  ["project_code", "Project code"], ["project_name", "Project"],
  ["notes", "Notes"], ["note", "Note"], ["description", "Description"],
];

function calendarDate(value) {
  const raw = text(value);
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(raw)) return "Date unavailable";
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function timestamp(value) {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return calendarDate(raw);
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Dubai", timeZoneName: "short",
  }).format(date);
}

function deadline(analysis) {
  if (!text(analysis.due_date)) return "";
  const date = calendarDate(analysis.due_date);
  if (date === "Date unavailable") return date;
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text(analysis.deadline_time)) ? text(analysis.deadline_time) : "";
  const zone = time ? text(analysis.deadline_timezone) : "";
  return `${date}${time ? ` · ${time}` : ""}${zone ? ` (${zone})` : ""}`;
}

function customerResult(value) {
  const resolution = object(value);
  const name = text(resolution.reviewed_name);
  const suffix = name ? `: ${name}` : "";
  if (resolution.mode === "created" && resolution.created === true) return `New client created${suffix}`;
  if (resolution.mode === "exact_name" && resolution.created === false) return `Existing client reused${suffix}`;
  if (resolution.mode === "selected" && resolution.created === false) return "Existing client selected";
  return "";
}

function FactList({ rows }) {
  const facts = rows.filter(([, value]) => value !== "");
  if (!facts.length) return null;
  return <dl className="min-w-0 space-y-3 text-sm leading-6">
    {facts.map(([label, value]) => <div key={label} className="grid min-w-0 gap-x-4 gap-y-0.5 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]">{value}</dd>
    </div>)}
  </dl>;
}
FactList.propTypes = { rows: PropTypes.array.isRequired };

function EmailDetails({ data }) {
  const analysis = object(data.reviewed_email_analysis);
  const classification = object(data.reviewed_classification);
  const identity = object(data.email_tender_identity);
  const detectedClassification = object(analysis.classification);
  const classificationEvidence = Array.isArray(detectedClassification.evidence) ? detectedClassification.evidence : [];
  const hasNoticeEvidence = text(detectedClassification.code) && classificationEvidence.some((item) =>
    object(item).rule_id === "ai_source_evidence_v1" && text(object(item).excerpt));
  const rows = [
    ["Subject", text(analysis.title) || text(data.subject)],
    ["Email customer", text(analysis.organization_name) || text(analysis.customer_name)],
    ["Email type", text(classification.label) || words(classification.code)],
    ["Notice", hasNoticeEvidence ? knownLabel(noticeLabels, object(analysis.ai_review).purpose) : ""],
    ["Client record", customerResult(data.reviewed_customer_resolution)],
    ["From", text(data.sender_email)],
    ["Received", text(data.received_at) ? timestamp(data.received_at) : ""],
    ["Mailbox", text(data.source_mailbox_address)],
    ["Tender reference", text(analysis.tender_reference) || text(identity.tender_reference)],
    ["Procurement reference", text(analysis.procurement_reference)],
    ["PR reference", text(analysis.pr_reference)],
    ["Portal", text(analysis.source_portal) || text(identity.source_portal)],
    ["Proposal deadline", deadline(analysis)],
    ["Estimated value", text(analysis.estimated_value)],
    ["Currency", text(analysis.currency)],
    ["Expected award date", text(analysis.expected_award_date) ? calendarDate(analysis.expected_award_date) : ""],
    ["Scope type", words(analysis.scope_type)],
    ["Scope summary", text(analysis.scope_summary)],
  ];
  const seen = new Set();
  const excerpts = sourceFields.flatMap(([key, label]) => {
    const excerpt = text(object(analysis.evidence)[key]);
    const normalized = excerpt.replace(/\s+/g, " ");
    if (!excerpt || seen.has(normalized)) return [];
    seen.add(normalized);
    return [[label, excerpt]];
  });
  if (!rows.some(([, value]) => value) && !excerpts.length) return null;
  return <div className="mt-3 min-w-0 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-3 sm:p-4">
    <h4 className="text-sm font-semibold text-[#102a47]">Email details</h4>
    <FactList rows={rows} />
    {excerpts.length > 0 && <details className="min-w-0 border-t border-slate-200 pt-3">
      <summary className="w-fit cursor-pointer rounded text-sm font-semibold leading-6 text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Source evidence</summary>
      <div className="mt-3 space-y-4">
        {excerpts.map(([label, excerpt], index) => <div key={`${label}-${index}`} className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <blockquote className="mt-1 min-w-0 whitespace-pre-wrap border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-800 [overflow-wrap:anywhere]">{excerpt}</blockquote>
        </div>)}
      </div>
    </details>}
  </div>;
}
EmailDetails.propTypes = { data: PropTypes.object.isRequired };

export default function SalesOpportunityHistory({ events = [] }) {
  const history = Array.isArray(events) ? events.filter((event) => event && typeof event === "object" && !Array.isArray(event)) : [];
  if (!history.length) return null;
  return <section aria-label="Action history" className="mt-4 min-w-0 rounded-md border border-slate-200 bg-white p-4">
    <h3 className="text-base font-semibold text-[#102a47]">Action history</h3>
    <p className="mt-1 text-xs leading-5 text-slate-600">Incoming source and lifecycle actions · newest first</p>
    <ol className="mt-4 min-w-0 space-y-6 border-l-2 border-blue-100 pl-3 sm:pl-4">
      {history.map((event, index) => {
        const data = object(event.data);
        const rows = businessFields.map(([key, label]) => [label,
          ["decision", "outcome", "opportunity_source"].includes(key) ? words(data[key]) : scalar(data[key])]);
        return <li key={event.id || index} className="relative min-w-0">
          <span aria-hidden="true" className="absolute -left-[1.06rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 sm:-left-[1.31rem]" />
          <p className="text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{knownLabel(eventLabels, event.event_type) || words(event.event_type) || "Activity recorded"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">
            <time>{timestamp(event.occurred_at)}</time> · By {text(event.actor_name) || "System"}
          </p>
          {(text(event.from_stage) || text(event.to_stage)) && <p className="text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">
            {words(event.from_stage) || "Created"} → {words(event.to_stage) || "No stage change"}
          </p>}
          {text(event.reason) && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800 [overflow-wrap:anywhere]">{event.reason}</p>}
          {event.event_type === "opportunity_created_from_email" ? <EmailDetails data={data} />
            : rows.some(([, value]) => value) && <div className="mt-3 min-w-0 rounded-md bg-slate-50 p-3"><FactList rows={rows} /></div>}
        </li>;
      })}
    </ol>
  </section>;
}
SalesOpportunityHistory.propTypes = { events: PropTypes.array };
