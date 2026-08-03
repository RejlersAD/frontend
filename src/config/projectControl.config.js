/**
 * Project Management — Soft-coded configuration.
 *
 * Every endpoint, tab definition, threshold and copy string is defined here
 * so the page components stay free of magic values. Backend pairing:
 * `backend/apps/project_control/*` mounted at `${API_BASE_URL}/project-control/`.
 */

// ───────────────────────────────────────────────────────────────────────────
// 1. API endpoints — relative paths appended to API_BASE_URL by the service
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_CONTROL_ENDPOINTS = {
  // Projects (existing apps.core.project_views — read mostly)
  projects:        '/projects/',
  projectStats:    '/projects/statistics/',

  // Project-control rollout flags + thresholds
  phaseFlags:      '/project-control/phase-flags/',

  // Estimates
  estimates:       '/project-control/estimates/',
  estimateLines:   '/project-control/estimate-line-items/',

  // Documents (S3-backed)
  documents:       '/project-control/documents/',
  importBoq:       '/project-control/documents/import-boq/',
  presignDoc:      (id) => `/project-control/documents/${id}/presign-download/`,

  // WBS
  wbsNodes:        '/project-control/wbs-nodes/',

  // Cost / EVM / Changes
  snapshots:       '/project-control/cost-snapshots/',
  changes:         '/project-control/change-events/',

  // Planning Packages
  planningPackages: '/project-control/planning-packages/',
  planningPackageStats: '/project-control/planning-packages/statistics/',

  // Analytics
  costKpis:        '/project-control/analytics/cost-kpis/',
  variance:        '/project-control/analytics/estimate-variance/',
  financeSync:     '/project-control/analytics/finance-sync/',
  aiTakeoff:       '/project-control/analytics/ai-takeoff/',
  evm:             '/project-control/analytics/evm/',
  cashflow:        '/project-control/analytics/cashflow/',
  risk:            '/project-control/analytics/risk/',
  changeDetect:    '/project-control/analytics/change-detection/',
}

// ───────────────────────────────────────────────────────────────────────────
// 2. View modes — tab definitions. Add a new tab by appending here only.
//    `icon` keys must map to an entry in ICONS inside ProjectsPage.jsx.
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_VIEW_MODES = [
  // Project Dashboard — first tab; shows key commercial & scheduling facts.
  { key: 'project-dashboard', label: 'Project Dashboard', phaseFlag: 'phase_1_project_dashboard', icon: 'squares' },
  { key: 'cost-dashboard',    label: 'Cost Dashboard',    phaseFlag: 'phase_1_cost_dashboard',    icon: 'chart' },
  { key: 'estimates',         label: 'Estimates',         phaseFlag: 'phase_1_estimate_variance', icon: 'document' },
  { key: 'documents',         label: 'Documents',         phaseFlag: 'phase_1_documents',         icon: 'folder' },
  { key: 'ai-takeoff',        label: 'AI Take-Off',       phaseFlag: 'phase_2_ai_takeoff',        icon: 'sparkles', phaseLabel: 'Phase 2' },
  { key: 'evm',               label: 'EVM Forecast',      phaseFlag: 'phase_3_evm_forecast',      icon: 'trending', phaseLabel: 'Phase 3' },
  { key: 'risk',              label: 'Risk Analytics',    phaseFlag: 'phase_4_risk_analytics',    icon: 'shield',   phaseLabel: 'Phase 4' },
]

// ───────────────────────────────────────────────────────────────────────────
// 2b. Project Control Features — REFERENCE ONLY
//     Features are dynamically loaded from backend /api/v1/features/ endpoint.
//     This config exists for documentation purposes and potential future use
//     (e.g., custom feature ordering, local overrides, or offline mode).
//     The Dashboard displays features directly from the backend feature registry.
// ───────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
// 2c. Project Control Sub-Features Navigation
//     This defines the hierarchical sub-features under "6. Project Control"
//     that appear as navigation links in the Projects page.
//     SOFT-CODED: Add new sub-features by appending to this array.
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_CONTROL_SUBFEATURES = [
  {
    id: 'project-management',
    number: '6.1',
    name: 'Projects',
    fullName: 'Project Management',
    description: 'Create and manage engineering projects with cost tracking and milestones',
    icon: '📊',
    route: '/projects',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    hoverBg: 'hover:bg-indigo-100',
    isActive: true,
    isDefault: true,
  },
  {
    id: 'planning-package',
    number: '6.2',
    name: 'Planning Packages',
    fullName: 'Planning Package',
    description: 'Work package planning with budgets, schedules, and deliverables',
    icon: '📦',
    route: '/planning-packages',
    color: 'violet',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    hoverBg: 'hover:bg-violet-100',
    isActive: true,
    isNew: true,
    badge: 'NEW',
    badgeColor: 'bg-green-100 text-green-700',
  },
]

