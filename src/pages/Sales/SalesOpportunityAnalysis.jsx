import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  ArrowRight,
  Check,
  HelpCircle,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
} from "lucide-react";
import salesService from "../../services/sales.service";
import { validateAnalysis } from "./salesOpportunityAnalysis";
import { buildAnalysisContent } from "./salesAnalysisContent";
import { assessmentCitations } from "./salesAnalysisCitations";
import { noGoBrief } from "./salesDecisionBrief";
import SalesOpportunityFilePreview from "./SalesOpportunityFilePreview";
import "./SalesOpportunityAnalysis.css";

const TABS = [
  "Assessment",
  "Opportunity Summary",
  "Clarifications",
  "Correspondence",
];
const asList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
const values = (rows) =>
  asList(rows)
    .map((row) => (typeof row === "string" ? row : row?.value || row?.finding))
    .filter(Boolean);
const isMissing = (value) =>
  !value ||
  /^(unknown|not provided|not available|further client clarification required)$/i.test(
    String(value).trim(),
  );
const decisionLabel = (value) =>
  ({
    go: "GO",
    bid: "GO",
    no_go: "NO-GO",
    no_bid: "NO-GO",
    conditional_go: "CONDITIONAL GO",
    conditional_bid: "CONDITIONAL GO",
    insufficient_evidence: "INSUFFICIENT EVIDENCE",
  })[String(value || "").toLowerCase()] || "INSUFFICIENT EVIDENCE";

function scopeSummary(facts, summary) {
  const text = [...values(facts.scope), ...values(facts.technologies)]
    .join(" ")
    .toLowerCase();
  const areas = [];
  if (/\b(?:erp|sap|s\/4hana|oneerp)\b/.test(text))
    areas.push("ERP transformation");
  if (/\b(?:gbs|global business services|operating model)\b/.test(text))
    areas.push("GBS operating model design");
  if (/\binfrastructure\b/.test(text)) areas.push("infrastructure design");
  if (/\bcyber(?:security| security)\b/.test(text)) areas.push("cybersecurity");
  if (areas.length)
    return (
      "The opportunity centers on " +
      areas.join(", ") +
      " across the client's operations."
    );
  if (!isMissing(summary.project_type))
    return "The opportunity covers " + summary.project_type + " services.";
  return "Review the tender scope with the client and bid team.";
}

