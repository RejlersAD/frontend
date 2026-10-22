// ============================================================================
// CLL data layer — Line Designation Table (LDT) and stress-criticality
// CRITERIA TABLE parsing.
//
// LDT (§2): sheet "Line Designation Table", header row 8 (names) / row 9
// (units), data from row 10. 27 columns A–AA. All cells may be text — never
// reject on type, never fail on malformed document properties.
//
// Criteria (§3): sheet "TABLE 2 ONSHORE" / "TABLE … OFFSHORE" — a fixed
// 13 × 15 grid (NPS × design temperature → L1/L2/L3) + definitions rows.
// Other sheets (e.g. README with #REF! formulas) are ignored, not warned.
//
// Pure functions (no React) so the module is testable from node.
// ============================================================================
import * as XLSX from 'xlsx';
import {
  NPS_ROWS, TEMP_LIMITS, TEMP_LABELS, CATEGORY_DEFINITIONS,
} from './criticalityEngine.js';

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ACCEPT_EXT = ['.xlsx', '.xls', '.csv'];

// ---------------------------------------------------------------------------
// §2.2 — LDT columns A–AA. `match` = normalised header fragments (header text
// is normalised: lower-case, line breaks → space, whitespace collapsed).
// ---------------------------------------------------------------------------
export const LDT_FIELDS = [
  { key: 'lineNumber',       col: 'A',  label: 'LINE NUMBER',                          required: true,  match: ['line number'] },
  { key: 'lineKey',          col: 'B',  label: 'LINE',                                 required: true,  match: ['line'] },
  { key: 'fluidCode',        col: 'C',  label: 'FLUID',                                required: true,  match: ['fluid'] },
  { key: 'from',             col: 'D',  label: 'FROM',                                 required: true,  match: ['from'] },
  { key: 'to',               col: 'E',  label: 'TO',                                   required: true,  match: ['to'] },
  { key: 'sizeText',         col: 'F',  label: 'LINE SIZE',      unit: '(IN)',         required: true,  match: ['line size'] },
  { key: 'pipeClass',        col: 'G',  label: 'MATERIAL CLASS',                       required: true,  match: ['material class'] },
  { key: 'ldtStressFlag',    col: 'H',  label: 'STRESS ANALYSIS',                      required: false, match: ['stress analysis'] },
  { key: 'operPressKgcm2',   col: 'I',  label: 'OPERATING PRESS.', unit: '(kg/cm²g)',  required: false, match: ['operating press'] },
  { key: 'operTempC',        col: 'J',  label: 'OPERATING TEMP.',  unit: '(°C)',       required: false, match: ['operating temp'] },
  { key: 'designPressKgcm2', col: 'K',  label: 'DESIGN PRESS.',    unit: '(kg/cm²g)',  required: true,  match: ['design press'] },
  { key: 'designTempC',      col: 'L',  label: 'DESIGN TEMP',      unit: '(°C)',       required: true,  match: ['design temp'] },
  { key: 'phase',            col: 'M',  label: 'PHASE',                                required: false, match: ['phase'] },
  { key: 'testPressKgcm2',   col: 'N',  label: 'TEST PRESS.',      unit: '(kg/cm²g)',  required: false, match: ['test press'] },
  { key: 'testMedia',        col: 'O',  label: 'TEST MEDIA',                           required: false, match: ['test media'] },
  { key: 'insulCode',        col: 'P',  label: 'INSUL CODE',                           required: false, match: ['insul code'] },
  { key: 'insulThkMm',       col: 'Q',  label: 'THK.',             unit: '(MM)',       required: false, match: ['thk'] },
  { key: 'paintCode',        col: 'R',  label: 'PAINT CODE',                           required: false, match: ['paint code'] },
  { key: 'paintCriticality', col: 'S',  label: 'Paint criticality',                    required: false, match: ['criticality rating'] },
  { key: 'pidNumber',        col: 'T',  label: 'P&ID NUMBER',                          required: true,  match: ['p&id number'] },
  { key: 'ndeClass',         col: 'U',  label: 'NDE CLASS NOTE:',                      required: false, match: ['nde class'] },
  { key: 'comments',         col: 'V',  label: 'COMMENTS',                             required: false, match: ['comments'] },
  { key: 'ldtRev',           col: 'W',  label: 'REV',                                  required: false, match: ['rev'] },
  { key: 'maintainedTemp',   col: 'X',  label: 'MAINTAINED TEMPERATURE',               required: false, match: ['maintained temperature'] },
  { key: 'instrumentCount',  col: 'Y',  label: 'NO OF INSTRUMENTS (VALVE, TT ETC)',    required: false, match: ['no of instruments'] },
  { key: 'pipeJointCount',   col: 'Z',  label: 'NO OF PIPE JOINTS',                    required: false, match: ['no of pipe'] },
  { key: 'lineLengthM',      col: 'AA', label: 'LINE LENGTH IN MTR',                   required: false, match: ['line length'] },
];

