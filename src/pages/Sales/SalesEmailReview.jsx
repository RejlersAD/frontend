import { useId, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle2, ChevronDown, Circle, FileText, Info, Plus } from "lucide-react";
import SalesEmailAnalysis from "./SalesEmailAnalysis";
import SalesEmailContextSummary from "./SalesEmailContextSummary";
import {
  EMAIL_CLASSIFICATIONS,
  classificationSuggestion,
  isKnownClassification,
  isOpportunityClassification,
  reviewObject,
  reviewText,
} from "./salesEmailReviewState";

const confidenceLabels = { high: "High", medium: "Medium", low: "Low", unresolved: "Unresolved" };

function ClassificationEvidence({ evidence, sources }) {
  const quotes = Array.isArray(evidence) ? evidence.filter((entry) => reviewObject(entry) &&
    reviewText(entry.source_id) && ["subject", "body"].includes(entry.location) && reviewText(entry.excerpt)) : [];
  const sourceList = Array.isArray(sources) ? sources.filter((source) => reviewObject(source) &&
    reviewText(source.id) && ["message", "quoted"].includes(source.origin)) : [];
  if (!quotes.length) return <p>No supporting quote is available.</p>;
  return quotes.map((quote, index) => {
    const matches = sourceList.filter((source) => source.id === quote.source_id);
    const source = matches.length === 1 ? matches[0] : null;
    return <figure className="sales-email-review__quote" key={index}>
      <figcaption>{source ? reviewText(source.label) || "Email source" : "Source details unavailable"} · {quote.location === "subject" ? "Subject" : "Email body"}</figcaption>
      <blockquote>{quote.excerpt}</blockquote>
    </figure>;
  });
}

