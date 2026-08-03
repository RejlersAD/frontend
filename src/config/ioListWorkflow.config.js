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
  reextract:      (id) => `/instrument-io-workflow/documents/${id}/re-extract/`,
  exportXlsx:     (id) => `/instrument-io-workflow/documents/${id}/export-xlsx/`,
  patchRow:       (docId, rowId) => `/instrument-io-workflow/documents/${docId}/rows/${rowId}/`,
  diff:           '/instrument-io-workflow/diff/',
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
  nonEditableColumns: ['page_number'],
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
// ─────────────────────────────────────────────────────────────────────
export const IO_PREVIEW_COLUMNS = [
  { key: 'tag_number',          label: 'Tag No',          width: 140, sticky: true },
  { key: 'loop_number',         label: 'Loop',            width: 100 },
  { key: 'pid_no',              label: 'P&ID',            width: 110 },
  { key: 'instrument_type',     label: 'Type',            width: 90  },
  { key: 'service_description', label: 'Service',         width: 280 },
  { key: 'hmi_description',     label: 'HMI Description', width: 260 },
  { key: 'io_type',             label: 'I/O Type',        width: 90  },
  { key: 'system',              label: 'System',          width: 100 },
  { key: 'signal_type',         label: 'Signal',          width: 110 },
  { key: 'unit',                label: 'Unit',            width: 90  },
  { key: 'alarm_priority',      label: 'Priority',        width: 110 },
  { key: 'page_number',         label: 'Page',            width: 70  },
]

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
// DETAIL TABS
// ─────────────────────────────────────────────────────────────────────
export const DETAIL_TABS = [
  { id: 'overview', label: 'Overview',                  icon: 'BarChart3' },
  { id: 'comments', label: 'Comments Resolution Sheet', icon: 'MessageSquare' },
  { id: 'iolist',   label: 'I/O List Table',            icon: 'Table2' },
  { id: 'metadata', label: 'Metadata & Audit',          icon: 'Info' },
]

// ─────────────────────────────────────────────────────────────────────
// UPLOAD MODAL
// ─────────────────────────────────────────────────────────────────────
export const UPLOAD_CONFIG = {
  acceptedTypes: '.pdf',
  maxSizeMB:     100,
  fields: [
    { key: 'project_name',    label: 'Project name',                placeholder: 'e.g. ADNOC Habshan MP Fuel Gas' },
    { key: 'document_number', label: 'Document number',             placeholder: 'e.g. NM-30201-50200-H0-113-13-15-25-001', required: true },
    { key: 'revision_label',  label: 'Revision',                    placeholder: 'e.g. 0, A, IFC',                          required: true },
    { key: 'plant',           label: 'Plant',                       placeholder: 'e.g. Habshan' },
    { key: 'unit',            label: 'Unit',                        placeholder: 'e.g. Unit 50200' },
    { key: 'crs_chain_id',    label: 'CRS chain ID (optional)',     placeholder: 'Link this revision to a CRS chain' },
  ],
  hints: [
    'PDF should contain a Comments Resolution Sheet section AND the structured I/O List table (DCS / ESD sheets).',
    'Server-side extraction uses PyMuPDF native text + find_tables(). No AI is invoked unless explicitly enabled.',
    'Identical PDFs (matched by SHA-256) reuse the previous extraction at zero cost.',
  ],
}

// ─────────────────────────────────────────────────────────────────────
// STATS CARD DEFINITIONS
// ─────────────────────────────────────────────────────────────────────
export const STATS_CARDS = [
  { key: 'total_pages',     label: 'Pages',          icon: 'FileText',       tone: 'indigo'  },
  { key: 'comment_pages',   label: 'Comment Pages',  icon: 'MessageSquare',  tone: 'sky'     },
  { key: 'io_table_pages',  label: 'I/O Pages',      icon: 'Table2',         tone: 'violet'  },
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
