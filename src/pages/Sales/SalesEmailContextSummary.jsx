import PropTypes from "prop-types";
import { FileText, ListChecks } from "lucide-react";
import { selectedThreadSource } from "./SalesEmailThreadRole";
import {
  EMAIL_CLASSIFICATIONS,
  classificationSuggestion,
  emailContextReference,
  emailReviewFacts,
  isKnownClassification,
  reviewObject,
  reviewText,
} from "./salesEmailReviewState";

const purposeLabels = {
  new_request: "New request", reminder: "Reminder", deadline_update: "Deadline update",
  clarification: "Clarification", cancellation: "Cancellation", other: "Other",
};

function supportedSources(information, ids) {
  if (information?.analysis?.version !== 1 || !Array.isArray(ids) || !ids.length) return false;
  const sources = Array.isArray(information.analysis.sources) ? information.analysis.sources : [];
  return ids.every((id) => {
    if (!reviewText(id)) return false;
    const matches = sources.filter((source) => reviewObject(source) && source.id === id);
    return matches.length === 1 && ["message", "quoted"].includes(matches[0].origin) &&
      !["outgoing", "draft"].includes(matches[0].direction) && matches[0].thread_role !== "draft" && matches[0].is_draft !== true;
  });
}

function sourcedField(information, key) {
  const value = reviewText(information?.[key]);
  return information?.detection_version === 2 && value && reviewText(information?.evidence?.[key]) && supportedSources(information, information?.field_sources?.[key]) ? value : "";
}

function sentDate(value) {
  const raw = reviewText(value);
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return "Not available";
  const calendar = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  const parsed = new Date(raw);
  if (Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== raw.slice(0, 10) || Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function SummaryCard({ title, label, icon: Icon, rows }) {
  return <section className="sales-email-context__card" aria-label={title}>
    <h5 className="sales-email-context__card-heading"><Icon size={16} aria-hidden="true" />{label}</h5>
    <dl className="sales-email-context__facts sales-email-review__facts">
      {rows.map(([label, value]) => <div className="sales-email-context__row" key={label}>
        <dt>{label}</dt><dd className="sales-email-context__value">{value}</dd>
      </div>)}
    </dl>
  </section>;
}

export default function SalesEmailContextSummary({ information, senderName, senderEmail, sentAt, receivedAt, converted, classificationCode }) {
  const facts = emailReviewFacts(information, converted);
  const suggestion = classificationSuggestion(information);
  const classificationEvidence = Array.isArray(suggestion?.evidence) ? suggestion.evidence : [];
  const supportedEvidence = classificationEvidence.filter((item) => reviewObject(item) &&
    ["subject", "body"].includes(item.location) && reviewText(item.excerpt) && supportedSources(information, [item.source_id]));
  const detectedType = isKnownClassification(classificationCode) ? EMAIL_CLASSIFICATIONS[classificationCode]
    : suggestion?.status === "classified" && supportedEvidence.length ? EMAIL_CLASSIFICATIONS[suggestion.code] : "Not classified";
  const purpose = information?.ai_review?.version === 1 && information.ai_review.status === "validated" &&
    supportedEvidence.some((item) => item.rule_id === "ai_source_evidence_v1") && Object.hasOwn(purposeLabels, reviewText(information.ai_review.purpose))
    ? purposeLabels[information.ai_review.purpose] : "";
  const selectedSource = selectedThreadSource(information?.analysis);
  const emailRows = [
    ["Sender", reviewText(senderEmail) || reviewText(senderName) || reviewText(selectedSource?.sender_email) || "Not available"],
    [receivedAt ? "Received" : "Sent", sentDate(receivedAt || sentAt || selectedSource?.sent_at)],
    ["Type", [detectedType, purpose].filter(Boolean).join(" · ")],
    ["Customer", facts.customer],
  ];
  const tenderReference = sourcedField(information, "tender_reference");
  const procurementReference = sourcedField(information, "procurement_reference");
  const purchaseReference = sourcedField(information, "pr_reference");
  const scope = sourcedField(information, "scope_summary");
  const portal = sourcedField(information, "source_portal");
  const agreementReference = emailContextReference(information, "agreement_reference");
  const correspondenceReference = emailContextReference(information, "correspondence_reference");
  const dueDate = information?.detection_version === 2 && facts.dueLabel === "Due date" && /^\d{4}-\d{2}-\d{2}(?: · Requires verification)?$/.test(facts.dueDate);
  const deadlineSources = information?.field_sources?.due_date;
  const sharesDeadlineSource = (key) => supportedSources(information, deadlineSources) &&
    Array.isArray(information?.field_sources?.[key]) && information.field_sources[key].some((id) => deadlineSources.includes(id));
  const time = dueDate && sharesDeadlineSource("deadline_time") ? sourcedField(information, "deadline_time") : "";
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
  const timezone = validTime && sharesDeadlineSource("deadline_timezone") ? sourcedField(information, "deadline_timezone") : "";
  const opportunityRows = [
    ...(tenderReference ? [["Tender code", tenderReference]] : []),
    ...(procurementReference ? [["Procurement reference", procurementReference]] : []),
    ...(purchaseReference ? [["PR reference", purchaseReference]] : []),
    ...(scope ? [["Package description", scope]] : []),
    ...(portal ? [["Source portal", portal]] : []),
    ...(tenderReference ? [["Tender status", "Not verified"]] : []),
    ...(agreementReference ? [["WO agreement reference", agreementReference.value]] : []),
    ...(correspondenceReference ? [["Correspondence reference", `${correspondenceReference.value} · Requires review`]] : []),
    [facts.dueLabel, facts.dueDate],
    ...(validTime ? [["Submission time", [validTime, timezone].filter(Boolean).join(" · ")]] : []),
    ["Opportunity", facts.opportunity],
  ];

  return <div className="sales-email-context__summary">
    <h4 className="sales-email-context__key-heading">Key information</h4>
    <div className="sales-email-context__groups">
      <SummaryCard title="Email Summary" label="Email summary" icon={FileText} rows={emailRows} />
      <SummaryCard title="Opportunity Details Detected" label="Detected details" icon={ListChecks} rows={opportunityRows} />
    </div>
  </div>;
}

SummaryCard.propTypes = { title: PropTypes.string.isRequired, label: PropTypes.string.isRequired, icon: PropTypes.elementType.isRequired, rows: PropTypes.array.isRequired };
SalesEmailContextSummary.propTypes = {
  information: PropTypes.object, senderName: PropTypes.string,
  senderEmail: PropTypes.string, sentAt: PropTypes.string, receivedAt: PropTypes.string, converted: PropTypes.bool, classificationCode: PropTypes.string,
};
SalesEmailContextSummary.defaultProps = { information: null, senderName: "", senderEmail: "", sentAt: "", receivedAt: "", converted: false, classificationCode: "" };
