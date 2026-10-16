/**
 * Valve MTO — Template Schema (Soft-coded)
 * =========================================
 * Single source of truth for the entire Valve Material Take-Off page.
 * Mirrors the standard "PIPING VALVES MTO" template (Notes / ISLAND / FIELD
 * / COMBINED MTO / Pivot — 13 columns).
 *
 * Edit this file to:
 *   • Add / remove / rename a column → flows through to UI, importer,
 *     exporter and pivot.
 *   • Add a new valve type, rating, unit, area or face type.
 *   • Adjust the column-header detection map for sheet importers.
 */
import { Wrench, Map as MapIcon, FolderTree, BarChart3, UploadCloud, History as HistoryIcon, FolderKanban, Activity } from 'lucide-react';

// ─── Persistence ──────────────────────────────────────────────────────────
export const STORAGE_KEY      = 'radai.valveMTO.state.v1';
export const REFRESH_EVENT    = 'radai:valveMTO:stateRefresh';

// ─── Project-level (header) fields ────────────────────────────────────────
export const PROJECT_FIELDS = [
  { key: 'doc_no',       label: 'COMPANY Doc. No.', placeholder: 'e.g. PJ6-EXD-GEN-TX0T-0004' },
  { key: 'doc_title',    label: 'Title',            placeholder: 'PIPING VALVES MTO' },
  { key: 'doc_desc',     label: 'Doc. Description', placeholder: 'VALVE MTO - <PROJECT>' },
  { key: 'revision',     label: 'Rev',              placeholder: '0' },
  { key: 'doc_date',     label: 'Date',             placeholder: 'YYYY-MM-DD' },
  { key: 'project_name', label: 'Project',          placeholder: 'e.g. MUBARRAZ' },
];

// ─── Soft-coded option lists (free text still allowed) ────────────────────
export const AREA_OPTIONS = ['ISLAND', 'Field', 'COMBINED'];
export const allocationTab = (row) => {
  const tab = String(row.tab || '').trim().toLowerCase();
  if (['island', 'field', 'combined'].includes(tab)) return tab;
  const island = Number(row.qty_island) > 0;
  const field = Number(row.qty_field) > 0;
  if (island || field) return island && field ? 'combined' : (island ? 'island' : 'field');
  const legacyArea = String(row.area || '').trim().toLowerCase();
  return ['island', 'field', 'combined'].includes(legacyArea) ? legacyArea : '';
};
export const VALVE_TYPES  = [
  'BALL VALVE', 'GATE VALVE', 'GLOBE VALVE', 'CHECK VALVE',
  'PLUG VALVE', 'BUTTERFLY VALVE', 'NEEDLE VALVE',
];
export const RATING_OPTIONS = [
  'CLASS 150', 'CLASS 300', 'CLASS 600', 'CLASS 800',
  'CLASS 900', 'CLASS 1500', 'CLASS 2500',
];
export const FACING_SUFFIXES = ['', 'RF', 'RTJ', 'SW', 'BW', 'NPT', 'FF'];
export const SIZE_OPTIONS = [
  '1/4"', '3/8"', '1/2"', '3/4"', '1"', '1 1/2"', '2"', '3"', '4"', '6"',
  '8"', '10"', '12"', '14"', '16"', '18"', '20"', '24"', '30"', '36"',
];
export const BORE_OPTIONS = ['', 'FB', 'RB'];
export const UNIT_OPTIONS = ['EACH', 'NOS', 'SET'];

