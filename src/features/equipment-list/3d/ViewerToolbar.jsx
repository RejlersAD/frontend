import React, { useEffect, useRef, useState } from "react";
import { COLOR_MODES } from "./colors";

const btn = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--rd-border, #cbd5e1)",
  background: "var(--rd-surface, #fff)",
  color: "var(--rd-text, #0f172a)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

function Segmented({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: "inline-flex",
        border: "1px solid var(--rd-border, #cbd5e1)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          style={{
            border: "none",
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background:
              value === option.id
                ? "var(--rd-accent, #2563eb)"
                : "var(--rd-surface, #fff)",
            color: value === option.id ? "#fff" : "var(--rd-text, #0f172a)",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: "var(--rd-text, #0f172a)",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

const VIEW_OPTIONS = [
  { id: "iso", label: "Iso" },
  { id: "plan", label: "Plan" },
  { id: "north", label: "North" },
  { id: "east", label: "East" },
];

export function ViewerToolbar({
  colorMode,
  onColorMode,
  toggles,
  onToggle,
  view,
  onView,
  onReset,
  onZoomIn,
  onZoomOut,
  onFit,
  onExport,
  canExport,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const close = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderBottom: "1px solid var(--rd-border-soft, #e2e8f0)",
        background: "var(--rd-surface, #fff)",
      }}
    >
      <Segmented
        label="Colour by"
        options={COLOR_MODES}
        value={colorMode}
        onChange={onColorMode}
      />
      <Toggle
        label="Lines"
        checked={toggles.lines}
        onChange={(v) => onToggle("lines", v)}
      />
      <Toggle
        label="Pipe rack"
        checked={toggles.rack}
        onChange={(v) => onToggle("rack", v)}
      />
      <Toggle
        label="Labels"
        checked={toggles.labels}
        onChange={(v) => onToggle("labels", v)}
      />
      <Toggle
        label="Tree"
        checked={toggles.tree}
        onChange={(v) => onToggle("tree", v)}
      />
      <Toggle
        label="Fade filtered"
        checked={toggles.fade}
        onChange={(v) => onToggle("fade", v)}
      />
      <Segmented
        label="Views"
        options={VIEW_OPTIONS}
        value={view}
        onChange={onView}
      />
      <div role="group" aria-label="Camera" style={{ display: "inline-flex", gap: 4 }}>
        <button type="button" style={btn} onClick={onReset} title="Reset view">
          ⟲
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => onView("iso")}
          title="Isometric view"
        >
          ⟳
        </button>
        <button type="button" style={btn} onClick={onZoomOut} title="Zoom out">
          −
        </button>
        <button type="button" style={btn} onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <button type="button" style={btn} onClick={onFit} title="Fit to model">
          Fit
        </button>
      </div>
      <div style={{ flex: 1 }} />
      {canExport && (
        <div ref={exportRef} style={{ position: "relative" }}>
          <button
            type="button"
            style={btn}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((v) => !v)}
          >
            Export 3D ▾
          </button>
          {exportOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--rd-surface, #fff)",
                border: "1px solid var(--rd-border-soft, #e2e8f0)",
                borderRadius: 8,
                boxShadow: "var(--rd-shadow-overlay, 0 20px 50px -12px rgba(15,23,42,0.35))",
                minWidth: 160,
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              {[
                ["glb", "glTF (.glb)"],
                ["ifc", "IFC 4 (.ifc)"],
              ].map(([format, label]) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    onExport?.(format);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    padding: "8px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                    color: "var(--rd-text, #0f172a)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
