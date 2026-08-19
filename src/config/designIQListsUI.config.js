/**
 * DesignIQ Lists UI Configuration
 * SOFT-CODED: Centralized UI settings for easy customization
 * Modify this file to change layout, colors, and behavior without touching core logic
 */

export const DESIGNIQ_UI_CONFIG = {
  // Layout Settings
  layout: {
    containerPadding: 'p-6',
    cardSpacing: 'mb-6',
    sectionSpacing: 'space-y-6',
    maxWidth: 'max-w-7xl mx-auto',
    enableStickyHeader: true,
    enableAnimations: true
  },

  // Color Themes for Different Sections
  colors: {
    primary: {
      bg: 'bg-indigo-600',
      hover: 'hover:bg-indigo-700',
      text: 'text-indigo-600',
      border: 'border-indigo-500'
    },
    accent: {
      bg: 'bg-purple-500',
      hover: 'hover:bg-purple-600',
      text: 'text-purple-600',
      border: 'border-purple-300'
    },
    success: {
      bg: 'bg-green-500',
      hover: 'hover:bg-green-600',
      text: 'text-green-600',
      light: 'bg-green-50'
    },
    warning: {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      light: 'bg-yellow-50'
    }
  },

  // Upload Zone Configuration
  uploadZone: {
    position: 'top', // 'top' or 'sidebar'
    style: 'card', // 'card', 'inline', 'modal'
    showInTab: true, // Show as separate tab vs always visible
    collapsed: false, // Start collapsed
    elevation: 'shadow-lg',
    gradient: 'from-purple-50 via-indigo-50 to-blue-50'
  },

  // Action Bar Settings
  actionBar: {
    layout: 'horizontal', // 'horizontal' or 'split'
    position: 'sticky', // 'static' or 'sticky'
    background: 'bg-white',
    shadow: 'shadow-md',
    padding: 'p-4',
    items: {
      search: { enabled: true, placeholder: 'Search by tag or description...', width: 'max-w-md' },
      filters: { enabled: true, showCount: true },
      export: { enabled: true, formats: ['excel', 'csv', 'pdf'] },
      refresh: { enabled: true, autoRefresh: true, interval: 30000 }
    }
  },

  // Stats Dashboard
  statsDashboard: {
    position: 'below-tabs', // 'below-tabs', 'sidebar', 'hidden'
    layout: 'grid', // 'grid' or 'horizontal'
    columns: 5,
    showPercentages: true,
    showTrends: true,
    animated: true,
    compactMode: false
  },

  // Document Upload Cards
  documentCards: {
    layout: 'grid', // 'grid', 'vertical', 'accordion'
    columns: 4,
    showPreview: true,
    showProgress: true,
    dragAndDrop: true,
    colors: {
      pid: { primary: 'blue', gradient: 'from-blue-50 to-blue-100' },
      hmb: { primary: 'green', gradient: 'from-green-50 to-green-100' },
      pms: { primary: 'orange', gradient: 'from-orange-50 to-orange-100' },
      nace: { primary: 'red', gradient: 'from-red-50 to-red-100' }
    }
  },

  // Format Selection
  formatSelection: {
    layout: 'cards', // 'cards', 'buttons', 'dropdown'
    showExamples: true,
    showIcons: true,
    highlightRequired: true,
    description: 'short' // 'short', 'detailed', 'hidden'
  },

  // Processing Indicators
  processing: {
    useModal: true, // vs inline
    showDetailedProgress: true,
    animationType: 'pulse', // 'pulse', 'spin', 'progress'
    showSteps: true,
    estimateTime: true
  },

  // Data Table Settings
  dataTable: {
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    stickyHeader: true,
    zebbraStripes: true,
    hoverEffect: true,
    compactMode: false,
    showRowNumbers: true
  },

  // Feature Flags
  features: {
    enableBatchUpload: true,
    enableAutoSave: true,
    enableKeyboardShortcuts: true,
    enableDarkMode: false,
    enableCollapsibleSections: true,
    enableQuickActions: true
  },

  // Text Content (for easy localization)
  text: {
    pageTitle: 'Engineering Lists',
    pageSubtitle: 'Smart document processing with AI-powered enrichment',
    uploadZoneTitle: '🚀 Smart 4-Document Enrichment',
    uploadZoneSubtitle: 'Upload P&ID + 3 Technical Documents for 34-column enriched table',
    formatSelectionTitle: 'Step 1: Select Project Format',
    formatSelectionHint: 'Choose your project type - this determines the line number format',
    processButtonText: '⚡ Process All Documents',
    processButtonTextProcessing: '⏳ Processing...',
    documentsLabel: 'Documents uploaded',
    exportButtonText: 'Export Data',
    filtersButtonText: 'Filters',
    searchPlaceholder: 'Search by tag or description...'
  },

  // Icons (HeroIcons class names)
  icons: {
    upload: 'ArrowUpTrayIcon',
    download: 'ArrowDownTrayIcon',
    filter: 'FunnelIcon',
    search: 'MagnifyingGlassIcon',
    refresh: 'ArrowPathIcon',
    success: 'CheckCircleIcon',
    error: 'XCircleIcon',
    warning: 'ExclamationTriangleIcon',
    info: 'InformationCircleIcon'
  }
};

