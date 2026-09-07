/**
 * Soft-coded configuration for the Instrument IO List Workflow frontend.
 * Mirrors backend/apps/instrument_io_workflow/services/config.py.
 *
 * NEVER hardcode endpoints, column names, status codes, colours, or copy in
 * pages — import them from here. To change the look-and-feel of the entire
 * IO List workflow, edit THIS file only.
 */

// ─────────────────────────────────────────────────────────────────────
// API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_API = {
  base:           '/instrument-io-workflow',
  config:         '/instrument-io-workflow/config/',
  documents:      '/instrument-io-workflow/documents/',
  documentById:   (id) => `/instrument-io-workflow/documents/${id}/`,
  documentStatus: (id) => `/instrument-io-workflow/documents/${id}/status/`,
  reextract:      (id) => `/instrument-io-workflow/documents/${id}/re-extract/`,
  originalPdf:    (id) => `/instrument-io-workflow/documents/${id}/original-pdf/`,
  exportXlsx:     (id) => `/instrument-io-workflow/documents/${id}/export-xlsx/`,
  patchRow:       (docId, rowId) => `/instrument-io-workflow/documents/${docId}/rows/${rowId}/`,
  diff:           '/instrument-io-workflow/diff/',
  visionTestKey:  '/instrument-io-workflow/vision/test-key/',
  pdfPageCount:   '/instrument-io-workflow/pdf-page-count/',
}

// ─────────────────────────────────────────────────────────────────────
// INLINE CELL EDITING — feature flags (soft-coded)
// Set enabled: false to disable edit mode entirely without touching page code.
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_EDIT_CONFIG = {
  /** Master switch — hides the Edit button when false. */
  enabled: true,
  /**
   * Columns whose cells are read-only even in edit mode.
   * 'page_number' is a PDF-source reference and should not be manually changed.
   */
  // 'kind' is the extraction's own structural classification (which
  // OTHER fields on this row are meaningful) — not free-text content a
  // user should hand-edit, same reasoning as page_number.
  nonEditableColumns: ['page_number', 'kind'],
  /** Milliseconds to keep the green 'saved' indicator before clearing it. */
  savedIndicatorMs: 2000,
}

// ─────────────────────────────────────────────────────────────────────
// THEME — design tokens
// ─────────────────────────────────────────────────────────────────────
export const THEME = {
  bannerFrom:    'from-slate-900',
  bannerVia:     'via-indigo-900',
  bannerTo:      'to-blue-900',
  accent:        'indigo',
  card:          'bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow',
  cardHeader:    'px-5 py-3 border-b border-slate-200 bg-slate-50/60',
  tableHead:     'bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider font-semibold',
  tableRow:      'border-t border-slate-100 hover:bg-indigo-50/40 transition-colors',
  badge:         'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
  iconBox:       'w-10 h-10 rounded-lg flex items-center justify-center',
}

// ─────────────────────────────────────────────────────────────────────
// PAGE COPY
// ─────────────────────────────────────────────────────────────────────
export const PAGE_COPY = {
  title:           'Instrument I/O List Workflow',
  subtitle:        'CRS-style multi-revision document workflow — upload an Instrument I/O List PDF and the platform extracts the Comments Resolution Sheet and the structured I/O table automatically.',
  costBanner:      'Powered by PyMuPDF native text + table extraction. AI vision fallback is opt-in and capped — default cost is $0.',
  emptyTitle:      'No I/O List documents yet',
  emptySubtitle:   'Upload your first multi-revision I/O List PDF to begin. The Comments Resolution Sheet and structured I/O table are extracted automatically.',
  detailBack:      'Back to documents',
  legacyLink:      'Legacy generator',
  legacyHint:      'Generate IO List from P&ID (old wizard)',
}

