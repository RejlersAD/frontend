/**
 * Tag and line-number parsers for the 3D model.
 * Tag:      2600-C-001A   → unit 2600, typeCode C, seq 1, suffix A
 * Line:     28"-2600-P-301-11055MR-P
 *           → nps 28, unit 2600, service P, seq 301, pipeClass 11055MR, insulation P
 */

const TAG_RE = /^(\d{4})-([A-Z]{1,2})-(\d{3})([A-Z]?)$/;
const LINE_RE = /^(\d+(?:\/\d+)?)"-(\d{4})-([A-Z]{1,5})-(\d{3,4})-([0-9A-Z]{5,7})-([A-Z])$/;

export function parseTag(tag) {
  const match = String(tag || "")
    .trim()
    .match(TAG_RE);
  if (!match) return null;
  return {
    unit: match[1],
    typeCode: match[2],
    seq: parseInt(match[3], 10),
    suffix: match[4] || "",
  };
}

export function parseLineNo(lineNo) {
  const match = String(lineNo || "")
    .trim()
    .match(LINE_RE);
  if (!match) return null;
  return {
    nps: match[1],
    unit: match[2],
    service: match[3],
    seq: match[4],
    pipeClass: match[5],
    insulation: match[6],
  };
}

// NPS (inches) → outside diameter in millimetres.
const NPS_OD_MM = {
  0.75: 26.7,
  1: 33.4,
  2: 60.3,
  3: 88.9,
  4: 114.3,
  6: 168.3,
  8: 219.1,
  10: 273.0,
  12: 323.8,
  14: 355.6,
  16: 406.4,
  18: 457.0,
  20: 508.0,
  24: 609.6,
  28: 711.2,
  48: 1219.2,
};

export function npsToOdMm(nps) {
  const value = parseFloat(nps);
  if (!Number.isFinite(value)) return 60.3;
  return NPS_OD_MM[value] ?? value * 25.4;
}

/** Tube radius in metres, with a minimum visual radius of 0.05 m. */
export function npsToRadiusM(nps) {
  return Math.max(npsToOdMm(nps) / 1000 / 2, 0.05);
}
