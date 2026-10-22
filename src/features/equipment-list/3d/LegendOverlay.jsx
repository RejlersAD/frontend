import React from "react";
import { legendEntries, COLOR_MODES } from "./colors";

/** Floating legend (bottom-left) following the Colour-by mode. */
export function LegendOverlay({ colorMode, systems, systemIndex }) {
  const entries = legendEntries(colorMode, { systems, systemIndex });
  const modeLabel =
    COLOR_MODES.find((mode) => mode.id === colorMode)?.label || "Type";
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        background: "var(--rd-surface, #fff)",
        borderRadius: 8,
        boxShadow: "var(--rd-shadow-overlay, 0 20px 50px -12px rgba(15,23,42,0.35))",
        border: "1px solid var(--rd-border-soft, #e2e8f0)",
        color: "var(--rd-text, #0f172a)",
        padding: "8px 10px",
        fontSize: 12,
        zIndex: 10,
        maxWidth: 240,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 6,
          color: "var(--rd-text-muted, #475569)",
        }}
      >
        Colour by: {modeLabel}
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        {entries.map((entry) => (
          <div
            key={entry.label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: entry.color,
                flexShrink: 0,
              }}
            />
            <span>{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
