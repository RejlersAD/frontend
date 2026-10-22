// ============================================================================
// CLL data layer — file definitions, Excel/CSV parsing, column mapping with
// synonyms, validation, line-number normalisation, two-file matching,
// revision diffing and discrepancy generation. Pure functions (no React).
// ============================================================================
import * as XLSX from 'xlsx';

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ACCEPT_EXT = ['.xlsx', '.xls', '.csv'];

// --- Canonical field definitions -------------------------------------------
export const LINE_LIST_FIELDS = [
  { key: 'line_number',       label: 'Line Number',        required: true,  match: ['line number', 'line no', 'line_no', 'line id', 'line tag'] },
  { key: 'size',              label: 'Size',               required: true,  match: ['size', 'nps', 'line size', 'nominal size', 'dia'] },
  { key: 'fluid',             label: 'Fluid/Service',      required: true,  match: ['fluid', 'service', 'fluid/service', 'fluid code', 'service fluid'] },
  { key: 'pipe_class',        label: 'Pipe Class',         required: true,  match: ['pipe class', 'piping class', 'material class', 'class'] },
  { key: 'from',              label: 'From',               required: true,  match: ['from', 'from equipment', 'origin'] },
  { key: 'to',                label: 'To',                 required: true,  match: ['to', 'to equipment', 'destination'] },
  { key: 'pid_no',            label: 'P&ID No.',           required: true,  match: ['p&id', 'pid', 'p&id no', 'pid no', 'p id', 'p&id number'] },
  { key: 'design_pressure',   label: 'Design Pressure',    required: true,  match: ['design pressure', 'dp', 'des pressure', 'design press'] },
  { key: 'design_temperature',label: 'Design Temperature', required: true,  match: ['design temperature', 'design temp', 'dt', 'des temp'] },
  // optional inputs that sharpen the auto-generated criticality (Sec. 7.3)
  { key: 'phase',           label: 'Phase',            required: false, match: ['phase'] },
  { key: 'insulation_code', label: 'Insulation Code',  required: false, match: ['insulation', 'insulation code', 'ins'] },
];

export const STRESS_FIELDS = [
  { key: 'line_number',          label: 'Line Number',         required: true,  match: ['line number', 'line no', 'line_no', 'line id', 'line tag'] },
  { key: 'stress_category',      label: 'Stress Category',     required: true,  match: ['stress category', 'stress criticality', 'criticality level', 'criticality category', 'stress criticality level', 'criticality', 'stress level', 'analysis level', 'stress class', 'stress cat', 'category', 'cat', 'level'] },
  { key: 'criteria_basis',       label: 'Criteria Basis',      required: false, match: ['criteria basis', 'basis', 'criteria', 'remarks', 'comment'] },
  { key: 'analysis_method',      label: 'Analysis Method',     required: false, match: ['analysis method', 'method', 'analysis'] },
  { key: 'responsible_engineer', label: 'Responsible Engineer',required: false, match: ['responsible engineer', 'engineer', 'responsible', 'stress engineer', 'checked by'] },
  // optional mirror fields used for conflict detection
  { key: 'size',               label: 'Size (optional)',              required: false, match: ['size', 'nps', 'line size'] },
  { key: 'pipe_class',         label: 'Pipe Class (optional)',        required: false, match: ['pipe class', 'piping class', 'material class'] },
  { key: 'design_pressure',    label: 'Design Pressure (optional)',   required: false, match: ['design pressure', 'dp', 'des pressure'] },
  { key: 'design_temperature', label: 'Design Temperature (optional)',required: false, match: ['design temperature', 'design temp', 'dt'] },
];

export const FILE_KINDS = {
  lineList: { key: 'lineList', title: 'Process Line List', fields: LINE_LIST_FIELDS,
    templateHeader: LINE_LIST_FIELDS.map(f => f.label) },
  stress:   { key: 'stress', title: 'Stress Criticality', fields: STRESS_FIELDS,
    templateHeader: STRESS_FIELDS.filter(f => !f.label.includes('(optional)')).map(f => f.label) },
};

export const STRESS_CATEGORIES = ['L1', 'L2', 'L3', 'Non-critical'];
export const CAT_PILL = {
  'L1': 'rd-pill-danger', 'L2': 'rd-pill-warning',
  'L3': 'rd-pill-info', 'Non-critical': 'rd-pill-success',
  'Not assessed': 'rd-pill-neutral',
};

