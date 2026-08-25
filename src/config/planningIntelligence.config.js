/**
 * RADAI Project Planning Application — Soft-coded frontend configuration.
 *
 * Backend pairing: `backend/apps/planning_intelligence/*` mounted at
 * `${API_BASE_URL}/planning-intelligence/`.
 */

export const PLANNING_ENDPOINTS = {
  projects: '/planning-intelligence/projects/',
  project: (id) => `/planning-intelligence/projects/${id}/`,
  analyze: (id) => `/planning-intelligence/projects/${id}/analyze/`,
  generate: (id) => `/planning-intelligence/projects/${id}/generate/`,
  generationPreview: (id) => `/planning-intelligence/projects/${id}/generation-preview/`,
  workflowTemplates: '/planning-intelligence/workflow-templates/',
  dependencyTemplates: '/planning-intelligence/dependency-templates/',
  scheduleConfigurations: '/planning-intelligence/schedule-configurations/',
  scheduleConfiguration: (id) => `/planning-intelligence/schedule-configurations/${id}/`,
  scheduleDefaultProposals: '/planning-intelligence/schedule-default-proposals/',
  scheduleDefaultProposalDecision: (id) => `/planning-intelligence/schedule-default-proposals/${id}/decision/`,

  aiSettings: (id) => `/planning-intelligence/projects/${id}/ai-settings/`,
  aiSettingsTest: (id) => `/planning-intelligence/projects/${id}/ai-settings/test/`,

  files: '/planning-intelligence/files/',
  file: (id) => `/planning-intelligence/files/${id}/`,

  generations: '/planning-intelligence/generations/',
  generation: (id) => `/planning-intelligence/generations/${id}/`,
  materializeGeneration: (id) => `/planning-intelligence/generations/${id}/materialize/`,
  calendars: '/planning-intelligence/calendars/',
  calendarExceptions: '/planning-intelligence/calendar-exceptions/',
  schedules: '/planning-intelligence/schedules/',
  schedule: (id) => `/planning-intelligence/schedules/${id}/`,
  createScheduleVersion: (id) => `/planning-intelligence/schedules/${id}/create-version/`,
  scheduleVersions: '/planning-intelligence/schedule-versions/',
  scheduleVersion: (id) => `/planning-intelligence/schedule-versions/${id}/`,
  scheduleWorkspace: (id) => `/planning-intelligence/schedule-versions/${id}/workspace/`,
  bulkScheduleActivities: (id) => `/planning-intelligence/schedule-versions/${id}/bulk-activities/`,
  calculateScheduleVersion: (id) => `/planning-intelligence/schedule-versions/${id}/calculate/`,
  approveScheduleVersion: (id) => `/planning-intelligence/schedule-versions/${id}/approve/`,
  baselineScheduleVersion: (id) => `/planning-intelligence/schedule-versions/${id}/baseline/`,
  scheduleControls: (id) => `/planning-intelligence/schedule-versions/${id}/controls/`,
  scheduleProgress: (id) => `/planning-intelligence/schedule-versions/${id}/progress/`,
  captureScheduleControls: (id) => `/planning-intelligence/schedule-versions/${id}/capture-controls/`,
  scheduleGovernance: (id) => `/planning-intelligence/schedule-versions/${id}/governance/`,
  governanceItems: (id) => `/planning-intelligence/schedule-versions/${id}/governance-items/`,
  governanceItem: (id) => `/planning-intelligence/schedule-versions/${id}/governance-item/`,
  governanceComments: (id) => `/planning-intelligence/schedule-versions/${id}/governance-comments/`,
  resolveGovernanceComment: (id) => `/planning-intelligence/schedule-versions/${id}/resolve-governance-comment/`,
  scheduleReviews: (id) => `/planning-intelligence/schedule-versions/${id}/reviews/`,
  scheduleReviewDecision: (id) => `/planning-intelligence/schedule-versions/${id}/review-decision/`,
  exportScheduleVersion: (id, format) => `/planning-intelligence/schedule-versions/${id}/export/?export_format=${format}`,
  integrationEndpoints: '/planning-intelligence/integration-endpoints/',
  integrationEndpoint: (id) => `/planning-intelligence/integration-endpoints/${id}/`,
  publishIntegration: (id) => `/planning-intelligence/integration-endpoints/${id}/publish/`,
  integrationDeliveries: '/planning-intelligence/integration-deliveries/',
  retryIntegrationDelivery: (id) => `/planning-intelligence/integration-deliveries/${id}/retry/`,
  scheduleExportRecords: '/planning-intelligence/schedule-export-records/',
  technicalProposals: '/planning-intelligence/technical-proposals/',
  technicalProposal: (id) => `/planning-intelligence/technical-proposals/${id}/`,
  proposalTransition: (id) => `/planning-intelligence/technical-proposals/${id}/transition/`,
  proposalRefresh: (id) => `/planning-intelligence/technical-proposals/${id}/refresh/`,
  proposalExport: (id, format) => `/planning-intelligence/technical-proposals/${id}/export/?export_format=${format}`,
  proposalExportRecords: '/planning-intelligence/proposal-export-records/',
  enterprisePortfolio: '/planning-intelligence/enterprise/portfolio/',
  enterpriseReadiness: '/planning-intelligence/enterprise/readiness/',
  enterpriseRetention: '/planning-intelligence/enterprise/retention/',
  enterpriseRetentionCleanup: '/planning-intelligence/enterprise/retention-cleanup/',
  wbsNodes: '/planning-intelligence/wbs-nodes/',
  wbsNode: (id) => `/planning-intelligence/wbs-nodes/${id}/`,
  activities: '/planning-intelligence/activities/',
  activity: (id) => `/planning-intelligence/activities/${id}/`,
  relationships: '/planning-intelligence/relationships/',
  relationship: (id) => `/planning-intelligence/relationships/${id}/`,
  resources: '/planning-intelligence/resources/',
  resource: (id) => `/planning-intelligence/resources/${id}/`,
  assignments: '/planning-intelligence/assignments/',
  assignment: (id) => `/planning-intelligence/assignments/${id}/`,
  baselines: '/planning-intelligence/baselines/',
  calculationRuns: '/planning-intelligence/calculation-runs/',
  documentProfiles: '/planning-intelligence/document-profiles/',
  intelligenceRuns: '/planning-intelligence/intelligence-runs/',
  intelligenceRun: (id) => `/planning-intelligence/intelligence-runs/${id}/`,
  addIntelligenceFact: (id) => `/planning-intelligence/intelligence-runs/${id}/add-fact/`,
  intelligenceFacts: '/planning-intelligence/intelligence-facts/',
  reviewIntelligenceFact: (id) => `/planning-intelligence/intelligence-facts/${id}/review/`,
  intelligenceConflicts: '/planning-intelligence/intelligence-conflicts/',
  resolveIntelligenceConflict: (id) => `/planning-intelligence/intelligence-conflicts/${id}/resolve/`,
  jobs: '/planning-intelligence/jobs/',
  job: (id) => `/planning-intelligence/jobs/${id}/`,
  cancelJob: (id) => `/planning-intelligence/jobs/${id}/cancel/`,
  auditEvents: '/planning-intelligence/audit-events/',
  // Planner corrections create an immutable child revision.
  editGeneration: (id) => `/planning-intelligence/generations/${id}/edit/`,
  // NOTE: query param is `export_format` (not `format`) because DRF's own
  // content-negotiation intercepts a query param literally named `format`
  // (URL_FORMAT_OVERRIDE) to select a *renderer* — since no renderer is
  // registered for 'pptx'/'csv'/'excel', that would raise a 404 before the
  // view's export() method ever runs. See backend views.py PlanningGenerationViewSet.export.
  export: (id, format) => `/planning-intelligence/generations/${id}/export/?export_format=${format}`,
}

