import { intelligenceField } from "./SalesEmailIntelligence";

export const EMAIL_CLASSIFICATIONS = Object.freeze({
  tender_opportunity: "Tender opportunity",
  rfp: "RFP",
  rfq: "RFQ",
  rft: "RFT",
  eoi: "EOI",
  itt: "ITT",
  proposal_request: "Proposal request",
  clarification: "Clarification",
  tender_bulletin: "Tender bulletin",
  tender_addendum: "Tender addendum",
  award_notification: "Award notification",
  regret_notification: "Regret notification",
  contract_award: "Contract award",
  framework_agreement: "Framework agreement",
  purchase_order: "Purchase order",
  variation_request: "Variation request",
  vendor_request: "Vendor request",
  invoice_related: "Invoice related",
  general_communication: "General communication",
  promotional_event: "Promotional / event",
  system_notification: "System notification",
});

export const reviewText = (value) => typeof value === "string" ? value.trim() : "";
export const reviewObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
export const isKnownClassification = (code) => typeof code === "string" && Object.hasOwn(EMAIL_CLASSIFICATIONS, code);
export const isOpportunityClassification = (code) => isKnownClassification(code) && !["promotional_event", "system_notification"].includes(code);

export function classificationSuggestion(information) {
  const classification = reviewObject(information?.classification);
  if (classification?.version !== 1 || !["classified", "ambiguous", "unclassified", "draft"].includes(classification.status)) return null;
  // The two manual review choices are not categories emitted by the classifier.
  if (classification.status === "classified" && !isOpportunityClassification(classification.code)) return null;
  return classification;
}

function supportedReview(information, field, statuses, evidencedStatuses) {
  const intelligence = reviewObject(information?.intelligence);
  const value = intelligence?.version === 1 ? reviewObject(intelligence[field]) : null;
  if (!value || !statuses.includes(value.status) || typeof value.reason !== "string" || !Array.isArray(value.source_ids)) return null;
  if (evidencedStatuses.includes(value.status) && !value.source_ids.length) return null;
  const sources = Array.isArray(information?.analysis?.sources) ? information.analysis.sources : [];
  return value.source_ids.every((id) => reviewText(id) && sources.filter((source) => source?.id === id).length === 1 &&
    sources.some((source) => source?.id === id && ["message", "quoted"].includes(source.origin))) ? value : null;
}

function calendarDate(value) {
  const text = reviewText(value);
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : "";
}

function evidencedSources(information, ids) {
  if (information?.analysis?.version !== 1 || !Array.isArray(ids) || !ids.length || ids.some((id) => !reviewText(id))) return null;
  const sources = Array.isArray(information?.analysis?.sources) ? information.analysis.sources : [];
  const matches = [...new Set(ids)].map((id) => sources.filter((source) => source?.id === id));
  return matches.every((found) => found.length === 1 && ["message", "quoted"].includes(found[0].origin) &&
    !["outgoing", "draft"].includes(found[0].direction) && found[0].thread_role !== "draft" && found[0].is_draft !== true)
    ? matches.map(([source]) => source) : null;
}

export function emailContextReference(information, key) {
  if (information?.detection_version !== 2 || !["agreement_reference", "correspondence_reference"].includes(key)) return null;
  const value = reviewText(information[key]);
  const evidence = reviewText(information.evidence?.[key]);
  const sourceIds = information.field_sources?.[key];
  if (!value || !evidence || !evidence.toLowerCase().includes(value.toLowerCase()) || !evidencedSources(information, sourceIds)) return null;
  return { value, evidence, sourceIds };
}

export function emailActionDeadline(information) {
  if (information?.detection_version !== 2 || !Array.isArray(information.action_deadlines)) return null;
  const supplied = information.action_deadlines.filter((entry) => reviewObject(entry)?.kind === "agreement_return");
  if (!supplied.length) return null;
  const entries = supplied.map((entry) => {
    const date = calendarDate(entry.date);
    const time = reviewText(entry.time);
    const timezone = reviewText(entry.timezone);
    const evidence = reviewText(entry.evidence);
    const sources = evidencedSources(information, entry.source_ids);
    if (entry.status !== "requires_verification" || !date || !evidence || !sources ||
      (entry.time != null && typeof entry.time !== "string") || (entry.timezone != null && typeof entry.timezone !== "string") ||
      (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) || (timezone && !time)) return null;
    return { date, time, timezone, evidence, sourceIds: [...new Set(entry.source_ids)], quoted: sources.some((source) => source.origin === "quoted") };
  });
  if (entries.some((entry) => !entry)) return { value: "Unavailable", evidence: [] };
  const evidence = entries.map((entry) => ({ excerpt: entry.evidence, sourceIds: entry.sourceIds }));
  const distinct = new Set(entries.map((entry) => JSON.stringify([entry.date, entry.time, entry.timezone.toLowerCase()])));
  if (distinct.size !== 1) return { value: "Requires review", evidence };
  const first = entries[0];
  return {
    value: [first.date, [first.time, first.timezone].filter(Boolean).join(" "), entries.some((entry) => entry.quoted) ? "Quoted" : "", "Requires verification"].filter(Boolean).join(" · "),
    evidence,
  };
}

export function emailReviewFacts(information, converted = false) {
  const detected = reviewObject(information) || {};
  if (detected.detection_version !== 2) return {
    customer: reviewText(detected.customer_name) || "Not identified",
    dueLabel: "Due date",
    dueDate: reviewText(detected.due_date) || "Not found",
    opportunity: converted ? "Created" : "Not established",
  };
  const customer = intelligenceField(detected, "customer_name");
  const deadline = supportedReview(detected, "deadline_review", ["detected", "not_detected", "requires_verification", "ambiguous"], ["detected"]);
  const opportunity = supportedReview(detected, "opportunity_detection", ["candidate", "follow_up", "not_established", "ambiguous"], ["candidate", "follow_up"]);
  const customerLabels = { not_detected: "Not identified", requires_verification: "Requires verification", conflicting: "Requires review" };
  const deadlineLabels = { not_detected: "Not found", requires_verification: "Requires verification", ambiguous: "Requires review" };
  const opportunityLabels = { candidate: "Potential opportunity", follow_up: "Existing request follow-up", not_established: "Not established", ambiguous: "Requires review" };
  const statedDueDate = calendarDate(detected.due_date);
  // A source-backed date can still require portal verification. Preserve both
  // the extracted value and review status; ambiguity must not promote a date.
  const reviewableDueDate = deadline?.status === "requires_verification" && deadline.source_ids.length > 0 && statedDueDate;
  const proposalDueDate = statedDueDate && (deadline?.status === "detected" || reviewableDueDate);
  const actionDeadline = !proposalDueDate ? emailActionDeadline(detected) : null;
  return {
    customer: customer?.status === "detected" ? reviewText(detected.customer_name) || "Unavailable" : customerLabels[customer?.status] || "Unavailable",
    dueLabel: actionDeadline ? "Action deadline" : "Due date",
    dueDate: actionDeadline?.value || (deadline?.status === "detected" ? statedDueDate || "Unavailable" : reviewableDueDate ? `${statedDueDate} · Requires verification` : deadlineLabels[deadline?.status] || "Unavailable"),
    opportunity: converted ? "Created" : opportunity?.needs_review === true ? opportunityLabels[opportunity.status] : "Unavailable",
  };
}