// ─────────────────────────────────────────────────────────────────────
// COMMENT SHEET COLUMNS
// ─────────────────────────────────────────────────────────────────────
export const COMMENT_DISPLAY_COLUMNS = [
  { key: 's_no',              label: 'S.No',              width: 60   },
  { key: 'company_comment',   label: 'COMPANY Comment',   width: 340  },
  { key: 'contractor_reply',  label: 'CONTRACTOR Reply',  width: 340  },
  { key: 'company_decision',  label: 'COMPANY Decision',  width: 260  },
  { key: 'status_code',       label: 'Status',            width: 140  },
  { key: 'page_number',       label: 'Page',              width: 70   },
  { key: 'linked_tags',       label: 'Linked Tags',       width: 240  },
]

// ─────────────────────────────────────────────────────────────────────
// IO LIST PREVIEW COLUMNS (Excel export keeps all 40)
//
// BUG FIX: this used to be one fixed 16-column list shown for every
// document regardless of how it was extracted. An io_list table document
// never populates the 4 P&ID-only fields (equipment_tag/line_tag/
// symbol_type/location — see pid_vision_extractor.py) and a pid_drawing
// document never populates the 8 io_list-only fields (loop_number/pid_no/
// hmi_description/io_type/system/signal_type/unit/alarm_priority) — so
// roughly half the visible columns were guaranteed blank on every row of
// any single document. Split into COMMON (populated by both extraction
// paths) plus one group per document_type, and getIoPreviewColumns()
// below picks the right set — see its call site in IOListWorkflowPage.jsx.
// ─────────────────────────────────────────────────────────────────────
const IO_PREVIEW_COMMON_COLUMNS = [
  { key: 'tag_number',          label: 'Tag No',          width: 140, sticky: true },
  { key: 'instrument_type',     label: 'Type',            width: 90  },
  { key: 'service_description', label: 'Service',         width: 280 },
  { key: 'page_number',         label: 'Page',            width: 70  },
]

const IO_PREVIEW_TABLE_ONLY_COLUMNS = [
  { key: 'loop_number',         label: 'Loop',            width: 100 },
  { key: 'pid_no',              label: 'P&ID',            width: 110 },
  { key: 'hmi_description',     label: 'HMI Description', width: 260 },
  { key: 'io_type',             label: 'I/O Type',        width: 90  },
  { key: 'system',              label: 'System',          width: 100 },
  { key: 'signal_type',         label: 'Signal',          width: 110 },
  { key: 'unit',                label: 'Unit',            width: 90  },
  { key: 'alarm_priority',      label: 'Priority',        width: 110 },
]

const IO_PREVIEW_PID_DRAWING_ONLY_COLUMNS = [
  // Shown first in this group — explains why the OTHER P&ID columns are
  // blank on any given row (a 'line' row has no instrument_type/
  // symbol_type because a line callout genuinely doesn't carry either on
  // the drawing, not because extraction missed something).
  { key: 'kind',                label: 'Kind',            width: 100 },
  { key: 'equipment_tag',       label: 'Equipment Tag',   width: 130 },
  { key: 'line_tag',            label: 'Line Number',     width: 150 },
  { key: 'symbol_type',         label: 'Symbol Type',     width: 180 },
  { key: 'location',            label: 'Location',        width: 200 },
]

// Full 16-column union — kept for anything (e.g. Excel-export references,
// the field-key allowlist in ioListWorkflowService.updateRow's JSDoc)
// that genuinely wants the whole set regardless of document type.
export const IO_PREVIEW_COLUMNS = [
  ...IO_PREVIEW_COMMON_COLUMNS,
  ...IO_PREVIEW_TABLE_ONLY_COLUMNS,
  ...IO_PREVIEW_PID_DRAWING_ONLY_COLUMNS,
]

// documentType: 'pid_drawing' | 'io_list' | undefined (older documents
// predating the document_type field — see migration 0055 — default to
// the io_list set, matching their actual extraction path).
export function getIoPreviewColumns(documentType) {
  return documentType === 'pid_drawing'
    ? [...IO_PREVIEW_COMMON_COLUMNS, ...IO_PREVIEW_PID_DRAWING_ONLY_COLUMNS]
    : [...IO_PREVIEW_COMMON_COLUMNS, ...IO_PREVIEW_TABLE_ONLY_COLUMNS]
}