export const LDT_REQUIRED_COUNT = LDT_FIELDS.filter(f => f.required).length; // 10

/** Normalise header text: trim, collapse line breaks/whitespace, lower-case. */
const normHeader = (h) => String(h ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Workbook loading — tolerant of malformed custom doc properties (§2)
// ---------------------------------------------------------------------------
export async function parseWorkbook(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`File exceeds the 25 MB limit (${(file.size / 1048576).toFixed(1)} MB).`);
  if (!ACCEPT_EXT.some(e => file.name.toLowerCase().endsWith(e))) throw new Error('Unsupported file type. Use .xlsx, .xls or .csv.');
  const buf = await file.arrayBuffer();
  return readWorkbookBuffer(buf);
}

export function readWorkbookBuffer(buf) {
  // bookProps must stay off — the reference LDT has a malformed custom
  // document property that would otherwise abort parsing.
  const wb = XLSX.read(buf, { type: 'array', bookProps: false });
  const sheets = {};
  wb.SheetNames.forEach(name => {
    try {
      sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    } catch {
      sheets[name] = [];
    }
  });
  return { sheets, sheetNames: wb.SheetNames };
}

// ---------------------------------------------------------------------------
// LDT sheet / header detection (§2)
// ---------------------------------------------------------------------------
function rowHasBothLdtMarkers(row) {
  const cells = (row || []).map(normHeader);
  return cells.some(c => c === 'line number') && cells.some(c => c.startsWith('design temp'));
}

/** Auto-select the first sheet whose header area contains LINE NUMBER + DESIGN TEMP. */
export function detectLdtSheet(wb) {
  for (const name of wb.sheetNames) {
    const grid = wb.sheets[name] || [];
    if (grid.slice(0, 30).some(rowHasBothLdtMarkers)) return name;
  }
  return wb.sheetNames[0] || null;
}

/** Header row (0-based) — first row containing both markers; 8 in the template. */
export function detectLdtHeaderRow(grid) {
  const idx = grid.slice(0, 40).findIndex(rowHasBothLdtMarkers);
  return idx === -1 ? 7 : idx;
}

/** Auto-map LDT columns by header text (exact normalised match wins). */
export function guessLdtMapping(headers) {
  const norm = headers.map(normHeader);
  const taken = new Set();
  const mapping = {};
  // Longest match fragment first so 'line number' wins over 'line'.
  const fields = [...LDT_FIELDS].sort(
    (a, b) => Math.max(...b.match.map(m => m.length)) - Math.max(...a.match.map(m => m.length)));
  fields.forEach(f => {
    let bestIdx = -1, bestScore = -1;
    norm.forEach((h, i) => {
      if (taken.has(i) || !h) return;
      f.match.forEach(m => {
        let score = 0;
        if (h === m) score = 1000 + m.length;
        else if (h.startsWith(m)) score = 500 + m.length;
        else if (h.includes(m)) score = 100 + m.length;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      });
    });
    if (bestIdx >= 0) { taken.add(bestIdx); mapping[f.key] = bestIdx; }
    else mapping[f.key] = null;
  });
  return mapping;
}

