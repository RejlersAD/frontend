import PropTypes from "prop-types";
import { emailActionDeadline, emailContextReference } from "./salesEmailReviewState";
import { SalesEmailSourceEvidence } from "./SalesEmailAnalysis";
import SalesEmailCustomerMatch from "./SalesEmailCustomerMatch";
import SalesEmailIntelligence, { intelligenceField } from "./SalesEmailIntelligence";

const valueText = (value) => typeof value === "string" ? value.trim() : "";
const objectValue = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const classificationLabels = {
  tender_opportunity: "Tender Opportunity", rfp: "RFP", rfq: "RFQ", rft: "RFT", eoi: "EOI", itt: "ITT",
  proposal_request: "Proposal Request", clarification: "Clarification", tender_bulletin: "Tender Bulletin",
  tender_addendum: "Tender Addendum", award_notification: "Award Notification", regret_notification: "Regret Notification",
  contract_award: "Contract Award", framework_agreement: "Framework Agreement", purchase_order: "Purchase Order",
  variation_request: "Variation Request", vendor_request: "Vendor Request", invoice_related: "Invoice Related",
  general_communication: "General Communication",
};
const confidenceLabels = { high: "High", medium: "Medium", low: "Low", unresolved: "Unresolved" };
const knownClassification = (value) => typeof value === "string" && Object.hasOwn(classificationLabels, value);

function ClassificationQuotes({ evidence, sources }) {
  const quotes = Array.isArray(evidence) ? evidence.filter((entry) => objectValue(entry) &&
    valueText(entry.source_id) && ["subject", "body"].includes(entry.location) && valueText(entry.excerpt)) : [];
  const sourceList = Array.isArray(sources) ? sources.filter((source) => objectValue(source) &&
    valueText(source.id) && ["message", "quoted"].includes(source.origin)) : [];
  if (!quotes.length) return <p className="mt-2">No supporting quote is available.</p>;
  return <div className="mt-2 space-y-3">{quotes.map((quote, index) => {
    const source = sourceList.find((entry) => entry.id === quote.source_id);
    return <figure key={index} className="min-w-0 border-l-2 border-slate-300 pl-3 [overflow-wrap:anywhere]">
      <figcaption className="font-semibold">{source ? valueText(source.label) || "Email source" : "Source details unavailable"} · {quote.location === "subject" ? "Subject" : "Email body"}</figcaption>
      <blockquote className="mt-1 whitespace-pre-wrap leading-5 [overflow-wrap:anywhere]">{quote.excerpt}</blockquote>
    </figure>;
  })}</div>;
}

function SuggestedClassification({ classification, sources }) {
  const supplied = objectValue(classification);
  const supported = supplied?.version === 1 && ["classified", "ambiguous", "unclassified", "draft"].includes(supplied.status) &&
    (supplied.status !== "classified" || knownClassification(supplied.code));
  if (!supported) return <section aria-label="Email classification" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
    <p><span className="font-semibold">Suggested classification: </span>Unavailable</p>
    <p><span className="font-semibold">Confidence: </span>Unavailable</p>
  </section>;
  const confidence = objectValue(supplied.confidence);
  const supportedConfidence = ["rule_evidence_v1", "ai_evidence_v1"].includes(confidence?.method) && typeof confidence.level === "string" && Object.hasOwn(confidenceLabels, confidence.level);
  const label = supplied.status === "classified" ? classificationLabels[supplied.code]
    : supplied.status === "ambiguous" ? "Needs review"
      : supplied.status === "draft" ? "Draft (not classified)" : "Not classified";
  const alternatives = supplied.status === "ambiguous" && Array.isArray(supplied.alternatives)
    ? supplied.alternatives.filter((item) => objectValue(item) && knownClassification(item.code)) : [];
  return <section aria-label="Email classification" className="mt-3 min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
    <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
      <div><p className="text-xs font-semibold text-slate-600">Suggested classification</p><p className="mt-1 text-sm font-medium text-slate-800">{label}</p></div>
      <div><p className="text-xs font-semibold text-slate-600">Confidence</p><p className="mt-1 text-sm font-medium text-slate-800">{supportedConfidence ? confidenceLabels[confidence.level] : "Unavailable"}</p></div>
    </div>
    <p className="mt-2 text-xs text-slate-600">Review required</p>
    <details className="mt-1 min-w-0 text-xs text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Classification evidence</summary>
      {supportedConfidence && valueText(confidence.reason) && <p className="mt-2 whitespace-pre-wrap leading-5 [overflow-wrap:anywhere]">{confidence.reason}</p>}
      <ClassificationQuotes evidence={supplied.evidence} sources={sources} />
      {alternatives.length > 0 && <div className="mt-3 space-y-3"><p className="font-semibold">Possible classifications</p>{alternatives.map((alternative, index) => <div key={index}>
        <p className="font-semibold text-slate-800">{classificationLabels[alternative.code]}</p>
        <ClassificationQuotes evidence={alternative.evidence} sources={sources} />
      </div>)}</div>}
    </details>
  </section>;
}

