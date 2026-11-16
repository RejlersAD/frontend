import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CitationDrawer from "./CitationDrawer";
import {
  CheckCircle2,
  AlertTriangle,
  Save,
  Flag,
  Sparkles,
  FileText,
  ChevronRight,
} from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pending Review", color: "text-[var(--rd-text-muted)]", bg: "bg-[var(--rd-surface-subtle)]", border: "border-[var(--rd-border-soft)]" },
  approved: { label: "Approved", color: "text-[var(--rd-text)]", bg: "bg-[var(--rd-surface-subtle)]", border: "border-[var(--rd-border-soft)]" },
  flagged: { label: "Flagged for Review", color: "text-[var(--rd-text-muted)]", bg: "bg-[var(--rd-surface-subtle)]", border: "border-[var(--rd-border-soft)]" },
  rejected: { label: "Rejected", color: "text-[var(--rd-danger)]", bg: "bg-[var(--rd-surface-subtle)]", border: "border-[var(--rd-border-soft)]" },
};

const TOOL_LABELS = {
  sales_bid_decision: "Sales Bid Decision",
  executive_brief: "Executive Briefing",
  pid_review: "P&ID Review",
  document_analysis: "Document Analysis",
  revision_compare: "Revision Comparison",
};

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBidScorecard(data) {
  const decision = data?.decision || "Undetermined";
  const confidence = data?.confidence != null ? Number(data.confidence) : null;
  const reasons = Array.isArray(data?.reasons) ? data.reasons : [];
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];

  return (
    <section className="mt-4 rounded-xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-[var(--rd-ai)]" />
        <h3 className="text-sm font-semibold text-[var(--rd-text)]">
          {TOOL_LABELS.sales_bid_decision} · Scorecard
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-lg border border-[var(--rd-border-soft)] p-3 bg-[var(--rd-bg)]">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-1">Decision</p>
          <p className={`font-medium ${decision.toLowerCase().includes("go") ? "text-[var(--rd-text)]" : decision.toLowerCase().includes("no") ? "text-[var(--rd-danger)]" : "text-[var(--rd-text-muted)]"}`}>
            {decision}
          </p>
        </div>
        {confidence != null && (
          <div className="rounded-lg border border-[var(--rd-border-soft)] p-3 bg-[var(--rd-bg)]">
            <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-1">Confidence</p>
            <p className="font-medium text-[var(--rd-text)]">{confidence}%</p>
          </div>
        )}
      </div>
      {reasons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-2">Key Reasons</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--rd-text)]">
            {reasons.map((reason, i) => (
              <li key={i} className="leading-relaxed">
                {escapeHtml(reason)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {evidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-2">Supporting Evidence</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--rd-text)]">
            {evidence.map((item, i) => (
              <li key={i} className="leading-relaxed">
                {escapeHtml(typeof item === "string" ? item : item.text || String(item))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function renderExecutiveBrief(data) {
  const title = data?.title || "Executive Briefing";
  const summary = data?.summary || "";
  const keyPoints = Array.isArray(data?.key_points) ? data.key_points : [];
  const risks = Array.isArray(data?.risks) ? data.risks : [];
  const nextSteps = Array.isArray(data?.next_steps) ? data.next_steps : [];
  const owners = data?.owners || [];

  return (
    <section className="mt-4 rounded-xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-[var(--rd-ai)]" />
        <h3 className="text-sm font-semibold text-[var(--rd-text)]">
          {TOOL_LABELS.executive_brief}
        </h3>
      </div>
      {title && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-1">Title</p>
          <p className="text-sm font-medium text-[var(--rd-text)]">{escapeHtml(title)}</p>
        </div>
      )}
      {summary && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-1">Summary</p>
          <p className="text-sm text-[var(--rd-text)] leading-relaxed whitespace-pre-wrap break-words">
            {escapeHtml(summary)}
          </p>
        </div>
      )}
      {keyPoints.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-2">Key Points</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--rd-text)]">
            {keyPoints.map((point, i) => (
              <li key={i} className="leading-relaxed">{escapeHtml(point)}</li>
            ))}
          </ul>
        </div>
      )}
      {risks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-2">Risks</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--rd-text)]">
            {risks.map((risk, i) => (
              <li key={i} className="leading-relaxed">{escapeHtml(risk)}</li>
            ))}
          </ul>
        </div>
      )}
      {nextSteps.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-2">Next Steps</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--rd-text)]">
            {nextSteps.map((step, i) => (
              <li key={i} className="leading-relaxed">{escapeHtml(step)}</li>
            ))}
          </ul>
        </div>
      )}
      {owners.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wide mb-2">Owners</p>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--rd-text-muted)]">
            {owners.map((owner, i) => (
              <span key={i} className="rounded-md border border-[var(--rd-border-soft)] px-2 py-0.5 bg-[var(--rd-bg)]">
                {escapeHtml(owner)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function renderArtifactCard(message) {
  const artifactType = message?.artifact_type || message?.tool;
  const artifactData = message?.artifact_data || message?.metadata?.artifact;

  if (!artifactType || !artifactData) return null;

  switch (artifactType) {
    case "sales_bid_decision":
      return renderBidScorecard(artifactData);
    case "executive_brief":
      return renderExecutiveBrief(artifactData);
    case "pid_review":
    case "document_analysis":
    case "revision_compare":
      return (
        <section className="mt-4 rounded-xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[var(--rd-ai)]" />
            <h3 className="text-sm font-semibold text-[var(--rd-text)]">
              {TOOL_LABELS[artifactType] || artifactType}
            </h3>
          </div>
          <div className="text-sm text-[var(--rd-text)] whitespace-pre-wrap break-words leading-relaxed">
            {typeof artifactData === "string"
              ? escapeHtml(artifactData)
              : JSON.stringify(artifactData, null, 2)}
          </div>
        </section>
      );
    default:
      return null;
  }
}

export default function AssistantMessageCard({
  message,
  projectId,
  status: overrideStatus,
  onApprove,
  onFlag,
  onReject,
}) {
  const status = overrideStatus || message?.status || "pending";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isAssistant = message.role === "assistant";
  const hasSources = message.sources && message.sources.length > 0;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const markdownComponents = {
    h1: ({ children }) => <h1 className="mt-4 mb-2 text-lg font-semibold text-[var(--rd-text)]">{children}</h1>,
    h2: ({ children }) => <h2 className="mt-3 mb-1 text-base font-semibold text-[var(--rd-text)]">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold text-[var(--rd-text)]">{children}</h3>,
    p: ({ children }) => <p className="mb-2 last:mb-0 text-sm text-[var(--rd-text)] leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="mb-2 list-disc pl-5 text-sm text-[var(--rd-text)]">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 text-sm text-[var(--rd-text)]">{children}</ol>,
    li: ({ children }) => <li className="mb-1 leading-relaxed">{children}</li>,
    pre: ({ children }) => (
      <pre className="my-2 overflow-x-auto rounded-lg bg-[var(--rd-surface-subtle)] p-3 text-xs">{children}</pre>
    ),
    code: ({ children, inline }) => {
      if (inline) return <code className="text-xs font-mono bg-[var(--rd-bg)] px-1 py-0.5 rounded">{children}</code>;
      return (
        <code className="block text-xs font-mono bg-[var(--rd-bg)] p-3 rounded overflow-x-auto">
          {children}
        </code>
      );
    },
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs text-[var(--rd-text)]">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-[var(--rd-border-soft)] p-2 text-left text-[var(--rd-text-muted)] font-medium uppercase tracking-wider">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-[var(--rd-border-soft)] p-2 text-[var(--rd-text)]">{children}</td>
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
  };

  const content = isAssistant ? message.content : "";

  return (
    <div
      key={message.id || `msg-${Date.now()}`}
      className={
        isAssistant
          ? "max-w-[90%] text-sm leading-7"
          : "ml-auto max-w-[85%] rounded-xl bg-[var(--rd-surface-subtle)] px-4 py-3 text-sm leading-6"
      }
    >
      <p className="mb-1 text-xs font-semibold text-[var(--rd-text-muted)]">
        {isAssistant ? "RADAI" : "You"}
      </p>

      {isAssistant ? (
        <>
          <div className="relative">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>

          {message.artifact_type && renderArtifactCard(message)}

          {hasSources && (
            <div className="mt-3 border-t border-[var(--rd-border-soft)] pt-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  aria-label="View source citations"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rd-primary)] hover:text-[var(--rd-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                  onClick={() => setDrawerOpen(true)}
                >
                  <FileText size={12} className="shrink-0" />
                  Sources considered ({hasSources})
                </button>
                <span className="text-[var(--rd-text-faint)] text-[xs]">
                  {message.partial_coverage ? "Partial coverage" : "Full coverage"}
                </span>
              </div>
            </div>
          )}
          {!hasSources && (
            <p className="mt-3 text-xs text-[var(--rd-text-muted)]">
              No project sources were retrieved for this answer.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--rd-border-soft)]">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${config.bg} ${config.border} ${config.color}`}>
              {config.label}
            </span>
            {status === "pending" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={onApprove ? false : true}
                  aria-label="Approve and save to project record"
                  title={onApprove ? "Approve & Save to Project Record" : "Record promotion not yet enabled"}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] ${
                    onApprove
                      ? "bg-[var(--rd-primary)] text-white border-[var(--rd-primary)] hover:bg-[var(--rd-primary-hover)]"
                      : "border-[var(--rd-border-soft)] text-[var(--rd-text-muted)] bg-[var(--rd-bg)] cursor-not-allowed opacity-70"
                  }`}
                  onClick={onApprove}
                >
                  <Save size={12} className="shrink-0" />
                  Approve & Save
                </button>
                <button
                  type="button"
                  disabled={onFlag ? false : true}
                  aria-label="Flag for review"
                  title={onFlag ? "Flag for Review" : "Review flagging not yet enabled"}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] ${
                    onFlag
                      ? "bg-[var(--rd-surface-subtle)] text-[var(--rd-text-muted)] border-[var(--rd-border-soft)] hover:bg-[var(--rd-bg)]"
                      : "border-[var(--rd-border-soft)] text-[var(--rd-text-muted)] bg-[var(--rd-bg)] cursor-not-allowed opacity-70"
                  }`}
                  onClick={onFlag}
                >
                  <Flag size={12} className="shrink-0" />
                  Flag
                </button>
                {status === "pending" && (
                  <span className="text-[var(--rd-text-faint)] text-[xs]">
                    Awaiting review · not yet a project record
                  </span>
                )}
              </div>
            )}
          </div>

          {drawerOpen && (
            <CitationDrawer
              sources={message.sources}
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            />
          )}
        </>
      ) : (
        <p className="whitespace-pre-wrap break-words">{content}</p>
      )}
    </div>
  );
}
