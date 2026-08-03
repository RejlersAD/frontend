/**
 * Soft-coded configuration for IO List Workflow Projects (Project Management).
 * Mirrors backend/apps/instrument_io_workflow/models.py IOListProject.
 *
 * NEVER hardcode project endpoints, status colors, categories, or copy in
 * pages — import them from here. To change project management behavior,
 * edit THIS file only.
 */

// ─────────────────────────────────────────────────────────────────────
// API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_API = {
  base:           '/instrument-io-workflow/projects',
  projects:       '/instrument-io-workflow/projects/',
  projectById:    (id) => `/instrument-io-workflow/projects/${id}/`,
  projectDocs:    (id) => `/instrument-io-workflow/projects/${id}/documents/`,
}

// ─────────────────────────────────────────────────────────────────────
// PROJECT STATUS
// Must match backend IOListProject.STATUS_CHOICES exactly
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_STATUSES = [
  { value: 'draft',     label: 'Draft'          },
  { value: 'active',    label: 'Active'         },
  { value: 'review',    label: 'Under Review'   },
  { value: 'completed', label: 'Completed'      },
  { value: 'archived',  label: 'Archived'       },
]

// Status badge colors (Tailwind)
export const IO_LIST_WORKFLOW_PROJECT_STATUS_BADGE = {
  draft:     { bg: 'bg-slate-100',   fg: 'text-slate-700',   dot: 'bg-slate-400',   label: 'Draft'        },
  active:    { bg: 'bg-emerald-100', fg: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Active'       },
  review:    { bg: 'bg-amber-100',   fg: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Under Review' },
  completed: { bg: 'bg-blue-100',    fg: 'text-blue-800',    dot: 'bg-blue-500',    label: 'Completed'    },
  archived:  { bg: 'bg-gray-100',    fg: 'text-gray-700',    dot: 'bg-gray-400',    label: 'Archived'     },
}

// ─────────────────────────────────────────────────────────────────────
// PROJECT CATEGORY
// Must match backend IOListProject.CATEGORY_CHOICES exactly
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_CATEGORIES = [
  { value: 'oil_gas',   label: 'Oil & Gas',        icon: '⚡' },
  { value: 'refinery',  label: 'Refinery',         icon: '🏭' },
  { value: 'lng',       label: 'LNG',              icon: '❄️' },
  { value: 'power',     label: 'Power Plant',      icon: '🔌' },
  { value: 'water',     label: 'Water/Wastewater', icon: '💧' },
  { value: 'other',     label: 'Other',            icon: '📦' },
]

// Category badge colors (Tailwind)
export const IO_LIST_WORKFLOW_PROJECT_CATEGORY_BADGE = {
  oil_gas:  { bg: 'bg-orange-100', fg: 'text-orange-800', dot: 'bg-orange-500' },
  refinery: { bg: 'bg-red-100',    fg: 'text-red-800',    dot: 'bg-red-500'    },
  lng:      { bg: 'bg-cyan-100',   fg: 'text-cyan-800',   dot: 'bg-cyan-500'   },
  power:    { bg: 'bg-yellow-100', fg: 'text-yellow-800', dot: 'bg-yellow-500' },
  water:    { bg: 'bg-blue-100',   fg: 'text-blue-800',   dot: 'bg-blue-500'   },
  other:    { bg: 'bg-gray-100',   fg: 'text-gray-700',   dot: 'bg-gray-500'   },
}

// ─────────────────────────────────────────────────────────────────────
// PROJECT FORM FIELDS
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_FIELDS = [
  {
    key:         'project_name',
    label:       'Project Name',
    type:        'text',
    placeholder: 'e.g. ADNOC Habshan MP Fuel Gas',
    required:    true,
    maxLength:   255,
    helpText:    'Descriptive name for the project',
  },
  {
    key:         'category',
    label:       'Category',
    type:        'select',
    options:     IO_LIST_WORKFLOW_PROJECT_CATEGORIES,
    required:    true,
    defaultValue: 'oil_gas',
    helpText:    'Industry/project type',
  },
  {
    key:         'status',
    label:       'Status',
    type:        'select',
    options:     IO_LIST_WORKFLOW_PROJECT_STATUSES,
    required:    true,
    defaultValue: 'draft',
    helpText:    'Current project stage',
  },
  {
    key:         'client_name',
    label:       'Client',
    type:        'text',
    placeholder: 'e.g. ADNOC Gas',
    required:    false,
    maxLength:   255,
    helpText:    'Client organization name',
  },
  {
    key:         'location',
    label:       'Location',
    type:        'text',
    placeholder: 'e.g. Abu Dhabi, UAE',
    required:    false,
    maxLength:   255,
    helpText:    'Project site location',
  },
  {
    key:         'project_code',
    label:       'Project Code',
    type:        'text',
    placeholder: 'e.g. NM-30201',
    required:    false,
    maxLength:   100,
    helpText:    'Internal project identifier',
  },
  {
    key:         'tags',
    label:       'Tags',
    type:        'text',
    placeholder: 'e.g. FEED, HAZOP, Brownfield (comma-separated)',
    required:    false,
    helpText:    'Comma-separated keywords for filtering',
  },
  {
    key:         'description',
    label:       'Description',
    type:        'textarea',
    placeholder: 'Optional project notes or scope summary',
    required:    false,
    rows:        3,
    helpText:    'Free-text project description',
  },
]

// ─────────────────────────────────────────────────────────────────────
// PAGE COPY
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_COPY = {
  // Panel/Modal titles
  panelTitle:         'Projects',
  createModalTitle:   'Create New Project',
  editModalTitle:     'Edit Project',
  deleteModalTitle:   'Delete Project',

  // Buttons
  createBtn:          'New Project',
  saveBtn:            'Save Project',
  updateBtn:          'Update Project',
  cancelBtn:          'Cancel',
  deleteBtn:          'Delete',
  confirmDeleteBtn:   'Yes, Delete',

  // Empty states
  emptyTitle:         'No Projects',
  emptySubtitle:      'Create a project to organize your IO List documents',
  noDocsTitle:        'No Documents in Project',
  noDocsSubtitle:     'Upload documents and assign them to this project',

  // Confirmations
  deleteConfirmMsg:   (projectName) => `Are you sure you want to delete the project "${projectName}"? Documents will be unlinked but not deleted.`,
  createSuccessMsg:   (projectName) => `Project "${projectName}" created successfully`,
  updateSuccessMsg:   (projectName) => `Project "${projectName}" updated successfully`,
  deleteSuccessMsg:   (projectName) => `Project "${projectName}" deleted successfully`,

  // Errors
  createErrorMsg:     'Failed to create project. Please try again.',
  updateErrorMsg:     'Failed to update project. Please try again.',
  deleteErrorMsg:     'Failed to delete project. Please try again.',
  loadErrorMsg:       'Failed to load projects. Please refresh.',

  // Filters
  filterPlaceholder:  'Search projects...',
  statusFilterLabel:  'Status',
  categoryFilterLabel:'Category',
  allLabel:           'All',

  // Table columns
  columns: {
    projectName:      'Project',
    category:         'Category',
    status:           'Status',
    client:           'Client',
    location:         'Location',
    docCount:         'Documents',
    createdBy:        'Created By',
    createdAt:        'Created',
    actions:          'Actions',
  },

  // Tooltips
  editTooltip:        'Edit project',
  deleteTooltip:      'Delete project',
  viewDocsTooltip:    'View project documents',
}

// ─────────────────────────────────────────────────────────────────────
// THEME (inherited from ioListWorkflow.config.js but can override here)
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_THEME = {
  // Panel/Modal
  panelBg:           'bg-white',
  panelBorder:       'border border-slate-200',
  panelShadow:       'shadow-xl',
  panelRounded:      'rounded-xl',
  
  // Header
  headerBg:          'bg-gradient-to-r from-indigo-600 to-blue-600',
  headerText:        'text-white',
  
  // Cards
  card:              'bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow',
  cardHover:         'hover:border-indigo-300',
  
  // Buttons
  primaryBtn:        'bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors',
  secondaryBtn:      'bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors',
  dangerBtn:         'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors',
  
  // Table
  tableHead:         'bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-semibold',
  tableRow:          'border-t border-slate-100 hover:bg-indigo-50/40 transition-colors',
  
  // Forms
  inputBorder:       'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500',
  labelText:         'text-sm font-medium text-slate-700',
  
  // Badge
  badge:             'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
}

// ─────────────────────────────────────────────────────────────────────
// LIMITS & VALIDATION
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_LIMITS = {
  maxProjectNameLength:   255,
  maxClientNameLength:    255,
  maxLocationLength:      255,
  maxProjectCodeLength:   100,
  maxDescriptionLength:   2000,
  maxTagsLength:          500,
  minSearchLength:        2,       // Minimum characters for search to trigger
  paginationPageSize:     20,      // Items per page in project list
  debounceSearchMs:       300,     // Debounce delay for search input
}

// ─────────────────────────────────────────────────────────────────────
// FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────
export const IO_LIST_WORKFLOW_PROJECT_FEATURES = {
  enableProjectManagement:  true,   // Master toggle for entire feature
  enableProjectFiltering:   true,   // Filter documents by project in main list
  enableProjectStats:       true,   // Show document count and stats in project cards
  enableProjectTags:        true,   // Allow tagging projects with keywords
  enableProjectSearch:      true,   // Enable search functionality
  enableBulkOperations:     false,  // Bulk assign documents to project (future)
  showArchivedByDefault:    false,  // Include archived projects in default list
}

// ─────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT (for convenience)
// ─────────────────────────────────────────────────────────────────────
export default {
  API: IO_LIST_WORKFLOW_PROJECT_API,
  STATUSES: IO_LIST_WORKFLOW_PROJECT_STATUSES,
  STATUS_BADGE: IO_LIST_WORKFLOW_PROJECT_STATUS_BADGE,
  CATEGORIES: IO_LIST_WORKFLOW_PROJECT_CATEGORIES,
  CATEGORY_BADGE: IO_LIST_WORKFLOW_PROJECT_CATEGORY_BADGE,
  FIELDS: IO_LIST_WORKFLOW_PROJECT_FIELDS,
  COPY: IO_LIST_WORKFLOW_PROJECT_COPY,
  THEME: IO_LIST_WORKFLOW_PROJECT_THEME,
  LIMITS: IO_LIST_WORKFLOW_PROJECT_LIMITS,
  FEATURES: IO_LIST_WORKFLOW_PROJECT_FEATURES,
}
