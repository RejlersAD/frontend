// ============================================================================
// Stress criticality evaluation engine — ADNOC AGPS-SP-PI-004 Table 2.
// Categories (L1/L2/L3) are CALCULATED per line from a criteria grid
// (NPS × design temperature); the stress-criticality file is a CRITERIA
// TABLE, not a per-line list. Stress critical = L1.
//
// Pure functions (no React, no DOM) so the module is testable from node.
// Data contracts (§6):
//   CriteriaTable  { id, locationType, source:'builtin'|'upload', standard,
//                    revision, npsRows[13], tempLimits[15], tempLabels[15],
//                    grid[13][15], definitions:{L1,L2,L3} }
//   LineEvaluation { lineNumber, lineKey, npsIn, sizeText, designTempC,
//                    tableRow, tableCol, tableCategory, override?,
//                    finalCategory, stressCritical, ldtStressFlag, flagCheck,
//                    status, warnings[], basis }
// ============================================================================

export const NPS_ROWS = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24]; // last row = ≥24
export const NPS_ROW_LABELS = ['1', '2', '3', '4', '6', '8', '10', '12', '14', '16', '18', '20', '≥24'];
export const TEMP_LIMITS = [-46, -30, 30, 50, 65, 85, 120, 150, 170, 205, 230, 260, 290, 315, 345];
export const TEMP_LABELS = [
  '-46 and below', '-30', '30', '50', '65', '85', '120', '150', '170',
  '205', '230', '260', '290', '315', '345 and above',
];

export const CATEGORY_DEFINITIONS = {
  L1: 'A comprehensive computer stress analysis and stress report is required.',
  L2: 'A simplified analysis method should be used.',
  L3: 'Neither manual nor computer analysis is generally required. A visual review of the piping drawing or sketch should be made to ensure that the piping system has flexibility.',
};

export const METHOD_TEXT = {
  L1: 'Comprehensive computer stress analysis + stress report',
  L2: 'Simplified analysis method',
  L3: 'Visual review of piping drawing / sketch',
};

// §5C proportion-bar / distribution colours
export const CATEGORY_COLORS = {
  L1: '#DC3545', L2: '#E3A02B', L3: '#12936F', cannotEvaluate: '#94A3B8',
};

// Soft tints for the criteria-grid heat-map cells
export const CATEGORY_SOFT = {
  L1: 'rgba(220,53,69,0.14)', L2: 'rgba(227,160,43,0.16)', L3: 'rgba(18,147,111,0.14)',
};

