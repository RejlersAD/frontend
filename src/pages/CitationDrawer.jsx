import { useState } from "react";
import { ChevronDown, FileText, Link, Copy, ShieldAlert, Clock, X } from "lucide-react";

const APPROVAL_BADGE = {
  unverified: { label: "Unverified", className: "bg-[var(--rd-surface-subtle)] text-[var(--rd-text-faint)] border border-[var(--rd-border-soft)]" },
  approved: { label: "Approved", className: "bg-[var(--rd-surface-subtle)] text-[var(--rd-text)] border border-[var(--rd-border-soft)]" },
  pending: { label: "Pending", className: "bg-[var(--rd-surface-subtle)] text-[var(--rd-text-muted)] border border-[var(--rd-border-soft)]" },
  rejected: { label: "Rejected", className: "bg-[var(--rd-surface-subtle)] text-[var(--rd-danger)] border border-[var(--rd-border-soft)]" },
};

export default function CitationDrawer({ sources = [], open = false, onClose }) {
  const [expanded, setExpanded] = useState(new Set());

  if (!open) return null;

  const toggle = (id) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isExpanded = (id) => expanded.has(id);
  const badge = (approval) => {
    const style = APPROVAL_BADGE[approval] || APPROVAL_BADGE.unverified;
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${style.className}`}
      >
        {style.label}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Source citations"
    >
      <button
        type="button"
        aria-label="Close citations"
        className="absolute inset-0 bg-[var(--rd-bg)]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="w-full max-w-2xl bg-[var(--rd-surface)] border border-[var(--rd-border-soft)] shadow-[var(--rd-shadow-card)] rounded-t-xl mb-4 flex flex-col h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rd-border-soft)]">
          <h2 className="text-sm font-semibold text-[var(--rd-text)]">
            Source Citations ({sources.length})
          </h2>
          <button
            type="button"
            aria-label="Close citations"
            className="rounded-lg p-1.5 text-[var(--rd-text-muted)] hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sources.length === 0 ? (
            <p className="text-sm text-[var(--rd-text-muted)] text-center py-8">
              No source citations available for this answer.
            </p>
          ) : (
            sources.map((source, index) => {
              const id = `citation-${index}`;
              const isOpen = isExpanded(id);
              return (
                <div
                  key={id}
                  className="rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-bg)] overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Toggle citation ${index + 1}`}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--rd-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                    onClick={() => toggle(id)}
                  >
                    <FileText size={14} className="shrink-0 text-[var(--rd-text-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--rd-text)] truncate">
                        {source.document}
                      </p>
                      <p className="text-xs text-[var(--rd-text-muted)] flex items-center gap-1">
                        {source.revision ? (
                          <>
                            <Clock size={10} className="shrink-0" />
                            v{source.revision}&nbsp;
                          </>
                        ) : null}
                        {source.location && (
                          <>
                            <Link size={10} className="shrink-0" />
                            {source.location}
                          </>
                        )}
                      </p>
                    </div>
                    {badge(source.approval)}
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-[var(--rd-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--rd-border-soft)] bg-[var(--rd-surface-subtle)] px-3 pb-3">
                      <div className="space-y-2">
                        {source.excerpt || source.quote ? (
                          <div>
                            <p className="text-xs font-semibold text-[var(--rd-text-muted)] uppercase tracking-wider mb-1">
                              Quoted evidence
                            </p>
                            <blockquote className="border-l-2 border-[var(--rd-primary-soft)] pl-3 py-1.5 text-sm text-[var(--rd-text)] italic bg-[var(--rd-bg)]/30 rounded-r-sm">
                              {source.excerpt || source.quote}
                            </blockquote>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 text-xs text-[var(--rd-text-faint)]">
                          <span>Source ID: {source.source_id || "—"}</span>
                          {source.page && (
                            <span>· Page {source.page}</span>
                          )}
                          <button
                            type="button"
                            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[var(--rd-primary)] hover:bg-[var(--rd-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigator.clipboard.writeText(
                                `${source.document} · ${source.location || ""}`,
                              );
                            }}
                            title="Copy citation"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
