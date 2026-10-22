import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEquipmentModel } from "./useEquipmentModel";
import { Viewer3D } from "./Viewer3D";
import { ViewerToolbar } from "./ViewerToolbar";
import { ModelTreeOverlay } from "./ModelTreeOverlay";
import { LegendOverlay } from "./LegendOverlay";
import { EquipmentDrawer } from "./EquipmentDrawer";
import { exportModel3d } from "./mockModel3d";

const viewerHeight = "max(520px, calc(100vh - 340px))";

function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const center = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: viewerHeight,
  color: "var(--rd-text-muted, #475569)",
  background: "var(--rd-surface-subtle, #f1f5f9)",
  borderRadius: 8,
};

/**
 * "3D View" workspace tab for the Equipment List page.
 * Shares filters and selection with the Equipment tab.
 */
export default function EquipmentList3DTab({
  equipment = [], // filtered register rows (page filters applied)
  allEquipment = [], // unfiltered register rows
  referenceFilters,
  selectedEquipment,
  setSelectedEquipment,
  registerRecord,
  role = "Engineer",
  onReviewItems,
  onOpenInRegister,
  onOpenPid,
  onGoToEquipment,
}) {
  const registerId = registerRecord?.id ?? registerRecord?.register_id;
  const canModify = role === "Engineer" || role === "Admin";
  const webgl = useMemo(isWebGLAvailable, []);
  const dark = useMemo(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
    [],
  );

  const rowsKey = useMemo(
    () => allEquipment.map((row) => row.tag || row.id).join("|"),
    [allEquipment],
  );
  const { status, step, steps, model, refresh, retry } = useEquipmentModel({
    registerId,
    registerRows: allEquipment,
    rowsKey,
  });

  const [colorMode, setColorMode] = useState("type");
  const [toggles, setToggles] = useState({
    lines: false,
    rack: true,
    labels: true,
    tree: true,
    fade: true,
  });
  const [view, setView] = useState("iso");
  const [frameRequest, setFrameRequest] = useState(null);
  const controllerRef = useRef(null);
  const uploadRef = useRef(null);

  // Publish 3D review items into the page's Reviews tab.
  const reviewItems = model?.reviewItems;
  useEffect(() => {
    onReviewItems?.(reviewItems || []);
    return () => onReviewItems?.([]);
  }, [reviewItems, onReviewItems]);

  const items = useMemo(() => model?.items || [], [model]);

  // Tags passing the page filters; null disables filtering (mock-only mode
  // where the register has no rows at all).
  const filteredTags = useMemo(() => {
    if (!allEquipment.length) return null;
    return new Set(equipment.map((row) => row.tag));
  }, [equipment, allEquipment]);

  const selectedTag = selectedEquipment?.tag || null;
  const selectedItem = useMemo(
    () => items.find((item) => item.tag === selectedTag) || null,
    [items, selectedTag],
  );

  const frameItem = useCallback((item) => {
    if (!item) return;
    setFrameRequest({
      x: item.position.x,
      y: item.position.y,
      z: item.position.z,
      height: item.height,
      nonce: Date.now(),
    });
  }, []);

  const handleSelect = useCallback(
    (item) => {
      if (!item) {
        setSelectedEquipment?.(null);
        return;
      }
      const row = allEquipment.find((entry) => entry.tag === item.tag);
      setSelectedEquipment?.(
        row || { tag: item.tag, description: item.description },
      );
      frameItem(item);
    },
    [allEquipment, setSelectedEquipment, frameItem],
  );

  // Keep the 3D view framed on the row selected in the Equipment tab.
  useEffect(() => {
    if (selectedItem) frameItem(selectedItem);
    // Only re-frame when the selected tag changes.
  }, [selectedTag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc clears, F frames the selected item.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target && /^(input|textarea|select)$/i.test(event.target.tagName))
        return;
      if (event.key === "Escape") setSelectedEquipment?.(null);
      if (event.key === "f" || event.key === "F") {
        if (selectedItem) frameItem(selectedItem);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedItem, frameItem, setSelectedEquipment]);

  const handleExport = useCallback(
    async (format) => {
      try {
        const blob = await exportModel3d(registerId, format);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `equipment-model-${registerId || "draft"}.${format}`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch {
        window.alert("The 3D export is not available yet.");
      }
    },
    [registerId],
  );

  const handleUploadPlotPlan = useCallback(() => {
    uploadRef.current?.click();
  }, []);

  const connectedLines = useMemo(() => {
    if (!selectedItem || !model) return [];
    return model.lines.filter(
      (line) =>
        line.fromTag === selectedItem.tag || line.toTag === selectedItem.tag,
    );
  }, [selectedItem, model]);

  const systems = useMemo(
    () => (model?.systemIndex ? [...model.systemIndex.keys()] : []),
    [model],
  );

  const units = useMemo(
    () => [...new Set(items.map((item) => item.unit || "0000"))].sort(),
    [items],
  );

  const shownCount = useMemo(() => {
    if (!filteredTags) return items.length;
    return items.filter((item) => filteredTags.has(item.tag)).length;
  }, [items, filteredTags]);

  if (!webgl) {
    return (
      <div className="p-5 border-t" style={{ borderColor: "#e1e9f1" }}>
        <div style={center} role="alert">
          <div style={{ fontSize: 28 }}>🖥️</div>
          <div style={{ fontWeight: 700, color: "var(--rd-text, #0f172a)" }}>
            3D view needs WebGL. Use a recent Chrome, Edge or Firefox.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 border-t" style={{ borderColor: "#e1e9f1" }}>
      <ViewerToolbar
        colorMode={colorMode}
        onColorMode={setColorMode}
        toggles={toggles}
        onToggle={(key, value) =>
          setToggles((prev) => ({ ...prev, [key]: value }))
        }
        view={view}
        onView={setView}
        onReset={() => controllerRef.current?.reset()}
        onZoomIn={() => controllerRef.current?.zoom(0.8)}
        onZoomOut={() => controllerRef.current?.zoom(1.25)}
        onFit={() => controllerRef.current?.fitAll()}
        onExport={handleExport}
        canExport={canModify}
      />

      {status === "error" && (
        <div style={center} role="alert">
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: "var(--rd-text, #0f172a)" }}>
            The 3D model could not be built.
          </div>
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--rd-accent, #2563eb)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {status === "building" && (
        <div style={center} aria-busy="true">
          <div
            style={{
              fontWeight: 700,
              color: "var(--rd-text, #0f172a)",
              marginBottom: 8,
            }}
          >
            Building 3D model…
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {steps.map((s) => {
              const stepIndex = steps.findIndex((entry) => entry.id === step);
              const thisIndex = steps.findIndex((entry) => entry.id === s.id);
              const state =
                thisIndex < stepIndex
                  ? "done"
                  : thisIndex === stepIndex
                    ? "active"
                    : "pending";
              return (
                <li
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color:
                      state === "pending"
                        ? "var(--rd-text-faint, #94a3b8)"
                        : "var(--rd-text, #0f172a)",
                    fontWeight: state === "active" ? 700 : 400,
                  }}
                >
                  <span aria-hidden>
                    {state === "done" ? "✓" : state === "active" ? "◌" : "·"}
                  </span>
                  {s.label}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {status === "ready" && model && items.length === 0 && (
        <div style={center}>
          <div style={{ fontSize: 28 }}>📦</div>
          <div style={{ fontWeight: 700, color: "var(--rd-text, #0f172a)" }}>
            No equipment to show in 3D
          </div>
          <div style={{ fontSize: 13 }}>
            Upload P&amp;IDs on the Equipment tab to build the register first.
          </div>
          <button
            type="button"
            onClick={onGoToEquipment}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--rd-accent, #2563eb)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Equipment
          </button>
        </div>
      )}

      {status === "ready" && model && items.length > 0 && (
        <>
          {!model.hasPlotPlan && model.stats.autoPlaced > 0 && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                margin: "12px 0 0",
                borderRadius: 8,
                background: "var(--rd-warning-soft, #fffbeb)",
                border: "1px solid var(--rd-warning, #d97706)",
                color: "#7a4300",
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1 }}>
                Equipment auto-placed — upload a plot plan for real positions.
              </span>
              {canModify && (
                <button
                  type="button"
                  onClick={handleUploadPlotPlan}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--rd-warning, #d97706)",
                    background: "var(--rd-surface, #fff)",
                    color: "#7a4300",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Upload plot plan
                </button>
              )}
            </div>
          )}
          <div
            style={{
              position: "relative",
              height: viewerHeight,
              marginTop: 12,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--rd-border-soft, #e2e8f0)",
            }}
          >
            <Viewer3D
              items={items}
              lines={model.lines}
              units={units}
              colorMode={colorMode}
              systemIndex={model.systemIndex}
              showLines={toggles.lines}
              showRack={toggles.rack}
              showLabels={toggles.labels}
              fadeFiltered={toggles.fade}
              filteredTags={filteredTags}
              selectedTag={selectedTag}
              view={view}
              frameRequest={frameRequest}
              controllerRef={controllerRef}
              onSelect={handleSelect}
              dark={dark}
            />
            {toggles.tree && (
              <ModelTreeOverlay
                items={items}
                groupBy={colorMode === "system" ? "system" : "type"}
                selectedTag={selectedTag}
                onSelect={handleSelect}
              />
            )}
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 11,
                background: "#fff1c7",
                color: "#9a4d00",
                border: "1px solid #f3c66d",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                pointerEvents: "none",
              }}
            >
              PRELIMINARY — NOT FOR CONSTRUCTION
            </div>
            <LegendOverlay
              colorMode={colorMode}
              systems={systems}
              systemIndex={model.systemIndex}
            />
            {selectedItem && (
              <EquipmentDrawer
                item={selectedItem}
                connectedLines={connectedLines}
                onClose={() => setSelectedEquipment?.(null)}
                onOpenInRegister={onOpenInRegister}
                onOpenPid={onOpenPid}
              />
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 14,
              padding: "8px 4px 0",
              fontSize: 12,
              color: "var(--rd-text-muted, #475569)",
            }}
          >
            <span>
              Equipment {shownCount}/{model.stats.total}
            </span>
            <span>Auto-placed {model.stats.autoPlaced}</span>
            <span>Lines {toggles.lines ? model.stats.routed : 0}</span>
            <span>Not routed {model.stats.notRouted}</span>
            <span>
              Model {model.rev} · {new Date(model.builtAt).toLocaleString()}
            </span>
            <span style={{ flex: 1 }} />
            {canModify && (
              <button
                type="button"
                onClick={refresh}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--rd-border, #cbd5e1)",
                  background: "var(--rd-surface, #fff)",
                  color: "var(--rd-text, #0f172a)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Refresh model
              </button>
            )}
          </div>
          <input
            ref={uploadRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            style={{ display: "none" }}
            onChange={() =>
              window.alert(
                "Plot plan upload will post to the register endpoint once the API is available.",
              )
            }
          />
        </>
      )}
    </div>
  );
}
