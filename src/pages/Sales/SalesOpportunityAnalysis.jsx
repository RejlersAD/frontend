import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  copilotActions,
  copilotConfidence,
  copilotScore,
  riskSeverity,
  scoreColor,
  SCORE_RING,
} from "./salesOpportunityCopilot";
import "./SalesOpportunityAnalysis.css";

const views = [
  "Copilot",
  "Brief",
  "Submissions",
  "Risks",
  "Actions",
  "Timeline",
  "Sources",
];
const sectionsFor = {
  Copilot: ["brief", "client_need", "risk", "next_step"],
  Brief: ["brief", "client_need", "next_step"],
  Submissions: ["submission"],
  Risks: ["risk"],
  Actions: ["action", "next_step"],
  Timeline: ["deadline"],
  Sources: [],
};
const message = (error) =>
  typeof error?.response?.data?.detail === "string"
    ? error.response.data.detail
    : error.message || "Analysis could not be loaded. Please retry.";

export default function SalesOpportunityAnalysis({ record }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("Copilot");
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);
  const [openSections, setOpenSections] = useState({
    brief: true,
    client_need: true,
    risk: true,
    next_step: true,
    submission: true,
    action: true,
    deadline: true,
  });
  const [showAllActions, setShowAllActions] = useState(false);
  const [sources, setSources] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [sourceError, setSourceError] = useState("");
  const [sourcesBusy, setSourcesBusy] = useState(false);
  const [sourcePage, setSourcePage] = useState(0);
  const generation = useRef(0);
  const operation = useRef(null);
  const [reload, setReload] = useState(0);
  const reportId = data?.id;
  const sourceStale = data?.stale;
  const sourceUpdatedAt = data?.updated_at;

  const score = useMemo(() => copilotScore(record, data), [record, data]);
  const confidence = useMemo(() => copilotConfidence(data), [data]);
  const nextActions = useMemo(() => copilotActions(record, data), [record, data]);
  const visibleActions = showAllActions ? nextActions : nextActions.slice(0, 3);
  const ringSize = SCORE_RING.size;
  const ringRadius = SCORE_RING.radius;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (score.score / 100) * ringCirc;
  const ringColor = scoreColor(score.band);
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
  const severityOf = (text) => riskSeverity(text);

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
                <li key={`${item.source_id || "s"}-${index}`} className={`cp-finding ${key === "risk" ? `cp-risk-${severityOf(item.text)}` : ""}`}>
                  {key === "risk" && (
                    <span className={`cp-sev cp-sev-${severityOf(item.text)}`}>
                      <ShieldAlert size={11} aria-hidden="true" />
                      {severityOf(item.text)} risk
                    </span>
                  )}
                  <p className="cp-finding-text">{item.text}</p>
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
  const progress = counts.chunks_total
    ? Math.min(100, Math.round((((counts.chunks_done || 0) + (counts.chunks_failed || 0)) / counts.chunks_total) * 100))
    : 0;
  const processing = ["queued", "running"].includes(data?.status);
  const hasResult =
    !data?.stale &&
    ["ready", "partial"].includes(data?.status) &&
    Object.values(result.sections || {}).some(
      (items) => Array.isArray(items) && items.length > 0,
    );

  return (
    <section className={`soa soa-copilot ${dark ? "soa-dark" : ""}`} aria-label="Opportunity analysis Copilot">
      <header className="soa-hero glass">
        <div className="soa-title">
          <span className="soa-mark" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <div>
            <span className="cp-ai-badge">
              <Sparkles size={12} aria-hidden="true" />
              RADAI COPILOT
            </span>
            <h2>Opportunity Intelligence</h2>
            <p>Qualify, decide and act — grounded in your tender documents.</p>
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
        <div className="cp-skeleton" role="status" aria-label="Loading Copilot workspace">
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
          <span className="cp-sr">Copilot is reading your documents…</span>
        </div>
      )}
      {data && (
        <>
          <div
            className={`cp-status glass ${data.status === "partial" || data.status === "failed" || data.status === "blocked" ? "cp-warn" : ""}`}
            role="status"
          >
            {processing ? (
              <Loader2 className="soa-spin" size={17} aria-hidden="true" />
            ) : data.status === "ready" ? (
              <CheckCircle2 size={17} aria-hidden="true" />
            ) : (
              <AlertCircle size={17} aria-hidden="true" />
            )}
            <div>
              <strong>
                {processing
                  ? data.stale
                    ? "Updating for the latest documents"
                    : "Analysis in progress"
                  : data.status === "ready"
                    ? "Analysis ready for review"
                    : data.status === "partial"
                      ? "Partial analysis — review coverage gaps"
                      : "Analysis needs attention"}
              </strong>
              <p>
                {processing
                  ? `${counts.chunks_done || 0} of ${counts.chunks_total || 0} text sections analyzed.`
                  : data.status === "failed" || data.status === "blocked"
                    ? analysisFailureMessage(data)
                    : "AI findings are advisory. Confirm dates and requirements before acting."}
              </p>
            </div>
            <span className={`cp-conf cp-conf-${confidence.level}`}>
              <span className="cp-conf-dot" aria-hidden="true" />
              {confidence.label} · {confidence.detail}
            </span>
          </div>
          <nav className="soa-nav cp-nav" aria-label="Analysis sections">
            {views.map((item) => (
              <button type="button" key={item} onClick={() => setView(item)} aria-current={view === item ? "page" : undefined}>
                {item === "Copilot" ? (
                  <>
                    <Sparkles size={13} aria-hidden="true" />
                    Copilot
                  </>
                ) : (
                  item
                )}
              </button>
            ))}
          </nav>
          {!hasResult && view !== "Sources" && (
            <div className="cp-empty glass">
              {processing ? <Sparkles size={26} aria-hidden="true" className="cp-pulse" /> : <BarChart3 size={28} aria-hidden="true" />}
              <h3>
                {counts.total === 0 && !processing
                  ? "No attached sources yet"
                  : processing
                    ? "Copilot is reading your documents"
                    : data.status === "failed" || data.status === "blocked"
                      ? "Analysis could not verify these documents"
                      : "No source-supported findings yet"}
              </h3>
              <p>
                {processing
                  ? "Findings, risks and the qualification score appear here as processing completes."
                  : data.status === "failed" || data.status === "blocked"
                    ? analysisFailureMessage(data)
                    : counts.total === 0
                      ? "Attach readable tender documents to unlock the Copilot brief."
                      : "No findings were verified. Review source coverage or attach additional files."}
              </p>
              {!processing && counts.total > 0 && (
                <button type="button" onClick={() => setView("Sources")}>
                  Review source coverage
                </button>
              )}
            </div>
          )}
          {view === "Copilot" && hasResult && (
            <div className="cp-workspace">
              <div className="cp-hero glass">
                <div className="cp-hero-grid">
                  <div className="cp-score-block">
                    <div className="cp-ring-wrap" role="img" aria-label={`Qualification score ${score.score} of 100, ${score.band}`}>
                      <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                        <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" strokeWidth="11" className="cp-ring-track" />
                        <circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={ringRadius}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={ringCirc}
                          strokeDashoffset={ringOffset}
                          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                          className="cp-ring-fill"
                        />
                      </svg>
                      <div className="cp-ring-label">
                        <strong style={{ color: ringColor }}>{score.score}</strong>
                        <small>/ 100 · {score.band}</small>
                      </div>
                    </div>
                    <div>
                      <h3>Qualification score</h3>
                      <p className="cp-muted">
                        Evidence {score.coverage}% · {score.ready}/{score.total} sources verified · {score.risks} risks
                      </p>
                    </div>
                  </div>
                  <div className="cp-actions">
                    <h3>
                      <Target size={15} aria-hidden="true" />
                      Next best actions
                    </h3>
                    <ul>
                      {visibleActions.map((action) => (
                        <li key={action.id} className={`cp-action cp-${action.priority}`}>
                          <div>
                            <strong>{action.title}</strong>
                            <p>{action.detail}</p>
                          </div>
                          {action.view && (
                            <button type="button" onClick={() => setView(action.view)}>
                              Open
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {nextActions.length > 3 && (
                      <button type="button" className="cp-more" onClick={() => setShowAllActions((v) => !v)}>
                        {showAllActions ? "Show fewer" : `Show all ${nextActions.length} actions`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="cp-insights">
                {sectionBlock("brief", "Opportunity brief", Sparkles)}
                {sectionBlock("client_need", "Client needs", ListChecks)}
                {sectionBlock("risk", "Risks to clear", ShieldAlert)}
                {sectionBlock("next_step", "Suggested next steps", ArrowRight)}
              </div>
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
            <div className="cp-insights">{sectionBlock("risk", "What risks need attention?", ShieldAlert)}</div>
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
                            <p>{claim.text}</p>
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
                Retry incomplete sources
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
};
