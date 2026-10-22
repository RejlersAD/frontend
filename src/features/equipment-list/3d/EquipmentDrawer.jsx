import React from "react";

const STATUS_PILL = {
  validated: { background: "#d8f7df", color: "#16723b", label: "Validated" },
  changed: { background: "#dceeff", color: "#1467b3", label: "Changed" },
  warning: { background: "#fff1c7", color: "#9a4d00", label: "Warning" },
  error: { background: "#ffd9dc", color: "#b4232d", label: "Error" },
  pending: { background: "#edf1f5", color: "#40536d", label: "Pending" },
};

function Pill({ children, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: "var(--rd-surface-subtle, #f1f5f9)",
        color: "var(--rd-text-muted, #475569)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid var(--rd-border-soft, #e2e8f0)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--rd-text-muted, #475569)", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ textAlign: "right", minWidth: 0 }}>{children}</span>
    </div>
  );
}

function formatSize(item) {
  const d = item.dims || {};
  const parts = [];
  if (d.diameter) parts.push(`Ø${d.diameter}`);
  if (d.length) parts.push(`L${d.length}`);
  if (d.width) parts.push(`W${d.width}`);
  if (d.height) parts.push(`H${d.height}`);
  return parts.length ? `${parts.join(" × ")} m` : "—";
}

/** Right drawer (360 px, absolute over the viewer) shown on selection. */
export function EquipmentDrawer({
  item,
  connectedLines = [],
  onClose,
  onOpenInRegister,
  onOpenPid,
  onSelectLine,
}) {
  if (!item) return null;
  const status = STATUS_PILL[item.status] || STATUS_PILL.pending;
  const pos = item.position || { x: 0, y: 0, z: 0 };
  const sheet = item.sourceSheet;

  return (
    <aside
      aria-label={`Equipment ${item.tag} details`}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 360,
        background: "var(--rd-surface, #fff)",
        color: "var(--rd-text, #0f172a)",
        borderRadius: 8,
        boxShadow: "var(--rd-shadow-overlay, 0 20px 50px -12px rgba(15,23,42,0.35))",
        border: "1px solid var(--rd-border-soft, #e2e8f0)",
        display: "flex",
        flexDirection: "column",
        zIndex: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--rd-border-soft, #e2e8f0)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{item.tag}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--rd-text-muted, #475569)",
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--rd-text-muted, #475569)",
            marginTop: 2,
          }}
        >
          {item.description || "No description"}
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
        >
          <Pill style={{ background: status.background, color: status.color }}>
            {status.label}
          </Pill>
          <Pill>
            {pos.source === "plotplan" ? "Plot plan" : "Auto-placed"}
          </Pill>
          {item.defaultSize && <Pill>Default size</Pill>}
          {(item.systems || []).map((sys) => (
            <Pill key={sys}>{sys}</Pill>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 16px", overflowY: "auto", flex: 1 }}>
        <Row label="Type">{item.typeLabel || item.typeCode || "Unknown"}</Row>
        <Row label="Unit">{item.unit || "—"}</Row>
        <Row label="Position (E, N, El)">
          {`${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`}
        </Row>
        <Row label="Size">{formatSize(item)}</Row>
        <Row label="Confidence">
          {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}
        </Row>
        <Row label="Connected lines">
          {connectedLines.length ? (
            <span style={{ display: "grid", gap: 2 }}>
              {connectedLines.map((line) => (
                <button
                  key={line.lineNo}
                  type="button"
                  onClick={() => onSelectLine?.(line)}
                  style={{
                    border: "none",
                    background: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--rd-accent, #2563eb)",
                    fontSize: 12,
                    fontFamily: "var(--rd-font-mono, monospace)",
                    textAlign: "right",
                  }}
                >
                  {line.lineNo}
                </button>
              ))}
            </span>
          ) : (
            "0"
          )}
        </Row>
        <Row label="Systems">
          {(item.systems || []).length ? item.systems.join(", ") : "—"}
        </Row>

        {sheet && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--rd-border-soft, #e2e8f0)",
              background: "var(--rd-surface-subtle, #f1f5f9)",
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Source</div>
            <div>
              {sheet.dwgNo || "—"} · Rev {sheet.rev || "—"}
            </div>
            {sheet.page != null && <div>Sheet {sheet.page}</div>}
            {sheet.clientDwgNo && (
              <div style={{ color: "var(--rd-text-muted, #475569)" }}>
                Client: {sheet.clientDwgNo}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid var(--rd-border-soft, #e2e8f0)",
        }}
      >
        <button
          type="button"
          onClick={() => onOpenPid?.(sheet)}
          disabled={!sheet}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--rd-border, #cbd5e1)",
            background: "var(--rd-surface, #fff)",
            color: "var(--rd-text, #0f172a)",
            cursor: sheet ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Open on P&ID
        </button>
        <button
          type="button"
          onClick={() => onOpenInRegister?.(item.tag)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "none",
            background: "var(--rd-accent, #2563eb)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Open in register
        </button>
      </div>
    </aside>
  );
}