// ---------------------------------------------------------------------------
// Size parsing (§2): `2"`→2, `3/4"`→0.75, `1-1/2"`→1.5, `4",6"`→{all,[4,6]}
// ---------------------------------------------------------------------------
function parseOneSize(s) {
  const t = s.replace(/["″']/g, '').trim();
  if (!t) return null;
  // mixed fraction: 1-1/2
  let m = t.match(/^(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)$/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

export function parseSizeCell(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { sizeText: '', sizes: [], npsIn: null, multipleSizes: false };
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  const sizes = parts.map(parseOneSize).filter(n => n != null);
  return {
    sizeText: s,
    sizes,
    npsIn: sizes.length ? Math.max(...sizes) : null,
    multipleSizes: sizes.length > 1,
  };
}

const num = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
};

// ---------------------------------------------------------------------------
// LDT record build + validation (§2)
// ---------------------------------------------------------------------------
const NUMERIC_KEYS = new Set([
  'operPressKgcm2', 'operTempC', 'designPressKgcm2', 'designTempC',
  'testPressKgcm2', 'insulThkMm', 'maintainedTemp', 'instrumentCount',
  'pipeJointCount', 'lineLengthM', 'paintCriticality',
]);
const CODE_KEYS = new Set(['lineNumber', 'fluidCode', 'pipeClass', 'insulCode', 'lineKey']);

export function parseLdtSheet(grid, headerRowIdx, mapping = {}) {
  const headers = (grid[headerRowIdx] || []).map((h, i) => String(h).trim() || `col_${i + 1}`);
  const issues = [];
  const records = [];

  // Required columns present?
  LDT_FIELDS.filter(f => f.required).forEach(f => {
    if (mapping[f.key] == null) {
      issues.push({ severity: 'error', row: null, type: 'required-column', message: `Required column "${f.label}" (${f.col}) is not mapped.` });
    }
  });

  const cell = (row, key) => {
    const idx = mapping[key];
    return idx == null ? '' : String(row[idx] ?? '').trim();
  };

  const seenLineNumbers = new Map();
  const seenLineKeys = new Map();

  // Data rows: headerRow+2 … last row with non-empty LINE NUMBER (skip empty).
  for (let r = headerRowIdx + 2; r < grid.length; r++) {
    const row = grid[r] || [];
    if (!row.some(c => String(c).trim() !== '')) continue; // skip empty rows
    const excelRow = r + 1;
    const lineNumberRaw = cell(row, 'lineNumber');
    if (!lineNumberRaw) continue; // rows without a line number are not data

    const rec = { _row: excelRow, ldtWarnings: [] };
    rec._raw = Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? '').trim()]));
    LDT_FIELDS.forEach(f => {
      const v = cell(row, f.key);
      rec[f.key] = NUMERIC_KEYS.has(f.key) ? num(v) : v;
    });

    // --- codes upper-cased; warn on normalisation ---
    let lowerCaseFound = false;
    CODE_KEYS.forEach(k => {
      if (rec[k] && /[a-z]/.test(rec[k])) lowerCaseFound = true;
    });
    if (lowerCaseFound) {
      rec.ldtWarnings.push({ type: 'lower-case', message: `Lower-case code normalised (row ${excelRow})` });
      issues.push({ severity: 'warning', row: excelRow, type: 'lower-case', message: `Row ${excelRow}: lower-case code normalised.` });
    }
    CODE_KEYS.forEach(k => { if (typeof rec[k] === 'string') rec[k] = rec[k].toUpperCase(); });

    // --- size ---
    const sz = parseSizeCell(cell(row, 'sizeText'));
    rec.sizeText = sz.sizeText;
    rec.sizes = sz.sizes;
    rec.npsIn = sz.npsIn;
    rec.multipleSizes = sz.multipleSizes;
    if (sz.multipleSizes) {
      rec.ldtWarnings.push({ type: 'multiple-sizes', message: `Multiple sizes (${sz.sizeText}) — evaluated on ${sz.npsIn}"` });
      issues.push({ severity: 'warning', row: excelRow, type: 'multiple-sizes', message: `Row ${excelRow}: multiple sizes (${sz.sizeText}) — evaluated on ${sz.npsIn}".` });
    }

    // --- line-number structure checks (warnings only unless noted) ---
    const segs = rec.lineNumber.split('-');
    if (rec.lineKey && !rec.lineNumber.startsWith(`${rec.lineKey}-`)) {
      issues.push({ severity: 'warning', row: excelRow, type: 'line-key-prefix', message: `Row ${excelRow}: LINE NUMBER does not start with "${rec.lineKey}-".` });
    }
    if (segs.length >= 2 && rec.fluidCode && segs[1] !== rec.fluidCode) {
      issues.push({ severity: 'warning', row: excelRow, type: 'fluid-mismatch', message: `Row ${excelRow}: fluid segment (${segs[1]}) differs from FLUID (${rec.fluidCode}).` });
    }
    if (segs.length >= 4 && rec.pipeClass && segs[3] !== rec.pipeClass) {
      rec.ldtWarnings.push({ type: 'class-mismatch', message: `Class in line number (${segs[3]}) differs from MATERIAL CLASS (${rec.pipeClass})` });
      issues.push({ severity: 'warning', row: excelRow, type: 'class-mismatch', message: `Row ${excelRow}: class in line number (${segs[3]}) differs from MATERIAL CLASS (${rec.pipeClass}).` });
    }
    if (segs.length >= 5 && rec.insulCode && segs[4].toUpperCase() !== rec.insulCode.toUpperCase()) {
      issues.push({ severity: 'warning', row: excelRow, type: 'insul-mismatch', message: `Row ${excelRow}: insulation segment (${segs[4]}) differs from INSUL CODE (${rec.insulCode}).` });
    }

    // --- duplicates ---
    if (seenLineNumbers.has(rec.lineNumber)) {
      issues.push({ severity: 'error', row: excelRow, type: 'duplicate-line-number', message: `Row ${excelRow}: duplicate line number "${rec.lineNumber}" (first on row ${seenLineNumbers.get(rec.lineNumber)}).` });
    } else {
      seenLineNumbers.set(rec.lineNumber, excelRow);
    }
    if (rec.lineKey) {
      if (seenLineKeys.has(rec.lineKey) && seenLineKeys.get(rec.lineKey).lineNumber !== rec.lineNumber) {
        rec.ldtWarnings.push({ type: 'duplicate-line-key', message: `Duplicate line key ${rec.lineKey} (also row ${seenLineKeys.get(rec.lineKey).row}) — check insulation code` });
        issues.push({ severity: 'warning', row: excelRow, type: 'duplicate-line-key', message: `Row ${excelRow}: duplicate line key "${rec.lineKey}" (also row ${seenLineKeys.get(rec.lineKey).row}) — check insulation code.` });
      } else if (!seenLineKeys.has(rec.lineKey)) {
        seenLineKeys.set(rec.lineKey, { row: excelRow, lineNumber: rec.lineNumber });
      }
    }

    records.push(rec);
  }

  const unitsRow = grid[headerRowIdx + 1] || [];
  return { headers, records, issues, unitsRow, headerRow: headerRowIdx, unitsRowIndex: headerRowIdx + 1 };
}