export default function SalesEmailReview({
  information = null,
  subject = "",
  senderName = "",
  senderEmail = "",
  sentAt = "",
  confirmedClassification = "",
  onConfirmClassification,
  onClassificationChange,
  onCreateOpportunity,
  canCreateOpportunity = false,
  converted = false,
  children = null,
  nextStepRef = null,
  savedContent = false,
  disabled = false,
}) {
  const selectId = useId();
  const suggestion = classificationSuggestion(information);
  const suggestedCode = suggestion?.status === "classified" ? suggestion.code : "";
  const [selectedChoice, setSelectedChoice] = useState(suggestedCode);
  const selectedCode = isKnownClassification(confirmedClassification) ? confirmedClassification : selectedChoice;
  const confirmed = isKnownClassification(selectedCode) && selectedCode === confirmedClassification;
  const opportunityType = isOpportunityClassification(selectedCode);
  const selectedSuggestion = selectedCode && selectedCode === suggestedCode;
  const confidence = reviewObject(suggestion?.confidence);
  const supportedConfidence = ["rule_evidence_v1", "ai_evidence_v1"].includes(confidence?.method) && typeof confidence.level === "string" && Object.hasOwn(confidenceLabels, confidence.level);
  const alternatives = suggestion?.status === "ambiguous" && Array.isArray(suggestion.alternatives)
    ? suggestion.alternatives.filter((entry) => reviewObject(entry) && isOpportunityClassification(entry.code)) : [];

  const changeClassification = (event) => {
    const code = event.target.value;
    setSelectedChoice(code);
    onClassificationChange(code);
  };

  return <section className="sales-email-review" aria-label="Email review details" ref={nextStepRef} tabIndex={-1}>
    <header className="sales-email-review__header">
      <h3 className="sales-email-context__heading"><span className="sales-email-context__icon"><FileText size={20} aria-hidden="true" /></span>Context &amp; evidence</h3>
      <p className={`sales-email-review__status sales-email-context__status${confirmed || converted ? " sales-email-review__status--confirmed" : ""}`} role="status">
        {confirmed || converted ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
        {converted ? "Opportunity created" : confirmed ? "Classification confirmed" : "Review required"}
      </p>
    </header>

    <div className="sales-email-context__scroll" tabIndex={0} aria-label="Email context and evidence" role="region">
    <SalesEmailContextSummary information={information} subject={subject} senderName={senderName} senderEmail={senderEmail} sentAt={sentAt} converted={converted} />

    <details className="sales-email-review__classification sales-email-context__classification" open>
      <summary className="sales-email-context__classification-heading"><ChevronDown size={18} aria-hidden="true" />Classification review</summary>
      <label className="sales-email-review__label" htmlFor={selectId}>{selectedSuggestion && !confirmed ? "Suggested type" : "Email type"}</label>
      <select id={selectId} className="sales-email-review__select" value={selectedCode} onChange={changeClassification} disabled={converted || disabled} aria-describedby={`${selectId}-hint`}>
        <option value="">Select email type</option>
        {Object.entries(EMAIL_CLASSIFICATIONS).map(([code, label]) => <option value={code} key={code}>{label}</option>)}
      </select>
      <p id={`${selectId}-hint`} className="sales-email-review__hint">
        {converted ? confirmed ? "Confirmed for this review" : "Suggested · confirmation not available" : confirmed ? "Confirmed for this review" : selectedSuggestion ? "Suggested · not confirmed" : selectedCode ? "Selected · not confirmed" : "Choose a type to continue"}
      </p>
    </details>

    <details className="sales-email-review__disclosure">
      <summary><ChevronDown size={18} aria-hidden="true" /><span>Why this suggestion</span></summary>
      <div className="sales-email-review__disclosure-body">
        {suggestedCode && <p className="sales-email-review__suggested-type">Suggested: {EMAIL_CLASSIFICATIONS[suggestedCode]}</p>}
        <p>Confidence: {supportedConfidence ? confidenceLabels[confidence.level] : "Unavailable"}</p>
        {supportedConfidence && reviewText(confidence.reason) ? <p>{confidence.reason}</p> : <p>No supported classification explanation is available.</p>}
        <ClassificationEvidence evidence={suggestion?.evidence} sources={information?.analysis?.sources} />
        {alternatives.length > 0 && <div className="sales-email-review__alternatives"><h4>Possible classifications</h4>{alternatives.map((alternative, index) => <div key={index}>
          <p>{EMAIL_CLASSIFICATIONS[alternative.code]}</p>
          <ClassificationEvidence evidence={alternative.evidence} sources={information?.analysis?.sources} />
        </div>)}</div>}
      </div>
    </details>

    <details className="sales-email-review__disclosure">
      <summary><ChevronDown size={18} aria-hidden="true" /><span>Source evidence</span></summary>
      <div className="sales-email-review__disclosure-body">
        <SalesEmailAnalysis analysis={information?.analysis} savedContent={savedContent} />
        {subject && <p className="sales-email-review__hint">Selected email: {subject}</p>}
      </div>
    </details>
    {children && <div className="sales-email-review__extras">{children}</div>}
    </div>

    {!converted && <div className="sales-email-review__actions">
      {(canCreateOpportunity || (selectedCode && !opportunityType)) && <p className="sales-email-review__notice" role="status">
        <Info size={18} aria-hidden="true" />
        <span>{selectedCode && !opportunityType ? "This email type is not an opportunity." : confirmed ? "Review the opportunity details before creating it." : "Confirm the email type before creating an opportunity."}</span>
      </p>}
      {!confirmed && <button type="button" className="sales-email-review__primary" disabled={disabled || !isKnownClassification(selectedCode)} onClick={() => onConfirmClassification(selectedCode)}>
        Confirm classification
      </button>}
      {canCreateOpportunity && <button type="button" className={confirmed && opportunityType ? "sales-email-review__primary" : "sales-email-review__secondary"} disabled={disabled || !confirmed || !opportunityType} onClick={onCreateOpportunity}>
        <Plus size={18} aria-hidden="true" />Create opportunity
      </button>}
    </div>}
  </section>;
}

ClassificationEvidence.propTypes = { evidence: PropTypes.any, sources: PropTypes.any };
SalesEmailReview.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
  senderName: PropTypes.string,
  senderEmail: PropTypes.string,
  sentAt: PropTypes.string,
  confirmedClassification: PropTypes.string,
  onConfirmClassification: PropTypes.func.isRequired,
  onClassificationChange: PropTypes.func.isRequired,
  onCreateOpportunity: PropTypes.func,
  canCreateOpportunity: PropTypes.bool,
  converted: PropTypes.bool,
  children: PropTypes.node,
  nextStepRef: PropTypes.shape({ current: PropTypes.any }),
  savedContent: PropTypes.bool,
  disabled: PropTypes.bool,
};
