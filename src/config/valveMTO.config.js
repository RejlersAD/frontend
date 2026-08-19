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
export const VALVE_COLUMNS = [
  { key: 'sl_no',       label: 'SL. NO.',                width:  8, type: 'number',
    aliases: ['sl', 'sl no', 'sr no', 's.no', 'serial', 'item'] },
  { key: 'area',        label: 'AREA',                   width: 10, type: 'select', options: AREA_OPTIONS,
    aliases: ['area'] },
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
  { key: 'size_1',      label: 'SIZE 1 (NB)',            width: 12, type: 'select', options: SIZE_OPTIONS,
    aliases: ['size 1 (nb)', 'size 1', 'nb', 'size'] },
  // The standard template uses a second column either for a reduced size
  // (ISLAND/FIELD) OR for bore (COMBINED). We keep both — UI shows the one
  // matching the active context, importer maps either.
  { key: 'size_2',      label: 'SIZE 2 (NB)',            width: 14, type: 'select', options: SIZE_OPTIONS,
    aliases: ['size 2 (nb)', 'size 2', 'reduced size'] },
  { key: 'bore',        label: 'BORE',                   width:  8, type: 'select', options: BORE_OPTIONS,
    aliases: ['bore', 'fb/rb'] },
  // Display label is "P&ID NUMBER" but the underlying field key stays
  // `line_number` so all extractor / exporter / storage logic remains
  // unchanged. Legacy "LINE NUMBER" sheets continue to import via aliases.
  { key: 'line_number', label: 'P&ID NUMBER',            width: 24, type: 'text',
    aliases: ['p&id number', 'p&id no', 'p&id no.', 'p&id', 'pid number', 'pid no', 'pid no.',
              'line number', 'line no', 'line no.', 'line', 'line #', 'pipeline number', 'pipeline no', 'line tag', 'line id'] },
  // Reference to the Line List document / entry (e.g. LL doc no, line-list
  // tag, or the originating line-list row id). Soft-coded — UI / exporter /
  // importer auto-pick up via VALVE_COLUMNS; no core logic change required.
  { key: 'line_list',   label: 'LINE LIST',              width: 18, type: 'text',
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
  { key: 'unit',        label: 'UNIT',                   width:  8, type: 'number',
    aliases: ['unit', 'uom', 'qty', 'quantity'] },
  { key: 'remarks',     label: 'REMARKS',                width: 24, type: 'text',
    aliases: ['remarks', 'remark', 'comments', 'notes'] },
];

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
];

// ─── Defaults ─────────────────────────────────────────────────────────────
export const DEFAULT_FILENAME = 'Valve_MTO.xlsx';
export const DEFAULT_ROW = () => {
  const row = { id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  for (const c of VALVE_COLUMNS) row[c.key] = c.type === 'number' ? 0 : '';
  return row;
};

const _exports = {
  STORAGE_KEY, REFRESH_EVENT, PROJECT_FIELDS, AREA_OPTIONS, VALVE_TYPES,
  RATING_OPTIONS, FACING_SUFFIXES, SIZE_OPTIONS, BORE_OPTIONS, UNIT_OPTIONS,
  VALVE_COLUMNS, VALVE_TABS, STANDARD_NOTES, DEFAULT_FILENAME, DEFAULT_ROW,
};
export default _exports;
