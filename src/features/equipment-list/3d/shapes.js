/**
 * Equipment type → parametric shape + default dimensions (metres).
 * Dims from the register win; defaults set defaultSize=true.
 */

export const TYPE_SHAPES = {
  C: { kind: "column", label: "Column", defaults: { diameter: 3.0, height: 30.0 } },
  D: { kind: "drum", label: "Drum", defaults: { diameter: 2.4, length: 7.0 } },
  E: { kind: "exchanger", label: "Exchanger", defaults: { diameter: 1.2, length: 6.0 } },
  EA: { kind: "airCooler", label: "Air cooler", defaults: { width: 5, length: 5, height: 1.5 } },
  G: { kind: "pump", label: "Pump", defaults: {} },
  P: { kind: "pump", label: "Pump", defaults: {} },
  V: { kind: "vessel", label: "Vessel", defaults: { diameter: 1.0, height: 1.6 } },
  F: { kind: "filter", label: "Filter", defaults: { diameter: 0.8, height: 2.0 } },
  T: { kind: "tank", label: "Tank", defaults: { diameter: 12, height: 10 } },
  K: { kind: "compressor", label: "Compressor", defaults: { width: 4, length: 3, height: 3 } },
};

export const UNKNOWN_SHAPE = {
  kind: "unknown",
  label: "Unknown",
  defaults: { width: 2, length: 2, height: 2 },
};

// Register "equipment_type" free text → type code fallback (tag code wins).
const TYPE_NAME_TO_CODE = {
  column: "C",
  drum: "D",
  exchanger: "E",
  "heat exchanger": "E",
  "air cooler": "EA",
  aircooler: "EA",
  pump: "P",
  vessel: "V",
  strainer: "V",
  filter: "F",
  tank: "T",
  compressor: "K",
};

export function typeCodeFromName(name) {
  const key = String(name || "").trim().toLowerCase();
  return TYPE_NAME_TO_CODE[key] || null;
}

export function shapeFor(typeCode) {
  return TYPE_SHAPES[typeCode] || UNKNOWN_SHAPE;
}

/** Merge register dims over defaults; reports whether defaults were used. */
export function resolveDims(typeCode, dims) {
  const shape = shapeFor(typeCode);
  const merged = { ...shape.defaults, ...(dims || {}) };
  const defaultSize =
    !dims || Object.keys(shape.defaults).some((key) => dims[key] == null);
  return { dims: merged, defaultSize, shape };
}

/** Horizontal footprint (max of width/length/diameter) for layout spacing. */
export function footprintOf(dims) {
  return Math.max(dims.width || 0, dims.length || 0, dims.diameter || 0, 1);
}
