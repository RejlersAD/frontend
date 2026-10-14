import { useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, Plus, Sparkles } from "lucide-react";
import SalesEmailAnalysis from "./SalesEmailAnalysis";
import SalesEmailContextSummary from "./SalesEmailContextSummary";
import "./SalesEmailInsights.css";
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
  receivedAt = "",
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
  assistant = null,
  activeTab,
  onTabChange,
}) {
  const selectId = useId();
  const tabRefs = useRef({});
  const [localTab, setLocalTab] = useState("summary");
  const [collapsed, setCollapsed] = useState(false);
  const tabs = [
    { key: "summary", label: "Summary" },
    { key: "evidence", label: "Evidence" },
    ...(assistant ? [{ key: "ask", label: "Ask AI" }] : []),
  ];
  const requestedTab = activeTab === undefined ? localTab : activeTab;
  const currentTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : "summary";
  const chooseTab = (key) => {
    setLocalTab(key);
    onTabChange?.(key);
  };
  const navigateTabs = (event, index) => {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[nextIndex].key;
    chooseTab(next);
    tabRefs.current[next]?.focus();
  };
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

  return <section className={`sales-email-review sales-email-insights${collapsed ? " sales-email-insights--collapsed" : ""}`} aria-label="Email review details" ref={nextStepRef} tabIndex={-1}>
    <header className="sales-email-review__header sales-email-insights__header">
      <Sparkles className="sales-email-insights__sparkle" size={26} aria-hidden="true" />
      <div><h3 className="sales-email-context__heading">AI insights</h3><p>Selected email</p></div>
      <button type="button" className="sales-email-insights__collapse" aria-label={collapsed ? "Expand AI insights" : "Collapse AI insights"}
        aria-expanded={!collapsed} aria-controls={`${selectId}-insights-body`} onClick={() => setCollapsed((value) => !value)}>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
    </header>

    <div id={`${selectId}-insights-body`} className="sales-email-insights__body" hidden={collapsed}>
    <div role="tablist" aria-label="AI insights tabs" className="sales-email-insights__tabs">
      {tabs.map((tab, index) => <button type="button" key={tab.key} role="tab" id={`${selectId}-tab-${tab.key}`}
        aria-selected={currentTab === tab.key} aria-controls={`${selectId}-panel-${tab.key}`} tabIndex={currentTab === tab.key ? 0 : -1}
        ref={(node) => { tabRefs.current[tab.key] = node; }} onClick={() => chooseTab(tab.key)} onKeyDown={(event) => navigateTabs(event, index)}>
        {tab.label}
      </button>)}
    </div>

    <div className="sales-email-context__scroll" tabIndex={0} aria-label="Email context and evidence" role="region">
    <div role="tabpanel" className="sales-email-insights__panel sales-email-insights__panel--summary" id={`${selectId}-panel-summary`} aria-labelledby={`${selectId}-tab-summary`} hidden={currentTab !== "summary"}>
    <div className="sales-email-review__classification sales-email-insights__classification">
      <div className="sales-email-insights__classification-field">
      <label className="sales-email-review__label" htmlFor={selectId}>Email type</label>
      <select id={selectId} className="sales-email-review__select" value={selectedCode} onChange={changeClassification} disabled={converted || disabled} aria-describedby={`${selectId}-hint`}>
        <option value="">Select email type</option>
        {Object.entries(EMAIL_CLASSIFICATIONS).map(([code, label]) => <option value={code} key={code}>{label}</option>)}
      </select>
      </div>
      <p id={`${selectId}-hint`} className={`sales-email-review__status sales-email-context__status${confirmed || converted ? " sales-email-review__status--confirmed" : ""}`} role="status">
        {confirmed || converted ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
        {converted ? "Opportunity created" : confirmed ? "Classification confirmed" : selectedSuggestion ? "Suggested · not confirmed" : selectedCode ? "Selected · not confirmed" : "Choose a type to continue"}
      </p>
    </div>

    <SalesEmailContextSummary information={information} senderName={senderName} senderEmail={senderEmail} sentAt={sentAt} receivedAt={receivedAt} converted={converted} classificationCode={confirmed ? selectedCode : ""} />

    <details className="sales-email-review__disclosure">
      <summary><FileText size={19} aria-hidden="true" /><span>Why this classification</span><ChevronRight className="sales-email-insights__disclosure-arrow" size={16} aria-hidden="true" /></summary>
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
      <summary><FileText size={19} aria-hidden="true" /><span>Source evidence</span><ChevronRight className="sales-email-insights__disclosure-arrow" size={16} aria-hidden="true" /></summary>
      <div className="sales-email-review__disclosure-body">
        <SalesEmailAnalysis analysis={information?.analysis} savedContent={savedContent} />
        {subject && <p className="sales-email-review__hint">Selected email: {subject}</p>}
      </div>
    </details>
    {children && <div className="sales-email-review__extras">{children}</div>}
    </div>

    <div role="tabpanel" className="sales-email-insights__panel sales-email-insights__panel--evidence" id={`${selectId}-panel-evidence`} aria-labelledby={`${selectId}-tab-evidence`} hidden={currentTab !== "evidence"}>
      <h4>Source evidence</h4>
      <SalesEmailAnalysis analysis={information?.analysis} savedContent={savedContent} />
      {subject && <p className="sales-email-review__hint">Selected email: {subject}</p>}
    </div>
    {assistant && <div role="tabpanel" className="sales-email-insights__panel sales-email-insights__panel--ask" id={`${selectId}-panel-ask`} aria-labelledby={`${selectId}-tab-ask`} hidden={currentTab !== "ask"}>
      {assistant}
    </div>}
    </div>

    {!converted && <div className="sales-email-review__actions">
      {(canCreateOpportunity || (selectedCode && !opportunityType)) && <p className="sales-email-review__notice" role="status">
        <span>{selectedCode && !opportunityType ? "This email type is not an opportunity." : confirmed ? "Review the opportunity details before creating it." : "Confirm the email type before creating an opportunity."}</span>
      </p>}
      {!confirmed && <button type="button" className="sales-email-review__primary" disabled={disabled || !isKnownClassification(selectedCode)} onClick={() => onConfirmClassification(selectedCode)}>
        Confirm classification
      </button>}
      {canCreateOpportunity && <button type="button" className={confirmed && opportunityType ? "sales-email-review__primary" : "sales-email-review__secondary"} disabled={disabled || !confirmed || !opportunityType} onClick={onCreateOpportunity}>
        <Plus size={18} aria-hidden="true" />Create opportunity
      </button>}
    </div>}
    </div>
  </section>;
}

ClassificationEvidence.propTypes = { evidence: PropTypes.any, sources: PropTypes.any };
SalesEmailReview.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
  senderName: PropTypes.string,
  senderEmail: PropTypes.string,
  sentAt: PropTypes.string,
  receivedAt: PropTypes.string,
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
  assistant: PropTypes.node,
  activeTab: PropTypes.oneOf(["summary", "evidence", "ask"]),
  onTabChange: PropTypes.func,
};
