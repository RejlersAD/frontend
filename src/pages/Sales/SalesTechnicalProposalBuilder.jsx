import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import salesService from "../../services/sales.service";
import SalesStandardProposal from "./SalesStandardProposal";

const message = (error, fallback) =>
  error?.response?.data?.detail ||
  error?.response?.data?.content ||
  error?.response?.data?.sources ||
  error?.response?.data?.analysis ||
  error?.message ||
  fallback;

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "technical-proposal";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LegacyTechnicalProposalBuilder({ quoteId, dealId, onPrepared }) {
  const [sources, setSources] = useState([]);
  const [selected, setSelected] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState(
    "Human-reviewed technical proposal update.",
  );
  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const [registry, selection, saved] = await Promise.all([
          salesService.getProposalSourceRegistry(
            dealId,
            { page_size: 200 },
            { signal },
          ),
          salesService.getProposalSourceSelection(dealId, { signal }),
          salesService.getTechnicalProposalWorkspace(quoteId, { signal }),
        ]);
        setSources(registry.sources || []);
        setSelected(
          selection.source_keys || registry.selected_source_keys || [],
        );
        setWorkspace(saved);
        setCurrent(saved.current?.content || null);
      } catch (failure) {
        if (!signal?.aborted)
          setError(
            message(
              failure,
              "The technical proposal builder could not be loaded.",
            ),
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [dealId, quoteId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const run = async (name, action) => {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setNotice(
        name === "generate"
          ? "A source-traceable technical proposal workspace was generated."
          : "The controlled proposal revision was saved.",
      );
      await load();
      await onPrepared?.(quoteId);
      return result;
    } catch (failure) {
      setError(
        message(failure, "The proposal command could not be completed."),
      );
      return null;
    } finally {
      setBusy("");
    }
  };

  const saveSelection = () =>
    run("selection", () =>
      salesService.saveProposalSourceSelection(dealId, selected),
    );
  const generate = () =>
    run("generate", () =>
      salesService.generateTechnicalProposalWorkspace(quoteId),
    );
  const save = () => {
    if (!workspace?.current || !current || !reason.trim()) return;
    return run("save", () =>
      salesService.saveTechnicalProposalWorkspace(quoteId, {
        expected_version: workspace.current.version,
        content: current,
        reason: reason.trim(),
      }),
    );
  };
  const reviewSection = (section, approved) =>
    run(`review-${section.key}`, () =>
      salesService.reviewTechnicalProposalWorkspace(quoteId, {
        expected_version: workspace.current.version,
        section_key: section.key,
        approved,
        reason: reason.trim(),
        compliance_matrix: current.compliance_matrix || [],
      }),
    );
  const regenerateSection = (section) =>
    run(`regenerate-${section.key}`, () =>
      salesService.regenerateTechnicalProposalSection(quoteId, section.key, {
        expected_version: workspace.current.version,
        reason: reason.trim(),
      }),
    );
  const download = async (format) => {
    setBusy(`download-${format}`);
    setError("");
    try {
      const result = await salesService.downloadTechnicalProposalWorkspace(
        quoteId,
        format,
        workspace?.current?.version,
      );
      downloadFile(result.blob, result.filename);
    } catch (failure) {
      setError(
        message(
          failure,
          `The ${format.toUpperCase()} could not be downloaded.`,
        ),
      );
    } finally {
      setBusy("");
    }
  };
  const changeParagraph = (sectionKey, paragraphId, text) => {
    setCurrent((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.key !== sectionKey
          ? section
          : {
              ...section,
              approved: false,
              status: "draft",
              paragraphs: section.paragraphs.map((paragraph) =>
                paragraph.id === paragraphId
                  ? {
                      ...paragraph,
                      text,
                    }
                  : paragraph,
              ),
            },
      ),
    }));
  };

  return (
    <section
      className="spp-builder"
      aria-label="Local technical proposal builder"
      aria-busy={loading || Boolean(busy)}
    >
      <div className="spp-heading">
        <div>
          <h3>Technical Proposal Builder</h3>
          <p>
            Deterministic folder/ZIP extraction. Select current
            Tender/Correspondence sources, review the configured 16-section
            scaffold, then approve every section before submission.
          </p>
        </div>
        <button
          type="button"
          className="spg-button"
          disabled={loading || Boolean(busy)}
          onClick={() => load()}
        >
          <RefreshCw size={15} />
          Refresh builder
        </button>
      </div>
      {error && (
        <p className="spp-error" role="alert">
          {String(error)}
        </p>
      )}
      {notice && (
        <p className="spp-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading source registry…</p>
      ) : (
        <>
          <section className="spp-builder-panel">
            <h4>1. Explicit source selection</h4>
            {!sources.length && (
              <p>
                No processed Tender or Correspondence sources are available.
                Start opportunity document analysis after uploading the tender
                package.
              </p>
            )}
            <div className="spp-source-list">
              {sources.map((source) => (
                <label key={source.key} className="spp-source-row">
                  <input
                    type="checkbox"
                    disabled={Boolean(busy)}
                    checked={selected.includes(source.key)}
                    onChange={(event) =>
                      setSelected((values) =>
                        event.target.checked
                          ? [...values, source.key]
                          : values.filter((value) => value !== source.key),
                      )
                    }
                  />
                  <span>
                    <strong>{source.path || source.name}</strong>
                    <small>
                      {source.folder} · {source.status} · v{source.version || 1}
                      {source.diagnostic ? ` · ${source.diagnostic}` : ""}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="spg-button"
              disabled={Boolean(busy) || !selected.length}
              onClick={saveSelection}
            >
              {busy === "selection"
                ? "Saving selection…"
                : "Save exact source selection"}
            </button>
          </section>
          <section className="spp-builder-panel">
            <h4>2. Generate source-linked proposal</h4>
            <p>
              Generation blocks incomplete processing, missing mandatory
              technical sources and incomplete requirement capture. No external
              AI is called.
            </p>
            <button
              type="button"
              className="spg-button spg-primary"
              disabled={Boolean(busy) || !selected.length}
              onClick={generate}
            >
              {busy === "generate"
                ? "Generating…"
                : current
                  ? "Generate next workspace revision"
                  : "Generate technical proposal"}
            </button>
          </section>
          {current && (
            <>
              <section className="spp-builder-summary">
                <div>
                  <FileText size={21} />
                  <span>
                    <strong>{current.title}</strong>
                    <small>
                      Workspace revision {current.revision} ·{" "}
                      {current.requirement_matrix?.length || 0} requirements
                    </small>
                  </span>
                </div>
                <span
                  className={
                    current.publication_validation?.ready
                      ? "spp-ready"
                      : "spp-blocked"
                  }
                >
                  {current.publication_validation?.ready ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  {current.publication_validation?.ready
                    ? "Ready for publication"
                    : `${current.publication_validation?.blockers?.length || 0} publication blockers`}
                </span>
                <div className="spp-actions">
                  <button
                    type="button"
                    className="spg-button"
                    disabled={Boolean(busy)}
                    onClick={() => download("pdf")}
                  >
                    <Download size={15} />
                    PDF
                  </button>
                  <button
                    type="button"
                    className="spg-button"
                    disabled={Boolean(busy)}
                    onClick={() => download("docx")}
                  >
                    <Download size={15} />
                    Word
                  </button>
                </div>
              </section>
              {(current.build_findings || []).length > 0 && (
                <details className="spp-build-report">
                  <summary>
                    Build report ({current.build_findings.length})
                  </summary>
                  <ul>
                    {current.build_findings.map((finding, index) => (
                      <li key={`${finding.code}-${index}`}>
                        <strong>
                          {finding.severity} · {finding.code}
                        </strong>{" "}
                        — {finding.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <label className="spp-review-reason">
                Controlled revision reason
                <textarea
                  rows={2}
                  maxLength={500}
                  value={reason}
                  disabled={Boolean(busy)}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div className="spp-builder-sections">
                {current.sections.map((section) => (
                  <details
                    key={section.key}
                    open={section.status !== "approved"}
                  >
                    <summary>
                      {section.title}
                      <span>{section.approved ? "Approved" : "Draft"}</span>
                    </summary>
                    <div className="spp-section-body">
                      {(section.paragraphs || []).map((paragraph) => (
                        <label key={paragraph.id}>
                          Source-linked response
                          <textarea
                            rows={4}
                            value={paragraph.text || ""}
                            disabled={Boolean(busy)}
                            onChange={(event) =>
                              changeParagraph(
                                section.key,
                                paragraph.id,
                                event.target.value,
                              )
                            }
                          />
                          <small>
                            {paragraph.requirement_ids?.length || 0} requirement
                            citations · {paragraph.evidence_ids?.length || 0}{" "}
                            evidence citations
                          </small>
                        </label>
                      ))}
                      {!section.paragraphs?.length && (
                        <p className="spp-muted">
                          No evidence-backed paragraph is available. Regenerate
                          from processed sources or add reviewed content through
                          the controlled workspace.
                        </p>
                      )}
                      {(section.rows || []).length > 1 && (
                        <div className="spp-builder-table">
                          <table>
                            <thead>
                              <tr>
                                {section.rows[0].map((cell, index) => (
                                  <th key={index}>{cell}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.slice(1).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((cell, index) => (
                                    <td key={index}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="spp-actions">
                        <button
                          type="button"
                          className="spg-button"
                          disabled={Boolean(busy) || !reason.trim()}
                          onClick={() =>
                            reviewSection(section, !section.approved)
                          }
                        >
                          {section.approved
                            ? "Return for correction"
                            : "Approve section"}
                        </button>
                        <button
                          type="button"
                          className="spg-button"
                          disabled={Boolean(busy) || !reason.trim()}
                          onClick={() => regenerateSection(section)}
                        >
                          Regenerate section
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
              <button
                type="button"
                className="spg-button spg-primary"
                disabled={Boolean(busy) || !reason.trim()}
                onClick={save}
              >
                Save edited workspace revision
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}

LegacyTechnicalProposalBuilder.propTypes = {
  quoteId: PropTypes.string.isRequired,
  dealId: PropTypes.string.isRequired,
  onPrepared: PropTypes.func,
};

// The backend reports which builder is enabled (DEC-TP-001): the company-standard proposal
// experience, or the legacy source-linked scaffold.
export default function SalesTechnicalProposalBuilder(props) {
  const [builder, setBuilder] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    salesService
      .getTechnicalProposalWorkspace(props.quoteId, {
        signal: controller.signal,
      })
      .then((result) =>
        setBuilder(result.builder === "standard" ? "standard" : "legacy"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setBuilder("legacy");
      });
    return () => controller.abort();
  }, [props.quoteId]);
  if (!builder)
    return (
      <p className="spp-muted" role="status">
        Loading the technical proposal…
      </p>
    );
  return builder === "standard" ? (
    <SalesStandardProposal {...props} />
  ) : (
    <LegacyTechnicalProposalBuilder {...props} />
  );
}

SalesTechnicalProposalBuilder.propTypes = {
  quoteId: PropTypes.string.isRequired,
  dealId: PropTypes.string.isRequired,
  onPrepared: PropTypes.func,
};