export const PROJECT_CONTROL_FEATURES = [
  {
    id: 'project-management',
    number: '6.1',
    name: 'Project Management',
    description: 'Create and manage engineering projects with timelines and milestones',
    icon: '📊',
    route: '/projects',
    color: 'indigo',
    isActive: true,
    isDefault: true, // This is the main/default view
  },
  {
    id: 'planning-package',
    number: '6.2',
    name: 'Planning Package',
    description: 'Work package planning with budgets, schedules, and deliverables',
    icon: '📦',
    route: '/planning-packages',
    color: 'violet',
    isActive: true,
    isNew: true,
    capabilities: [
      'Package creation & management',
      'Budget allocation & tracking',
      'Schedule planning',
      'Progress monitoring',
      'WBS integration',
    ],
  },
]

// Default tab for first-time visitors — Project Dashboard surfaces key facts
// immediately without requiring any cost/estimate data to be entered first.
export const PROJECT_DEFAULT_VIEW = 'project-dashboard'

// ───────────────────────────────────────────────────────────────────────────
// 3. Cost dashboard KPI cards — definitions drive the dashboard renderer
// ───────────────────────────────────────────────────────────────────────────
export const COST_KPI_CARDS = [
  { key: 'budget',     label: 'Budget',          field: 'budget',          tone: 'blue',   isCurrency: true },
  { key: 'committed',  label: 'Committed',       field: 'committed',       tone: 'indigo', isCurrency: true },
  { key: 'spent',      label: 'Actual Spent',    field: 'spent',           tone: 'amber',  isCurrency: true },
  { key: 'remaining',  label: 'Remaining',       field: 'remaining',       tone: 'green',  isCurrency: true },
  { key: 'utilisation',label: 'Utilisation %',   field: 'utilisation_pct', tone: 'rose',   isPercent:  true },
  { key: 'progress',   label: 'Physical Progress', field: 'progress_pct',  tone: 'violet', isPercent:  true },
]

