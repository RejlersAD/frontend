import { useCallback, useEffect, useRef, useState } from "react";
import { parseTag, parseLineNo, npsToRadiusM } from "./parse";
import { resolveDims, footprintOf, typeCodeFromName, shapeFor } from "./shapes";
import { autoLayout, routeLine } from "./layout";
import { fetchModel3d, refreshModel3d, MODEL_STEPS } from "./mockModel3d";

/** Map a page status string to the 3D contract status. */
function mapStatus(row) {
  const raw = String(row?.status || "").toLowerCase();
  if (raw === "validated" || raw === "reviewed") return "validated";
  if (raw === "changed" || raw === "new") return "changed";
  if (raw === "warning" || raw === "warnings") return "warning";
  if (raw === "error") return "error";
  return row?.review_state === "reviewed" ? "validated" : "pending";
}

/** Map a register row (Equipment tab shape) to the 3D equipment contract. */
export function mapRegisterRow(row, enrichment) {
  const parsed = parseTag(row.tag);
  const typeCode =
    parsed?.typeCode || typeCodeFromName(row.equipment_type || row.type) || "";
  let confidence = row.confidence;
  if (typeof confidence === "number" && confidence > 1)
    confidence = confidence / 100;
  return {
    tag: row.tag || "",
    unit: parsed?.unit || "",
    typeCode,
    seq: parsed?.seq ?? 0,
    suffix: parsed?.suffix || "",
    description: row.description || "",
    status: mapStatus(row),
    confidence: typeof confidence === "number" ? confidence : null,
    sourceSheet: row.pid_no
      ? { dwgNo: row.pid_no, rev: row.rev || "—", page: row.page ?? null }
      : enrichment?.sourceSheet || null,
    systems: row.systems || enrichment?.systems || [],
    position: enrichment?.position,
    dims: row.dims || enrichment?.dims,
    changed:
      Boolean(row._changed) || String(row.status || "").toLowerCase() === "changed",
    validation: row._error
      ? "errors"
      : row._warning
        ? "warnings"
        : "pass",
    unparsed: !parsed,
  };
}

