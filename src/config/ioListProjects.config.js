// ─────────────────────────────────────────────────────────────────────────────
// IO List — Project Management (soft-coded configuration)
// ─────────────────────────────────────────────────────────────────────────────
// All tunable values for the IO List "Projects" feature live here. Edit this
// file alone to change storage, validation, statuses or default fields — no
// changes to the page or service needed.
//
// Persistence: today the service uses `localStorage` (no backend changes
// required for this initiative). Swap STORAGE.adapter to 'api' in the future
// and point STORAGE.endpoint at a DRF ViewSet to migrate without UI changes.
// ─────────────────────────────────────────────────────────────────────────────

export const IO_LIST_PROJECT_STORAGE = {
  // Adapter — 'local' (default) | 'api' (future)
  adapter:    'local',
  // Bump the version suffix to invalidate cached projects after a schema change
  storageKey: 'radai.iolist.projects.v1',
  // Reserved for future API mode
  endpoint:   '/api/v1/instrument-tools/io-list/projects/',
}

// ─── Project status (mirrors PFD / DesignIQ vocab so UX feels consistent) ───
export const IO_LIST_PROJECT_STATUSES = {
  draft:      { label: 'Draft',      bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  generated:  { label: 'Generated',  bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  archived:   { label: 'Archived',   bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
}
export const DEFAULT_IO_LIST_PROJECT_STATUS = 'draft'

// ─── Project categories (single source of truth, shared with Instrument Index) ──────────
// Re-exported from InstrumentProjectManager so labels / ids / `defaults.tag_format`
// stay in lock-step with the Instrument Index page — including the historical
// id↔label swap (id 'adnoc_onshore' renders as 'ADNOC Gas' and vice versa) that
// the backend extraction logic depends on. To add or rename a category, edit
// `InstrumentProjectManager.INSTRUMENT_PROJECT_CATEGORIES` — it flows through
// to the IO List page automatically.
export { INSTRUMENT_PROJECT_CATEGORIES as IO_LIST_PROJECT_CATEGORIES }
  from '../pages/Engineering/Instrument/InstrumentProjectManager'

// Local import for use inside this config file (factory + default value).
import { INSTRUMENT_PROJECT_CATEGORIES as _CATS }
  from '../pages/Engineering/Instrument/InstrumentProjectManager'

export const DEFAULT_IO_LIST_PROJECT_CATEGORY = _CATS[0]?.id || 'adnoc_onshore'


// ─── New-project form field schema (drives the Create dialog) ───────────────
// Add a field here → it shows up in the modal automatically.
export const IO_LIST_PROJECT_FIELDS = [
  { key: 'project_name', label: 'Project Name',       type: 'text',     required: true,
    placeholder: 'e.g. NM Compressor Station — IO List' },
  { key: 'category',     label: 'Project Category',   type: 'select',   required: true,
    defaultValue: DEFAULT_IO_LIST_PROJECT_CATEGORY,
    options: _CATS.map((c) => ({ value: c.id, label: c.label, icon: c.icon, description: c.description })),
    helpText: 'Drives tag-format rules (ADNOC Gas / Onshore / Offshore) used by the extractor and IO mapper.' },
  { key: 'description',  label: 'Description',        type: 'textarea', required: false,
    placeholder: 'Scope, package, area or any helpful note…' },
  { key: 'pid_no',       label: 'P&ID No. (default)', type: 'text',     required: false,
    placeholder: 'NM-1234-PID-001' },
  { key: 'revision',     label: 'Revision',           type: 'text',     required: false,
    placeholder: '0', defaultValue: '0' },
]

// ─── Misc tunables ──────────────────────────────────────────────────────────
export const IO_LIST_PROJECT_LIMITS = {
  maxProjects:       50,
  maxNameLength:     120,
  searchDebounceMs:  150,
}

export const IO_LIST_PROJECT_COPY = {
  panelTitle:         'IO List Projects',
  panelSubtitle:      'Group every IO List you generate under a project so you can revisit, re-export or share later.',
  emptyHeading:       'No IO List projects yet',
  emptyBody:          'Create your first project to start generating IO Lists with full traceability.',
  createButton:       'New IO List Project',
  searchPlaceholder:  'Search projects by name or P&ID number…',
  deleteConfirmTitle: 'Delete this IO List project?',
  deleteConfirmBody:  'This permanently removes the project and any generated IO List snapshots stored in your browser.',
}

// ─── Project factory — single source of truth for the shape ────────────────
// Keeping this in config means the page never builds project objects by hand.
export function makeIoListProject(input = {}) {
  const now = new Date().toISOString()
  return {
    id:               input.id          || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `iolp_${Date.now()}`),
    project_name:     (input.project_name || '').trim(),
    description:      (input.description  || '').trim(),
    pid_no:           (input.pid_no       || '').trim(),
    revision:         (input.revision     || '0').trim(),
    category:         (input.category     || DEFAULT_IO_LIST_PROJECT_CATEGORY).trim(),
    status:           input.status || DEFAULT_IO_LIST_PROJECT_STATUS,
    iolist_rows:      Array.isArray(input.iolist_rows) ? input.iolist_rows : [],
    source_count:     Number.isFinite(input.source_count) ? input.source_count : 0,
    last_source_name: input.last_source_name || '',
    created_at:       input.created_at || now,
    updated_at:       now,
  }
}