// File categories — mirrors backend/apps/planning_intelligence/config.py FILE_CATEGORIES
export const PLANNING_FILE_CATEGORIES = [
  { value: 'sow', label: 'Scope of Work (SOW)', icon: '📜' },
  { value: 'wbs', label: 'WBS Structure', icon: '🗂️' },
  { value: 'mdr', label: 'Master Deliverable Register (MDR)', icon: '📚' },
  { value: 'eddr', label: 'Engineering Document Deliverable Register (EDDR)', icon: '📋' },
  { value: 'schedule_requirements', label: 'Schedule Requirements', icon: '📐' },
  { value: 'project_control_procedure', label: 'Project Control Procedure', icon: '📏' },
  { value: 'reference_schedule', label: 'Reference Schedule', icon: '📅' },
  { value: 'output_schedule_sample', label: 'Output Schedule Sample', icon: '🧾' },
  { value: 'timeline', label: 'Timeline / Milestone File', icon: '🚩' },
  { value: 'other', label: 'Other Attachment', icon: '📎' },
]

// Left-side workflow navigation — soft-coded, add a step by appending here only.
// `accent` drives the stepper's icon-chip gradient; `requiresGeneration` controls
// whether the step is greyed out until a schedule has been generated at least once.
export const PLANNING_WORKFLOW_STEPS = [
  { id: 'upload',       label: 'Upload Files',          icon: '📤', description: 'Add SOW, WBS, MDR & schedule docs', accent: 'from-sky-500 to-blue-600',      requiresGeneration: false },
  { id: 'intelligence', label: 'Document Intelligence', icon: '🧠', description: 'Rule-based analysis of your files',  accent: 'from-violet-500 to-purple-600', requiresGeneration: false },
  { id: 'wbs',          label: 'WBS Builder',           icon: '🗂️', description: 'Work breakdown structure tree',      accent: 'from-fuchsia-500 to-pink-600',  requiresGeneration: true },
  { id: 'schedule',     label: 'Schedule Generator',    icon: '📅', description: 'Level-4 activities & critical path', accent: 'from-orange-500 to-amber-600',  requiresGeneration: true },
  { id: 'eddr',         label: 'EDDR',                  icon: '📋', description: 'Deliverable review-cycle register',  accent: 'from-teal-500 to-emerald-600',  requiresGeneration: true },
  { id: 'manhours',     label: 'Manhours',              icon: '⏱️', description: 'Resource & effort estimate',         accent: 'from-cyan-500 to-sky-600',      requiresGeneration: true },
  { id: 'validation',   label: 'Validation',            icon: '✅', description: 'Automated QA rule checks',           accent: 'from-emerald-500 to-green-600', requiresGeneration: true },
  { id: 'narrative',    label: 'Narrative',             icon: '📝', description: 'Auto-composed schedule basis',       accent: 'from-indigo-500 to-blue-600',   requiresGeneration: true },
  { id: 'presentation', label: 'PowerPoint Presentation', icon: '📊', description: 'Client-ready summary deck',         accent: 'from-rose-500 to-orange-500',   requiresGeneration: true },
  { id: 'export',       label: 'Export',                icon: '⬇️', description: 'CSV, Excel, Primavera, JSON',        accent: 'from-slate-600 to-slate-800',   requiresGeneration: true },
  { id: 'proposal',     label: 'Final Project Proposal', icon: '📑', description: 'Sales · enterprise technical proposal', accent: 'from-indigo-600 to-violet-700', requiresGeneration: true },
]

