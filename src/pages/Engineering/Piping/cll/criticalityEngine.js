// ============================================================================
// RADAI Stress Criticality generator — AGES-SP-09-004 Rev.2 logic.
// Given Process Line List records, derives the Stress Category per line:
//   Table 7.1  (NPS × design temperature) → base level
//   Section 7.3 (auto-evaluable items)    → can only RAISE the level
// Levels map directly to the Stress Criticality vocabulary used in project
// files: L1 (comprehensive analysis), L2 (simplified), L3 (visual).
// Lines with insufficient data are flagged for stress-engineer review.
// Pure functions; legends are soft-coded and editable.
// ============================================================================

// ---------------------------------------------------------------------------
// Table 7.1 — criticality by NPS × design temperature.
// Lookup rounds UP to the next size row / temperature column; >345 °C ⇒ L1.
// Default matrix below — verify against the controlled copy of AGES-SP-09-004
// Rev.2 Table 7.1 before issue for construction.
// ---------------------------------------------------------------------------
export const TABLE_7_1 = {
  sizeRows: [1, 1.5, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24], // last row = ≥24
  tempCols: [-30, -10, 100, 200, 300, 345],              // upper bounds (°C)
  matrix: [
    ['L2', 'L3', 'L3', 'L3', 'L2', 'L2'], // NPS 1
    ['L2', 'L3', 'L3', 'L3', 'L2', 'L2'], // NPS 1.5
    ['L1', 'L2', 'L3', 'L3', 'L2', 'L2'], // NPS 2
    ['L1', 'L2', 'L3', 'L2', 'L2', 'L1'], // NPS 3
    ['L1', 'L2', 'L2', 'L2', 'L1', 'L1'], // NPS 4
    ['L1', 'L2', 'L2', 'L1', 'L1', 'L1'], // NPS 6
    ['L1', 'L1', 'L2', 'L1', 'L1', 'L1'], // NPS 8
    ['L1', 'L1', 'L2', 'L1', 'L1', 'L1'], // NPS 10
    ['L1', 'L1', 'L1', 'L1', 'L1', 'L1'], // NPS 12
    ['L1', 'L1', 'L1', 'L1', 'L1', 'L1'], // NPS 16
    ['L1', 'L1', 'L1', 'L1', 'L1', 'L1'], // NPS 20
    ['L1', 'L1', 'L1', 'L1', 'L1', 'L1'], // NPS ≥24
  ],
};

export const LEVEL_TO_CATEGORY = { L1: 'L1', L2: 'L2', L3: 'L3' };

export const DEFAULT_LEGENDS = {
  fluidCodes: [
    { code: 'ST',  meaning: 'Steam' },
    { code: 'CND', meaning: 'Condensate' },
    { code: 'FL',  meaning: 'Flare' },
    { code: 'FW',  meaning: 'Fire Water' },
    { code: 'BFW', meaning: 'Boiler Feed Water' },
    { code: 'BD',  meaning: 'Blowdown' },
    { code: 'CT',  meaning: 'Chemical / Toxic' },
  ],
  equipmentPrefixes: [
    { prefix: 'P',   type: 'Rotating (Pump)' },
    { prefix: 'K',   type: 'Rotating (Compressor)' },
    { prefix: 'F',   type: 'Fired Heater' },
    { prefix: 'BL',  type: 'Boiler' },
    { prefix: 'A',   type: 'Air Cooler' },
    { prefix: 'E',   type: 'Static (Exchanger)' },
    { prefix: 'V',   type: 'Static (Vessel)' },
    { prefix: 'C',   type: 'Static (Column)' },
    { prefix: 'T',   type: 'Static (Tank)' },
    { prefix: 'R',   type: 'Reactor' },
    { prefix: 'PK',  type: 'Package' },
    { prefix: 'PSV', type: 'PSV / Relief' },
  ],
  classRatingPattern: '(\\d{3,4})#?',
};