export default function SalesEmailDetectedInformation({ information, subject }) {
  const detected = information && typeof information === "object" ? information : {};
  const versionTwo = detected.detection_version === 2;
  const customer = versionTwo ? intelligenceField(detected, "customer_name") : null;
  const domain = versionTwo ? intelligenceField(detected, "customer_domain") : null;
  const sentDate = versionTwo ? intelligenceField(detected, "submission_date") : null;
  const requestCode = valueText(detected.request_type_code);
  const agreementReference = emailContextReference(detected, "agreement_reference");
  const correspondenceReference = emailContextReference(detected, "correspondence_reference");
  const actionDeadline = emailActionDeadline(detected);
  const fields = [
    ["title", "Title (Subject)", valueText(detected.title) || subject],
    ["customer_name", "Customer Name", !versionTwo || customer?.status === "detected" ? valueText(detected.customer_name) : ""],
    ["submission_date", "Submission Date", !versionTwo || sentDate?.status === "detected" ? valueText(detected.submission_date) : ""],
    ["due_date", "Due Date", valueText(detected.due_date)],
    ["request_type_code", "Type of Request", ["EOI", "EIO", "RFT", "RFQ", "RFP", "ITT"].includes(requestCode) ? requestCode : ""],
    ...(agreementReference ? [["agreement_reference", "WO agreement reference", agreementReference.value]] : []),
    ...(correspondenceReference ? [["correspondence_reference", "Correspondence reference", `${correspondenceReference.value} · Requires review`]] : []),
    ...(actionDeadline ? [["action_deadline", "Action deadline", actionDeadline.value]] : []),
  ];
  const evidenceFields = versionTwo ? [...fields, ["customer_domain", "Customer domain", domain?.status === "detected" ? valueText(detected.customer_domain) : ""]] : fields;
  const evidence = evidenceFields.map(([key, label, value]) => {
    const status = key === "customer_name" ? customer : key === "customer_domain" ? domain : key === "submission_date" ? sentDate : null;
    return [label, valueText(detected.evidence?.[key]), detected.field_sources?.[key] || status?.source_ids, valueText(status?.reason), key === "customer_domain" ? value : ""];
  }).filter(([, value, sources, reason, domainValue]) => value || reason || domainValue || (Array.isArray(sources) && sources.length));
  if (actionDeadline) evidence.push(...actionDeadline.evidence.map((entry) => ["Agreement return deadline", entry.excerpt, entry.sourceIds, "Agreement/document-return deadline. Verify whether this action remains outstanding.", ""]));
  const warnings = Array.isArray(detected.warnings) ? detected.warnings.filter((value) => typeof value === "string" && value.trim()) : [];
  return <section aria-label="Detected information" className="min-w-0">
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
      {fields.map(([key, label, value]) => <div key={key} className={`min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 ${key === "title" ? "sm:col-span-2" : ""}`}>
        <dt className="text-xs font-semibold text-slate-600">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{value || (versionTwo && ["customer_name", "submission_date"].includes(key) && !(key === "customer_name" ? customer : sentDate) ? "Unavailable" : "Not detected")}</dd>
      </div>)}
    </dl>
    <SuggestedClassification classification={detected.classification} sources={detected.analysis?.sources} />
    <SalesEmailCustomerMatch information={detected} />
    <SalesEmailIntelligence information={detected} />
    {(evidence.length > 0 || warnings.length > 0) && <details className="mt-3 min-w-0 text-xs text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Source evidence</summary>
      {evidence.length > 0 && <dl className="mt-2 space-y-2">
        {evidence.map(([label, value, sourceIds, reason, domainValue], index) => <div key={`${label}-${index}`}><dt className="font-semibold">{label}</dt><dd className="mt-0.5 leading-5 [overflow-wrap:anywhere]">{domainValue && <p className="whitespace-pre-wrap">{domainValue}</p>}{value && <p className="whitespace-pre-wrap">{value}</p>}{reason && <p className="whitespace-pre-wrap">{reason}</p>}<SalesEmailSourceEvidence sourceIds={Array.isArray(sourceIds) ? sourceIds : null} sources={Array.isArray(detected.analysis?.sources) ? detected.analysis.sources : null} /></dd></div>)}
      </dl>}
      {warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 leading-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    </details>}
  </section>;
}

SalesEmailDetectedInformation.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
};
SalesEmailDetectedInformation.defaultProps = { information: null, subject: "" };
ClassificationQuotes.propTypes = { evidence: PropTypes.any, sources: PropTypes.any };
SuggestedClassification.propTypes = { classification: PropTypes.any, sources: PropTypes.any };