// ---------------------------------------------------------------------------
// Built-in Onshore default grid — AGPS-SP-PI-004 Rev 01, Table 2 (Onshore).
// MUST equal §3.2 and the reference Stress_Critical_Onshore.xlsx cell-for-cell.
// Rows: NPS 1,2,3,4,6,8,10,12,14,16,18,20,≥24 × cols -46,-30,30,50,65,85,120,
// 150,170,205,230,260,290,315,345+.
// ---------------------------------------------------------------------------
const G = {
  1:  ['L1', 'L2', 'L3', 'L3', 'L3', 'L3', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2'],
  2:  ['L1', 'L2', 'L3', 'L3', 'L3', 'L3', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1'],
  3:  ['L1', 'L2', 'L3', 'L3', 'L3', 'L2', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1'],
  4:  ['L1', 'L2', 'L3', 'L3', 'L3', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  6:  ['L1', 'L1', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  8:  ['L1', 'L1', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  10: ['L1', 'L1', 'L2', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  12: ['L1', 'L1', 'L2', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  14: ['L1', 'L1', 'L2', 'L2', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  16: ['L1', 'L1', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  18: ['L1', 'L1', 'L2', 'L2', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  20: ['L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
  24: ['L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1', 'L1'],
};

export const BUILTIN_ONSHORE = {
  id: 'builtin-agps-sp-pi-004-t2-onshore',
  locationType: 'onshore',
  source: 'builtin',
  standard: 'AGPS-SP-PI-004',
  revision: '01',
  sourceLabel: 'Built-in · AGPS-SP-PI-004 Rev 01',
  npsRows: NPS_ROWS,
  npsRowLabels: NPS_ROW_LABELS,
  tempLimits: TEMP_LIMITS,
  tempLabels: TEMP_LABELS,
  grid: NPS_ROWS.map(r => G[r]),
  definitions: { ...CATEGORY_DEFINITIONS },
};

export const CAT_PILL = {
  L1: 'rd-pill-danger', L2: 'rd-pill-warning', L3: 'rd-pill-success',
  'Cannot evaluate': 'rd-pill-neutral',
};

/** kg/cm²g → barg (×0.980665, 2 dp) for tooltips. */
export function kgcm2ToBarg(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (v == null || Number.isNaN(n)) return null;
  return Math.round(n * 0.980665 * 100) / 100;
}

// ---------------------------------------------------------------------------
// Table row / column lookup (§4)
// ---------------------------------------------------------------------------
/** Smallest table NPS ≥ npsIn. <1 → row 0 (1"); >20 → row ≥24. */
export function tableRowFor(nps) {
  if (nps == null || Number.isNaN(nps)) return null;
  let flag = null;
  let size = nps;
  if (size < 1) { flag = 'below-1'; size = 1; }
  let ri = NPS_ROWS.findIndex(r => size <= r);
  if (ri === -1) ri = NPS_ROWS.length - 1; // >20 → ≥24 row
  if (!flag && NPS_ROWS[ri] !== nps) flag = nps > 20 ? 'above-20' : 'between';
  return { index: ri, flag };
}

/** First temperature limit ≥ designTempC; >345 → last (345+) column. */
export function tempColFor(designTempC) {
  if (designTempC == null || Number.isNaN(designTempC)) return null;
  let ci = TEMP_LIMITS.findIndex(t => designTempC <= t);
  if (ci === -1) ci = TEMP_LIMITS.length - 1;
  return { index: ci };
}

// ---------------------------------------------------------------------------
// Per-line evaluation (§4)
// ---------------------------------------------------------------------------
export function evaluateLine(line, criteria, override) {
  const warnings = [];
  const npsIn = line.npsIn ?? null;
  const designTempC = line.designTempC ?? null;

  const base = {
    lineNumber: line.lineNumber,
    lineKey: line.lineKey,
    npsIn,
    sizeText: line.sizeText ?? '',
    designTempC,
    designPressKgcm2: line.designPressKgcm2 ?? null,
    ldtStressFlag: line.ldtStressFlag || '',
    ldtWarnings: line.ldtWarnings || [],
    override: override || null,
    warnings,
    _line: line, // original LDT record (register table / drawer / export)
  };

  // --- Cannot evaluate: size or design temperature missing/unparseable ---
  const missing = [];
  if (npsIn == null) missing.push('line size');
  if (designTempC == null) missing.push('design temperature');
  if (missing.length) {
    warnings.push({ type: 'cannot-evaluate', message: `Missing ${missing.join(' and ')} — cannot evaluate` });
    return {
      ...base,
      tableRow: null, tableCol: null, tableCategory: null,
      finalCategory: null, stressCritical: false,
      flagCheck: 'no-flag',
      status: 'cannot-evaluate',
      basis: `Cannot evaluate — ${missing.join(' and ')} not available in the line list.`,
    };
  }

  const row = tableRowFor(npsIn);
  const col = tempColFor(designTempC);
  if (row.flag === 'between') {
    warnings.push({ type: 'nps-between', message: `NPS between table sizes — next larger row (${NPS_ROW_LABELS[row.index]})` });
  } else if (row.flag === 'below-1') {
    warnings.push({ type: 'nps-below-1', message: 'NPS below 1" — 1" row' });
  } else if (row.flag === 'above-20') {
    warnings.push({ type: 'nps-above-20', message: 'NPS above 20 — ≥24 row' });
  }
  if (line.multipleSizes) {
    warnings.push({ type: 'multiple-sizes', message: `Multiple sizes — evaluated on ${npsIn}"` });
  }

  const tableCategory = criteria.grid[row.index][col.index];
  const finalCategory = override?.category || tableCategory;
  const stressCritical = finalCategory === 'L1';
  const standard = criteria.standard || 'AGPS-SP-PI-004';
  const basis = `${standard} Table 2 · NPS ${NPS_ROW_LABELS[row.index]} row · design T ≤ ${TEMP_LIMITS[col.index]} °C`;

  // --- LDT flag check (line-list col H vs Table 2 result) ---
  const flag = String(line.ldtStressFlag || '').trim().toUpperCase();
  let flagCheck;
  if (flag === 'Y' && finalCategory === 'L1') flagCheck = 'agrees';
  else if (flag === 'N' && (finalCategory === 'L2' || finalCategory === 'L3')) flagCheck = 'agrees';
  else if (flag === 'N' && finalCategory === 'L1') flagCheck = 'not-flagged-L1';
  else if (flag === 'Y' && (finalCategory === 'L2' || finalCategory === 'L3')) flagCheck = 'flagged-conservative';
  else flagCheck = 'no-flag';

  return {
    ...base,
    tableRow: row.index, tableCol: col.index,
    tableCategory, finalCategory, stressCritical,
    flagCheck,
    status: 'evaluated',
    basis,
  };
}

// ---------------------------------------------------------------------------
// Bulk evaluation + summary + review items
// ---------------------------------------------------------------------------
export function evaluateAll(lines, criteria, overrides = {}) {
  const evaluations = lines.map(l => evaluateLine(l, criteria, overrides[l.lineNumber]));

  const results = { L1: 0, L2: 0, L3: 0, cannotEvaluate: 0 };
  const flagCheck = { agrees: 0, notFlaggedL1: 0, flaggedConservative: 0, noFlag: 0 };
  // cellCounts[row][col] = how many lines fell into that grid cell
  const cellCounts = NPS_ROWS.map(() => TEMP_LIMITS.map(() => 0));

  evaluations.forEach(ev => {
    if (ev.status === 'cannot-evaluate') results.cannotEvaluate++;
    else results[ev.finalCategory]++;
    if (ev.flagCheck === 'agrees') flagCheck.agrees++;
    else if (ev.flagCheck === 'not-flagged-L1') flagCheck.notFlaggedL1++;
    else if (ev.flagCheck === 'flagged-conservative') flagCheck.flaggedConservative++;
    else flagCheck.noFlag++;
    if (ev.tableRow != null && ev.tableCol != null) cellCounts[ev.tableRow][ev.tableCol]++;
  });

  return { evaluations, results, flagCheck, cellCounts };
}

/** Build review-queue items from evaluations + LDT parse issues (§5 review). */
export function buildReviewItems(evaluations, resolved = {}, overrides = {}) {
  const items = [];
  const push = (id, severity, type, lineNumber, detail, ev) => items.push({
    id, severity, type, line_number: lineNumber, detail, line: ev || null,
    resolved: resolved[id] || null,
  });

  evaluations.forEach(ev => {
    const ln = ev.lineNumber;
    if (ev.flagCheck === 'not-flagged-L1') {
      push(`notflag-${ln}`, 'critical', 'Line list not flagged for stress analysis', ln,
        'Line list not flagged — Table 2 requires L1', ev);
    }
    if (ev.status === 'cannot-evaluate') {
      push(`canteval-${ln}`, 'warning', 'Cannot evaluate', ln,
        ev.warnings.find(w => w.type === 'cannot-evaluate')?.message || 'Missing data', ev);
    }
    if (ev.warnings.some(w => w.type === 'multiple-sizes')) {
      push(`multisize-${ln}`, 'warning', 'Multiple sizes', ln,
        `Multiple sizes — evaluated on ${ev.npsIn}"`, ev);
    }
    (ev.ldtWarnings || []).forEach(w => {
      if (w.type === 'class-mismatch') {
        push(`classmm-${ln}`, 'warning', 'Class mismatch in line number', ln, w.message, ev);
      } else if (w.type === 'duplicate-line-key') {
        push(`dupkey-${ln}`, 'warning', 'Duplicate line key', ln, w.message, ev);
      } else if (w.type === 'lower-case') {
        push(`lower-${ln}`, 'warning', 'Lower-case code normalised', ln, w.message, ev);
      }
    });
  });

  Object.values(overrides).forEach(o => {
    if (o.pendingApproval) {
      push(`ovrpend-${o.lineNumber}`, 'warning', 'Override pending approval', o.lineNumber,
        `Downgrade from table L1 to ${o.category} needs Lead Stress Engineer approval`, null);
    }
  });

  return items.filter(i => !i.resolved);
}

/** Compact criteria-table summary used by the drawer / cards. */
export function criteriaSummary(criteria) {
  if (!criteria) return null;
  const cells = criteria.grid.flat();
  return {
    rows: criteria.grid.length,
    cols: criteria.grid[0]?.length || 0,
    valid: cells.every(c => ['L1', 'L2', 'L3'].includes(c)),
    categories: [...new Set(cells)],
    standard: criteria.standard,
    revision: criteria.revision,
    source: criteria.source,
    locationType: criteria.locationType,
  };
}
