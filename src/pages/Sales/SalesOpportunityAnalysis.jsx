import { decisionText } from '../../utils/salesDecisionTerminology.js';
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Moon,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import salesService from "../../services/sales.service";
import {
  analysisDeadline,
  analysisFailureMessage,
  analysisMarkdown,
  analysisSectionMessage,
  analysisSourceError,
  validateAnalysis,
} from "./salesOpportunityAnalysis";
import "./SalesOpportunityAnalysis.css";

const views = [
  "Manager review",
  "Brief",
  "Submissions",
  "Risks",
  "Actions",
  "Timeline",
  "Sources",
];
const reviewDimensions = [
  ["capability_fit", "Scope vs capabilities"],
  ["strategic_fit", "Strategic fit"],
  ["resources", "Resources"],
  ["execution_risk", "Execution risk"],
  ["commercial", "Commercial attractiveness"],
  ["schedule", "Schedule"],
];
const message = (error) =>
  typeof error?.response?.data?.detail === "string"
    ? error.response.data.detail
    : error.message || "Analysis could not be loaded. Please retry.";

export default function SalesOpportunityAnalysis({ record, onAction }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("Manager review");
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);
  const [openSections, setOpenSections] = useState({
    brief: true,
    client_need: true,
    next_step: true,
    submission: true,
    action: true,
    deadline: true,
  });
  const [sources, setSources] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [sourceError, setSourceError] = useState("");
  const [sourcesBusy, setSourcesBusy] = useState(false);
  const [sourcePage, setSourcePage] = useState(0);
  const generation = useRef(0);
  const operation = useRef(null);
  const [reload, setReload] = useState(0);
  const reportId = data?.id;
  const managerReview = data?.result?.manager_review;
  const sourceStale = data?.stale;
  const sourceUpdatedAt = data?.updated_at;

  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const fmtDate = (value) => {
    if (!value) return "Unconfirmed date";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unconfirmed date";
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(date);
  };
  const sectionBlock = (key, title, Icon, deadline = false) => {
    const items = data?.result?.sections?.[key] || [];
    const open = openSections[key] !== false;
    return (
      <section className="cp-insight glass" aria-label={title}>
        <button type="button" className="cp-insight-head" aria-expanded={open} onClick={() => toggleSection(key)}>
          <span className="cp-insight-title">
            <Icon size={16} aria-hidden="true" />
            {title}
          </span>
          <span className="cp-count">{items.length}</span>
          <ChevronDown size={15} aria-hidden="true" className={open ? "cp-flip" : ""} />
        </button>
        {open && (
          items.length ? (
            <ul className="cp-findings">
              {items.map((item, index) => (
                <li key={`${item.source_id || "s"}-${index}`} className="cp-finding">
                  <p className="cp-finding-text">{decisionText(item.text)}</p>
                  {deadline && item.date && (
                    <span className="cp-chip">
                      <CalendarDays size={12} aria-hidden="true" />
                      {fmtDate(item.date)} · {analysisDeadline(item.date)}
                    </span>
                  )}
                  {(item.name || item.location) && (
                    <details className="cp-evidence">
                      <summary>
                        <FileText size={13} aria-hidden="true" />
                        {item.name || "Source"}
                        {item.location ? ` · ${item.location}` : ""}
                      </summary>
                      {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-missing">{analysisSectionMessage(key, data)}</p>
          )
        )}
      </section>
    );
  };

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    let timer;
    operation.current = controller;
    setData(null);
    setError("");
    setBusy(true);
    const load = async () => {
      try {
        let result = validateAnalysis(
          await salesService.getOpportunityAnalysis(record.id, controller.signal),
          record.id,
        );
        if (result.status === "not_started" || result.stale) {
          result = validateAnalysis(
            await salesService.startOpportunityAnalysis(record.id, false, controller.signal),
            record.id,
          );
        }
        if (current !== generation.current || controller.signal.aborted) return;
        setData(result);
        setError("");
        setBusy(false);
        timer = setTimeout(
          load,
          ["queued", "running"].includes(result.status) ? 4000 : 15000,
        );
      } catch (failure) {
        if (current !== generation.current || controller.signal.aborted) return;
        setData(null);
        setError(message(failure));
        setBusy(false);
      }
    };
    load();
    return () => {
      generation.current = current + 1;
      controller.abort();
      clearTimeout(timer);
    };
  }, [record.id, reload]);

  useEffect(() => {
    if (!reportId || sourceStale) {
      setSources([]);
      setNextOffset(null);
      setSourcesBusy(false);
      setSourcePage(0);
      return undefined;
    }
    if (view !== "Sources") return undefined;
    const controller = new AbortController();
    setSourcesBusy(true);
    setSourceError("");
    salesService
      .getOpportunityAnalysisSources(record.id, sourcePage, controller.signal)
      .then((payload) => {
        const result = validateAnalysis(payload, record.id);
        if (controller.signal.aborted) return;
        setSources(result.sources || []);
        setNextOffset(result.next_offset ?? null);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setSources([]);
          setSourceError(message(failure));
          if ([403, 404].includes(failure?.response?.status)) {
            setData(null);
            setError(message(failure));
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSourcesBusy(false);
      });
    return () => controller.abort();
  }, [view, record.id, sourceUpdatedAt, sourceStale, sourcePage, reportId]);

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      const result = validateAnalysis(
        await salesService.startOpportunityAnalysis(record.id, true, operation.current?.signal),
        record.id,
      );
      if (current === generation.current) {
        setData(result);
        setReload((value) => value + 1);
      }
    } catch (failure) {
      if (current === generation.current && !operation.current?.signal.aborted) {
        setData(null);
        setSources([]);
        setError(message(failure));
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([analysisMarkdown(record, data)], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${record.deal_code || "opportunity"}-analysis.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const counts = data?.counts || {};
  const sourcesNeedingReview = (counts.partial || 0) + (counts.failed || 0);
  const fullResult = data?.result || {};
  const result =
    view === "Brief"
      ? {
          ...fullResult,
          sections: fullResult.sections
            ? Object.fromEntries(
                Object.entries(fullResult.sections).map(([key, items]) => [
                  key,
                  items.slice(0, 3),
                ]),
              )
            : undefined,
        }
      : fullResult;
  const processing = ["queued", "running"].includes(data?.status);
  const hasResult =
    !data?.stale &&
    (managerReview?.status === "ready" ||
      (["ready", "partial"].includes(data?.status) && Object.values(result.sections || {}).some(
        (items) => Array.isArray(items) && items.length > 0,
      )));

  return (
    <section className={`soa soa-Radai ${dark ? "soa-dark" : ""}`} aria-label="Opportunity Intelligence Sales review">
      <header className="soa-hero glass">
        <div className="soa-title">
          <span className="soa-mark" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div className="soa-heading">
            <h2>Opportunity Intelligence</h2>
            {data && <div className="soa-hero-meta" role="status">
              <span className={`soa-analysis-state ${data.status === "failed" || data.status === "blocked" ? "soa-analysis-state-error" : ""}`}>
                {processing ? <Loader2 className="soa-spin" size={13} aria-hidden="true" />
                  : data.status === "ready" ? <CheckCircle2 size={13} aria-hidden="true" />
                    : <AlertCircle size={13} aria-hidden="true" />}
                {processing
                  ? `Analyzing ${counts.chunks_done || 0} of ${counts.chunks_total || 0} sections`
                  : data.status === "ready"
                    ? `${counts.chunks_done || 0} sections analyzed`
                    : data.status === "partial"
                      ? `${counts.chunks_done || 0} sections analyzed`
                      : "Analysis needs attention"}
              </span>
              {sourcesNeedingReview > 0 && <button type="button" className="soa-coverage-link" onClick={() => setView("Sources")}>
                {sourcesNeedingReview} {sourcesNeedingReview === 1 ? "source" : "sources"} need review <ArrowRight size={12} aria-hidden="true" />
              </button>}
            </div>}
          </div>
        </div>
        <div className="soa-hero-actions">
          <button
            type="button"
            className="soa-icon-button"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={dark}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className="soa-icon-button"
            aria-label="Refresh analysis"
            onClick={() => setReload((value) => value + 1)}
            disabled={busy}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      {error && (
        <div className="soa-alert" role="alert">
          <AlertCircle size={18} />
          <div>
            {error}
            <button type="button" onClick={() => setReload((value) => value + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}
      {busy && !data && (
        <div className="cp-skeleton" role="status" aria-label="Loading Radai workspace">
          <div className="cp-sk-hero glass">
            <div className="cp-sk-ring" aria-hidden="true" />
            <div className="cp-sk-lines">
              <div className="cp-sk-line cp-sk-w60" />
              <div className="cp-sk-line cp-sk-w40" />
            </div>
          </div>
          {[0, 1, 2].map((index) => (
            <div key={index} className="cp-sk-card glass" aria-hidden="true">
              <div className="cp-sk-line cp-sk-w40" />
              <div className="cp-sk-line" />
              <div className="cp-sk-line cp-sk-w70" />
            </div>
          ))}
          <span className="cp-sr">Radai is reading your documents…</span>
        </div>
      )}
      {data && (
        <>
          <nav className="soa-nav cp-nav" aria-label="Analysis sections">
            {views.map((item) => (
              <button type="button" key={item} onClick={() => setView(item)} aria-current={view === item ? "page" : undefined}>
                {item === "Manager review" ? (
                  <>
                    <Sparkles size={13} aria-hidden="true" />
                    Sales review
                  </>
                ) : (
                  item
                )}
              </button>
            ))}
          </nav>
          {view === "Manager review" && managerReview?.status === "ready" && (
            <div className="soa-manager-review">
              <section className="soa-review-conclusion glass">
                <p className="soa-review-kicker">Advisory recommendation</p>
                <h3 className={`soa-verdict soa-verdict-${managerReview.recommendation}`}>
                  {({ go: "Go", conditional_go: "Conditional Go", no_go: "No-Go", insufficient_evidence: "More information needed" })[managerReview.recommendation] || "Review unavailable"}
                </h3>
                <p>{managerReview.rationale}</p>
                {managerReview.rationale_evidence?.map((source, index) => <details className="cp-evidence" key={`${source.source_id}-${index}`}>
                  <summary><FileText size={13} aria-hidden="true" />{source.name} · {source.location}</summary>
                  <blockquote>{source.excerpt}</blockquote>
                </details>)}
                <p className="soa-review-note">{managerReview.review_note}</p>
                {record.bid_decision === "pending" && record.stage === "qualified" && managerReview.recommendation !== "insufficient_evidence" &&
                  <button type="button" className="soa-review-action" onClick={() => onAction?.("bid_decision")}>Open Go / No-Go decision</button>}
                {record.bid_decision === "pending" && record.stage === "lead" && managerReview.recommendation !== "insufficient_evidence" &&
                  <button type="button" className="soa-review-action" onClick={() => onAction?.("qualify")}>Continue qualification before recording a decision</button>}
                {record.bid_decision !== "pending" &&
                  <p className="soa-review-note">Recorded decision: {record.bid_decision === "no_bid" ? "No-Go" : record.bid_decision === "conditional_bid" ? "Conditional Go" : "Go"}. Review the advisory recommendation before preparing correspondence.</p>}
                {(managerReview.recommendation === "go" || managerReview.recommendation === "conditional_go") &&
                  record.stage === "proposal" && (record.bid_decision === "bid" || record.bid_decision === "conditional_bid") &&
                  <button type="button" className="soa-review-action" onClick={() => onAction?.("prepare_letter_eoi")}>Prepare EOI from saved template</button>}
                {record.stage === "no_bid" && record.bid_decision === "no_bid" && (
                  managerReview.recommendation === "no_go" && managerReview.suggested_letter === "regret_expertise" ? (
                    <button type="button" className="soa-review-action" onClick={() => onAction?.("prepare_letter_regret_expertise")}>Prepare expertise regret from saved template</button>
                  ) : managerReview.recommendation === "no_go" && managerReview.suggested_letter === "regret_manpower" ? (
                    <button type="button" className="soa-review-action" onClick={() => onAction?.("prepare_letter_regret_manpower")}>Prepare manpower regret from saved template</button>
                  ) : (
                    <div className="soa-letter-choice">
                      <p>The recorded No-Go has no cited expertise or manpower reason. Choose the saved wording to review:</p>
                      <button type="button" onClick={() => onAction?.("prepare_letter_regret_expertise")}>Expertise template</button>
                      <button type="button" onClick={() => onAction?.("prepare_letter_regret_manpower")}>Manpower template</button>
                    </div>
                  )
                )}
              </section>
              <div className="soa-review-grid">
                {reviewDimensions.map(([key, title]) => {
                  const item = managerReview.dimensions?.find((row) => row.dimension === key);
                  return <section className="cp-insight glass soa-review-dimension" key={key} aria-label={title}>
                    <h3>{title}<span className={`soa-assessment soa-assessment-${item?.assessment || "unknown"}`}>{item?.assessment || "unknown"}</span></h3>
                    <p>{item?.summary || "No verified assessment available."}</p>
                    {item?.evidence?.map((source, index) => <details className="cp-evidence" key={`${source.source_id}-${index}`}>
                      <summary><FileText size={13} aria-hidden="true" />{source.name} · {source.location}</summary>
                      <blockquote>{source.excerpt}</blockquote>
                    </details>)}
                  </section>;
                })}
              </div>
              {managerReview.clarifications?.length > 0 && <section className="cp-insight glass soa-review-clarifications">
                <h3>Clarifications to raise with the client</h3>
                <ul>{managerReview.clarifications.map((item, index) => <li key={index}>
                  <p>{item.text}</p>
                  {item.evidence?.map((source, evidenceIndex) => <details className="cp-evidence" key={`${source.source_id}-${evidenceIndex}`}>
                    <summary><FileText size={13} aria-hidden="true" />{source.name} · {source.location}</summary><blockquote>{source.excerpt}</blockquote>
                  </details>)}
                </li>)}</ul>
              </section>}
              <p className="soa-review-note">EOI and regret drafts use the saved company template. Only project-specific fields are populated; standard wording is preserved.</p>
            </div>
          )}
          {view === "Manager review" && managerReview?.status !== "ready" && hasResult && (
            <div className="cp-empty glass"><h3>Sales manager review is not ready</h3>
              <p>{managerReview?.error_code ? "The recommendation could not be verified. Review source coverage and retry." : processing ? "The review will appear when source analysis completes." : "No manager recommendation is available in this report. Retry the analysis and review source coverage."}</p>
              {!processing && <button type="button" onClick={() => setView("Sources")}>Review source coverage</button>}
            </div>
          )}
          {!hasResult && view !== "Sources" && (
            <div className="cp-empty glass">
              {processing ? <Sparkles size={26} aria-hidden="true" className="cp-pulse" /> : <BarChart3 size={28} aria-hidden="true" />}
              <h3>
                {counts.total === 0 && !processing
                  ? "No attached sources yet"
                  : processing
                    ? "Radai is reading your documents"
                    : data.status === "failed" || data.status === "blocked"
                      ? "Analysis could not verify these documents"
                      : "No source-supported findings yet"}
              </h3>
              <p>
                {processing
                  ? "Source findings and the Sales manager review appear here as processing completes."
                  : data.status === "failed" || data.status === "blocked"
                    ? analysisFailureMessage(data)
                    : counts.total === 0
                      ? "Attach readable tender documents to prepare the Sales manager review."
                      : "No findings were verified. Review source coverage or attach additional files."}
              </p>
              {!processing && counts.total > 0 && (
                <button type="button" onClick={() => setView("Sources")}>
                  Review source coverage
                </button>
              )}
            </div>
          )}
          {hasResult && view === "Brief" && (
            <div className="cp-insights">
              {sectionBlock("brief", "What is this opportunity?", Sparkles)}
              {sectionBlock("client_need", "What does the client want?", ListChecks)}
              {sectionBlock("next_step", "What should we do next?", ArrowRight)}
              {result.relationships?.length > 0 && (
                <section className="cp-insight glass" aria-label="Document relationships">
                  <h3>Document relationships</h3>
                  <ul>{result.relationships.map((relation, index) => (
                    <li key={index}>{relation.reference || relation.kind}
                      {relation.sources?.length ? ` — ${relation.sources.map((source) => source.name).filter(Boolean).join(', ')}` : ''}
                    </li>
                  ))}</ul>
                </section>
              )}
            </div>
          )}
          {hasResult && view === "Submissions" && (
            <div className="cp-insights">{sectionBlock("submission", "What do we need to submit?", FileText)}</div>
          )}
          {hasResult && view === "Risks" && (
            <div className="cp-insights">
              <section className="cp-insight glass" aria-label="Business decision risks">
                <h3 className="soa-risk-heading"><ShieldAlert size={16} aria-hidden="true" />Business decision risks</h3>
                <p className="cp-missing">Factors that may affect attractiveness, profitability, winnability or commercial exposure.</p>
                {managerReview?.status === "ready" ? (
                  managerReview.business_risks?.length ? <ul className="cp-findings">
                    {managerReview.business_risks.map((item, index) => <li className="cp-finding" key={`${item.category}-${index}`}>
                      <span className="soa-risk-category">{item.category.replaceAll("_", " ")}</span>
                      <p className="cp-finding-text">{item.risk}</p>
                      <p className="soa-risk-impact"><strong>Decision impact:</strong> {item.decision_impact}</p>
                      {item.evidence?.map((source, evidenceIndex) => <details className="cp-evidence" key={`${source.source_id}-${evidenceIndex}`}>
                        <summary><FileText size={13} aria-hidden="true" />{source.name} · {source.location}</summary>
                        <blockquote>{source.excerpt}</blockquote>
                      </details>)}
                    </li>)}
                  </ul> : <p className="cp-missing">No cited business decision risk was identified. Commercial terms and internal guardrails still need Sales review.</p>
                ) : <p className="cp-missing">Business decision risks will appear when the Sales manager review is ready.</p>}
              </section>
            </div>
          )}
          {hasResult && view === "Actions" && (
            <div className="cp-insights">
              {sectionBlock("action", "What actions are pending?", Target)}
              {sectionBlock("next_step", "What should we do next?", ArrowRight)}
            </div>
          )}
          {hasResult && view === "Timeline" && (
            <div className="cp-insights">{sectionBlock("deadline", "Which deadlines are approaching?", CalendarDays, true)}</div>
          )}
          {view === "Sources" && (
            <section className="soa-section">
              <h3>Source coverage</h3>
              <p className="soa-coverage-note">
                {counts.total || 0} sources inventoried · {counts.ready || 0} ready · {counts.partial || 0} partial.
              </p>
              {!hasResult && result.relationships?.length > 0 && (
                <p className="soa-coverage-note">
                  Shared document references were detected during text extraction, but no AI findings were verified. These references are not an executive brief.
                </p>
              )}
              <p className="soa-coverage-note">
                {data.coverage_note} Budget: 32 MiB and 2 million text characters per file. Scanned pages need OCR; partial sources remain marked.
              </p>
              {sourceError && <p role="alert">{sourceError}</p>}
              {sourcesBusy && <p role="status">Loading sources…</p>}
              <ul className="soa-sources">
                {sources.map((source) => (
                  <li key={source.id}>
                    <details>
                      <summary>
                        <FileText size={16} />
                        <span>
                          {source.name}
                          <small>
                            {source.provider} · {source.status}
                            {source.diagnostic ? ` · ${source.diagnostic.replaceAll("_", " ")}` : ""}
                          </small>
                          {source.analysis_error && (
                            <small className="soa-source-error">{analysisSourceError(source.analysis_error)}</small>
                          )}
                        </span>
                      </summary>
                      {source.claims?.length ? (
                        source.claims.map((claim, index) => (
                          <div className="soa-source-claim" key={index}>
                            <p>{decisionText(claim.text)}</p>
                            <blockquote>{claim.excerpt}</blockquote>
                            <small>{claim.location}</small>
                          </div>
                        ))
                      ) : (
                        <p className="soa-missing">
                          {source.analysis_error
                            ? "No verified findings from this source. Review the error above and retry."
                            : "No verified findings for this source yet."}
                        </p>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
              <div className="soa-pages">
                <button type="button" disabled={!sourcePage || sourcesBusy} onClick={() => setSourcePage((value) => Math.max(0, value - 25))}>
                  Previous sources
                </button>
                <span>
                  {sourcePage + 1}–{sourcePage + sources.length}
                </span>
                <button type="button" disabled={nextOffset === null || sourcesBusy} onClick={() => setSourcePage(nextOffset)}>
                  More sources
                </button>
              </div>
            </section>
          )}
          <footer className="soa-footer">
            <p>
              {data.updated_at
                ? `Updated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(
                    new Date(data.updated_at),
                  )} (Dubai)`
                : "Waiting for processing"}
              · Updates automatically when sources change.
            </p>
            <div>
              <button type="button" onClick={retry} disabled={busy || processing}>
                <RefreshCw size={14} />
                Retry incomplete analysis
              </button>
              <button type="button" onClick={download} disabled={!hasResult}>
                <Download size={14} />
                Download brief
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

SalesOpportunityAnalysis.propTypes = {
  record: PropTypes.object.isRequired,
  onAction: PropTypes.func,
};