// Soft-coded layout tokens so the page's "canvas" sizing / hero styling can be
// tuned in one place without touching JSX.
export const PLANNING_UI = {
  heroIcon: '🧭',
  heroGradient: 'from-violet-600 via-indigo-600 to-blue-600',
}

// Canvas width modes — user-toggleable between a comfortable reading width
// ("original") and a near edge-to-edge working width ("full"). Persisted in
// localStorage so the preference survives reloads/navigation.
export const CANVAS_MODES = {
  ORIGINAL: 'original',
  FULL: 'full',
}

export const CANVAS_MODE_STORAGE_KEY = 'planningPackages.canvasMode'

export const CANVAS_MODE_OPTIONS = [
  { value: CANVAS_MODES.ORIGINAL, label: 'Original', icon: '🗗' },
  { value: CANVAS_MODES.FULL, label: 'Full Screen', icon: '🖥️' },
]

// Tailwind classes per canvas mode — widened "original" width and a near-full
// "full" width, each paired with matching outer page padding.
export const CANVAS_MODE_STYLES = {
  [CANVAS_MODES.ORIGINAL]: {
    container: 'max-w-[1800px]',
    pagePadding: 'px-4 sm:px-6 lg:px-10',
  },
  [CANVAS_MODES.FULL]: {
    container: 'max-w-none',
    pagePadding: 'px-2 sm:px-3 lg:px-5',
  },
}