// ───────────────────────────────────────────────────────────────────────────
// 4. Variance buckets → Tailwind classes (also returned by backend)
// ───────────────────────────────────────────────────────────────────────────
export const VARIANCE_BUCKET_STYLES = {
  green:  { badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',  row: 'bg-emerald-50/40' },
  amber:  { badge: 'bg-amber-100  text-amber-700  ring-1 ring-amber-200',     row: 'bg-amber-50/40' },
  red:    { badge: 'bg-rose-100   text-rose-700   ring-1 ring-rose-200',      row: 'bg-rose-50/40' },
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Estimate kind / status badges
// ───────────────────────────────────────────────────────────────────────────
export const ESTIMATE_KIND_OPTIONS = [
  { value: 'estimate', label: 'Internal Estimate' },
  { value: 'tender',   label: 'Tender Submitted' },
  { value: 'awarded',  label: 'Awarded / Contract' },
  { value: 'baseline', label: 'Baseline (locked)' },
  { value: 'revised',  label: 'Revised' },
]

export const ESTIMATE_STATUS_TONES = {
  draft:      'bg-slate-100  text-slate-700',
  approved:   'bg-emerald-100 text-emerald-700',
  superseded: 'bg-slate-100  text-slate-500 line-through',
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Document kinds (must mirror backend config.DOCUMENT_KINDS)
// ───────────────────────────────────────────────────────────────────────────
export const DOCUMENT_KIND_OPTIONS = [
  { value: 'boq',             label: 'BOQ' },
  { value: 'tender',          label: 'Tender' },
  { value: 'contract',        label: 'Contract' },
  { value: 'change_order',    label: 'Change Order' },
  { value: 'drawing',         label: 'Drawing' },
  { value: 'progress_report', label: 'Progress Report' },
  { value: 'minutes',         label: 'Meeting Minutes' },
  { value: 'specification',   label: 'Specification' },
  { value: 'other',           label: 'Other' },
]

// ───────────────────────────────────────────────────────────────────────────
// 7a. Scope type options (mirror apps.core.project_models.SCOPE_TYPE_CHOICES)
//     Values must match the DB choices exactly; only labels may change freely.
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_SCOPE_TYPE_OPTIONS = [
  { value: 'conceptual',           label: 'Conceptual Study' },
  { value: 'pre_feed',             label: 'Pre-FEED' },
  { value: 'feed',                 label: 'FEED' },
  { value: 'basic_engineering',    label: 'Basic Engineering' },
  { value: 'detailed_engineering', label: 'Detailed Engineering' },
  { value: 'epcm',                 label: 'EPCM' },
  { value: 'epc',                  label: 'EPC (Lump Sum)' },
  { value: 'pmc',                  label: 'PMC (Project Management Consultancy)' },
  { value: 'owner_engineer',       label: "Owner's Engineer" },
  { value: 'procurement',          label: 'Procurement Only' },
  { value: 'construction',         label: 'Construction Management' },
  { value: 'commissioning',        label: 'Commissioning & Start-Up' },
  { value: 'feasibility',          label: 'Feasibility Study' },
  { value: 'other',                label: 'Other / Mixed Scope' },
]

// ───────────────────────────────────────────────────────────────────────────
// 7b. Currency options (mirror apps.core.project_models.CURRENCY_CHOICES)
//     ISO 4217 codes used in Oil & Gas project regions.
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_CURRENCY_OPTIONS = [
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'QAR', label: 'QAR — Qatari Riyal' },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD — Bahraini Dinar' },
  { value: 'OMR', label: 'OMR — Omani Rial' },
]

// ───────────────────────────────────────────────────────────────────────────
// 7c. Project status / priority option lists (mirror apps.core.Project choices)
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning',  label: 'Planning'  },
  { value: 'active',    label: 'Active'    },
  { value: 'on_hold',   label: 'On Hold'   },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PROJECT_PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low'      },
  { value: 'medium',   label: 'Medium'   },
  { value: 'high',     label: 'High'     },
  { value: 'critical', label: 'Critical' },
]

// ───────────────────────────────────────────────────────────────────────────
// 8. Create / edit form schema — soft-coded; add a field by appending here.
//    Field types: text | textarea | select | date | number | currency
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_FORM_SECTIONS = [
  {
    id: 'basics',
    title: 'Basics',
    fields: [
      { name: 'code',         label: 'Project Code',  type: 'text',     required: true,  placeholder: 'PRJ-2026-001', help: 'Unique short code', colSpan: 1 },
      { name: 'name',         label: 'Project Name',  type: 'text',     required: true,  placeholder: 'New refinery expansion', colSpan: 2 },
      { name: 'description',  label: 'Description',   type: 'textarea', required: false, placeholder: 'Scope, objectives, deliverables…', rows: 3, colSpan: 3 },
    ],
  },
  {
    id: 'classification',
    title: 'Classification',
    fields: [
      { name: 'status',   label: 'Status',   type: 'select', required: true, options: PROJECT_STATUS_OPTIONS,   defaultValue: 'planning' },
      { name: 'priority', label: 'Priority', type: 'select', required: true, options: PROJECT_PRIORITY_OPTIONS, defaultValue: 'medium'   },
      { name: 'progress', label: 'Progress %', type: 'number', required: false, min: 0, max: 100, defaultValue: 0 },
    ],
  },
  {
    id: 'schedule',
    title: 'Schedule & Commercials',
    fields: [
      { name: 'start_date',  label: 'Start Date', type: 'date'     },
      { name: 'end_date',    label: 'End Date',   type: 'date'     },
      { name: 'budget',      label: 'Internal Budget', type: 'currency', help: 'Internal cost estimate (not the client-facing contract value)' },
    ],
  },
  {
    id: 'contract',
    title: 'Contract',
    fields: [
      // Soft-coded: currency before contract_value so the dropdown appears inline.
      // colSpan controls the 3-column grid defined in ProjectFormModal.
      {
        name: 'currency',
        label: 'Contract Currency',
        type: 'select',
        options: PROJECT_CURRENCY_OPTIONS,
        defaultValue: 'AED',
        colSpan: 1,
        help: 'ISO 4217 currency code for the contract value',
      },
      {
        name: 'contract_value',
        label: 'Contract Value',
        type: 'currency',
        colSpan: 2,
        placeholder: '0.00',
        help: 'Awarded contract value (commercial amount signed with the client)',
      },
      {
        name: 'scope_type',
        label: 'Scope Type',
        type: 'select',
        options: PROJECT_SCOPE_TYPE_OPTIONS,
        defaultValue: '',
        colSpan: 3,
        help: 'Engineering engagement type — FEED, Detailed Engineering, EPC, …',
      },
    ],
  },
  {
    id: 'context',
    title: 'Client & Location',
    fields: [
      { name: 'client_name', label: 'Client Name', type: 'text', placeholder: 'ADNOC, EWEC, …' },
      { name: 'location',    label: 'Location',    type: 'text', placeholder: 'Ruwais, Abu Dhabi' },
    ],
  },
]

// Fields the API accepts on create/update — used by the modal to strip blanks.
// Mirrors apps.core.project_serializers.ProjectSerializer.Meta.fields.
export const PROJECT_FORM_API_FIELDS = [
  'code', 'name', 'description', 'status', 'priority', 'progress',
  'start_date', 'end_date', 'budget', 'client_name', 'location',
  // Contract / scope fields — added in migration 0002
  'contract_value', 'currency', 'scope_type',
]

// ───────────────────────────────────────────────────────────────────────────
// 9. Copy / labels
// ───────────────────────────────────────────────────────────────────────────
export const PROJECT_COPY = {
  selectorPlaceholder: 'Select a project…',
  loadingProjects:     'Loading projects…',
  noProjects:          'No projects yet — click “New Project” to create one.',
  newProject:          'New Project',
  editProject:         'Edit Project',
  saveProject:         'Save Project',
  saving:              'Saving…',
  createTitle:         'Create Project',
  editTitle:           'Edit Project',
  deleteConfirm:       (name) => `Delete project “${name}”? This cannot be undone.`,
  phaseStubTitle:      (label) => `${label} — Coming Soon`,
  phaseStubBody:       (label, flag) =>
    `${label} ships in a later phase. Set environment variable ` +
    `PROJECT_CONTROL_${flag.toUpperCase()}=true and restart the backend to enable it.`,
  importFromQhse:      'Import from QHSE',
  importQhseTitle:     'Import Projects from QHSE',
  importQhseSubtitle:  'Pull running projects from the QHSE department (radai.ae/qhse/general/detailed) and create matching project records here.',
  importQhseEmpty:     'No QHSE projects found.',
  importQhseLoading:   'Fetching QHSE projects…',
  importQhseExisting:  'Already imported — will be updated',
  importQhseNew:       'New — will be created',
  importQhseSelected:  (n) => `${n} selected`,
  importQhseRun:       (n) => `Import ${n} project${n === 1 ? '' : 's'}`,
  importQhseRunning:   'Importing…',
  importQhseDone:      (created, updated, failed) =>
    `Done — ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}.`,
  importQhseSource:    'Source',
  importQhseToken:     'Bearer token (radai.ae)',
  importQhseTokenHelp: 'Paste a JWT access token from radai.ae (DevTools → Application → Local Storage → access_token).',
  importQhseAuthError: 'Authentication failed. Check the bearer token and try again.',
  importQhseCorsError: 'Browser blocked the cross-origin request. Make sure www.radai.ae allows http://localhost:5173 in its CORS settings.',
}

// ───────────────────────────────────────────────────────────────────────────
// 10. QHSE → Project import — soft-coded smart sync
// ───────────────────────────────────────────────────────────────────────────
// Pulls rows from /api/v1/qhse/projects/ (camelCase serializer) and maps them
// to apps.core.Project payloads. Every mapping is declarative so adding a new
// field requires changes to this config only — no service or component edits.
//
// `key` identifies which Project field is the unique join key (defaults to
// `code` ↔ QHSE.projectNo) so re-imports update instead of duplicating.
// ───────────────────────────────────────────────────────────────────────────

// Helpers used by the derivation rules below. Defined module-level so they
// remain pure and easy to unit-test.
const _qhseToISODate = (v) => (v ? String(v).slice(0, 10) : null)
const _qhseParsePct = (v) => {
  if (v == null || v === '') return 0
  const n = parseFloat(String(v).replace('%', '').trim())
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
}
const _qhseToday = () => new Date().toISOString().slice(0, 10)

export const QHSE_IMPORT_CONFIG = {
  // Source endpoint (relative to the chosen source's baseUrl).
  sourceEndpoint: '/qhse/projects/',

  // Optional query parameters sent to QHSE on every fetch.
  sourceParams: { ordering: 'sr_no' },

  // Available data sources — user picks one in the modal. Add a new source by
  // appending here; no service/component changes required.
  // `requiresToken=true` shows a Bearer-token input in the modal (used when the
  // source is a remote origin where the local JWT cookie isn't valid).
  sources: [
    {
      id: 'local',
      label: 'Local backend (this environment)',
      baseUrl: '',                                // empty → use apiClient (relative + JWT)
      requiresToken: false,
    },
    {
      id: 'production',
      label: 'Production — radai.ae',
      // Override with VITE_QHSE_PRODUCTION_BASE_URL in .env.local if needed.
      baseUrl: (import.meta.env?.VITE_QHSE_PRODUCTION_BASE_URL ||
                'https://www.radai.ae/api/v1').replace(/\/+$/, ''),
      requiresToken: true,
    },
  ],

  // Default source id when the modal opens.
  defaultSourceId: (import.meta.env?.VITE_QHSE_DEFAULT_SOURCE || 'local'),

  // Unique join key — used to detect "already imported" rows.
  joinKey: { qhseField: 'projectNo', projectField: 'code' },

  // Declarative field map. `from` = QHSE serializer field (camelCase),
  // `to` = Project payload field (snake_case), `transform` is optional.
  fieldMap: [
    { from: 'projectNo',           to: 'code'        },
    { from: 'projectTitle',        to: 'name'        },
    { from: 'client',              to: 'client_name' },
    { from: 'projectStartingDate', to: 'start_date',  transform: _qhseToISODate },
    { from: 'projectClosingDate',  to: 'end_date',    transform: _qhseToISODate },
    { from: 'projectCompletionPercent', to: 'progress', transform: _qhseParsePct },
  ],

  // Derived fields — computed from the full QHSE row, not a single field.
  // Each entry receives the raw QHSE row and returns the value (or null/undefined
  // to skip). First non-empty wins.
  derivedFields: {
    status: (row) => {
      const pct = _qhseParsePct(row.projectCompletionPercent)
      if (pct >= 100) return 'completed'
      const end = _qhseToISODate(row.projectExtension) || _qhseToISODate(row.projectClosingDate)
      if (end && end < _qhseToday() && pct < 100) return 'on_hold'
      return 'active'
    },
    priority: (row) => {
      // Soft heuristic: open CARs > 0 OR audit delay > 30 → high; else medium.
      const cars = Number(row.carsOpen || 0)
      const delay = Number(row.delayInAuditsNoDays || 0)
      if (cars > 0 || delay > 30) return 'high'
      return 'medium'
    },
    description: (row) =>
      [
        row.projectManager     && `Project Manager: ${row.projectManager}`,
        row.projectQualityEng  && `Quality Engineer: ${row.projectQualityEng}`,
        row.remarks            && `Remarks: ${row.remarks}`,
      ].filter(Boolean).join('\n') || '',
    location: (row) => row.location || '',
    tags: () => ['qhse-sync'],
  },

  // Soft-coded import policy.
  // - createIfMissing: POST a new Project when no joinKey match exists
  // - updateIfExisting: PATCH the matching Project (set false for create-only)
  policy: {
    createIfMissing:  true,
    updateIfExisting: true,
  },

  // Columns rendered in the import preview table. label/icon are presentational.
  previewColumns: [
    { key: 'projectNo',              label: 'Project No' },
    { key: 'projectTitle',           label: 'Title' },
    { key: 'client',                 label: 'Client' },
    { key: 'projectManager',         label: 'PM' },
    { key: 'projectCompletionPercent', label: 'Progress' },
  ],
}