// Format-specific configurations
export const FORMAT_CONFIGS = {
  onshore: {
    name: 'Onshore',
    description: 'No area code',
    example: '2-D-5777-033842-X',
    color: 'blue',
    icon: '🏭',
    pattern: 'SIZE-FLUID-SEQUENCE-PIPECLASS'
  },
  general: {
    name: 'General',
    description: 'With area code',
    example: '1"-41-SWS-64544-A2AU16-V',
    color: 'green',
    icon: '🏗️',
    pattern: 'SIZE-AREA-FLUID-SEQUENCE-PIPECLASS'
  },
  offshore: {
    name: 'Offshore',
    description: 'Area-first format',
    example: '604-HO-8-BC2GA0-1070-H',
    color: 'purple',
    icon: '⚓',
    pattern: 'AREA-FLUID-SIZE-PIPECLASS-SEQUENCE'
  }
};

// Document type configurations
export const DOCUMENT_CONFIGS = {
  pid: {
    label: 'P&ID Drawing',
    order: 1,
    required: true,
    badge: 'Mandatory',
    columns: 8,
    description: 'Extracts: Line No, Size, Fluid Code, Area, From, To',
    acceptedFormats: ['.pdf'],
    color: 'blue',
    icon: '📋'
  },
  hmb: {
    label: 'HMB/PFD',
    order: 2,
    required: false,
    badge: '+10 cols',
    columns: 10,
    description: 'Design/Operating Temp, Pressure, Flow Rate, Density',
    acceptedFormats: ['.pdf', '.xlsx', '.xls'],
    color: 'green',
    icon: '📊'
  },
  pms: {
    label: 'PMS',
    order: 3,
    required: false,
    badge: '+8 cols',
    columns: 8,
    description: 'Material Grade, Schedule, Flange Rating, Gaskets',
    acceptedFormats: ['.pdf', '.xlsx', '.xls'],
    color: 'orange',
    icon: '🔧'
  },
  nace: {
    label: 'NACE Report',
    order: 4,
    required: false,
    badge: '+8 cols',
    columns: 8,
    description: 'Corrosion Allowance, NACE Class, H2S, Coating',
    acceptedFormats: ['.pdf', '.xlsx', '.xls'],
    color: 'red',
    icon: '⚠️'
  }
};

// Column output information
export const COLUMN_OUTPUT_INFO = [
  { source: 'P&ID', columns: 8, color: 'blue' },
  { source: 'HMB', columns: 10, color: 'green' },
  { source: 'PMS', columns: 8, color: 'orange' },
  { source: 'NACE', columns: 8, color: 'red' }
];