// ─── Column schema (the heart of everything) ─────────────────────────────
// Each column has:
//   • key       — stable id (used in row state)
//   • label     — header text (must match the template exactly)
//   • width     — Excel column width (chars)
//   • type      — 'text' | 'number' | 'select' (UI hint only)
//   • options?  — soft-coded list for selects
//   • aliases?  — accepted header aliases when importing existing sheets
//   • visible?  — false hides a field in the UI and exports, not stored/imported data
export const VALVE_COLUMNS = [
  { key: 'sl_no',       label: 'SL. NO.',                width:  8, type: 'number',
    aliases: ['sl', 'sl no', 'sr no', 's.no', 'serial', 'item'] },
  { key: 'area',        label: 'AREA',                   width: 48, type: 'text',
    aliases: ['area', 'drg. title', 'drg title', 'drawing title'] },
  { key: 'type',        label: 'TYPE',                   width: 22, type: 'select', options: VALVE_TYPES,
    aliases: ['type', 'valve type'] },
  { key: 'pms_class',   label: 'PIPING MATERIAL CLASS',  width: 22, type: 'text',
    aliases: ['piping material class', 'pms', 'pms class', 'material class', 'class', 'pm class'] },
  // Short piping spec code (e.g. A1A, B1B). Distinct from `pms_class`
  // (the long descriptive name). Soft-coded — UI / exporter / importer
  // auto-pick up via VALVE_COLUMNS; no core logic change required.
  { key: 'piping_class', label: 'PIPING CLASS',          width: 14, type: 'text',
    aliases: ['piping class', 'pipe class', 'pipe spec', 'piping spec', 'spec', 'spec class',
              'class code', 'pipe class code', 'piping class code'] },
  { key: 'rating',      label: 'RATING / FACING',        width: 18, type: 'text',
    aliases: ['rating / facing', 'rating', 'rating facing', 'pressure rating'] },
  { key: 'size_1',      label: 'SIZE (NB)',              width: 12, type: 'select', options: SIZE_OPTIONS,
    aliases: ['size 1 (nb)', 'size 1', 'nb', 'size'] },
  // Retain legacy reduced-size data for existing records and workbook imports.
  { key: 'size_2',      label: 'SIZE 2 (NB)',            width: 14, type: 'select', options: SIZE_OPTIONS, visible: false,
    aliases: ['size 2 (nb)', 'size 2', 'reduced size'] },
  { key: 'bore',        label: 'BORE',                   width:  8, type: 'select', options: BORE_OPTIONS,
    aliases: ['bore', 'fb/rb'] },
  { key: 'pid_number', label: 'P&ID NUMBER',             width: 24, type: 'text',
    aliases: ['p&id number', 'p&id no', 'p&id no.', 'p&id', 'pid number', 'pid no', 'pid no.'] },
  { key: 'line_number', label: 'LINE NUMBER',            width: 24, type: 'text',
    aliases: ['line number', 'line no', 'line no.', 'line', 'line #', 'pipeline number', 'pipeline no', 'line tag', 'line id'] },
  { key: 'facing', label: 'FACING',                     width: 10, type: 'text',
    aliases: ['facing', 'face type', 'flange facing'] },
  // Retain legacy Line List references for existing records and imports.
  { key: 'line_list',   label: 'LINE LIST',              width: 18, type: 'text', visible: false,
    aliases: ['line list', 'line list ref', 'line list reference', 'line list no', 'line list no.',
              'line-list', 'll', 'll no', 'll no.', 'll ref', 'll reference', 'line list document'] },
  { key: 'valve_tag',   label: 'VALVE TAG',              width: 14, type: 'text',
    aliases: ['valve tag', 'tag', 'tag no', 'tag number'] },
  { key: 'description', label: 'DESCRIPTION',            width: 38, type: 'text',
    aliases: ['description', 'desc', 'service description'] },
  { key: 'qty_island',  label: 'Total to be ordered (ISLAND)',  width: 18, type: 'number',
    aliases: ['total to be order ed (island)', 'island', 'island qty', 'total island', 'total to be ordered'] },
  { key: 'qty_field',   label: 'Total to be ordered (FIELD)',   width: 18, type: 'number',
    aliases: ['total to be order ed (field)', 'field', 'field qty', 'total field'] },
  { key: 'qty_observed', label: 'OBSERVED QTY (REVIEW)', width: 18, type: 'number',
    aliases: ['observed qty', 'observed qty (review)', 'observed quantity'] },
  { key: 'unit',        label: 'UNIT',                   width:  8, type: 'text',
    aliases: ['unit', 'uom', 'qty', 'quantity'] },
  { key: 'remarks',     label: 'REMARKS',                width: 24, type: 'text',
    aliases: ['remarks', 'remark', 'comments', 'notes'] },
  // Vision-confidence + on-sheet grid zone returned by the Borouge PE4&PE5
  // extraction prompt (CONFIDENCE / LOCATION_HINT) — additive columns.
  { key: 'confidence',  label: 'CONFIDENCE',             width: 12, type: 'text',
    aliases: ['confidence', 'conf'] },
  { key: 'location_hint', label: 'LOCATION',             width: 10, type: 'text',
    aliases: ['location hint', 'location', 'grid', 'zone'] },
];

