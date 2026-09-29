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

export function emailReviewFacts(information, converted = false) {
  const detected = reviewObject(information) || {};
  if (detected.detection_version !== 2) return {
    customer: reviewText(detected.customer_name) || "Not identified",
    dueDate: reviewText(detected.due_date) || "Not found",
    opportunity: converted ? "Created" : "Not established",
  };
  const customer = intelligenceField(detected, "customer_name");
  const deadline = supportedReview(detected, "deadline_review", ["detected", "not_detected", "requires_verification", "ambiguous"], ["detected"]);
  const opportunity = supportedReview(detected, "opportunity_detection", ["candidate", "follow_up", "not_established", "ambiguous"], ["candidate", "follow_up"]);
  const customerLabels = { not_detected: "Not identified", requires_verification: "Requires verification", conflicting: "Requires review" };
  const deadlineLabels = { not_detected: "Not found", requires_verification: "Requires verification", ambiguous: "Requires review" };
  const opportunityLabels = { candidate: "Potential opportunity", follow_up: "Existing request follow-up", not_established: "Not established", ambiguous: "Requires review" };
  return {
    customer: customer?.status === "detected" ? reviewText(detected.customer_name) || "Unavailable" : customerLabels[customer?.status] || "Unavailable",
    dueDate: deadline?.status === "detected" ? reviewText(detected.due_date) || "Unavailable" : deadlineLabels[deadline?.status] || "Unavailable",
    opportunity: converted ? "Created" : opportunity?.needs_review === true ? opportunityLabels[opportunity.status] : "Unavailable",
  };
}
