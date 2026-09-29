import PropTypes from "prop-types";
import { SalesEmailSourceEvidence } from "./SalesEmailAnalysis";

const text = (value) => typeof value === "string" ? value.trim() : "";
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const statuses = {
  matched: "Suggested client", ambiguous: "Multiple matching clients — choose after review",
  no_match: "No matching client available to you", not_detected: "Customer name not detected",
  conflicting: "Conflicting customer names — review the source", unavailable: "Customer matching unavailable",
  denied: "You do not have access to customer matching",
};

export const withoutCustomerMatch = (information) => ({
  ...information,
  customer_match: { version: 1, status: "denied", method: "exact_name_v1", detected_name: "", needs_review: true, evidence: { excerpt: "", source_ids: [] }, candidates: [], has_more: false },
});

export function customerMatch(information) {
  const match = information?.customer_match;
  if (!object(match) || match.version !== 1 || match.method !== "exact_name_v1" || match.needs_review !== true ||
      typeof match.status !== "string" || !Object.hasOwn(statuses, match.status) || typeof match.detected_name !== "string" || typeof match.has_more !== "boolean" ||
      !Array.isArray(match.candidates) || match.candidates.length > 20 || !object(match.evidence) ||
      typeof match.evidence.excerpt !== "string" || !Array.isArray(match.evidence.source_ids) ||
      match.evidence.source_ids.some((id) => !text(id))) return null;
  const hasCandidates = ["matched", "ambiguous"].includes(match.status);
  if (!hasCandidates && (match.candidates.length || match.has_more)) return null;
  if (match.status === "matched" && (match.candidates.length !== 1 || match.has_more)) return null;
  if (match.status === "ambiguous" && match.candidates.length < 2) return null;
  if (match.has_more && match.candidates.length !== 20) return null;
  const ids = new Set();
  for (const candidate of match.candidates) {
    if (!object(candidate) || !text(candidate.id) || !text(candidate.company_name) || ids.has(candidate.id) ||
        typeof candidate.client_code !== "string" || !Array.isArray(candidate.matched_fields) || !candidate.matched_fields.length ||
        candidate.matched_fields.some((field) => !["company_name", "legal_name", "trading_name"].includes(field)) ||
        !["active", "inactive", "prospect", "former"].includes(candidate.status) ||
        !["unverified", "verified", "review_due", "restricted"].includes(candidate.verification_status) ||
        typeof candidate.new_proposals_permitted !== "boolean") return null;
    ids.add(candidate.id);
  }
  if (hasCandidates || match.status === "no_match") {
    if (information?.detection_version === 2 && (!text(information.organization_name || information.company_name) ||
        text(match.detected_name) !== text(information.organization_name || information.company_name))) return null;
    const sources = Array.isArray(information?.analysis?.sources) ? information.analysis.sources : [];
    if (!text(match.detected_name) || !text(match.evidence.excerpt) || !match.evidence.source_ids.length ||
        !match.evidence.source_ids.every((id) => sources.some((source) => source?.id === id && ["message", "quoted"].includes(source.origin)))) return null;
  }
  return match;
}

export default function SalesEmailCustomerMatch({ information, clients, onUseClient, disabled, clientChoice }) {
  const match = customerMatch(information);
  if (!match || ["unavailable", "denied"].includes(match.status)) return <section aria-label="Customer matching" className="mt-3 text-xs font-normal text-slate-600"><p>{match ? statuses[match.status] : statuses.unavailable}</p></section>;
  const evidence = text(match.evidence.excerpt);
  return <section aria-label="Customer matching" className="mt-3 min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal">
    <p className="text-xs font-semibold text-slate-600">Customer matching</p>
    <p className="mt-1 text-sm font-medium text-slate-800">{statuses[match.status]}</p>
    {match.candidates.length > 0 && <>
      <p className="mt-1 text-xs leading-5 text-slate-600">Exact name match. Review the source and client record before choosing.</p>
      <ul className="mt-2 space-y-3">{match.candidates.map((candidate) => {
        const available = clients.some((client) => client.id === candidate.id);
        return <li key={candidate.id} className="min-w-0 [overflow-wrap:anywhere]">
          <p className="text-sm font-semibold text-slate-800">{candidate.company_name}</p>
          {text(candidate.client_code) && <p className="mt-0.5 text-xs text-slate-600">Client code: {candidate.client_code}</p>}
          <p className="mt-0.5 text-xs leading-5 text-slate-600">Matched on {candidate.matched_fields.map((field) => ({ company_name: "company name", legal_name: "legal name", trading_name: "trading name" })[field]).join(", ")}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">Status: {text(candidate.status).replaceAll("_", " ") || "Unavailable"} · Verification: {text(candidate.verification_status).replaceAll("_", " ") || "Unavailable"}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">New proposals: {candidate.new_proposals_permitted ? "Permitted" : "Restricted"}</p>
          {onUseClient && <button type="button" disabled={disabled || !available} onClick={() => { if (!disabled && available) onUseClient(candidate.id); }} aria-label={`Use this client: ${candidate.company_name}${candidate.client_code ? ` (${candidate.client_code})` : ""}`} className="sales-email-button mt-2">{clientChoice === candidate.id ? "Client selected" : "Use this client"}</button>}
          {onUseClient && !disabled && !available && <p className="mt-1 text-xs text-slate-600">This client is not available in your current client options.</p>}
        </li>;
      })}</ul>
    </>}
    {match.has_more && <p className="mt-2 text-xs leading-5 text-slate-600">More matching clients are available. Use the full Client list to review your choice.</p>}
    {(evidence || match.evidence.source_ids.length > 0) && <details className="mt-2 min-w-0 text-xs text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Customer matching evidence</summary>
      {evidence && <blockquote className="mt-2 whitespace-pre-wrap leading-5 [overflow-wrap:anywhere]">{match.evidence.excerpt}</blockquote>}
      <SalesEmailSourceEvidence sourceIds={match.evidence.source_ids} sources={information?.analysis?.sources} />
    </details>}
  </section>;
}

SalesEmailCustomerMatch.propTypes = { information: PropTypes.object, clients: PropTypes.array, onUseClient: PropTypes.func, disabled: PropTypes.bool, clientChoice: PropTypes.string };
SalesEmailCustomerMatch.defaultProps = { information: null, clients: [], onUseClient: null, disabled: false, clientChoice: "" };