function buildModel(payload, registerRows) {
  const enrichmentByTag = new Map(
    (payload.equipment || []).map((item) => [item.tag, item]),
  );
  // Prefer the live register rows when present; fall back to the model feed.
  let items;
  if (registerRows && registerRows.length) {
    items = registerRows.map((row) =>
      mapRegisterRow(row, enrichmentByTag.get(row.tag)),
    );
  } else {
    items = (payload.equipment || []).map((item) => {
      const parsed = parseTag(item.tag);
      return {
        seq: parsed?.seq ?? 0,
        suffix: parsed?.suffix || "",
        changed: item.status === "changed",
        validation: item.status === "error"
          ? "errors"
          : item.status === "warning"
            ? "warnings"
            : "pass",
        unparsed: !parsed,
        ...item,
        unit: item.unit || parsed?.unit || "",
        typeCode: item.typeCode || parsed?.typeCode || "",
      };
    });
  }

  // Resolve dims + footprints before layout.
  const reviewItems = [];
  const defaultSizeTags = [];
  for (const item of items) {
    const { dims, defaultSize, shape } = resolveDims(item.typeCode, item.dims);
    item.dims = dims;
    item.shapeKind = shape.kind;
    item.typeLabel = shape.label;
    item.defaultSize = defaultSize;
    item.footprint = footprintOf(dims);
    item.height = dims.height || dims.diameter || 2;
    if (defaultSize) defaultSizeTags.push(item.tag);
  }

  const { positions, autoPlacedByUnit, autoPlacedCount } = autoLayout(items);
  for (const item of items) {
    item.position = positions.get(item.tag) || {
      x: 0,
      y: -14,
      z: 0,
      rotationDeg: 0,
      source: "auto",
    };
  }

  // Route lines between known endpoints.
  const itemsByTag = new Map(items.map((item) => [item.tag, item]));
  const lines = (payload.lines || []).map((line) => {
    const parsed = parseLineNo(line.lineNo) || {};
    const from = line.fromTag ? itemsByTag.get(line.fromTag) : null;
    const to = line.toTag ? itemsByTag.get(line.toTag) : null;
    const routed = Boolean(line.fromTag && line.toTag && from && to);
    return {
      ...line,
      ...parsed,
      nps: line.nps || parsed.nps,
      radius: npsToRadiusM(line.nps || parsed.nps || 2),
      routed,
      path: routed ? routeLine(from, to) : null,
    };
  });
  const notRouted = lines.filter((line) => !line.routed);

  // Review items (category "3D model").
  for (const [unit, count] of [...autoPlacedByUnit.entries()].sort()) {
    reviewItems.push({
      id: `auto-placed-${unit}`,
      category: "3D model",
      title: `Equipment auto-placed (${count} item${count === 1 ? "" : "s"})`,
      detail: `Unit ${unit} — positions are automatic until a plot plan is uploaded.`,
    });
  }
  if (defaultSizeTags.length) {
    reviewItems.push({
      id: "default-size",
      category: "3D model",
      title: `Default size used (${defaultSizeTags.length} items)`,
      detail: defaultSizeTags.slice(0, 12).join(", ") +
        (defaultSizeTags.length > 12 ? "…" : ""),
      tag: defaultSizeTags[0],
    });
  }
  for (const line of notRouted) {
    reviewItems.push({
      id: `line-not-routed-${line.lineNo}`,
      category: "3D model",
      title: "Line not routed (missing from/to)",
      detail: line.lineNo,
    });
  }
  for (const item of items.filter((entry) => entry.unparsed)) {
    reviewItems.push({
      id: `unparsed-${item.tag}`,
      category: "3D model",
      title: "Unparsed tag",
      detail: item.tag,
      tag: item.tag,
    });
  }

  const systemIndex = new Map();
  [...new Set(items.flatMap((item) => item.systems || []))]
    .sort()
    .forEach((sys, index) => systemIndex.set(sys, index));

  return {
    items,
    lines,
    rev: payload.rev || "—",
    builtAt: payload.builtAt || new Date().toISOString(),
    hasPlotPlan: Boolean(payload.hasPlotPlan),
    stats: {
      total: items.length,
      autoPlaced: autoPlacedCount,
      lines: lines.length,
      routed: lines.length - notRouted.length,
      notRouted: notRouted.length,
    },
    systemIndex,
    reviewItems,
  };
}

/**
 * Fetch + build the 3D model with progress state.
 * @param {{ registerId?: string|number, registerRows?: Array,
 *   rowsKey?: string }} options rowsKey identifies register content.
 */
export function useEquipmentModel({ registerId, registerRows, rowsKey } = {}) {
  const [state, setState] = useState({
    status: "idle", // idle | building | ready | error
    step: null,
    model: null,
    error: null,
  });
  const rowsRef = useRef(registerRows);
  rowsRef.current = registerRows;
  const cancelledRef = useRef(false);

  const build = useCallback(
    async (refresh = false) => {
      cancelledRef.current = false;
      setState((prev) => ({
        ...prev,
        status: "building",
        step: MODEL_STEPS[0].id,
        error: null,
      }));
      try {
        const fetcher = refresh ? refreshModel3d : fetchModel3d;
        const payload = await fetcher(registerId, (step) => {
          if (!cancelledRef.current)
            setState((prev) => ({ ...prev, step }));
        });
        if (cancelledRef.current) return;
        const model = buildModel(payload, rowsRef.current);
        setState({ status: "ready", step: null, model, error: null });
      } catch (error) {
        if (!cancelledRef.current)
          setState({
            status: "error",
            step: null,
            model: null,
            error: error?.message || "build failed",
          });
      }
    },
    [registerId],
  );

  useEffect(() => {
    build();
    return () => {
      cancelledRef.current = true;
    };
    // rowsKey identifies register content; registerId identifies the register.
  }, [build, rowsKey]);

  return {
    ...state,
    steps: MODEL_STEPS,
    refresh: () => build(true),
    retry: () => build(false),
  };
}