// ─────────────────────────────────────────────────────────────────────
// STATUS CODES (Comments Resolution Sheet)
// ─────────────────────────────────────────────────────────────────────
export const STATUS_BADGE_COLOURS = {
  '1': { bg: 'bg-red-100',     fg: 'text-red-800',     dot: 'bg-red-500',     label: 'Rejected'     },
  '2': { bg: 'bg-amber-100',   fg: 'text-amber-800',   dot: 'bg-amber-500',   label: 'As Noted'     },
  '3': { bg: 'bg-emerald-100', fg: 'text-emerald-800', dot: 'bg-emerald-500', label: 'No Comments'  },
  '4': { bg: 'bg-sky-100',     fg: 'text-sky-800',     dot: 'bg-sky-500',     label: 'Info Only'    },
}

// Fallback style for status codes that don't match the standard 1–4 ADNOC codes.
// Applied to any extra codes that appear in the data (soft-coded so one edit updates all bars).
export const UNKNOWN_STATUS_STYLE = {
  bg:  'bg-slate-100',
  fg:  'text-slate-700',
  dot: 'bg-slate-400',
}

// ─────────────────────────────────────────────────────────────────────
// DOCUMENT STATUS BADGES (extraction lifecycle)
// ─────────────────────────────────────────────────────────────────────
export const DOC_STATUS_BADGE = {
  uploaded:   { bg: 'bg-slate-100',   fg: 'text-slate-700',   dot: 'bg-slate-400',   label: 'Uploaded'   },
  extracting: { bg: 'bg-amber-100',   fg: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Extracting' },
  completed:  { bg: 'bg-emerald-100', fg: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Completed'  },
  failed:     { bg: 'bg-red-100',     fg: 'text-red-800',     dot: 'bg-red-500',     label: 'Failed'     },
}

// ─────────────────────────────────────────────────────────────────────
// DOCUMENT TYPE (which extraction path produced this document's rows —
// set by the backend during extraction, not chosen by the uploader)
// ─────────────────────────────────────────────────────────────────────
export const DOCUMENT_TYPE_BADGE = {
  io_list:     { bg: 'bg-indigo-100',  fg: 'text-indigo-700',  dot: 'bg-indigo-500',  label: 'I/O List'    },
  pid_drawing: { bg: 'bg-violet-100',  fg: 'text-violet-700',  dot: 'bg-violet-500',  label: 'P&ID Drawing' },
}

// ─────────────────────────────────────────────────────────────────────
// DETAIL TABS
// ─────────────────────────────────────────────────────────────────────
export const DETAIL_TABS = [
  { id: 'overview', label: 'Overview',                  icon: 'BarChart3' },
  { id: 'comments', label: 'Comments Resolution Sheet', icon: 'MessageSquare' },
  { id: 'iolist',   label: 'I/O List Table',            icon: 'Table2' },
  { id: 'legend',   label: 'Legend Check',              icon: 'BookOpen' },
  { id: 'metadata', label: 'Metadata & Audit',          icon: 'Info' },
]

// ─────────────────────────────────────────────────────────────────────
// UPLOAD MODAL
// ─────────────────────────────────────────────────────────────────────
export const UPLOAD_CONFIG = {
  acceptedTypes: '.pdf',
  maxSizeMB:     100,
  // 'project_name' deliberately not in this list — inside a project it's
  // auto-populated from the active project's name (see UploadCard in
  // IOListWorkflowPage.jsx) instead of being a manually-typed field.
  fields: [
    { key: 'document_number', label: 'Document number',             placeholder: 'e.g. NM-30201-50200-H0-113-13-15-25-001', required: true },
    { key: 'revision_label',  label: 'Revision',                    placeholder: 'e.g. 0, A, IFC',                          required: true },
    { key: 'plant',           label: 'Plant',                       placeholder: 'e.g. Habshan' },
    { key: 'unit',            label: 'Unit',                        placeholder: 'e.g. Unit 50200' },
    { key: 'crs_chain_id',    label: 'CRS chain ID (optional)',     placeholder: 'Link this revision to a CRS chain' },
  ],
  hints: [
    'Upload either an I/O List PDF (Comments Resolution Sheet + structured table) or a P&ID drawing PDF — the file type is auto-detected.',
    'I/O List PDFs use PyMuPDF native text + table extraction — free, no AI involved.',
    'P&ID drawings use AI Vision to read instrument tags, equipment tags, line tags and symbols — add your API key below for best accuracy, or leave it blank to use basic OCR.',
    'Every upload always runs a genuinely fresh extraction — even re-uploading the same PDF creates a new document and re-processes it from scratch.',
  ],
  title: 'Upload I/O List PDF or P&ID Drawing',
}

// ─────────────────────────────────────────────────────────────────────
// P&ID DRAWING — BYOK VISION OPTIONS (I/O List's own sessionStorage keys,
// distinct from apps/pid_checker_v2's — kept isolated per this module's
// standing rule of no cross-app coupling)
// ─────────────────────────────────────────────────────────────────────
export const PID_VISION_CONFIG = {
  sessionStorageProviderKey: 'io_list_vision_provider',
  sessionStorageApiKeyKey:   'io_list_vision_api_key',
  sessionStorageThoroughKey: 'io_list_vision_thorough',
  providers: [
    { value: 'claude', label: 'Claude' },
    { value: 'openai', label: 'OpenAI' },
  ],
  defaultProvider: 'claude',
  hint: 'AI Vision recommended for P&ID drawings — your key is used for this request only and never stored on the server.',
}

// Quick Scan (default) vs Thorough Scan toggle — 2 Vision calls/page
// (2 independent passes over the full page) vs a 2x2 tiled, 2-pass
// ~8 calls/page pass (see pid_vision_extractor.py's own VISION_PASSES /
// extract_pid_tags_from_page docstring for the backend side — both
// modes run more than one pass per image now, to reduce run-to-run
// variance in what Vision reports).
export const SCAN_CALLS_PER_PAGE_QUICK = 2
export const SCAN_CALLS_PER_PAGE_THOROUGH = 8

// Pre-extraction ESTIMATE shown on the upload form, before anything has
// actually run — deliberately a rough, clearly-labelled prediction, not
// measured data (the real, live numbers come from GET .../status/ once
// extraction is actually underway — see ProcessingBanner in
// IOListWorkflowPage.jsx). Per-page multipliers reflect typical Vision
// call latency/cost at SCAN_CALLS_PER_PAGE_QUICK/THOROUGH calls per page
// (~1 min and ~2,000 tokens per call, rounded) — not derived from a
// specific document, so any single real run can land above or below
// this. Kept as its own config block (not computed from
// SCAN_CALLS_PER_PAGE_*) so the estimate can be tuned independently of
// the actual call-count constants if real-world timing/usage diverges.
export const VISION_ESTIMATE = {
  quick:    { minutesPerPage: 2, tokensPerPage: 4000 },
  thorough: { minutesPerPage: 8, tokensPerPage: 16000 },
}

// ─────────────────────────────────────────────────────────────────────
// STATS CARD DEFINITIONS
// ─────────────────────────────────────────────────────────────────────
export const STATS_CARDS = [
  { key: 'total_pages',     label: 'Pages',          icon: 'FileText',       tone: 'indigo'  },
  { key: 'comment_pages',   label: 'Comment Pages',  icon: 'MessageSquare',  tone: 'sky'     },
  // io_table_pages is always 0 for a P&ID drawing document — the page
  // classifier never tags a drawing page 'io_table' (there is no
  // structured table on it), so this card shows a different key/label for
  // that document type: every page of a P&ID drawing PDF IS a P&ID page,
  // so total_pages is the accurate count there instead of 0.
  {
    key: 'io_table_pages',  label: 'I/O Pages',      icon: 'Table2',         tone: 'violet',
    pidDrawing: { key: 'total_pages', label: 'P&ID Pages' },
  },
  { key: 'comments_found',  label: 'Comments',       icon: 'MessagesSquare', tone: 'amber'   },
  { key: 'io_rows_found',   label: 'I/O Rows',       icon: 'List',           tone: 'emerald' },
  { key: 'linked_comments', label: 'Linked',         icon: 'Link2',          tone: 'fuchsia', hint: 'comment ↔ tag' },
]

export const TONE_CLASSES = {
  indigo:   { bg: 'bg-indigo-50',   fg: 'text-indigo-700',   icon: 'text-indigo-600',   bar: 'bg-indigo-500'  },
  sky:      { bg: 'bg-sky-50',      fg: 'text-sky-700',      icon: 'text-sky-600',      bar: 'bg-sky-500'     },
  violet:   { bg: 'bg-violet-50',   fg: 'text-violet-700',   icon: 'text-violet-600',   bar: 'bg-violet-500'  },
  amber:    { bg: 'bg-amber-50',    fg: 'text-amber-700',    icon: 'text-amber-600',    bar: 'bg-amber-500'   },
  emerald:  { bg: 'bg-emerald-50',  fg: 'text-emerald-700',  icon: 'text-emerald-600',  bar: 'bg-emerald-500' },
  fuchsia:  { bg: 'bg-fuchsia-50',  fg: 'text-fuchsia-700',  icon: 'text-fuchsia-600',  bar: 'bg-fuchsia-500' },
  slate:    { bg: 'bg-slate-50',    fg: 'text-slate-700',    icon: 'text-slate-600',    bar: 'bg-slate-500'   },
  rose:     { bg: 'bg-rose-50',     fg: 'text-rose-700',     icon: 'text-rose-600',     bar: 'bg-rose-500'    },
}

// ─────────────────────────────────────────────────────────────────────
// COST PROFILE LABELS
// ─────────────────────────────────────────────────────────────────────
export const COST_BADGES = {
  cached:   { label: 'Cached',          tone: 'slate',   hint: 'Re-used prior extraction (free)' },
  free:     { label: 'Free · PyMuPDF',  tone: 'emerald', hint: 'Native text + table extraction' },
  vision:   { label: 'AI Vision',       tone: 'amber',   hint: 'GPT-4o-mini vision fallback used' },
}

// ─────────────────────────────────────────────────────────────────────
// DIFF VIEW
// ─────────────────────────────────────────────────────────────────────
export const DIFF_COLOURS = {
  added:     { bg: 'bg-emerald-50', fg: 'text-emerald-800', label: 'Added'    },
  removed:   { bg: 'bg-red-50',     fg: 'text-red-800',     label: 'Removed'  },
  modified:  { bg: 'bg-amber-50',   fg: 'text-amber-800',   label: 'Modified' },
  unchanged: { bg: 'bg-slate-50',   fg: 'text-slate-700',   label: 'No change'},
}

// ─────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────
export const ROUTES = {
  workflow:        '/engineering/instrument/datasheet/io-list',
  legacyGenerator: '/engineering/instrument/datasheet/io-list/generator',
}

// ─────────────────────────────────────────────────────────────────────
// SORT / FILTER OPTIONS
// ─────────────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { value: '-created_at',     label: 'Newest first'       },
  { value: 'created_at',      label: 'Oldest first'       },
  { value: 'document_number', label: 'Document No (A→Z)'  },
  { value: '-document_number',label: 'Document No (Z→A)'  },
  { value: 'revision_label',  label: 'Revision (A→Z)'     },
]

export const STATUS_FILTER_OPTIONS = [
  { value: '',           label: 'All statuses'   },
  { value: 'completed',  label: 'Completed'      },
  { value: 'extracting', label: 'Extracting'     },
  { value: 'failed',     label: 'Failed'         },
  { value: 'uploaded',   label: 'Uploaded'       },
]