/**
 * Level allocation — normalise any stress-criticality cell value onto the
 * canonical levels L1 / L2 / L3 / Non-critical. Handles vendor vocabularies:
 *   L1 ← "L1", "Cat 1", "Level 1", "1", "Comprehensive", "Full", "Critical", "High"
 *   L2 ← "L2", "Cat 2", "Level 2", "2", "Simplified", "Moderate", "Medium"
 *   L3 ← "L3", "Cat 3", "Level 3", "3", "Visual", "Low"
 *   Non-critical ← "NC", "Non critical", "Not critical", "N/A", "None"
 * Returns '' for empty input, null when the value is unrecognised.
 */
export function normalizeCategory(raw) {
  const s = String(raw ?? '').trim().toUpperCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');
  if (!s) return '';
  if (/^(L1|CAT\s?1|CATEGORY 1|LEVEL 1|CLASS 1|1|COMPREHENSIVE|FULL|CRITICAL|HIGH)\b/.test(s)) return 'L1';
  if (/^(L2|CAT\s?2|CATEGORY 2|LEVEL 2|CLASS 2|2|SIMPLIFIED|MODERATE|MEDIUM)\b/.test(s)) return 'L2';
  if (/^(L3|CAT\s?3|CATEGORY 3|LEVEL 3|CLASS 3|3|VISUAL|LOW)\b/.test(s)) return 'L3';
  if (/^(NC|NON\s?CRITICAL|NOT CRITICAL|N\/?A|NONE|NO)\b/.test(s)) return 'Non-critical';
  return null;
}