// ---------------------------------------------------------------------------
// Criteria table parsing (§3)
// ---------------------------------------------------------------------------
/** Sheet whose name or A1 title contains TABLE + ONSHORE/OFFSHORE. */
export function detectCriteriaSheet(wb) {
  for (const name of wb.sheetNames) {
    const upper = name.toUpperCase();
    const grid = wb.sheets[name] || [];
    const a1 = String(grid[0]?.[0] ?? '').toUpperCase();
    if ((upper.includes('TABLE') || a1.includes('TABLE')) &&
        (upper.includes('ONSHORE') || upper.includes('OFFSHORE') || a1.includes('ONSHORE') || a1.includes('OFFSHORE'))) {
      return name;
    }
  }
  return null;
}

const cellRef = (r, c) => `${String.fromCharCode(65 + c)}${r + 1}`;

/**
 * Parse the fixed criteria grid. `grid` is the sheet as array-of-arrays.
 * Returns { table, errors, warnings, info }. Errors are blocking.
 */
export function parseCriteriaSheet(grid, projectLocationType) {
  const errors = [];
  const warnings = [];
  const info = [];

  const txt = (r, c) => String(grid[r]?.[c] ?? '').trim();

  // Table type from the A1 title
  const title = txt(0, 0).toUpperCase();
  const locationType = title.includes('OFFSHORE') ? 'offshore' : title.includes('ONSHORE') ? 'onshore' : null;
  if (projectLocationType && locationType && locationType !== projectLocationType) {
    errors.push({
      type: 'wrong-type',
      message: `This criteria table is ${locationType.toUpperCase()}; the project is ${projectLocationType.toUpperCase()}.`,
    });
  }

  // A2 source line: doc no + rev (e.g. "… AGPS-SP-PI-004 Rev. No: 01 …")
  const a2 = txt(1, 0);
  let standard = null;
  let revision = null;
  if (a2) {
    const docM = a2.match(/([A-Z]{2,}(?:-[A-Z0-9]{2,}){2,})/);
    const revM = a2.match(/Rev\.?\s*(?:No\.?)?\s*:?\s*([0-9]+)/i);
    if (docM) standard = docM[1];
    if (revM) revision = revM[1].padStart(2, '0');
  } else {
    warnings.push({ type: 'no-source', message: 'Standard reference not found in A2.' });
  }

  // Temp labels (row 3, B:P) + numeric limits (row 4, B:P)
  const tempLabels = [];
  const tempLimits = [];
  for (let c = 1; c <= 15; c++) {
    tempLabels.push(txt(2, c));
    const lim = num(grid[3]?.[c]);
    if (lim == null) errors.push({ type: 'temp-limit', message: `Temperature limit ${cellRef(3, c)} is empty or not numeric.` });
    tempLimits.push(lim);
  }
  for (let i = 1; i < tempLimits.length; i++) {
    if (tempLimits[i] != null && tempLimits[i - 1] != null && tempLimits[i] <= tempLimits[i - 1]) {
      errors.push({ type: 'temp-order', message: 'Temperature limits are not strictly ascending.' });
      break;
    }
  }

  // NPS rows (A5:A17) + category grid (B5:P17)
  const npsRows = [];
  const gridCells = [];
  for (let r = 0; r < 13; r++) {
    const sheetRow = 4 + r; // 0-based row index of Excel row 5+r
    const nps = num(grid[sheetRow]?.[0]);
    if (nps == null) errors.push({ type: 'nps', message: `NPS value ${cellRef(sheetRow, 0)} is empty or not numeric.` });
    npsRows.push(nps);
    const rowCells = [];
    for (let c = 0; c < 15; c++) {
      const raw = txt(sheetRow, 1 + c);
      const v = raw.toUpperCase();
      if (!v) {
        errors.push({ type: 'grid-empty', message: `Grid cell ${cellRef(sheetRow, 1 + c)} is empty.` });
      } else if (!['L1', 'L2', 'L3'].includes(v)) {
        errors.push({ type: 'grid-value', message: `${cellRef(sheetRow, 1 + c)} = "${raw}" — expected L1, L2 or L3.` });
      }
      rowCells.push(['L1', 'L2', 'L3'].includes(v) ? v : null);
    }
    gridCells.push(rowCells);
  }
  for (let i = 1; i < npsRows.length; i++) {
    if (npsRows[i] != null && npsRows[i - 1] != null && npsRows[i] <= npsRows[i - 1]) {
      errors.push({ type: 'nps-order', message: 'NPS rows are not strictly ascending.' });
      break;
    }
  }

  // Category definitions A20:B22
  const definitions = { ...CATEGORY_DEFINITIONS };
  for (let r = 19; r <= 21; r++) {
    const cat = txt(r, 0).toUpperCase();
    const def = txt(r, 1);
    if (['L1', 'L2', 'L3'].includes(cat) && def) definitions[cat] = def;
  }

  const valid = errors.length === 0;
  const table = valid || gridCells.flat().some(Boolean)
    ? {
        id: `upload-${Date.now()}`,
        locationType: locationType || projectLocationType || 'onshore',
        source: 'upload',
        standard: standard || 'Unknown standard',
        revision: revision || null,
        npsRows, tempLimits, tempLabels,
        grid: gridCells,
        definitions,
      }
    : null;

  return { table, errors, warnings, info, valid, standard, revision, locationType };
}

