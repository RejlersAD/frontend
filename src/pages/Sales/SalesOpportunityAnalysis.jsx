import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import salesService from "../../services/sales.service";
import {
  ANALYSIS_SECTIONS,
  analysisDeadline,
  analysisFailureMessage,
  analysisMarkdown,
  analysisSectionMessage,
  analysisSourceError,
  validateAnalysis,
} from "./salesOpportunityAnalysis";
import "./SalesOpportunityAnalysis.css";

const views = [
  "Brief",
  "Submissions",
  "Risks",
  "Actions",
  "Timeline",
  "Sources",
];
const sectionsFor = {
  Brief: ["brief", "client_need", "next_step"],
  Submissions: ["submission"],
  Risks: ["risk"],
  Actions: ["action", "next_step"],
  Timeline: ["deadline"],
};
const message = (error) =>
  typeof error?.response?.data?.detail === "string"
    ? error.response.data.detail
    : error.message || "Analysis could not be loaded. Please retry.";

export default function SalesOpportunityAnalysis({ record }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("Brief");
  const [busy, setBusy] = useState(false);
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
          await salesService.getOpportunityAnalysis(
            record.id,
            controller.signal,
          ),
          record.id,
        );
        if (result.status === "not_started" || result.stale)
          result = validateAnalysis(
            await salesService.startOpportunityAnalysis(
              record.id,
              false,
              controller.signal,
            ),
            record.id,
          );
        if (current !== generation.current || controller.signal.aborted) return;
        setData(result);
        setError("");
        setBusy(false);
        // Keep watching a completed report too: later uploads invalidate it.
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
        await salesService.startOpportunityAnalysis(
          record.id,
          true,
          operation.current?.signal,
        ),
        record.id,
      );
      if (current === generation.current) {
        setData(result);
        setReload((value) => value + 1);
      }
    } catch (failure) {
      if (
        current === generation.current &&
        !operation.current?.signal.aborted
      ) {
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
    <section className="soa" aria-label="Opportunity analysis">
      <header className="soa-header">
        <div className="soa-title">
          <span className="soa-mark">
            <BarChart3 aria-hidden="true" />
          </span>
          <div>
            <span className="soa-eyebrow">OPPORTUNITY INTELLIGENCE</span>
            <h2>RADAI ANALYSIS</h2>
            <p>Evidence, requirements and the next move.</p>
          </div>
        </div>
        <button
          type="button"
          className="soa-icon-button"
          aria-label="Refresh analysis"
          onClick={() => setReload((value) => value + 1)}
          disabled={busy}
        >
          <RefreshCw size={16} />
        </button>
      </header>
      {error && (
        <div className="soa-alert" role="alert">
          <AlertCircle size={18} />
          <div>
            {error}
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      )}
      {busy && !data && (
        <p role="status" className="soa-loading">
          <Loader2 className="soa-spin" size={18} />
          Reading analysis status…
        </p>
      )}
      {data && (
        <>
          <div
            className={`soa-status ${data.status === "partial" || data.status === "failed" || data.status === "blocked" ? "soa-status-warning" : ""}`}
            role="status"
          >
            {processing ? (
              <Loader2 className="soa-spin" size={17} />
            ) : data.status === "ready" ? (
              <CheckCircle2 size={17} />
            ) : (
              <AlertCircle size={17} />
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
                  ? `${counts.chunks_done || 0} of ${counts.chunks_total || 0} text sections analyzed. You can leave this tab while it continues.`
                  : data.status === "failed" || data.status === "blocked"
                    ? analysisFailureMessage(data)
                    : "AI findings are advisory. Confirm dates and requirements before acting."}
              </p>
            </div>
          </div>
          {processing && (
            <div
              className="soa-progress"
              role="progressbar"
              aria-label="Document analysis progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <nav className="soa-nav" aria-label="Analysis sections">
            {views.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setView(item)}
                aria-current={view === item ? "page" : undefined}
              >
                {item}
              </button>
            ))}
          </nav>
          {!hasResult && view !== "Sources" && (
            <div className="soa-empty">
              <BarChart3 size={28} />
              <h3>
                {counts.total === 0 && !processing
                  ? "No attached sources yet"
                  : processing
                    ? "Building your executive brief"
                    : data.status === "failed" || data.status === "blocked"
                      ? "Analysis could not verify these documents"
                      : "No source-supported findings yet"}
              </h3>
              <p>
                {processing
                  ? "Every current attached source is queued. Findings will appear after processing; unreadable files are listed under Sources."
                  : data.status === "failed" || data.status === "blocked"
                    ? analysisFailureMessage(data)
                    : counts.total === 0
                      ? "Attach readable tender documents to generate a source-cited brief."
                      : "No findings were verified from the available documents. Review source coverage or attach additional tender files."}
              </p>
              {!processing && counts.total > 0 && (
                <button type="button" className="soa-review-sources" onClick={() => setView("Sources")}>
                  Review source coverage
                </button>
              )}
            </div>
          )}
          {hasResult &&
            view !== "Sources" &&
            sectionsFor[view].map((key) => (
              <section className="soa-section" key={key}>
                <h3>{ANALYSIS_SECTIONS.find(([value]) => value === key)[1]}</h3>
                {(result.sections[key] || []).length ? (
                  <ul className="soa-findings">
                    {result.sections[key].map((item, index) => (
                      <li key={`${item.source_id}-${index}`}>
                        <div className="soa-finding-text">
                          <ArrowRight size={15} aria-hidden="true" />
                          <p>{item.text}</p>
                        </div>
                        {key === "deadline" && (
                          <span className="soa-date">
                            {item.date || "Unconfirmed date"} ·{" "}
                            {analysisDeadline(item.date)}
                          </span>
                        )}
                        <details>
                          <summary>
                            <FileText size={12} />
                            {item.name} · {item.location}
                          </summary>
                          <blockquote>{item.excerpt}</blockquote>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="soa-missing">
                    {analysisSectionMessage(key, data)}
                  </p>
                )}
              </section>
            ))}
          {hasResult && view === "Brief" && (
            <section className="soa-section">
              <h3>How the documents connect</h3>
              {result.relationships?.length ? (
                <ul className="soa-relationships">
                  {result.relationships.slice(0, 8).map((relation, index) => (
                    <li key={index}>
                      <strong>{relation.reference}</strong>
                      <span>
                        {relation.sources
                          .map((source) => source.name)
                          .join(" · ")}
                      </span>
                      <small>
                        {relation.kind === "identical_content"
                          ? "Identical file content"
                          : "Shared document reference — relationship requires review"}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="soa-missing">
                  No shared document references or identical content identified.
                </p>
              )}
              {result.deadline_dates?.length > 1 && (
                <p className="soa-caution">
                  <AlertCircle size={15} />
                  Multiple dates were found. Review Timeline for extensions,
                  historical dates and different milestones.
                </p>
              )}
            </section>
          )}
          {view === "Sources" && (
            <section className="soa-section">
              <h3>Source coverage</h3>
              {!hasResult && result.relationships?.length > 0 && (
                <p className="soa-coverage-note">
                  Shared document references were detected during text extraction,
                  but no AI findings were verified. These references are not an
                  executive brief.
                </p>
              )}
              <p className="soa-coverage-note">
                {data.coverage_note} Budget: 32 MiB and 2 million text
                characters per file. Scanned pages need OCR; partial sources
                remain marked.
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
                            {source.diagnostic
                              ? ` · ${source.diagnostic.replaceAll("_", " ")}`
                              : ""}
                          </small>
                          {source.analysis_error && (
                            <small className="soa-source-error">
                              {analysisSourceError(source.analysis_error)}
                            </small>
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
                <button
                  type="button"
                  disabled={!sourcePage || sourcesBusy}
                  onClick={() =>
                    setSourcePage((value) => Math.max(0, value - 25))
                  }
                >
                  Previous sources
                </button>
                <span>
                  {sourcePage + 1}–{sourcePage + sources.length}
                </span>
                <button
                  type="button"
                  disabled={nextOffset === null || sourcesBusy}
                  onClick={() => setSourcePage(nextOffset)}
                >
                  More sources
                </button>
              </div>
            </section>
          )}
          <footer className="soa-footer">
            <p>
              {data.updated_at
                ? `Updated ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date(data.updated_at))} (Dubai)`
                : "Waiting for processing"}{" "}
              · Updates automatically when sources change.
            </p>
            <div>
              <button
                type="button"
                onClick={retry}
                disabled={busy || processing}
              >
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
SalesOpportunityAnalysis.propTypes = { record: PropTypes.object.isRequired };
