// ─────────────────────────────────────────────────────────────────────────────
// Instrument Cable Schedule — Project Management (soft-coded configuration)
// ─────────────────────────────────────────────────────────────────────────────
// All tunable values for the Cable Schedule "Projects" feature live here.
// Edit this file alone to change storage, validation, statuses or default
// fields — no changes to the page or service needed.
//
// Persistence: localStorage today (zero backend changes). Flip
// CABLE_SCHEDULE_PROJECT_STORAGE.adapter to 'api' in the future to migrate to
// a DRF ViewSet without touching the page.
// ─────────────────────────────────────────────────────────────────────────────

export const CABLE_SCHEDULE_PROJECT_STORAGE = {
  adapter:    'local',
  storageKey: 'radai.cableschedule.projects.v1',
  endpoint:   '/api/v1/instrument-tools/cable-schedule/projects/',
}

export const CABLE_SCHEDULE_PROJECT_STATUSES = {
  draft:      { label: 'Draft',      bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  generated:  { label: 'Generated',  bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  archived:   { label: 'Archived',   bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
}
export const DEFAULT_CABLE_SCHEDULE_PROJECT_STATUS = 'draft'

// Re-export the shared project category list so the Schedule stays in
// lock-step with Instrument Index / IO List / Cable Block Diagram.
export { INSTRUMENT_PROJECT_CATEGORIES as CABLE_SCHEDULE_PROJECT_CATEGORIES }
  from '../pages/Engineering/Instrument/InstrumentProjectManager'

import { INSTRUMENT_PROJECT_CATEGORIES as _CATS }
  from '../pages/Engineering/Instrument/InstrumentProjectManager'

export const DEFAULT_CABLE_SCHEDULE_PROJECT_CATEGORY = _CATS[0]?.id || 'adnoc_onshore'

export const CABLE_SCHEDULE_PROJECT_FIELDS = [
  { key: 'project_name', label: 'Project Name',        type: 'text',     required: true,
    placeholder: 'e.g. Habshan MP Fuel Gas — Instrument Cable Schedule' },
  { key: 'category',     label: 'Project Category',    type: 'select',   required: true,
    defaultValue: DEFAULT_CABLE_SCHEDULE_PROJECT_CATEGORY,
    options: _CATS.map((c) => ({ value: c.id, label: c.label, icon: c.icon, description: c.description })),
    helpText: 'Drives tag-format rules (ADNOC Gas / Onshore / Offshore) used by the cable & cabinet mapper.' },
  { key: 'description',  label: 'Description',         type: 'textarea', required: false,
    placeholder: 'Scope, package, area or any helpful note…' },
  { key: 'pid_no',       label: 'P&ID No. (default)',  type: 'text',     required: false,
    placeholder: 'NM-1234-PID-001' },
  { key: 'unit',         label: 'Plant Unit / Area',   type: 'text',     required: false,
    placeholder: '15', defaultValue: '15' },
  { key: 'revision',     label: 'Revision',            type: 'text',     required: false,
    placeholder: '0', defaultValue: '0' },
]

export const CABLE_SCHEDULE_PROJECT_LIMITS = {
  maxProjects:       50,
  maxNameLength:     120,
  searchDebounceMs:  150,
}

export const CABLE_SCHEDULE_PROJECT_COPY = {
  panelTitle:         'Instrument Cable Schedule Projects',
  panelSubtitle:      'Group every cable schedule you generate under a project so you can revisit, re-export or share later.',
  emptyHeading:       'No Instrument Cable Schedule projects yet',
  emptyBody:          'Create your first project to start generating Instrument Cable Schedules with full traceability.',
  createButton:       'New Cable Schedule Project',
  searchPlaceholder:  'Search projects by name or P&ID number…',
  deleteConfirmTitle: 'Delete this Cable Schedule project?',
  deleteConfirmBody:  'This permanently removes the project and any generated schedule snapshots stored in your browser.',
}

export function makeCableScheduleProject(input = {}) {
  const now = new Date().toISOString()
  return {
    id:                   input.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `csp_${Date.now()}`),
    project_name:         (input.project_name || '').trim(),
    description:          (input.description  || '').trim(),
    pid_no:               (input.pid_no       || '').trim(),
    unit:                 (input.unit         || '15').trim(),
    revision:             (input.revision     || '0').trim(),
    category:             (input.category     || DEFAULT_CABLE_SCHEDULE_PROJECT_CATEGORY).trim(),
    status:               input.status || DEFAULT_CABLE_SCHEDULE_PROJECT_STATUS,
    cable_schedule_rows:  Array.isArray(input.cable_schedule_rows) ? input.cable_schedule_rows : [],
    source_count:         Number.isFinite(input.source_count) ? input.source_count : 0,
    last_source_name:     input.last_source_name || '',
    created_at:           input.created_at || now,
    updated_at:           now,
  }
}
