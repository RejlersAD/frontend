import PropTypes from "prop-types";
import { SalesEmailSourceEvidence } from "./SalesEmailAnalysis";

const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const levels = { high: "High", medium: "Medium", low: "Low", unresolved: "Unresolved" };
const entityLabels = { organization: "Organization", contact: "Contact name", person: "Contact name", email: "Contact email", domain: "Domain", project: "Project" };
const fieldLabels = {
  title: "Title", customer_name: "Customer name", customer_domain: "Customer domain", organization_name: "Organization",
  company_name: "Organization", contact_name: "Contact name", contact_email: "Contact email", project_name: "Project",
  request_type_code: "Request type", request_type: "Request type", submission_date: "Original email sent date",
  due_date: "Proposal deadline", deadline_date: "Proposal deadline", estimated_value: "Estimated value", currency: "Currency",
};
const supportedKey = (labels, key) => typeof key === "string" && Object.hasOwn(labels, key);
const sourceReferences = (information, ids, required = false) => {
  if (!Array.isArray(ids) || (required && !ids.length)) return false;
  const sources = Array.isArray(information?.analysis?.sources) ? information.analysis.sources : [];
  return ids.every((id) => text(id) && sources.filter((source) => source?.id === id).length === 1 &&
    sources.some((source) => source?.id === id && ["message", "quoted"].includes(source.origin)));
};
const intelligence = (information) => information?.detection_version === 2 && object(information.intelligence) && information.intelligence.version === 1
  ? information.intelligence : null;
const review = (information, value, statuses, evidencedStatuses) => object(value) && statuses.includes(value.status) && typeof value.reason === "string" &&
  sourceReferences(information, value.source_ids, evidencedStatuses.includes(value.status)) ? value : null;

export function intelligenceField(information, key) {
  return review(information, intelligence(information)?.[key], ["detected", "requires_verification", "not_detected", "conflicting"], ["detected"]);
}

function ReviewEvidence({ value, sources }) {
  return <>
    {text(value.reason) && <p className="mt-1 whitespace-pre-wrap leading-5 [overflow-wrap:anywhere]">{value.reason}</p>}
    <SalesEmailSourceEvidence sourceIds={value.source_ids} sources={sources} />
  </>;
}

export default function SalesEmailIntelligence({ information }) {
  if (information?.detection_version !== 2) return null;
  const supplied = intelligence(information);
  if (!supplied) return <section aria-label="Detection review" className="mt-3 text-xs text-slate-600">Detection review is unavailable.</section>;
  const sources = information.analysis?.sources;
  const entities = Array.isArray(supplied.entities) ? supplied.entities.filter((entity) => object(entity) && entity.entity_type !== "domain" && supportedKey(entityLabels, entity.entity_type) &&
    text(entity.value) && text(entity.evidence) && sourceReferences(information, entity.source_ids, true)) : [];
  const deadline = review(information, supplied.deadline_review, ["detected", "not_detected", "requires_verification", "ambiguous"], ["detected"]);
  const opportunity = review(information, supplied.opportunity_detection, ["candidate", "follow_up", "not_established", "ambiguous"], ["candidate", "follow_up"]);
  const confirmedOpportunity = opportunity?.needs_review === true ? opportunity : null;
  const confidence = object(supplied.field_confidence) ? Object.entries(supplied.field_confidence).filter(([field, value]) =>
    supportedKey(fieldLabels, field) && object(value) && supportedKey(levels, value.level) && text(value.reason) &&
    sourceReferences(information, value.source_ids, value.level !== "unresolved")) : [];
  const deadlineLabels = { detected: "Detected deadline — review before use", not_detected: "Not detected", requires_verification: "Human verification required", ambiguous: "Conflicting or ambiguous deadlines" };
  const opportunityLabels = { candidate: "Potential opportunity — review required", follow_up: "Follow-up to an existing request", not_established: "Opportunity not established", ambiguous: "Requires review" };
  return <section aria-label="Detection review" className="mt-3 min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="min-w-0"><h3 className="font-semibold">Deadline review</h3><p className="mt-1 font-medium text-slate-800">{deadline ? deadlineLabels[deadline.status] : "Unavailable"}</p>
        {deadline && <ReviewEvidence value={deadline} sources={sources} />}
      </div>
      <div className="min-w-0"><h3 className="font-semibold">Opportunity suggestion</h3><p className="mt-1 font-medium text-slate-800">{confirmedOpportunity ? opportunityLabels[confirmedOpportunity.status] : "Unavailable"}</p>
        {confirmedOpportunity && <ReviewEvidence value={confirmedOpportunity} sources={sources} />}
      </div>
    </div>
    <details className="mt-3 min-w-0">
      <summary className="w-fit cursor-pointer rounded py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Detected entities</summary>
      {entities.length ? <dl className="mt-2 space-y-3">{entities.map((entity, index) => <div key={index} className="min-w-0 [overflow-wrap:anywhere]">
        <dt className="font-semibold">{entityLabels[entity.entity_type]}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">{entity.value}</dd>
        <dd><blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-slate-300 pl-2 leading-5">{entity.evidence}</blockquote><SalesEmailSourceEvidence sourceIds={entity.source_ids} sources={sources} /></dd>
      </div>)}</dl> : <p className="mt-2">No sourced entities are available.</p>}
    </details>
    <details className="mt-1 min-w-0">
      <summary className="w-fit cursor-pointer rounded py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Field confidence</summary>
      <p className="mt-2 leading-5">Confidence describes the available rule evidence. Review the source before using a value.</p>
      {confidence.length ? <dl className="mt-2 space-y-3">{confidence.map(([field, value]) => <div key={field} className="min-w-0 [overflow-wrap:anywhere]">
        <dt className="font-semibold">{fieldLabels[field]}: {levels[value.level]}</dt><dd><ReviewEvidence value={value} sources={sources} /></dd>
      </div>)}</dl> : <p className="mt-2">Field confidence is unavailable.</p>}
    </details>
  </section>;
}

ReviewEvidence.propTypes = { value: PropTypes.object.isRequired, sources: PropTypes.array };
SalesEmailIntelligence.propTypes = { information: PropTypes.object };
SalesEmailIntelligence.defaultProps = { information: null };
