/**
 * Valve MTO — Excel Exporter (client-side)
 * =========================================
 * Emits a 5-sheet workbook matching the standard PIPING VALVES MTO
 * template:
 *   1) Notes        — project header + numbered notes
 *   2) ISLAND       — valves where area = 'ISLAND'
 *   3) FIELD        — valves where area = 'Field'
 *   4) COMBINED MTO — every row, with the BORE column instead of SIZE 2
 *   5) Pivot        — aggregated quantity by Type / Class / Size / Tag
 *
 * Soft-coded:
 *   • Sheet → area mapping in `SHEET_DEFS`.
 *   • Column visibility per sheet in `SHEET_DEFS[*].columns`.
 *   • Project header & notes pulled from valveMTO.config.js so editing
 *     either propagates everywhere.
 */
import * as XLSX from 'xlsx';
import {
  VALVE_COLUMNS, PROJECT_FIELDS, STANDARD_NOTES, DEFAULT_FILENAME,
} from './valveMTO.config';

// ─── Soft-coded sheet definitions ────────────────────────────────────────
// Each sheet selects its rows + the columns to render.
const COMMON_COLS = [
  'sl_no', 'area', 'type', 'pms_class', 'rating', 'size_1',
];

const SHEET_DEFS = [
  {
    name: 'ISLAND',
    filter: (rows) => rows.filter((r) => normArea(r.area) === 'island'),
    columns: [...COMMON_COLS, 'size_2', 'line_number', 'valve_tag', 'description', 'qty_island', 'qty_field', 'unit', 'remarks'],
    headerTitle: 'VALVE MTO — ISLAND',
  },
  {
    name: 'FIELD',
    filter: (rows) => rows.filter((r) => normArea(r.area) === 'field'),
    columns: [...COMMON_COLS, 'size_2', 'line_number', 'valve_tag', 'description', 'qty_island', 'qty_field', 'unit', 'remarks'],
    headerTitle: 'VALVE MTO — FIELD',
  },
  {
    name: 'COMBINED MTO',
    filter: (rows) => rows,
    // The standard COMBINED sheet uses BORE in place of SIZE 2.
    columns: [...COMMON_COLS, 'bore', 'line_number', 'valve_tag', 'description', 'qty_island', 'qty_field', 'unit', 'remarks'],
    headerTitle: 'VALVE MTO — COMBINED',
  },
];

const TITLE_ROW_HEIGHT  = 22;
const HEADER_ROW_HEIGHT = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────
function normArea(a) {
  return String(a || '').trim().toLowerCase();
}

const colByKey = Object.fromEntries(VALVE_COLUMNS.map((c) => [c.key, c]));

const buildHeaderBlock = (project, headerTitle) => {
  // 4-row header block matching the template.
  const empty = ['', '', '', '', '', '', '', '', '', '', '', '', ''];
  return [
    ['DETAILED ENGINEERING PACKAGE — PIPING VALVES MATERIAL TAKE-OFF', ...empty.slice(1)],
    empty,
    empty,
    [
      'DOC NO.:', project.doc_no || '',
      '', 'DOC. Description', project.doc_desc || headerTitle,
      '', '', 'REV', project.revision || '',
      '', '', '', '',
    ],
  ];
};

const buildDataSheet = ({ name, filter, columns, headerTitle }, rows, project) => {
  const aoa = [];
  aoa.push(...buildHeaderBlock(project, headerTitle));

  // Column header row
  aoa.push(columns.map((k) => colByKey[k]?.label || k));

  // Data rows
  const data = filter(rows);
  data.forEach((r, idx) => {
    const line = columns.map((k) => {
      if (k === 'sl_no') return idx + 1;
      const v = r[k];
      if (v === undefined || v === null) return '';
      return v;
    });
    aoa.push(line);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((k) => ({ wch: colByKey[k]?.width || 14 }));
  ws['!rows'] = [{ hpx: TITLE_ROW_HEIGHT }];
  ws['!rows'][4] = { hpx: HEADER_ROW_HEIGHT };
  return ws;
};

const buildNotesSheet = (project) => {
  const aoa = [];
  aoa.push(['DETAILED ENGINEERING PACKAGE — PIPING VALVES MATERIAL TAKE-OFF']);
  aoa.push([]);
  aoa.push([]);
  aoa.push([]);
  aoa.push([]);
  aoa.push(['COMPANY Doc. No.:', '', '', '', 'Rev.', '', '', 'TITLE', '', '', '', '', '', '', '', '', '', 'Date:', '', '', project.doc_date || '']);
  aoa.push([project.doc_no || '', '', '', '', project.revision || '', '', '', project.doc_title || 'PIPING VALVES MTO']);
  aoa.push([]);
  aoa.push(['NOTES:']);
  STANDARD_NOTES.forEach((note, i) => aoa.push(['', i + 1, note]));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 24 }, { wch: 4 }, { wch: 70 },
  ];
  return ws;
};

const buildPivotSheet = (rows) => {
  // Aggregate by Type / Class / Size / Tag — equivalent to the template pivot.
  const groups = new Map();
  for (const r of rows) {
    const key = [r.type, r.pms_class, r.size_1, r.valve_tag].filter(Boolean).join(' / ');
    if (!key.trim()) continue;
    const cur = groups.get(key) || 0;
    const total = (Number(r.qty_island) || 0) + (Number(r.qty_field) || 0);
    groups.set(key, cur + total);
  }
  const aoa = [
    ['TYPE', '(All)'],
    ['SIZE 1 (NB)', '(All)'],
    ['PIPING MATERIAL CLASS', '(All)'],
    ['VALVE TAG', '(All)'],
    [],
    ['Sum of Total to be ordered', ''],
    ['Combine', 'Total'],
  ];
  const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of sorted) aoa.push([k, v]);
  aoa.push(['Grand Total', sorted.reduce((acc, [, v]) => acc + v, 0)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 50 }, { wch: 12 }];
  return ws;
};

// ─── Public API ──────────────────────────────────────────────────────────
export const exportValveMTOWorkbook = ({
  rows = [],
  project = {},
  filename = DEFAULT_FILENAME,
} = {}) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildNotesSheet(project), 'Notes');
  for (const def of SHEET_DEFS) {
    XLSX.utils.book_append_sheet(wb, buildDataSheet(def, rows, project), def.name.slice(0, 31));
  }
  XLSX.utils.book_append_sheet(wb, buildPivotSheet(rows), 'Pivot');
  XLSX.writeFile(wb, filename);
};

// Soft-coded: re-exported so callers can introspect (used by tests / debug).
export { SHEET_DEFS };
export default exportValveMTOWorkbook;

// Defensively expose the project-fields list to keep the exporter's inputs
// aligned with the page form.
export const PROJECT_FIELD_KEYS = PROJECT_FIELDS.map((f) => f.key);