/** Note ignored non-criteria sheets (README with #REF! → info, not warning). */
export function ignoredSheetNotes(wb, criteriaSheet) {
  return wb.sheetNames
    .filter(n => n !== criteriaSheet)
    .map(n => ({ type: 'ignored-sheet', message: `${n} sheet ignored` }));
}

// ---------------------------------------------------------------------------
// Templates / export
// ---------------------------------------------------------------------------
/** §2.4 — LDT-layout workbook: one sheet, header row 8 / units row 9,
 *  frozen at row 10, one example row. */
export function downloadLdtTemplate() {
  const rows = [];
  for (let i = 0; i < 7; i++) rows.push([]);
  rows.push(LDT_FIELDS.map(f => f.label));
  rows.push(LDT_FIELDS.map(f => f.unit || ''));
  rows.push([
    '2600-AY-005-17091R-V', '2600-AY-005', 'AY', '2600-AY-CB-004', '2600-AY-CB-005',
    '6"', '17091R', 'N', '0', '40', '3.5', '87', 'LIQUID', '0', 'Visual Test',
    'V', '0', '31', '4', '2600-224A', 'NA', '', '6', '', '', '', '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 9 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Line Designation Table');
  XLSX.writeFile(wb, 'Process_Line_List_LDT_Template.xlsx');
}

/** Register export — final category appended as the last column. */
export async function exportRegisterWorkbook(evaluations, rawHeaders, meta = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Critical Line List');
  const headers = [...rawHeaders, 'Stress Category'];
  ws.columns = headers.map(h => ({ header: h, key: h, width: Math.max(14, String(h).length + 4) }));
  const FILLS = { L1: 'FFDC3545', L2: 'FFE3A02B', L3: 'FF12936F' };
  evaluations.forEach(ev => {
    const row = ws.addRow({ ...(ev._line?._raw || ev._raw || {}), 'Stress Category': ev.finalCategory || 'Cannot evaluate' });
    const cell = row.getCell('Stress Category');
    const fill = FILLS[ev.finalCategory];
    if (fill) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  });
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: 'A1', to: { row: 1, column: headers.length } };
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CriticalLineList_${meta.revision ? `R${meta.revision}_` : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------------------
// Revision diff (kept for upload history)
// ---------------------------------------------------------------------------
export function diffRevisions(oldRecs, newRecs) {
  const key = r => String(r.lineNumber ?? r.line_number ?? '').trim().toUpperCase();
  const oldMap = new Map((oldRecs || []).map(r => [key(r), r]));
  const newMap = new Map((newRecs || []).map(r => [key(r), r]));
  const added = [], removed = [], changed = [];
  newMap.forEach((r, k) => {
    if (!oldMap.has(k)) { added.push(r); return; }
    const o = oldMap.get(k);
    const delta = Object.keys(r).filter(key2 => !key2.startsWith('_') && String(r[key2]) !== String(o[key2]));
    if (delta.length) changed.push({ line: r, fields: delta });
  });
  oldMap.forEach((r, k) => { if (!newMap.has(k)) removed.push(r); });
  return { added, removed, changed };
}
