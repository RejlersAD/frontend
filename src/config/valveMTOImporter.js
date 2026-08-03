/**
 * Valve MTO — Excel / CSV Importer (client-side)
 * ===============================================
 * Reads any Valve MTO workbook (.xls / .xlsx / .csv) and maps rows into
 * the canonical schema declared in `valveMTO.config.js`.
 *
 * Soft-coded:
 *   • Header → key mapping uses `aliases` from each column definition.
 *     Adding a new alias is a one-line config change.
 *   • The header row is auto-detected (looks for the row that contains
 *     >= 4 known column aliases).
 *   • Sheet selection: defaults to the first sheet that yields data, but
 *     skips obvious metadata sheets (Notes, SPReport_Definition, Pivot).
 */
import * as XLSX from 'xlsx';
import { VALVE_COLUMNS, AREA_OPTIONS, DEFAULT_ROW } from './valveMTO.config';
import { deriveRemarksFromRow, mergeRemarks } from './valveMTORemarks';

// ─── Soft-coded constants ────────────────────────────────────────────────
const HEADER_SCAN_DEPTH    = 12;   // rows scanned at top of each sheet
const MIN_ALIAS_HITS       = 4;    // threshold to accept a row as the header
const SHEET_BLACKLIST_RE   = /^(notes|notes\s|spreport_definition|pivot|cover|index)$/i;
const PROJECT_HEADER_KEYS  = {
  doc_no: ['company doc. no.', 'company doc no', 'doc no.', 'doc no', 'document no'],
  doc_title: ['title'],
  doc_desc: ['doc. description', 'description', 'doc description'],
  revision: ['rev.', 'rev', 'revision'],
  doc_date: ['date'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Build header → column-key map for one sheet by scanning the top rows.
const detectHeader = (rows) => {
  const aliasMap = new Map(); // alias → column key
  for (const c of VALVE_COLUMNS) {
    aliasMap.set(norm(c.label), c.key);
    for (const a of c.aliases || []) aliasMap.set(norm(a), c.key);
  }

  let bestRow = -1;
  let bestHits = 0;
  let bestMap = null;

  const limit = Math.min(HEADER_SCAN_DEPTH, rows.length);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    const colMap = {}; // colIndex → columnKey
    let hits = 0;
    for (let c = 0; c < row.length; c++) {
      const k = aliasMap.get(norm(row[c]));
      if (k && !Object.values(colMap).includes(k)) {
        colMap[c] = k;
        hits += 1;
      }
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestRow = r;
      bestMap = colMap;
    }
  }

  if (bestHits < MIN_ALIAS_HITS) return null;
  return { headerRow: bestRow, colMap: bestMap };
};

// Try to extract project metadata from a "Notes"-style sheet.
const extractProjectMeta = (rows) => {
  const meta = {};
  const flat = (rows || []).flatMap((r, i) => (r || []).map((cell, j) => ({ r: i, c: j, v: cell })));
  for (const { r, c, v } of flat) {
    if (v === undefined || v === null) continue;
    const key = norm(v).replace(/[:.]+$/, '').trim();
    for (const [field, aliases] of Object.entries(PROJECT_HEADER_KEYS)) {
      if (aliases.includes(key)) {
        // Look right or below for the value.
        const candidates = [
          rows[r]?.[c + 1], rows[r]?.[c + 2],
          rows[r + 1]?.[c], rows[r + 1]?.[c + 1],
        ].filter((x) => x !== undefined && x !== null && String(x).trim() !== '');
        if (candidates.length && !meta[field]) {
          meta[field] = String(candidates[0]).trim();
        }
      }
    }
  }
  return meta;
};

// Coerce a cell into the right type for a column key.
const coerce = (key, raw) => {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (key === 'sl_no' || key === 'qty_island' || key === 'qty_field' || key === 'unit') {
    if (s === '') return 0;
    const n = Number(s.replace(/[, ]+/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  if (key === 'area') {
    const m = AREA_OPTIONS.find((a) => norm(a) === norm(s));
    return m || s;
  }
  return s;
};

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Parse a .xls/.xlsx/.csv file.
 * @returns {Promise<{rows: Array, projectMeta: Object, debug: Object}>}
 */
export const importValveMTOFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  let projectMeta = {};
  const collected = [];
  const debug = { sheetsTried: [], chosenSheets: [] };

  for (const name of wb.SheetNames) {
    debug.sheetsTried.push(name);

    // Try to harvest project metadata from any "Notes"-like sheet.
    if (/notes/i.test(name)) {
      const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
      const meta = extractProjectMeta(sheetRows);
      projectMeta = { ...meta, ...projectMeta };
    }
    if (SHEET_BLACKLIST_RE.test(name.trim())) continue;

    const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const det = detectHeader(sheetRows);
    if (!det) continue;
    debug.chosenSheets.push({ name, headerRow: det.headerRow, hits: Object.keys(det.colMap).length });

    // Default-area fallback: sheet name often equals the area (ISLAND / FIELD).
    const sheetArea =
      AREA_OPTIONS.find((a) => norm(a) === norm(name))
      || (norm(name).includes('combined') ? 'COMBINED' : null);

    for (let r = det.headerRow + 1; r < sheetRows.length; r++) {
      const raw = sheetRows[r] || [];
      // Skip blank rows.
      if (!raw.some((c) => String(c ?? '').trim() !== '')) continue;
      // Skip obvious section / sub-header rows (no SL.NO. and no VALVE TAG).
      const row = DEFAULT_ROW();
      let filled = 0;
      for (const [colIdx, key] of Object.entries(det.colMap)) {
        const v = coerce(key, raw[Number(colIdx)]);
        row[key] = v;
        if (v !== '' && v !== 0) filled += 1;
      }
      // Need at least a tag OR a description OR a type to count.
      if (!row.valve_tag && !row.description && !row.type) continue;
      if (filled < 3) continue;
      if (!row.area && sheetArea) row.area = sheetArea;
      // Soft-coded Remark derivation from any text field; merge with any
      // pre-existing free-text remarks so engineering notes survive.
      const derived = deriveRemarksFromRow(row);
      if (derived) row.remarks = mergeRemarks(row.remarks, derived);
      collected.push(row);
    }
  }

  // De-duplicate identical rows (same tag + class + size + area).
  const seen = new Set();
  const rows = [];
  for (const r of collected) {
    const k = [r.area, r.valve_tag, r.pms_class, r.size_1, r.rating, r.description].map(norm).join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(r);
  }

  // Renumber SL. NO. so the imported set is contiguous.
  rows.forEach((r, i) => { r.sl_no = i + 1; });
  return { rows, projectMeta, debug };
};

export default importValveMTOFile;
