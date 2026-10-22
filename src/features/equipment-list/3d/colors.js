/** Colour maps for the 3D viewer. */

export const TYPE_COLORS = {
  C: "#1F6FEB", // Column
  D: "#7C5CFC", // Drum
  E: "#19A7B8", // Exchanger
  EA: "#12936F", // Air cooler
  G: "#E3A02B", // Pump
  P: "#E3A02B", // Pump
  V: "#EA6A1F", // Vessel
  F: "#EA6A1F", // Filter
  T: "#4B5565", // Tank
  K: "#0A3A8C", // Compressor
  UNKNOWN: "#94A3B8",
};

export const STATUS_COLORS = {
  validated: "#12936F",
  changed: "#2B7BF5",
  warning: "#E3A02B",
  error: "#DC3545",
  pending: "#94A3B8",
};

export const VALIDATION_COLORS = {
  pass: "#12936F",
  warnings: "#E3A02B",
  errors: "#DC3545",
};

export const CHANGED_COLORS = {
  changed: "#2B7BF5",
  unchanged: "#C8D2DF",
};

export const SYSTEM_NONE_COLOR = "#94A3B8";

// Chart order palette for SYS-xxx colouring.
export const SYSTEM_PALETTE = [
  "#1F6FEB",
  "#12936F",
  "#E3A02B",
  "#7C5CFC",
  "#19A7B8",
  "#EA6A1F",
  "#DC3545",
  "#0A3A8C",
  "#4B5565",
  "#94A3B8",
];

export const RACK_COLOR = "#8A97AB";
export const GRID_COLOR = "#E1E7EF";
export const SELECTED_EMISSIVE = "#0A5EF5";
export const HOVER_OUTLINE = "#0B1B3A";
export const FILTERED_OPACITY = 0.12;

export function systemColor(system, systemIndex) {
  if (!system) return SYSTEM_NONE_COLOR;
  const index = systemIndex instanceof Map ? systemIndex.get(system) : 0;
  return SYSTEM_PALETTE[(index ?? 0) % SYSTEM_PALETTE.length];
}

/**
 * Resolve the display colour for an item under the active colour mode.
 * item: { typeCode, status, validation, changed, systems }
 */
export function colorForItem(mode, item, systemIndex) {
  switch (mode) {
    case "status":
      return STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    case "validation":
      return VALIDATION_COLORS[item.validation] || VALIDATION_COLORS.pass;
    case "changed":
      return item.changed ? CHANGED_COLORS.changed : CHANGED_COLORS.unchanged;
    case "system":
      return systemColor(item.systems?.[0], systemIndex);
    case "type":
    default:
      return TYPE_COLORS[item.typeCode] || TYPE_COLORS.UNKNOWN;
  }
}

/** Legend entries per colour mode: [{ label, color }]. */
export function legendEntries(mode, { systems = [], systemIndex } = {}) {
  switch (mode) {
    case "status":
      return [
        ["Validated", STATUS_COLORS.validated],
        ["Changed", STATUS_COLORS.changed],
        ["Warning", STATUS_COLORS.warning],
        ["Error", STATUS_COLORS.error],
        ["Pending", STATUS_COLORS.pending],
      ].map(([label, color]) => ({ label, color }));
    case "validation":
      return [
        ["Pass", VALIDATION_COLORS.pass],
        ["Warnings", VALIDATION_COLORS.warnings],
        ["Errors", VALIDATION_COLORS.errors],
      ].map(([label, color]) => ({ label, color }));
    case "changed":
      return [
        { label: "Changed", color: CHANGED_COLORS.changed },
        { label: "Unchanged", color: CHANGED_COLORS.unchanged },
      ];
    case "system": {
      const entries = systems.map((sys) => ({
        label: sys,
        color: systemColor(sys, systemIndex),
      }));
      entries.push({ label: "No system", color: SYSTEM_NONE_COLOR });
      return entries;
    }
    case "type":
    default:
      return [
        ["Column", TYPE_COLORS.C],
        ["Drum", TYPE_COLORS.D],
        ["Exchanger", TYPE_COLORS.E],
        ["Air cooler", TYPE_COLORS.EA],
        ["Pump", TYPE_COLORS.P],
        ["Vessel / filter", TYPE_COLORS.V],
        ["Tank", TYPE_COLORS.T],
        ["Compressor", TYPE_COLORS.K],
        ["Unknown", TYPE_COLORS.UNKNOWN],
      ].map(([label, color]) => ({ label, color }));
  }
}

export const COLOR_MODES = [
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "validation", label: "Validation" },
  { id: "changed", label: "Changed" },
  { id: "system", label: "System" },
];