// ---------------------------------------------------------------------------
export function parseNPS(raw) {
  if (raw == null || raw === '') return { nps: null, multi: false };
  const s = String(raw).replace(/["″]/g, '').trim();
  const parts = s.split(/[xX×\-\/]/).map(p => parseFloat(p)).filter(n => !isNaN(n));
  if (!parts.length) return { nps: null, multi: false };
  return { nps: Math.max(...parts), multi: parts.length > 1 }; // multi-size ⇒ larger
}

export function parseClassRating(materialClass, pattern) {
  if (!materialClass) return null;
  const m = String(materialClass).match(new RegExp(pattern || DEFAULT_LEGENDS.classRatingPattern));
  return m ? parseInt(m[1], 10) : null;
}

export function classifyTag(tag, legends) {
  if (!tag) return null;
  const m = String(tag).trim().toUpperCase().match(/^([A-Z]{1,3})/);
  if (!m) return null;
  const p = m[1];
  const sorted = [...legends.equipmentPrefixes].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find(e => p === e.prefix || p.startsWith(e.prefix)) || null;
}

const hasFluid = (line, legends, targets) => {
  const f = String(line.fluid || '').toUpperCase();
  return legends.fluidCodes.some(l =>
    targets.includes(l.code) && (f === l.code || f.includes(l.meaning.toUpperCase())));
};
const isType = (cls, needle) => cls && cls.type.toUpperCase().includes(needle);

export function table71Lookup(nps, designTempC) {
  const res = { level: null, flags: [], basis: '' };
  if (nps == null || isNaN(designTempC)) {
    res.basis = 'Size or design temperature missing — Table 7.1 not evaluated';
    res.flags.push('INSUFFICIENT_DATA');
    return res;
  }
  let size = nps;
  if (size < 1) { res.flags.push('BELOW_NPS_1'); size = 1; }
  const ri = Math.max(0, TABLE_7_1.sizeRows.findIndex(s => size <= s));
  if (designTempC > 345) {
    res.flags.push('ABOVE_345C');
    res.level = 'L1';
    res.basis = `Design temperature ${designTempC} °C exceeds 345 °C — L1 (comprehensive) required.`;
    return res;
  }
  const ci = Math.max(0, TABLE_7_1.tempCols.findIndex(t => designTempC <= t));
  res.level = TABLE_7_1.matrix[ri][ci];
  res.basis = `Table 7.1: NPS ${nps} (row ${TABLE_7_1.sizeRows[ri]}), ${designTempC} °C (col ≤${TABLE_7_1.tempCols[ci]} °C) → ${res.level}.`;
  return res;
}

/** Section 7.3 auto-evaluable items — any trigger raises the line to Cat 1. */
export function evaluateSec73(line, legends) {
  const t = [];
  const nps = line._nps;
  const rating = parseClassRating(line.pipe_class || line.material_class, legends.classRatingPattern);
  const ends = [classifyTag(line.from, legends), classifyTag(line.to, legends)].filter(Boolean);
  const dT = parseFloat(line.design_temperature ?? line.design_temp_c);
  const phase = String(line.phase || '').toUpperCase();
  const insul = String(line.insulation_code || '').toUpperCase();
  const push = (id, why) => t.push({ id, why });

  if (hasFluid(line, legends, ['CT'])) push('b', 'chemical/toxic service');
  if (nps >= 4 && rating >= 900) push('c', `NPS ${nps} ≥ 4 at class ${rating}# ≥ 900#`);
  if (nps >= 2 && ends.some(c => isType(c, 'ROTATING') || isType(c, 'FIRED HEATER')))
    push('d', 'NPS ≥ 2 connected to rotating machinery / fired heater');
  if (nps >= 3 && ends.some(c => isType(c, 'PSV'))) push('f', 'NPS ≥ 3 connected to PSV / rupture disc');
  if (nps >= 2 && ends.some(c => isType(c, 'REACTOR') || isType(c, 'FIRED HEATER') || isType(c, 'AIR COOLER')))
    push('i', 'NPS ≥ 2 connected to reactor / heater / air cooler');
  if (nps >= 6 && ends.some(c => isType(c, 'STATIC'))) push('j', 'NPS ≥ 6 to/from static equipment');
  if ((hasFluid(line, legends, ['BFW']) || hasFluid(line, legends, ['ST'])) && ends.some(c => isType(c, 'BOILER')))
    push('k', 'boiler feed water / steam to or from a boiler');
  if (!isNaN(dT) && dT < 5 && /^(C|CD|COLD|CRYO)/.test(insul)) push('l', `design temp ${dT} °C < 5 °C with cold insulation`);
  if (nps >= 3 && hasFluid(line, legends, ['ST', 'CND', 'FL'])) push('m', 'NPS ≥ 3 steam / condensate / flare');
  if (hasFluid(line, legends, ['FW'])) push('n', 'fire water network');
  if (nps >= 2 && (phase.includes('2') || phase.includes('TWO') || hasFluid(line, legends, ['BD'])))
    push('p', 'NPS ≥ 2 two-phase / blowdown');
  return t;
}

/** Full generation for one line-list record. */
export function generateCriticality(line, legends = DEFAULT_LEGENDS) {
  const { nps, multi } = parseNPS(line.size ?? line.nps);
  const enriched = { ...line, _nps: nps };
  const t71 = table71Lookup(nps, parseFloat(line.design_temperature ?? line.design_temp_c));
  const sec73 = evaluateSec73(enriched, legends);

  const flags = [...t71.flags];
  if (multi) flags.push('MULTI_SIZE');

  let level = t71.level || 'L3';
  let raised = false;
  if (sec73.length && level !== 'L1') { level = 'L1'; raised = true; } // raise, never lower

  const basis = sec73.length
    ? (t71.level === 'L1'
      ? `L1 per Table 7.1; Sec. 7.3 item(s) ${sec73.map(s => s.id).join(', ')} also apply — ${sec73.map(s => s.why).join('; ')}.`
      : `${t71.level || 'L3'} per Table 7.1; raised to L1 by Sec. 7.3 item(s) ${sec73.map(s => s.id).join(', ')} — ${sec73.map(s => s.why).join('; ')}.`)
    : t71.basis;

  return {
    category: LEVEL_TO_CATEGORY[level] || 'L3',
    level, table71: t71, sec73, raisedBy73: raised,
    criteria_basis: basis,
    analysis_method: level === 'L1' ? 'Comprehensive (computer analysis)'
      : level === 'L2' ? 'Simplified (chart/formula methods)' : 'Visual review',
    flags,
    needs_review: flags.includes('INSUFFICIENT_DATA') || flags.includes('BELOW_NPS_1'),
  };
}

/** Bulk: generate stress-criticality records from line-list records. */
export function generateStressRecords(lineRecs, legends = DEFAULT_LEGENDS) {
  return lineRecs.map(l => {
    const g = generateCriticality(l, legends);
    return {
      line_number: l.line_number,
      stress_category: g.category,
      criteria_basis: g.criteria_basis,
      analysis_method: g.analysis_method,
      responsible_engineer: g.needs_review ? 'Stress Engineer (review required)' : 'RADAI auto-classification',
      _generated: g,
      _row: l._row,
    };
  });
}