// --- Line number normalisation ----------------------------------------------
/** trim, upper-case, unify separators (space/_/. – /inch quotes ⇒ '-'). */
export function normalizeLineNo(v) {
  return String(v ?? '')
    .trim().toUpperCase()
    .replace(/["″']/g, '')
    .replace(/[\s_.–—\/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Parsing -----------------------------------------------------------------
export async function parseWorkbook(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`File exceeds the 25 MB limit (${(file.size / 1048576).toFixed(1)} MB).`);
  if (!ACCEPT_EXT.some(e => file.name.toLowerCase().endsWith(e))) throw new Error('Unsupported file type. Use .xlsx, .xls or .csv.');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = {};
  wb.SheetNames.forEach(name => {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  });
  return { sheets, sheetNames: wb.SheetNames };
}

/** Auto-detect header row: first row with ≥3 non-empty cells, preferring one
 *  that hits known synonyms for this file kind. */
export function detectHeaderRow(grid, fields) {
  let best = 0, bestScore = -1;
  grid.slice(0, 20).forEach((row, i) => {
    const nonEmpty = row.filter(c => String(c).trim() !== '').length;
    if (nonEmpty < 3) return;
    const lower = row.map(c => String(c).trim().toLowerCase());
    const score = lower.reduce((s, cell) =>
      s + (fields.some(f => f.match.some(m => cell === m || cell.includes(m))) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

export function gridToHeadersAndRows(grid, headerRow) {
  const headers = (grid[headerRow] || []).map((h, i) => String(h).trim() || `col_${i + 1}`);
  const rows = grid.slice(headerRow + 1)
    .map((r, i) => ({ values: r, excelRow: headerRow + 2 + i }))
    .filter(r => r.values.some(c => String(c).trim() !== ''));
  return { headers, rows };
}

/** Guess a column mapping from uploaded headers. Scored matching
 *  (exact > starts-with > contains) and never assigns the same header twice. */
export function guessMapping(headers, fields) {
  const lower = headers.map(h => h.toLowerCase());
  const taken = new Set();
  const mapping = {};
  // Most-specific fields first (longer synonym lists / earlier declaration).
  fields.forEach(f => {
    let bestIdx = -1, bestScore = -1;
    lower.forEach((h, i) => {
      if (taken.has(i) || !h) return;
      let score = 0;
      f.match.forEach(m => {
        if (h === m) score = Math.max(score, 100 + m.length);
        else if (h.startsWith(m)) score = Math.max(score, 60 + m.length);
        else if (h.includes(m)) score = Math.max(score, 30 + m.length);
      });
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });
    if (bestIdx >= 0) { taken.add(bestIdx); mapping[f.key] = headers[bestIdx]; }
    else mapping[f.key] = '';
  });
  return mapping;
}

/** Apply mapping ⇒ { records, issues }. Issues carry the Excel row number. */
export function applyMapping(rows, headers, mapping, fields) {
  const issues = [];
  const unmapped = fields.filter(f => f.required && !mapping[f.key]);
  unmapped.forEach(f => issues.push({ severity: 'error', row: null, message: `Required column "${f.label}" is not mapped.` }));
  const records = rows.map(r => {
    const rec = { _row: r.excelRow };
    // keep every original column so the register/export mirror the file
    rec._raw = Object.fromEntries(headers.map((h, i) => [h, String(r.values[i] ?? '').trim()]));
    fields.forEach(f => {
      const hdr = mapping[f.key];
      rec[f.key] = hdr ? String(r.values[headers.indexOf(hdr)] ?? '').trim() : '';
    });
    fields.filter(f => f.required).forEach(f => {
      if (mapping[f.key] && !rec[f.key]) {
        issues.push({ severity: 'error', row: r.excelRow, message: `Row ${r.excelRow}: missing required "${f.label}".` });
      }
    });
    return rec;
  });
  // Level allocation: normalise stress-category values onto Cat 1/2/3/Non-critical
  if (fields.some(f => f.key === 'stress_category') && mapping.stress_category) {
    records.forEach(rec => {
      const norm = normalizeCategory(rec.stress_category);
      if (norm === null) {
        issues.push({ severity: 'warning', row: rec._row, message: `Row ${rec._row}: unrecognised stress level "${rec.stress_category}" — kept as-is; expected L1 / L2 / L3 / Non-critical.` });
      } else if (norm !== '') {
        rec.stress_category_raw = rec.stress_category;
        rec.stress_category = norm;
      }
    });
  }
  // duplicate line numbers are warnings
  const seen = {};
  records.forEach(rec => {
    const k = normalizeLineNo(rec.line_number);
    if (!k) return;
    if (seen[k]) issues.push({ severity: 'warning', row: rec._row, message: `Row ${rec._row}: duplicate line number "${rec.line_number}" (first on row ${seen[k]}).` });
    else seen[k] = rec._row;
  });
  return { records, issues };
}

// --- Matching ----------------------------------------------------------------
const NUM = v => { const n = parseFloat(String(v).replace(/[^\d.\-]/g, '')); return isNaN(n) ? null : n; };
const sameVal = (a, b, numeric) => {
  if (a === '' || a == null || b === '' || b == null) return true; // unknown = no conflict
  if (numeric) { const x = NUM(a), y = NUM(b); return x == null || y == null ? String(a) === String(b) : Math.abs(x - y) < 1e-6; }
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
};

const CONFLICT_FIELDS = [
  { key: 'size', label: 'Size', numeric: false },
  { key: 'pipe_class', label: 'Pipe Class', numeric: false },
  { key: 'design_pressure', label: 'Design P', numeric: true },
  { key: 'design_temperature', label: 'Design T', numeric: true },
];

/** Match stress records onto line-list records.
 *  Returns { lines, notInLineList, conflicts, summary }. */
export function matchFiles(lineRecs, stressRecs) {
  const stressByKey = new Map(stressRecs.map(s => [normalizeLineNo(s.line_number), s]));
  const conflicts = [];
  const usedStress = new Set();

  const lines = lineRecs.map(l => {
    const key = normalizeLineNo(l.line_number);
    const s = stressByKey.get(key);
    if (!s) {
      return { ...l, _key: key, stress_category: 'Not assessed', match_status: 'Missing criticality', _stress: null };
    }
    usedStress.add(key);
    const diffs = CONFLICT_FIELDS
      .filter(f => s[f.key] !== undefined && s[f.key] !== '' && !sameVal(l[f.key], s[f.key], f.numeric))
      .map(f => ({ field: f.label, lineListValue: l[f.key], criticalityValue: s[f.key] }));
    diffs.forEach(d => conflicts.push({ line: l, stress: s, ...d }));
    return {
      ...l, _key: key,
      stress_category: s.stress_category || 'Not assessed',
      criteria_basis: s.criteria_basis, analysis_method: s.analysis_method,
      responsible_engineer: s.responsible_engineer,
      match_status: diffs.length ? 'Conflict' : 'Matched',
      _stress: s,
    };
  });

  const lineKeys = new Set(lineRecs.map(l => normalizeLineNo(l.line_number)));
  const notInLineList = stressRecs.filter(s => !lineKeys.has(normalizeLineNo(s.line_number)));

  const summary = {
    matched: lines.filter(l => l.match_status === 'Matched').length,
    missing: lines.filter(l => l.match_status === 'Missing criticality').length,
    notInLineList: notInLineList.length,
    conflicts: conflicts.length,
  };
  return { lines, notInLineList, conflicts, summary };
}

// --- Revision diff -----------------------------------------------------------
/** Diff old vs new record sets (on normalised line number). */
export function diffRevisions(oldRecs, newRecs) {
  const oldMap = new Map((oldRecs || []).map(r => [normalizeLineNo(r.line_number), r]));
  const newMap = new Map(newRecs.map(r => [normalizeLineNo(r.line_number), r]));
  const added = [], removed = [], changed = [];
  newMap.forEach((r, k) => {
    if (!oldMap.has(k)) { added.push(r); return; }
    const o = oldMap.get(k);
    const delta = Object.keys(r).filter(key => !key.startsWith('_') && String(r[key]) !== String(o[key]));
    if (delta.length) changed.push({ line: r, fields: delta });
  });
  oldMap.forEach((r, k) => { if (!newMap.has(k)) removed.push(r); });
  return { added, removed, changed };
}

// --- Register export ---------------------------------------------------------
/** Export the register in the uploaded file's own column layout, with
 *  "Stress Category" appended as the LAST column (colour-coded + filter). */
export async function exportRegisterWorkbook(lines, rawHeaders, meta = {}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Critical Line List');
  const headers = [...rawHeaders, 'Stress Category'];
  ws.columns = headers.map(h => ({ header: h, key: h, width: Math.max(14, String(h).length + 4) }));
  const FILLS = { L1: 'FFDC2626', L2: 'FFD97706', L3: 'FF0284C7', 'Non-critical': 'FF059669' };
  lines.forEach(l => {
    const row = ws.addRow({ ...(l._raw || {}), 'Stress Category': l.stress_category || '' });
    const cell = row.getCell('Stress Category');
    const fill = FILLS[l.stress_category];
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
export function downloadTemplate(kind) {
  const def = FILE_KINDS[kind];
  const ws = XLSX.utils.aoa_to_sheet([def.templateHeader]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, kind === 'lineList' ? 'Process Line List' : 'Stress Criticality');
  XLSX.writeFile(wb, `${def.title.replace(/\s+/g, '_')}_Template.xlsx`);
}

// --- Discrepancies (Review Queue) --------------------------------------------
/** Build review-queue items from the current match state. */
export function buildDiscrepancies(matchResult, resolved = {}) {
  if (!matchResult) return [];
  const items = [];
  matchResult.conflicts.forEach((c, i) => {
    const id = `conflict-${c.line._key}-${c.field}`;
    items.push({
      id, severity: 'warning', issue: `${c.field} mismatch`,
      line_number: c.line.line_number, line: c.line,
      lineListValue: c.lineListValue, criticalityValue: c.criticalityValue,
      cat: c.stress?.stress_category || c.line.stress_category,
      resolved: resolved[id] || null,
    });
  });
  matchResult.lines.filter(l => l.match_status === 'Missing criticality').forEach(l => {
    const id = `missing-${l._key}`;
    items.push({
      id, severity: 'danger', issue: 'Missing criticality', line_number: l.line_number, line: l,
      lineListValue: l.pipe_class, criticalityValue: '—', cat: 'Not assessed', resolved: resolved[id] || null,
    });
  });
  // RADAI-allocated level (Size × Design Temperature) disagrees with the
  // level in the uploaded Stress Criticality file.
  matchResult.lines.filter(l => l.category_mismatch).forEach(l => {
    const id = `cat-${l._key}`;
    items.push({
      id, severity: 'warning', issue: 'Stress category mismatch (file vs RADAI allocation)',
      line_number: l.line_number, line: l,
      lineListValue: `RADAI: ${l.generated_category} (Size ${l.size}, DT ${l.design_temperature})`,
      criticalityValue: `File: ${l.file_category}`, cat: l.file_category, resolved: resolved[id] || null,
    });
  });
  // RADAI-generated lines that could not be fully classified from the line
  // list alone (insufficient data, below NPS 1) need a stress engineer.
  matchResult.lines.filter(l => l._generated?.needs_review).forEach(l => {
    const id = `review-${l._key}`;
    items.push({
      id, severity: 'warning', issue: `Auto-classification needs review (${l._generated.flags.join(', ').replace(/_/g, ' ').toLowerCase()})`,
      line_number: l.line_number, line: l,
      lineListValue: `Size ${l.size || '—'} / DT ${l.design_temperature || '—'}`,
      criticalityValue: l.stress_category, cat: l.stress_category, resolved: resolved[id] || null,
    });
  });
  matchResult.notInLineList.forEach(s => {
    const id = `extra-${normalizeLineNo(s.line_number)}`;
    items.push({
      id, severity: 'orange', issue: 'Not in line list', line_number: s.line_number, line: null,
      lineListValue: '—', criticalityValue: s.stress_category || '', cat: s.stress_category,
      resolved: resolved[id] || null,
    });
  });
  return items.filter(i => !i.resolved);
}