export const PARSE_STATUS_STYLES = {
  pending:    { label: 'Pending',    className: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Processing', className: 'bg-amber-100 text-amber-700' },
  done:       { label: 'Parsed',     className: 'bg-emerald-100 text-emerald-700' },
  failed:     { label: 'Failed',     className: 'bg-rose-100 text-rose-700' },
}

export const VALIDATION_SEVERITY_STYLES = {
  pass:     { label: 'Pass',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning:  { label: 'Warning',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  critical: { label: 'Critical', className: 'bg-rose-50 text-rose-700 border-rose-200' },
}

// Export step cards — soft-coded metadata so the Export screen can grow new
// formats/descriptions without touching JSX. `category` groups cards into
// sections; `badge` is an optional small pill (e.g. "New"); `accent` drives
// the card's icon-chip + hover gradient.
export const EXPORT_FORMATS = [
  { format: 'xer',           label: 'Primavera Schedule (.xer)', icon: '🗓️', description: 'Native P6 project file — WBS, activities, logic ties & calendar in one import.', category: 'Schedule Data', accent: 'from-orange-500 to-amber-600', badge: 'New' },
  { format: 'primavera_csv', label: 'Primavera-ready (CSV)',     icon: '🛠️', description: "Column layout mapped for P6's CSV import wizard.",                          category: 'Schedule Data', accent: 'from-amber-500 to-yellow-600' },
  { format: 'csv',           label: 'Activities (CSV)',          icon: '📄', description: 'Flat activity list — quick to open in any spreadsheet tool.',               category: 'Schedule Data', accent: 'from-slate-500 to-slate-700' },
  { format: 'excel',         label: 'Activities (Excel)',        icon: '📊', description: 'Formatted workbook, ready to filter, sort & share.',                        category: 'Spreadsheet',  accent: 'from-emerald-500 to-green-600' },
  { format: 'eddr_csv',      label: 'EDDR (CSV)',                icon: '📋', description: 'Deliverable review-cycle register for document control.',                  category: 'Documents',    accent: 'from-teal-500 to-emerald-600' },
  { format: 'json',          label: 'Full Generation (JSON)',    icon: '🧬', description: 'Complete raw payload — WBS, schedule, EDDR, manhours & validation.',        category: 'Raw Data',     accent: 'from-indigo-500 to-violet-600' },
]

// Section order + accent used for the Export step's category headers.
export const EXPORT_CATEGORY_ORDER = ['Schedule Data', 'Spreadsheet', 'Documents', 'Raw Data']

// Slide outline shown to the user before they download the PowerPoint deck —
// purely descriptive; the backend (export_utils.generation_to_pptx_bytes)
// is the single source of truth for actual slide content/order. Deck is
// built on Rejlers' own corporate template (cover/agenda/content/table/
// closing layouts), so exports are on-brand in both local and production.
export const PRESENTATION_SLIDE_OUTLINE = [
  { icon: '🧭', title: 'Cover — Project Snapshot' },
  { icon: '📑', title: 'Agenda' },
  { icon: '🧭', title: 'Project Overview' },
  { icon: '🗂️', title: 'Work Breakdown Structure' },
  { icon: '📅', title: 'Schedule Summary' },
  { icon: '📌', title: 'Key Milestones (if defined)' },
  { icon: '📋', title: 'Engineering Document Deliverable Register' },
  { icon: '⏱️', title: 'Manhour Estimate' },
  { icon: '✅', title: 'Validation & Quality Checks' },
  { icon: '📝', title: 'Executive Summary' },
  { icon: '🙏', title: 'Closing — Thank You' },
]

// Max file size shown in the uploader hint — mirrors backend MAX_FILE_BYTES default.
export const PLANNING_MAX_FILE_MB = 100

// ─────────────────────────────────────────────────────────────────────────
// Discipline metadata — mirrors backend/apps/planning_intelligence/config.py
// (DISCIPLINES, DISCIPLINE_RESPONSIBLE_ROLE, DISCIPLINE_DEFAULT_DELIVERABLES).
// Only the "engineering" disciplines that Document Intelligence actually
// scans for (see ENGINEERING_DISCIPLINE_ORDER) are listed here — used to turn
// the flat "3 deliverables · 1 mentioned" discipline card into a detailed,
// expandable one (icon, responsible role, full deliverable checklist).
// Add a discipline by appending a row here — no JSX changes required.
// ─────────────────────────────────────────────────────────────────────────
// chartColor: hex form of each accent gradient's start color — Recharts fills
// need a real CSS color, not a Tailwind class, so charts stay visually tied
// to the same per-discipline color used in badges/cards throughout this page.
export const PLANNING_DISCIPLINE_META = {
  process:         { label: 'Process Engineering',         icon: '🧪', accent: 'from-sky-500 to-blue-600',       chartColor: '#0ea5e9', responsibleRole: 'Lead Process Engineer' },
  piping:          { label: 'Piping Engineering',           icon: '🛢️', accent: 'from-amber-500 to-orange-600',   chartColor: '#f59e0b', responsibleRole: 'Lead Piping Engineer' },
  mechanical:      { label: 'Mechanical Engineering',       icon: '⚙️', accent: 'from-slate-500 to-slate-700',    chartColor: '#64748b', responsibleRole: 'Mechanical Engineer' },
  civil:           { label: 'Civil / Structural Engineering', icon: '🏗️', accent: 'from-stone-500 to-stone-700', chartColor: '#78716c', responsibleRole: 'Civil Engineer' },
  electrical:      { label: 'Electrical Engineering',       icon: '⚡', accent: 'from-yellow-500 to-amber-600',   chartColor: '#eab308', responsibleRole: 'Electrical Engineer' },
  instrumentation: { label: 'Instrumentation & Control',    icon: '🎛️', accent: 'from-emerald-500 to-teal-600',   chartColor: '#10b981', responsibleRole: 'Instrumentation Engineer' },
  telecom:         { label: 'Telecom',                      icon: '📡', accent: 'from-indigo-500 to-violet-600',  chartColor: '#6366f1', responsibleRole: 'Instrumentation Engineer' },
}
export const DEFAULT_DISCIPLINE_META = { label: '', icon: '📄', accent: 'from-slate-400 to-slate-600', chartColor: '#94a3b8', responsibleRole: 'Engineer' }

// ─────────────────────────────────────────────────────────────────────────
// BYOK (Bring Your Own Key) — Claude/Anthropic augmentation, per project.
// Mirrors backend/apps/planning_intelligence/config.py. Model list is
// soft-coded here as a fallback; the backend's `model_choices` (returned by
// the ai-settings GET endpoint) is always preferred/authoritative when
// available, so new models only need to be added on the backend.
// ─────────────────────────────────────────────────────────────────────────
export const AI_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic Claude' },
]

export const CLAUDE_MODEL_OPTIONS = [
  { value: 'claude-opus-5', label: 'Claude Opus 5 (most capable — recommended)', recommended: true },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (balanced cost/quality)', recommended: false },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest / cheapest)', recommended: false },
]

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5'

// Simple client-side sanity check before submitting (backend re-validates).
export const CLAUDE_API_KEY_PATTERN = /^sk-ant-[A-Za-z0-9\-_]{20,}$/