export default function SalesOpportunityAnalysis({ record, onAction }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [dark, setDark] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [letters, setLetters] = useState([]);
  const [letterMessage, setLetterMessage] = useState("");
  const [previewSource, setPreviewSource] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const load = async () => {
      try {
        let response = validateAnalysis(
          await salesService.getOpportunityAnalysis(record.id),
          record.id,
        );
        if (response.status === "not_started" || response.stale) {
          response = validateAnalysis(
            await salesService.startOpportunityAnalysis(record.id, false),
            record.id,
          );
        }
        if (cancelled) return;
        setData(response);
        timer = setTimeout(
          load,
          ["queued", "running"].includes(response.status) ? 8000 : 30000,
        );
      } catch {
        if (!cancelled) timer = setTimeout(load, 30000);
      }
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [record.id, refreshKey]);

  const evaluation = data?.result?.manager_review?.tender_evaluation || {};
  const hasEvaluation = Object.keys(evaluation).length > 0;
  const summary = evaluation.opportunity_summary || {};
  const facts = summary.project_facts || {};
  const sourceDocuments = evaluation.source_documents || {};
  const content = buildAnalysisContent(record, evaluation);
  const officialDecision =
    { bid: "GO", conditional_bid: "CONDITIONAL GO", no_bid: "NO-GO" }[
      record.bid_decision
    ] || "";
  const recommendation = officialDecision || (hasEvaluation
    ? decisionLabel(evaluation.decision?.recommendation)
    : "INSUFFICIENT EVIDENCE");
  const client = isMissing(summary.client_name)
    ? record.client_name
    : summary.client_name;
  const opportunity = isMissing(summary.project_name)
    ? record.deal_name
    : summary.project_name;
  const nextSteps =
    recommendation === "NO-GO"
      ? [
          "Approve the regret response",
          "Close the pursuit in the opportunity register",
        ]
      : [
          "Validate capability and qualification evidence",
          "Confirm named resources and commercial guardrails",
          officialDecision
            ? "Prepare the EOI response"
            : "Record the governed bid decision",
        ];
  const scope = scopeSummary(facts, summary);
  const narrative = !hasEvaluation
    ? "Review the tender and internal bid position before committing. Confirm the key scope and commercial requirements before recording a decision."
    : recommendation === "NO-GO"
      ? scope + " The recorded decision is to decline the pursuit."
      : recommendation === "INSUFFICIENT EVIDENCE"
        ? scope + " Rejlers' capability, qualification compliance, named resources, commercial position and win probability require approved internal evidence before a bid recommendation."
      : scope +
        (recommendation === "GO"
          ? " Proceed with the bid."
          : " Pursue the opportunity after specialist capacity, resource availability, and commercial acceptance are confirmed.");

  useEffect(() => {
    if (tab !== "Correspondence" || !officialDecision) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await salesService.getLetters(record.id);
        if (!cancelled)
          setLetters(
            Array.isArray(response) ? response : asList(response?.results),
          );
      } catch {
        if (!cancelled) setLetters([]);
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tab, officialDecision, record.id, refreshKey]);
  const letterType = officialDecision === "NO-GO" ? "regret" : "eoi";
  const savedLetter = [...letters]
    .filter(
      (letter) =>
        letter.status !== "archived" &&
        (letterType === "regret"
          ? String(letter.letter_type || "").startsWith("regret")
          : letter.letter_type === "eoi"),
    )
    .sort((left, right) =>
      String(right.created_at || "").localeCompare(
        String(left.created_at || ""),
      ),
    )[0];

  const openDecision = () => {
    if (record.stage === "qualified") onAction?.("bid_decision");
    else if (record.stage === "lead") onAction?.("qualify");
  };

  const refreshAnalysis = async () => {
    try {
      await salesService.startOpportunityAnalysis(record.id, true);
    } catch {
      // Analysis may already be running; the polling effect will pick up the status.
    }
    setRefreshKey((value) => value + 1);
  };
  const openLetter = () => {
    if (record.bid_decision === "no_bid") setTab("Correspondence");
    else if (["bid", "conditional_bid"].includes(record.bid_decision))
      onAction?.("prepare_letter_eoi");
    else openDecision();
  };
  const copyLetter = async () => {
    if (!savedLetter?.body || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(
        [savedLetter.subject, savedLetter.body].filter(Boolean).join("\n\n"),
      );
      setLetterMessage("Letter copied.");
    } catch {
      setLetterMessage("Copy could not be completed.");
    }
  };
  const downloadLetter = async () => {
    if (!savedLetter?.id) return;
    try {
      const { blob, filename } = await salesService.downloadLetterPdf(
        record.id,
        savedLetter.id,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filename ||
        (record.deal_code || "opportunity") + "-" + letterType + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLetterMessage("Letter downloaded.");
    } catch {
      setLetterMessage("Download could not be completed.");
    }
  };

  const actionLabel =
    officialDecision === "NO-GO"
      ? "Prepare regret"
      : officialDecision
        ? "Prepare EOI"
        : record.stage === "lead"
          ? "Continue qualification"
          : "Record decision";
  const matchingRationale =
    hasEvaluation &&
    decisionLabel(evaluation.decision?.recommendation) === officialDecision
      ? evaluation.decision?.decision_rationale
      : "";
  const decisionJustification =
    record.bid_decision_reason ||
    matchingRationale ||
    (officialDecision === "NO-GO"
      ? "The recorded No-Go decision requires a reason that matches the selected regret template."
      : officialDecision === "CONDITIONAL GO"
        ? "Specialist capacity and commercial terms remain conditions of the recorded pursuit decision."
        : officialDecision === "GO"
          ? "The opportunity has a recorded Go decision."
          : "The advisory assessment supports an internal Go / No-Go decision before client correspondence.");
  const noGoRecommendation =
    officialDecision === "NO-GO"
      ? noGoBrief(record.bid_decision_reason, scope)
      : null;
  const correspondenceDescription =
    officialDecision === "GO"
      ? "Prepare an Expression of Interest using the approved Rejlers template."
      : officialDecision === "CONDITIONAL GO"
        ? "Prepare an Expression of Interest after the pursuit conditions are reviewed."
        : officialDecision === "NO-GO"
          ? "Prepare a regret response using the approved reason-specific template."
          : "Record the Go / No-Go decision before preparing client correspondence.";

  const tenderBasis = (keys) => {
    const citations = assessmentCitations(facts, sourceDocuments, keys);
    if (!citations.length) return null;
    return (
      <div className="soa-ref-citations">
        <span>Sources</span>
        {citations.map((citation, index) => {
          const canOpen =
            citation.page &&
            citation.fileId &&
            citation.folder &&
            /\.pdf$/i.test(citation.name) &&
            ["radai", "sharepoint"].includes(citation.provider);
          const sourceLabel = `${citation.name} · ${citation.location}`;
          const label = citation.page
            ? `Page ${citation.page}`
            : citation.location;
          return canOpen ? (
            <button
              type="button"
              key={`${sourceLabel}:${index}`}
              title={`Open ${sourceLabel}`}
              aria-label={`Open ${sourceLabel}`}
              onClick={() => setPreviewSource(citation)}
            >
              {label}
            </button>
          ) : (
            <span
              className="soa-ref-citation-text"
              key={`${sourceLabel}:${index}`}
              title={sourceLabel}
            >
              <span aria-hidden="true">{label}</span>
              <span className="sr-only">{sourceLabel}</span>
            </span>
          );
        })}
      </div>
    );
  };
  const sectionSources = {
    "Scope vs. Capabilities": [
      "scope",
      "technologies",
      "disciplines",
      "deliverables",
    ],
    "Strategic Fit": ["client", "project_name", "locations"],
    "Resource Requirements": ["disciplines", "locations", "timeline"],
    "Execution & Schedule Risk": ["key_risks", "timeline", "technologies"],
  };

  return (
    <section
      className={"soa soa-Radai soa-reference" + (dark ? " soa-dark" : "")}
      aria-label="Management opportunity briefing"
    >
      <header className="soa-ref-header">
        <span className="soa-ref-mark" aria-hidden="true">
          <Sparkles size={19} />
        </span>
        <div className="soa-ref-heading">
          <h2>Opportunity Analysis</h2>
          <p>
            {client || "Opportunity review"} ·{" "}
            {opportunity || "New opportunity"}
          </p>
        </div>
        <div className="soa-ref-tools">
          <button
            type="button"
            aria-label="Refresh briefing"
            onClick={refreshAnalysis}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>
      <nav className="soa-ref-tabs" aria-label="Management briefing">
        {TABS.map((item) => (
          <button
            type="button"
            key={item}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {data && ["queued", "running"].includes(data.status) && (
        <section className="soa-ref-progress">
          <div className="soa-progress-header">
            <span className="soa-progress-label">
              {data.status === "queued" ? "Analysis queued" : "Analyzing documents"}
            </span>
            <span className="soa-progress-pct">
              {data.counts?.total
                ? `${Math.round(
                    (data.counts.ready / data.counts.total) * 100,
                  )}%`
                : "0%"}
            </span>
          </div>
          <div className="soa-progress-track">
            <div
              className="soa-progress-fill"
              style={{
                width: data.counts?.total
                  ? `${Math.round((data.counts.ready / data.counts.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <p className="soa-progress-detail">
            {data.counts?.total
              ? `${data.counts.ready} of ${data.counts.total}${
                  data.counts.partial
                    ? ` · ${data.counts.partial} partial`
                    : ""
                } sources processed`
              : "Waiting for analysis to begin…"}
          </p>
          <button
            type="button"
            className="soa-progress-refresh"
            aria-label="Refresh analysis status"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            <RefreshCw size={14} className="soa-spin" />
          </button>
        </section>
      )}
      {tab === "Assessment" && (
        <div className="soa-ref-assessment">
          <section
            className={
              "soa-ref-recommendation soa-ref-" +
              recommendation.toLowerCase().replaceAll(" ", "_")
            }
            aria-labelledby="soa-recommendation"
          >
            <p>{officialDecision ? "Recorded bid decision" : "Executive recommendation"}</p>
            <h3 id="soa-recommendation">{recommendation}</h3>
            <div>{narrative}{data?.source_gaps?.length > 0 && (
              <> Source review is incomplete: {data.source_gaps.map((gap) =>
                `${gap.name} (${String(gap.reason || gap.status || "incomplete").replaceAll("_", " ")})`).join("; ")}.</>
            )}</div>
            {tenderBasis([
              "scope",
              "technologies",
              "deliverables",
              "key_risks",
              "timeline",
            ])}
          </section>
          <div className="soa-ref-driver-grid">
            <section className="soa-ref-driver-card soa-ref-positive">
              <h4>Decision Drivers ? Tender Evidence</h4>
              <ul>{content.drivers.map((item) => <li key={item}><Check size={13} aria-hidden="true" /><span>{item}</span></li>)}</ul>
            </section>
            <section className="soa-ref-driver-card soa-ref-concerns">
              <h4>Key Concerns</h4>
              <ul>{content.concerns.map((item) => <li key={item}><HelpCircle size={13} aria-hidden="true" /><span>{item}</span></li>)}</ul>
            </section>
          </div>
          <section className="soa-ref-next">
            <h4>Next Action</h4>
            <ol>
              {nextSteps.map((step) => (
                <li key={step}>
                  <span className="soa-ref-step-icon">
                    <ArrowRight size={13} aria-hidden="true" />
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={officialDecision ? openLetter : openDecision}
              disabled={
                !officialDecision &&
                !["lead", "qualified"].includes(record.stage)
              }
            >
              {actionLabel}
            </button>
          </section>
          <section className="soa-ref-content soa-ref-detail">
            <h3>Comprehensive Assessment</h3>
            {content.detailedSections.map((section) => (
              <div key={section.title}>
                <h4>{section.title}</h4>
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                {tenderBasis(sectionSources[section.title] || [])}
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "Opportunity Summary" && (
        <section className="soa-ref-content">
          <p className="soa-ref-kicker">Project information</p>
          <h3>Opportunity Summary</h3>
          <div className="soa-summary-table-wrap">
            <table className="soa-summary-table">
              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {content.summaryRows.map(([property, detail]) => (
                  <tr key={property}>
                    <th scope="row">{property}</th>
                    <td>{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "Clarifications" && (
        <section className="soa-ref-content">
          <p className="soa-ref-kicker">Before bid submission</p>
          <h3>Critical Clarifications</h3>
          {content.clarificationRows.length ? (
            <ol className="soa-ref-questions">
              {content.clarificationRows.map((item) => (
                <li key={item.title + item.request}>
                  <strong>{item.title}:</strong>
                  <div>
                    <em>Clarification Request:</em> {item.request}
                  </div>
                  {item.evidence?.map((source, index) => (
                    <small key={`${source.source_file}:${source.source_page}:${index}`}>
                      {source.source_file} · {source.source_page}: {source.source_text || source.excerpt}
                    </small>
                  ))}
                </li>
              ))}
            </ol>
          ) : (
            <p>No material client clarification is currently identified.</p>
          )}
        </section>
      )}
      {tab === "Correspondence" && (
        <section className="soa-ref-content soa-correspondence">
          <p className="soa-ref-kicker">
            {noGoRecommendation
              ? "Final recommendation"
              : "Decision correspondence"}
          </p>
          <h3>{officialDecision || "Decision required"}</h3>
          {noGoRecommendation ? (
            <div className="soa-no-go-brief">
              <p>{noGoRecommendation.rationale}</p>
              {noGoRecommendation.tenderContext && (
                <p>{noGoRecommendation.tenderContext}</p>
              )}
              <p>
                <strong>Recommendation:</strong> {noGoRecommendation.nextAction}
              </p>
            </div>
          ) : (
            <>
              <p className="soa-correspondence-description">
                {correspondenceDescription}
              </p>
              <div className="soa-correspondence-justification">
                <span>Justification</span>
                <p>{decisionJustification}</p>
              </div>
            </>
          )}
          <div className="soa-ref-letter-actions">
            {["bid", "conditional_bid"].includes(record.bid_decision) && (
              <button
                type="button"
                onClick={() => onAction?.("prepare_letter_eoi")}
              >
                Prepare EOI
              </button>
            )}
            {record.bid_decision === "no_bid" && (
              <>
                <button
                  type="button"
                  onClick={() => onAction?.("prepare_letter_regret_expertise")}
                >
                  Regret · Expertise
                </button>
                <button
                  type="button"
                  onClick={() => onAction?.("prepare_letter_regret_manpower")}
                >
                  Regret · Resources
                </button>
              </>
            )}
            {!officialDecision && (
              <button type="button" onClick={openDecision}>
                {record.stage === "lead"
                  ? "Continue qualification"
                  : "Record decision"}
              </button>
            )}
            {savedLetter && (
              <button
                type="button"
                onClick={() =>
                  onAction?.("prepare_letter_" + savedLetter.letter_type)
                }
              >
                Preview saved letter
              </button>
            )}
            {savedLetter && (
              <button type="button" onClick={copyLetter}>
                Copy letter
              </button>
            )}
            {savedLetter && (
              <button type="button" onClick={downloadLetter}>
                Download letter
              </button>
            )}
          </div>
          {letterMessage && <p role="status">{letterMessage}</p>}
        </section>
      )}
      {previewSource && (
        <SalesOpportunityFilePreview
          key={`${record.id}:${previewSource.fileId}:${previewSource.page}`}
          recordId={String(record.id)}
          folderKey={previewSource.folder}
          storage={previewSource.provider}
          file={{ id: previewSource.fileId, name: previewSource.name }}
          initialPage={previewSource.page}
          onClose={() => setPreviewSource(null)}
        />
      )}
    </section>
  );
}

SalesOpportunityAnalysis.propTypes = {
  record: PropTypes.object.isRequired,
  onAction: PropTypes.func,
};
