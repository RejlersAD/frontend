import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import salesService from "../../services/sales.service";
import { proposalTabKey } from "./SalesProposalWorkspace";
import SalesProposalEvidence from "./SalesProposalEvidence";
import {
  folderLabel,
  pageLabel,
  presentFacts,
  presentFindings,
  presentJob,
  proposalStatus,
  reviewSections,
  sectionCoverage,
} from "./standardProposalPresentation";
import "./SalesStandardProposal.css";

const VIEWS = ["Workspace", "Generate", "Evidence review", "Preview"];
const POLL_MS = 4000;

const errorText = (error, fallback) => {
  const data = error?.response?.data;
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return (
    first(data?.detail) ||
    first(data?.sources) ||
    first(data?.analysis) ||
    first(data?.expected_version) ||
    first(data?.builder) ||
    fallback
  );
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "technical-proposal";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

function IssueList({ issues, empty }) {
  if (!issues.blockers.length && !issues.checks.length)
    return empty ? <p className="ssp-muted">{empty}</p> : null;
  return (
    <ul className="ssp-issues">
      {issues.blockers.map((item) => (
        <li key={`b-${item.title}`} className="ssp-issue ssp-issue-blocker">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            <strong>{item.title}</strong>
            {item.detail && <small>{item.detail}</small>}
          </span>
          <span className="ssp-tag">Must fix</span>
        </li>
      ))}
      {issues.checks.map((item) => (
        <li key={`c-${item.title}`} className="ssp-issue ssp-issue-check">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>{item.title}</strong>
            {item.detail && <small>{item.detail}</small>}
          </span>
          <span className="ssp-tag">Check</span>
        </li>
      ))}
    </ul>
  );
}
IssueList.propTypes = {
  issues: PropTypes.object.isRequired,
  empty: PropTypes.string,
};

function Progress({ job }) {
  const state = presentJob(job);
  if (!state) return null;
  return (
    <div
      className={`ssp-progress ssp-progress-${state.status}`}
      role="status"
      aria-live="polite"
    >
      {state.busy ? (
        <Loader2 size={18} className="ssp-spin" aria-hidden="true" />
      ) : state.status === "failed" ? (
        <ShieldAlert size={18} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={18} aria-hidden="true" />
      )}
      <span>
        <strong>
          {state.label}
          {state.section ? " (section rebuild)" : ""}
        </strong>
        <small>
          {state.busy
            ? `This usually takes a few minutes. You can leave this page; generation continues.${state.retrying ? " Retrying after a temporary problem." : ""}`
            : state.error ||
              (state.version
                ? `Revision ${state.version} is ready for review.`
                : "")}
        </small>
      </span>
    </div>
  );
}
Progress.propTypes = { job: PropTypes.object };

export default function SalesStandardProposal({ quoteId, dealId, onPrepared }) {
  const [view, setView] = useState("Workspace");
  const [workspace, setWorkspace] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState(null);
  const [documentsError, setDocumentsError] = useState("");
  // Tender text must be scanned (document analysis) before the proposal can use it.
  const [needsScan, setNeedsScan] = useState(false);
  const [scan, setScan] = useState(null); // { done, total } while scanning
  const [selected, setSelected] = useState([]);
  const [savedSelection, setSavedSelection] = useState([]);
  const [check, setCheck] = useState(null);
  const [note, setNote] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [pdf, setPdf] = useState({
    url: "",
    version: null,
    loading: false,
    error: "",
  });
  const pdfUrl = useRef("");

  const current = workspace?.current?.content || null;
  const version = workspace?.current?.version || null;
  const status = proposalStatus(current, job);
  const sections = useMemo(() => reviewSections(current), [current]);
  // Sections that accept uploaded documents: evidence sections, and authored sections such as
  // 2.6 Specific HSE Requirements whose documents follow the drafted text.
  const evidenceKeys = useMemo(
    () => new Set(workspace?.current?.evidence_sections || []),
    [workspace],
  );
  const issues = useMemo(
    () => presentFindings(current?.build_findings),
    [current],
  );
  const facts = useMemo(
    () => presentFacts(current?.build_meta?.facts),
    [current],
  );
  const jobState = presentJob(job);
  const generating = Boolean(jobState?.busy);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const [saved, latest] = await Promise.all([
          salesService.getTechnicalProposalWorkspace(quoteId, { signal }),
          salesService.getStandardProposalJob(quoteId, "latest", { signal }),
        ]);
        setWorkspace(saved);
        setJob(latest.job);
      } catch (failure) {
        if (!signal?.aborted)
          setError(
            errorText(
              failure,
              "The proposal could not be loaded. Refresh to try again.",
            ),
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [quoteId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Follow a running generation until it finishes, then reload the proposal.
  useEffect(() => {
    if (!generating || !job?.id) return undefined;
    const timer = setTimeout(async () => {
      try {
        const next = (
          await salesService.getStandardProposalJob(quoteId, job.id)
        ).job;
        setJob(next);
        if (next.status === "succeeded") {
          setNotice(
            next.section_key
              ? "The section was rebuilt. Review it again."
              : "The proposal was generated. Review each section next.",
          );
          await load();
          await onPrepared?.(quoteId);
        }
      } catch {
        setJob((previous) => ({ ...previous })); // keep polling after a transient failure
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [generating, job, quoteId, load, onPrepared]);

  const loadDocuments = useCallback(async () => {
    setDocumentsError("");
    setNeedsScan(false);
    try {
      const selection = await salesService.getProposalSourceSelection(dealId);
      // Tender packages often exceed one registry page (200); read them all.
      const sources = [];
      for (let offset = 0; offset !== null && offset !== undefined; ) {
        const page = await salesService.getProposalSourceRegistry(dealId, {
          page_size: 200,
          offset,
        });
        sources.push(...(page.sources || []));
        offset = page.next_offset;
      }
      const rows = sources.map((row) => ({
        key: row.key,
        name: row.name,
        folder: row.folder || "",
      }));
      const chosen = selection.source_keys?.length
        ? selection.source_keys
        : rows
            .filter((row) => ["tender", "correspondence"].includes(row.folder))
            .map((row) => row.key);
      setDocuments(rows);
      setSelected(chosen);
      setSavedSelection(selection.source_keys || []);
      // A scan started after upload may still be reading files; show its progress.
      salesService
        .getOpportunityAnalysis(dealId)
        .then((analysis) => {
          const counts = analysis?.counts || {};
          if (counts.queued > 0)
            setScan({ done: counts.total - counts.queued, total: counts.total });
        })
        .catch(() => {});
    } catch (failure) {
      setDocuments([]);
      setNeedsScan(Boolean(failure?.response?.data?.analysis));
      setDocumentsError(
        errorText(failure, "The tender documents could not be loaded."),
      );
    }
  }, [dealId]);

  useEffect(() => {
    if (view === "Generate" && documents === null) loadDocuments();
  }, [view, documents, loadDocuments]);

  const scanDocuments = async () => {
    const started = await run("scan", () =>
      salesService.startOpportunityAnalysis(dealId),
    );
    if (started) {
      setNeedsScan(false);
      setDocumentsError("");
      setScan({ done: 0, total: started.counts?.total || 0 });
    }
  };

  // Follow the document scan; reload the document list once every file has been read.
  useEffect(() => {
    if (!scan) return undefined;
    const timer = setTimeout(async () => {
      try {
        const analysis = await salesService.getOpportunityAnalysis(dealId);
        const counts = analysis?.counts || {};
        const total = counts.total || 0;
        const pending = analysis?.stale ? total : counts.queued || 0;
        if (["failed", "blocked"].includes(analysis?.status) && !pending) {
          setScan(null);
          setDocumentsError("Some documents could not be scanned. Scan again or check the files.");
          setNeedsScan(true);
        } else if (total && !pending) {
          setScan(null);
          setDocuments(null); // reload the now-readable documents
        } else {
          setScan({ done: Math.max(0, total - pending), total });
        }
      } catch {
        setScan((previous) => (previous ? { ...previous } : previous)); // keep polling
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [scan, dealId]);

  // Fetch the compiled binder once per revision when Preview opens.
  const pdfRequested = useRef(null);
  useEffect(() => {
    if (view !== "Preview" || !version || pdfRequested.current === version)
      return;
    pdfRequested.current = version;
    setPdf({ url: "", version, loading: true, error: "" });
    salesService
      .downloadTechnicalProposalWorkspace(quoteId, "pdf", version)
      .then((result) => {
        if (pdfRequested.current !== version) return; // a newer revision was requested meanwhile
        if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
        pdfUrl.current = URL.createObjectURL(result.blob);
        setPdf({ url: pdfUrl.current, version, loading: false, error: "" });
      })
      .catch((failure) => {
        if (pdfRequested.current !== version) return;
        pdfRequested.current = null; // allow a retry by reopening Preview
        setPdf({
          url: "",
          version,
          loading: false,
          error: errorText(failure, "The preview could not be loaded."),
        });
      });
  }, [view, version, quoteId]);
  useEffect(
    () => () => {
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    },
    [],
  );

  const run = async (name, action, success) => {
    if (busy) return null;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (success) setNotice(success);
      return result;
    } catch (failure) {
      setError(errorText(failure, "The action could not be completed."));
      return null;
    } finally {
      setBusy("");
    }
  };

  const selectionChanged =
    selected.length !== savedSelection.length ||
    selected.some((key) => !savedSelection.includes(key));
  const saveSelection = () =>
    run(
      "selection",
      async () => {
        await salesService.saveProposalSourceSelection(dealId, selected);
        setSavedSelection(selected);
        setCheck(null);
      },
      "Document selection saved.",
    );
  const runCheck = () =>
    run("check", async () =>
      setCheck(await salesService.getStandardProposalPlan(quoteId)),
    );
  const generate = () =>
    run("generate", async () => {
      const result =
        await salesService.generateTechnicalProposalWorkspace(quoteId);
      setJob(result.job);
    });
  const review = (section, approved) =>
    run(
      `review-${section.key}`,
      async () => {
        await salesService.reviewTechnicalProposalWorkspace(quoteId, {
          expected_version: version,
          section_key: section.key,
          approved,
          reason: note.trim(),
          compliance_matrix: current.compliance_matrix || [],
        });
        await load();
      },
      approved
        ? `${section.title} approved.`
        : `${section.title} returned for changes.`,
    );
  const rebuild = (section, reason = note.trim()) =>
    run(
      `rebuild-${section.key}`,
      async () => {
        const result = await salesService.regenerateTechnicalProposalSection(
          quoteId,
          section.key,
          { expected_version: version, reason },
        );
        setJob(result.job);
      },
      `${section.title} is being rebuilt.`,
    );
  const download = (format) =>
    run(`download-${format}`, async () => {
      const result = await salesService.downloadTechnicalProposalWorkspace(
        quoteId,
        format,
        version,
      );
      saveBlob(result.blob, result.filename);
    });
  const openPreview = (page) => {
    setPreviewPage(page || 1);
    setView("Preview");
  };

  const nextStep = {
    empty: {
      label: "Generate proposal",
      go: "Generate",
      text: "Choose the tender documents and generate the first draft.",
    },
    generating: {
      label: "View progress",
      go: "Generate",
      text: "The proposal is being generated.",
    },
    attention: {
      label: "Resolve issues",
      go: "Evidence review",
      text: "Some issues must be fixed before the proposal can be submitted.",
    },
    review: {
      label: "Continue review",
      go: "Evidence review",
      text: "Review and approve each section.",
    },
    ready: {
      label: "Open preview",
      go: "Preview",
      text: "All sections are approved and no issues remain.",
    },
  }[status.key];
  const documentsByFolder = useMemo(() => {
    const groups = {};
    for (const row of documents || []) (groups[row.folder] ||= []).push(row);
    return Object.entries(groups).sort(([a], [b]) =>
      folderLabel(a).localeCompare(folderLabel(b)),
    );
  }, [documents]);
  const checkIssues = useMemo(() => presentFindings(check?.findings), [check]);
  const checkFacts = useMemo(() => presentFacts(check?.facts), [check]);

  return (
    <section
      className="ssp"
      aria-label="Technical proposal"
      aria-busy={loading || Boolean(busy)}
    >
      <header className="ssp-header">
        <div>
          <h3>Technical proposal</h3>
          <p>
            {current
              ? `${current.opportunity_reference} · ${current.client_name} · Version V${version}`
              : "Company-standard technical proposal"}
          </p>
        </div>
        <span className={`ssp-status ssp-status-${status.key}`}>
          {status.label}
        </span>
      </header>
      <div
        className="ssp-tabs"
        role="tablist"
        aria-label="Technical proposal views"
      >
        {VIEWS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`ssp-tab-${name}`}
            aria-controls="ssp-panel"
            aria-selected={view === name}
            tabIndex={view === name ? 0 : -1}
            disabled={
              (name === "Evidence review" || name === "Preview") && !current
            }
            onClick={() => setView(name)}
            onKeyDown={(event) => proposalTabKey(event, VIEWS, view, setView)}
          >
            {name}
          </button>
        ))}
      </div>
      {error && (
        <p className="ssp-alert ssp-alert-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ssp-alert ssp-alert-ok" role="status">
          {notice}
        </p>
      )}
      <div
        id="ssp-panel"
        role="tabpanel"
        aria-labelledby={`ssp-tab-${view}`}
        className="ssp-panel"
      >
        {loading ? (
          <p className="ssp-muted" role="status">
            Loading the proposal…
          </p>
        ) : (
          <>
            {view === "Workspace" && (
              <div className="ssp-grid">
                <section className="ssp-card ssp-card-wide">
                  <h4>Status</h4>
                  {status.total ? (
                    <>
                      <div
                        className="ssp-meter"
                        role="progressbar"
                        aria-label="Sections approved"
                        aria-valuemin={0}
                        aria-valuemax={status.total}
                        aria-valuenow={status.approved}
                        aria-valuetext={`${status.approved} of ${status.total} sections approved`}
                      >
                        <span
                          style={{
                            width: `${Math.round((status.approved / status.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="ssp-meter-label">
                        {status.approved} of {status.total} sections approved
                        {status.blockers
                          ? ` · ${status.blockers} issue${status.blockers === 1 ? "" : "s"} to fix`
                          : ""}
                      </p>
                    </>
                  ) : null}
                  {generating && <Progress job={job} />}
                  <p>{nextStep.text}</p>
                  <button
                    type="button"
                    className="spg-button spg-primary"
                    onClick={() => setView(nextStep.go)}
                    disabled={!current && nextStep.go !== "Generate"}
                  >
                    {nextStep.label}
                  </button>
                </section>
                {current && (
                  <section className="ssp-card">
                    <h4>Proposal document</h4>
                    <p className="ssp-muted">
                      {current.title} · V{version} (PDF). The Word file is
                      produced on request.
                    </p>
                    <div className="ssp-actions">
                      <button
                        type="button"
                        className="spg-button"
                        disabled={Boolean(busy)}
                        onClick={() => download("pdf")}
                      >
                        <Download size={15} aria-hidden="true" />
                        {busy === "download-pdf"
                          ? "Downloading…"
                          : "Download PDF"}
                      </button>
                      <button
                        type="button"
                        className="spg-button"
                        disabled={Boolean(busy)}
                        onClick={() => download("docx")}
                      >
                        <Download size={15} aria-hidden="true" />
                        {busy === "download-docx"
                          ? "Downloading…"
                          : "Word (on request)"}
                      </button>
                      <button
                        type="button"
                        className="spg-button"
                        onClick={() => openPreview(1)}
                      >
                        <Eye size={15} aria-hidden="true" />
                        Preview
                      </button>
                      <Link
                        className="spg-button"
                        to={`/sales/proposals/${encodeURIComponent(quoteId)}/preview`}
                      >
                        Review &amp; comments
                      </Link>
                    </div>
                  </section>
                )}
                {facts.length > 0 && (
                  <section className="ssp-card">
                    <h4>Proposal details</h4>
                    <dl className="ssp-facts">
                      {facts.map((fact) => (
                        <div key={fact.key}>
                          <dt>{fact.label}</dt>
                          <dd>
                            {fact.value}
                            <small>from {fact.source}</small>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {current && (
                  <section className="ssp-card ssp-card-wide">
                    <h4>Issues</h4>
                    <IssueList
                      issues={issues}
                      empty="No issues. Every section can be reviewed."
                    />
                  </section>
                )}
                {(workspace?.history || []).length > 0 && (
                  <section className="ssp-card ssp-card-wide">
                    <h4>Revisions</h4>
                    <ol className="ssp-revisions">
                      {workspace.history.slice(0, 8).map((item) => (
                        <li key={item.id}>
                          <strong>V{item.version}</strong>
                          <span>{formatDate(item.created_at)}</span>
                          <span>{item.reason}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            )}

            {view === "Generate" && (
              <div className="ssp-steps">
                {(generating || job?.status === "failed") && (
                  <Progress job={job} />
                )}
                <section className="ssp-card">
                  <h4>
                    <span className="ssp-step">1</span>Choose tender documents
                  </h4>
                  <p className="ssp-muted">
                    Select tender files. for proposal generation.
                  </p>
                  {documents === null ? (
                    <p className="ssp-muted" role="status">
                      Loading documents…
                    </p>
                  ) : scan ? (
                    <div className="ssp-alert" role="status">
                      <p>
                        Scanning tender documents… {scan.done} of{" "}
                        {scan.total || "?"} read. You can leave this page; the
                        scan continues in the background.
                      </p>
                      <div
                        className="ssp-meter"
                        role="progressbar"
                        aria-label="Document scan progress"
                        aria-valuemin={0}
                        aria-valuemax={scan.total || 1}
                        aria-valuenow={scan.done}
                      >
                        <span
                          style={{
                            width: `${scan.total ? Math.round((100 * scan.done) / scan.total) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : documentsError ? (
                    <div className="ssp-alert ssp-alert-warn">
                      <p>{documentsError}</p>
                      {needsScan && (
                        <button
                          type="button"
                          className="spg-button spg-primary"
                          disabled={Boolean(busy)}
                          onClick={scanDocuments}
                        >
                          {busy === "scan" ? "Starting scan…" : "Scan tender documents"}
                        </button>
                      )}
                    </div>
                  ) : !documents.length ? (
                    <p className="ssp-muted">
                      No documents are available yet. Upload them to the
                      opportunity first.
                    </p>
                  ) : (
                    <div className="ssp-folders">
                      {documentsByFolder.map(([folder, rows]) => {
                        const keys = rows.map((row) => row.key);
                        const all = keys.every((key) => selected.includes(key));
                        return (
                          <fieldset
                            key={folder || "other"}
                            className="ssp-folder"
                            disabled={Boolean(busy) || generating}
                          >
                            <legend>
                              <label className="ssp-check">
                                <input
                                  type="checkbox"
                                  checked={all}
                                  onChange={(event) =>
                                    setSelected((values) =>
                                      event.target.checked
                                        ? [...new Set([...values, ...keys])]
                                        : values.filter(
                                            (key) => !keys.includes(key),
                                          ),
                                    )
                                  }
                                />
                                {folderLabel(folder)}{" "}
                                <small>({rows.length})</small>
                              </label>
                            </legend>
                            <ul>
                              {rows.map((row) => (
                                <li key={row.key}>
                                  <label className="ssp-check">
                                    <input
                                      type="checkbox"
                                      checked={selected.includes(row.key)}
                                      onChange={(event) =>
                                        setSelected((values) =>
                                          event.target.checked
                                            ? [...values, row.key]
                                            : values.filter(
                                                (key) => key !== row.key,
                                              ),
                                        )
                                      }
                                    />
                                    <FileText size={14} aria-hidden="true" />
                                    {row.name}
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </fieldset>
                        );
                      })}
                    </div>
                  )}
                  <div className="ssp-actions">
                    <span className="ssp-muted">
                      {selected.length} selected
                    </span>
                    <button
                      type="button"
                      className="spg-button"
                      disabled={
                        Boolean(busy) ||
                        generating ||
                        !selected.length ||
                        !selectionChanged
                      }
                      onClick={saveSelection}
                    >
                      {busy === "selection"
                        ? "Saving…"
                        : selectionChanged
                          ? "Save selection"
                          : "Selection saved"}
                    </button>
                  </div>
                </section>
                <section className="ssp-card">
                  <h4>
                    <span className="ssp-step">2</span>Check documents
                  </h4>
                  <p className="ssp-muted">
                    See what each section will be written from and what needs
                    attention before generating.
                  </p>
                  <button
                    type="button"
                    className="spg-button"
                    disabled={
                      Boolean(busy) ||
                      generating ||
                      !savedSelection.length ||
                      selectionChanged
                    }
                    onClick={runCheck}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    {busy === "check"
                      ? "Checking…"
                      : check
                        ? "Check again"
                        : "Check documents"}
                  </button>
                  {check && (
                    <>
                      <ul className="ssp-coverage">
                        {check.plan.map((entry) => {
                            const coverage = sectionCoverage(entry);
                            return (
                              <li
                                key={entry.key}
                                className={`ssp-cover-${coverage.state}`}
                              >
                                {coverage.state === "complete" ? (
                                  <CheckCircle2 size={16} aria-hidden="true" />
                                ) : coverage.state === "missing" ||
                                  coverage.state === "evidence" ? (
                                  <ShieldAlert size={16} aria-hidden="true" />
                                ) : (
                                  <CircleDashed size={16} aria-hidden="true" />
                                )}
                                <span>
                                  <strong>{entry.label}</strong>
                                  <small>
                                    {coverage.label}
                                    {coverage.documents.length
                                      ? ` · ${coverage.documents
                                          .map((item) => item.name)
                                          .join(", ")}`
                                      : coverage.state === "missing"
                                        ? " · no tender text found"
                                        : ""}
                                  </small>
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                      {checkFacts.length > 0 && (
                        <dl className="ssp-facts ssp-facts-inline">
                          {checkFacts.map((fact) => (
                            <div key={fact.key}>
                              <dt>{fact.label}</dt>
                              <dd>{fact.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      <IssueList
                        issues={checkIssues}
                        empty="No issues found."
                      />
                    </>
                  )}
                </section>
                <section className="ssp-card">
                  <h4>
                    <span className="ssp-step">3</span>Generate proposal
                  </h4>
                  <p className="ssp-muted">
                   Generates the proposal from selected tender files, saves it as a new version, and opens it for review.
                    {current ? " Approvals start again for the new version." : ""}
                  </p>
                  <button
                    type="button"
                    className="spg-button spg-primary"
                    disabled={
                      Boolean(busy) ||
                      generating ||
                      !savedSelection.length ||
                      selectionChanged
                    }
                    onClick={generate}
                  >
                    <Sparkles size={15} aria-hidden="true" />
                    {generating
                      ? "Generating…"
                      : current
                        ? "Generate new version"
                        : "Generate proposal"}
                  </button>
                </section>
              </div>
            )}

            {view === "Evidence review" && current && (
              <div className="ssp-review">
                <label className="ssp-note">
                  Review note{" "}
                  <small>
                    Recorded with every approval or return. When you rewrite a
                    section, it tells the writer what to change.
                  </small>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="For example: checked against the tender scope, or: use months instead of weeks"
                    disabled={generating}
                  />
                </label>
                {generating && <Progress job={job} />}
                <ul className="ssp-sections">
                  {sections.map((section) => (
                    <li key={section.key} className="ssp-section">
                      <details
                        open={!section.approved && section.blockers.length > 0}
                      >
                        <summary>
                          <span className="ssp-section-title">
                            {section.title}
                          </span>
                          {section.blockers.length > 0 && (
                            <span className="ssp-tag ssp-tag-blocker">
                              {section.blockers.length} to fix
                            </span>
                          )}
                          <span className="ssp-tag">{section.kindLabel}</span>
                          <span
                            className={`ssp-tag ${section.approved ? "ssp-tag-ok" : ""}`}
                          >
                            {section.approved ? "Approved" : "Needs review"}
                          </span>
                        </summary>
                        <div className="ssp-section-body">
                          {section.preview.length > 0 && (
                            <div className="ssp-draft">
                              <h5>Draft</h5>
                              {section.preview.map((text, index) => (
                                <p key={index}>{text}</p>
                              ))}
                              {section.paragraphs > section.preview.length && (
                                <p className="ssp-muted">
                                  {section.paragraphs - section.preview.length}{" "}
                                  more paragraph
                                  {section.paragraphs - section.preview.length === 1 ? "" : "s"}{" "}
                                  in the PDF.
                                </p>
                              )}
                            </div>
                          )}
                          <h5>Based on</h5>
                          {section.sources.length ? (
                            <ul className="ssp-documents">
                              {section.sources.map((name) => (
                                <li key={name}>
                                  <FileText size={14} aria-hidden="true" />
                                  <span>{name}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="ssp-muted">
                              {section.kind === "authored"
                                ? "No tender source was cited."
                                : section.kindLabel + "."}
                            </p>
                          )}
                          {(section.kind === "evidence" || evidenceKeys.has(section.key)) && (
                            <SalesProposalEvidence
                              quoteId={quoteId}
                              section={section}
                              disabled={generating}
                              onInclude={(item) =>
                                rebuild(item, note.trim() || "Company evidence updated")
                              }
                            />
                          )}
                          <IssueList
                            issues={{
                              blockers: section.blockers,
                              checks: section.checks,
                            }}
                          />
                          <div className="ssp-actions">
                            {section.approved ? (
                              <button
                                type="button"
                                className="spg-button"
                                disabled={
                                  Boolean(busy) || generating || !note.trim()
                                }
                                onClick={() => review(section, false)}
                              >
                                <RotateCcw size={15} aria-hidden="true" />
                                Return for changes
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="spg-button spg-primary"
                                disabled={
                                  Boolean(busy) || generating || !note.trim()
                                }
                                onClick={() => review(section, true)}
                              >
                                <CheckCircle2 size={15} aria-hidden="true" />
                                Approve
                              </button>
                            )}
                            {section.kind === "authored" && (
                              <button
                                type="button"
                                className="spg-button"
                                disabled={
                                  Boolean(busy) || generating || !note.trim()
                                }
                                onClick={() => rebuild(section)}
                              >
                                <RefreshCw size={15} aria-hidden="true" />
                                Rewrite section
                              </button>
                            )}
                            {section.firstPage && (
                              <button
                                type="button"
                                className="spg-button"
                                onClick={() => openPreview(section.firstPage)}
                              >
                                <Eye size={15} aria-hidden="true" />
                                View {pageLabel(section.pages)}
                              </button>
                            )}
                          </div>
                          {!note.trim() && (
                            <p className="ssp-hint">
                              Add a review note to approve, return or rewrite.
                            </p>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {view === "Preview" && current && (
              <div className="ssp-preview">
                <nav className="ssp-outline" aria-label="Proposal sections">
                  <h4>Sections</h4>
                  <ol>
                    {sections
                      .filter((item) => item.firstPage)
                      .map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            className={
                              previewPage === item.firstPage
                                ? "ssp-outline-active"
                                : ""
                            }
                            onClick={() => setPreviewPage(item.firstPage)}
                          >
                            <span>{item.title}</span>
                            <small>p. {item.firstPage}</small>
                          </button>
                        </li>
                      ))}
                  </ol>
                </nav>
                <div className="ssp-viewer">
                  {pdf.loading && (
                    <p className="ssp-muted" role="status">
                      <Loader2
                        size={16}
                        className="ssp-spin"
                        aria-hidden="true"
                      />{" "}
                      Loading the proposal PDF. Large proposals can take a moment…
                    </p>
                  )}
                  {pdf.error && (
                    <p className="ssp-alert ssp-alert-error" role="alert">
                      {pdf.error}
                    </p>
                  )}
                  {pdf.url && (
                    <iframe
                      key={previewPage}
                      title={`Client PDF, revision ${version}`}
                      src={`${pdf.url}#page=${previewPage}`}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

SalesStandardProposal.propTypes = {
  quoteId: PropTypes.string.isRequired,
  dealId: PropTypes.string.isRequired,
  onPrepared: PropTypes.func,
};