export const isValveColumnVisible = (key) =>
  VALVE_COLUMNS.some(column => column.key === key && column.visible !== false);

export const sizeNBFromLineNumber = (lineNumber) => {
  const match = String(lineNumber || '').trim().match(
    /^(\d+(?:(?:[- ]\d+)?\/\d+)?)["\u201d\u2033]\s*[-\u2013\u2014]\s*[A-Z0-9]+[-\u2013\u2014]/i,
  );
  return match ? `${match[1]}"` : '';
};

// ─── Tabs / views ─────────────────────────────────────────────────────────
// Each tab declares an `areaFilter` (or null) which the page uses to filter
// the same underlying valve list — no data duplication.
export const VALVE_TABS = [
  { id: 'projects',  label: 'Projects',         icon: FolderKanban, areaFilter: null,
    description: 'Open or create a project folder to keep its valves separate' },
  { id: 'upload',    label: 'Upload & Extract', icon: UploadCloud, areaFilter: null,
    description: 'Import an existing Valve MTO .xls / .xlsx to auto-populate the table' },
  { id: 'all',       label: 'All Valves',       icon: Wrench,      areaFilter: null,
    description: 'Master list — every valve across ISLAND and FIELD' },
  { id: 'island',    label: 'ISLAND',           icon: MapIcon,     areaFilter: 'ISLAND',
    description: 'Valves located inside Island (process plot)' },
  { id: 'field',     label: 'FIELD',            icon: FolderTree,  areaFilter: 'Field',
    description: 'Valves located in Field' },
  { id: 'combined',  label: 'COMBINED MTO',     icon: FolderTree,  areaFilter: null,
    description: 'Combined MTO across all areas (with bore column)' },
  { id: 'pivot',     label: 'Pivot Summary',    icon: BarChart3,   areaFilter: null,
    description: 'Aggregated quantity by Type / Class / Size / Tag' },
  { id: 'history',   label: 'History',          icon: HistoryIcon, areaFilter: null,
    description: 'Past extractions — restore or reuse without re-running AI Vision' },
  { id: 'performance', label: 'AI Performance', icon: Activity,    areaFilter: null,
    description: 'Track AI Vision extraction accuracy, field completeness and trends' },
];

// ─── Soft-coded notes (rendered on Notes sheet + UI footer) ─────────────────
export const STANDARD_NOTES = [
  'FOR VALVE DETAILS REFER TO RESPECTIVE VALVE DATASHEETS.',
  'THIS MTO IS BASED ON ISSUED P&IDs AND PIPING MATERIAL SPECIFICATIONS.',
  'MTO FOR HYDRO TEST / TEMPORARY VALVES IS NOT INCLUDED.',
  'FOR PAINTING / COATING REFER TO PROJECT PAINTING SPECIFICATION.',
  'PIPING DATASHEET FOR BALL VALVES SHALL BE REFERRED.',
  'PIPING DATASHEET FOR GATE VALVES SHALL BE REFERRED.',
  'PIPING DATASHEET FOR GLOBE VALVES SHALL BE REFERRED.',
  'PIPING DATASHEET FOR CHECK VALVES SHALL BE REFERRED.',
  'PIPING DATASHEET FOR PLUG / BUTTERFLY VALVES SHALL BE REFERRED.',
  'EXTRACTED QUANTITIES COUNT ALL VISIBLE VALVES, INCLUDING EXISTING ITEMS. REVIEW PROJECT SCOPE, CLASSIFICATION AND PROCUREMENT QUANTITIES BEFORE ORDERING.',
];

// ─── Defaults ─────────────────────────────────────────────────────────────
export const DEFAULT_FILENAME = 'Valve_MTO.xlsx';
export const DEFAULT_ROW = () => {
  const row = { id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, tab: '' };
  for (const c of VALVE_COLUMNS) row[c.key] = c.type === 'number' ? 0 : '';
  return row;
};

const _exports = {
  STORAGE_KEY, REFRESH_EVENT, PROJECT_FIELDS, AREA_OPTIONS, VALVE_TYPES,
  RATING_OPTIONS, FACING_SUFFIXES, SIZE_OPTIONS, BORE_OPTIONS, UNIT_OPTIONS,
  VALVE_COLUMNS, isValveColumnVisible, sizeNBFromLineNumber, VALVE_TABS, STANDARD_NOTES, DEFAULT_FILENAME, DEFAULT_ROW,
};
export default _exports;
