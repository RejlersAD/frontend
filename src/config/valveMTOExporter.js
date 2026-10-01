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

// ─── "Download All Data" — raw, complete dump (separate from the
// standard template above, which stays unchanged) ─────────────────────────
// Exact customer column set/order/names (16 columns) on every sheet, with
// every row — including the line-recovery placeholder rows the standard
// export already includes too (neither export has ever filtered those
// out; nothing to change there).
//
// NOTE on what's NOT here: this customer list has no LINE NUMBER, BORE,
// QTY COMBINED, or OP. STATUS column — all four were in this export's
// previous column set. line_number in particular is real, well-populated
// data (the valve's own line/piping tag — not the same thing as the new
// P&ID NUMBER column below, which is the DRAWING SHEET number). Dropped
// here only because this exact 16-column list was given as "exact
// customer column names" to match; flagging in case that omission was
// unintentional — the data itself isn't lost anywhere else (still a real
// column in both the model and the standard "Download Valve MTO" export
// above).
//
// "RATING / FACING" combines two separate underlying fields (`rating` +
// the newer `facing` — see apps.valve_mto.models.ValveMTORow's migration
// 0003) into one string, e.g. "150# RF", matching the customer template's
// single combined column; both remain independently stored/round-tripped
// everywhere else (this is purely a display-time join for this column).
const ALL_DATA_COLUMNS = [
  { key: 'sl_no',          label: 'SL. NO.',                       width:  8, source: (r, idx) => idx + 1 },
  { key: 'area',           label: 'AREA',                          width: 10, source: (r) => r.area },
  { key: 'tag_number',     label: 'VALVE TAG',                     width: 14, source: (r) => r.valve_tag },
  { key: 'valve_type',     label: 'TYPE',                          width: 22, source: (r) => r.type },
  { key: 'pms_class',      label: 'PIPING MATERIAL CLASS',         width: 22, source: (r) => r.pms_class },
  { key: 'piping_class',   label: 'PIPING CLASS',                  width: 14, source: (r) => r.piping_class },
  { key: 'rating_facing',  label: 'RATING / FACING',               width: 16, source: (r) => [r.rating, r.facing].filter(Boolean).join(' ') },
  { key: 'size_primary',   label: 'SIZE 1 (NB)',                   width: 12, source: (r) => r.size_1 },
  { key: 'size_secondary', label: 'SIZE 2 (NB)',                   width: 14, source: (r) => r.size_2 },
  { key: 'pid_number',     label: 'P&ID NUMBER',                   width: 20, source: (r) => r.pid_number },
  { key: 'line_list_ref',  label: 'LINE LIST',                     width: 18, source: (r) => r.line_list },
  { key: 'description',    label: 'DESCRIPTION',                   width: 38, source: (r) => r.description },
  { key: 'qty_island',     label: 'Total to be ordered (ISLAND)',  width: 18, source: (r) => Number(r.qty_island) || 0 },
  { key: 'qty_field',      label: 'Total to be ordered (FIELD)',   width: 18, source: (r) => Number(r.qty_field) || 0 },
  { key: 'unit',           label: 'UNIT',                          width:  8, source: (r) => r.unit },
  { key: 'remarks',        label: 'REMARKS',                       width: 24, source: (r) => r.remarks },
];

const ALL_DATA_SHEET_DEFS = [
  { name: 'ALL VALVES',   filter: (rows) => rows },
  { name: 'ISLAND',       filter: (rows) => rows.filter((r) => normArea(r.area) === 'island') },
  { name: 'FIELD',        filter: (rows) => rows.filter((r) => normArea(r.area) === 'field') },
  { name: 'COMBINED MTO', filter: (rows) => rows },
];

const buildAllDataSheet = ({ name, filter }, rows, project) => {
  const aoa = [];
  aoa.push(...buildHeaderBlock(project, `VALVE MTO — ${name} (ALL DATA)`));
  aoa.push(ALL_DATA_COLUMNS.map((c) => c.label));
  filter(rows).forEach((r, idx) => {
    aoa.push(ALL_DATA_COLUMNS.map((c) => {
      const v = c.source(r, idx);
      return v === undefined || v === null ? '' : v;
    }));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = ALL_DATA_COLUMNS.map((c) => ({ wch: c.width }));
  ws['!rows'] = [{ hpx: TITLE_ROW_HEIGHT }];
  ws['!rows'][4] = { hpx: HEADER_ROW_HEIGHT };
  return ws;
};

export const exportValveMTOAllData = ({
  rows = [],
  project = {},
  filename = DEFAULT_FILENAME,
} = {}) => {
  const wb = XLSX.utils.book_new();
  // ALL VALVES appended FIRST — the sheet a workbook opens on is the
  // first one in its sheet order, which every common reader (Excel,
  // LibreOffice, Google Sheets) honours; also set explicitly below for
  // readers that look at the active-tab flag instead of sheet order.
  for (const def of ALL_DATA_SHEET_DEFS) {
    XLSX.utils.book_append_sheet(wb, buildAllDataSheet(def, rows, project), def.name.slice(0, 31));
  }
  XLSX.utils.book_append_sheet(wb, buildPivotSheet(rows), 'Pivot Summary');
  wb.Workbook = { ...(wb.Workbook || {}), Views: [{ RTL: false, activeTab: 0 }] };
  XLSX.writeFile(wb, filename);
};

// Soft-coded: re-exported so callers can introspect (used by tests / debug).
export { SHEET_DEFS };
export default exportValveMTOWorkbook;

// Defensively expose the project-fields list to keep the exporter's inputs
// aligned with the page form.
export const PROJECT_FIELD_KEYS = PROJECT_FIELDS.map((f) => f.key);
