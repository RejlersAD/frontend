/**
 * Pump Hydraulic — Excel Exporter (client-side)
 * =============================================
 * Builds a .xlsx workbook with one sheet per tab, populated from the
 * current form state (`localStorage[STORAGE_KEY]`).
 *
 * Soft-coded: every sheet's structure is derived directly from the
 * `PUMP_HYDRAULIC_TABS` config — no extra mapping needed when the
 * template is extended.
 *
 * Uses the existing `xlsx` (SheetJS) dependency — no backend round-trip.
 */
import * as XLSX from 'xlsx';
import PUMP_HYDRAULIC_TABS, { STORAGE_KEY } from './pumpHydraulicTemplate.config';

// ─── Soft-coded constants ────────────────────────────────────────────────
const DEFAULT_FILENAME = 'Pump_Hydraulic_Calculation.xlsx';
const COL_WIDTH_LABEL  = 38;
const COL_WIDTH_UNIT   = 10;
const COL_WIDTH_VALUE  = 18;
const TITLE_ROW_HEIGHT = 22;

// ─── Helpers ─────────────────────────────────────────────────────────────
const loadFormState = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const cell = (v) => (v === undefined || v === null ? '' : v);

// Build a 2D array (AOA) for one tab.
const buildSheetAOA = (tab, state) => {
  const aoa = [];
  // Title row
  aoa.push([`PUMP HYDRAULIC CALCULATION — ${tab.label.toUpperCase()}`]);
  if (tab.description) aoa.push([tab.description]);
  aoa.push([]); // spacer

  for (const section of tab.sections || []) {
    if (section.title) aoa.push([section.title]);

    if (section.columns) {
      // Matrix-style: write column headers + each row
      aoa.push(section.columns);
      for (const row of section.rows) {
        if (row.kind === 'header')   { aoa.push([row.text]); continue; }
        if (row.kind === 'note')     { aoa.push([row.text]); continue; }

        if (row.kind === 'matrixRow') {
          const total = section.columns.length;
          const hasUnit = total - 1 - row.cols >= 1;
          const line = [row.label];
          if (hasUnit) line.push(row.unit || '');
          for (let i = 0; i < row.cols; i++) {
            line.push(cell(state[`${row.key}.${i}`]));
          }
          aoa.push(line);
        } else if (row.kind === 'matrix') {
          const rowsCount = row.defaultRows || 5;
          for (let r = 0; r < rowsCount; r++) {
            const line = [];
            for (let c = 0; c < row.cols; c++) {
              const isFixedFirst = row.fixedFirstCol && c === 0;
              line.push(isFixedFirst ? r + 1 : cell(state[`${row.key}.${r}.${c}`]));
            }
            aoa.push(line);
          }
        } else if (row.kind === 'field') {
          // Single field embedded in a matrix section
          aoa.push([row.label, row.unit || '', cell(state[row.key])]);
        }
      }
    } else {
      // Flat (label / unit / value) layout
      for (const row of section.rows) {
        if (row.kind === 'header') { aoa.push([row.text]); continue; }
        if (row.kind === 'note')   { aoa.push([row.text]); continue; }
        if (row.kind === 'field') {
          aoa.push([row.label, row.unit || '', cell(state[row.key])]);
        }
      }
    }
    aoa.push([]); // section spacer
  }
  return aoa;
};

// Apply column widths and merge title row.
const styliseSheet = (ws, hasMatrix) => {
  // Column widths
  if (!ws['!cols']) ws['!cols'] = [];
  if (hasMatrix) {
    ws['!cols'][0] = { wch: COL_WIDTH_LABEL };
    ws['!cols'][1] = { wch: COL_WIDTH_UNIT };
    for (let c = 2; c < 14; c++) ws['!cols'][c] = { wch: COL_WIDTH_VALUE };
  } else {
    ws['!cols'][0] = { wch: COL_WIDTH_LABEL };
    ws['!cols'][1] = { wch: COL_WIDTH_UNIT };
    ws['!cols'][2] = { wch: COL_WIDTH_VALUE * 2 };
  }
  // Row 1 height
  if (!ws['!rows']) ws['!rows'] = [];
  ws['!rows'][0] = { hpx: TITLE_ROW_HEIGHT };
};

// ─── Public API ──────────────────────────────────────────────────────────
export const exportPumpHydraulicWorkbook = (filename = DEFAULT_FILENAME) => {
  const state = loadFormState();
  const wb = XLSX.utils.book_new();

  for (const tab of PUMP_HYDRAULIC_TABS) {
    if (tab.isUploadTab) continue; // skip the upload tab — not a datasheet sheet
    const aoa = buildSheetAOA(tab, state);
    const ws  = XLSX.utils.aoa_to_sheet(aoa);
    const hasMatrix = (tab.sections || []).some((s) => !!s.columns);
    styliseSheet(ws, hasMatrix);

    // Excel sheet-name cap = 31 chars
    const safeName = String(tab.label).slice(0, 31).replace(/[\\/*?:[\]]/g, ' ');
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }

  XLSX.writeFile(wb, filename);
};

export default exportPumpHydraulicWorkbook;
