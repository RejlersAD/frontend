/**
 * Pressure Instrument Datasheet Configuration
 * SOFT-CODED: Centralized configuration for pressure instrument analysis
 */

export const PRESSURE_INSTRUMENT_CONFIG = {
  // Page metadata
  page: {
    title: 'Pressure Instrument Datasheet Generator',
    subtitle: 'AI-powered instrument detection and datasheet generation from P&ID drawings',
    backButtonText: 'Back to Process Datasheets',
    icon: '🎯'
  },

  // Upload configuration
  upload: {
    supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG', 'DWG', 'TIFF'],
    maxFileSize: 50, // MB
    acceptedMimeTypes: '.pdf,.png,.jpg,.jpeg,.dwg,.tiff',
    dragDropText: 'Drop P&ID file here or click to browse',
    uploadButtonText: 'Analyze P&ID for Pressure Instruments',
    uploadingText: 'Analyzing P&ID...'
  },

  // Instrument types detection
  instrumentTypes: [
    {
      id: 'pressure_transmitter',
      label: 'Pressure Transmitters',
      prefix: 'PT',
      color: 'blue',
      icon: '📡',
      description: 'Converts pressure to electrical signal'
    },
    {
      id: 'pressure_indicator',
      label: 'Pressure Indicators',
      prefix: 'PI',
      color: 'green',
      icon: '📊',
      description: 'Local pressure display'
    },
    {
      id: 'pressure_switch',
      label: 'Pressure Switches',
      prefix: 'PS',
      color: 'yellow',
      icon: '⚡',
      description: 'Binary pressure switch'
    },
    {
      id: 'pressure_controller',
      label: 'Pressure Controllers',
      prefix: 'PC',
      color: 'purple',
      icon: '🎛️',
      description: 'Automated pressure control'
    },
    {
      id: 'pressure_gauge',
      label: 'Pressure Gauges',
      prefix: 'PG',
      color: 'cyan',
      icon: '🌡️',
      description: 'Mechanical pressure gauge'
    },
    {
      id: 'differential_pressure',
      label: 'Differential Pressure',
      prefix: 'PDT/PDI',
      color: 'orange',
      icon: '⚖️',
      description: 'Measures pressure difference'
    },
    {
      id: 'pressure_safety',
      label: 'Pressure Safety Valves',
      prefix: 'PSV',
      color: 'red',
      icon: '🛡️',
      description: 'Safety relief valves'
    }
  ],

  // Analysis options
  analysisOptions: [
    {
      key: 'extractTags',
      label: 'Extract Tag Numbers',
      description: 'Identify and extract all instrument tag numbers',
      defaultValue: true,
      icon: '🏷️'
    },
    {
      key: 'identifyLocations',
      label: 'Identify Locations',
      description: 'Determine instrument locations on P&ID',
      defaultValue: true,
      icon: '📍'
    },
    {
      key: 'detectRanges',
      label: 'Detect Ranges',
      description: 'Extract pressure ranges and specifications',
      defaultValue: true,
      icon: '📏'
    },
    {
      key: 'identifyServices',
      label: 'Identify Services',
      description: 'Extract service descriptions',
      defaultValue: true,
      icon: '⚙️'
    },
    {
      key: 'extractLineNumbers',
      label: 'Extract Line Numbers',
      description: 'Identify associated piping line numbers',
      defaultValue: true,
      icon: '🔗'
    },
    {
      key: 'generateDatasheets',
      label: 'Generate Datasheets',
      description: 'Create preliminary datasheets with AI',
      defaultValue: false,
      icon: '📄'
    }
  ],

  // Form fields for manual entry
  formFields: [
    {
      section: 'Drawing Information',
      fields: [
        {
          name: 'drawing_number',
          label: 'Drawing Number',
          type: 'text',
          placeholder: 'P-1001-A',
          required: true,
          icon: '📋'
        },
        {
          name: 'drawing_title',
          label: 'Drawing Title',
          type: 'text',
          placeholder: 'Process Flow Diagram',
          required: true,
          icon: '📝'
        },
        {
          name: 'revision',
          label: 'Revision',
          type: 'text',
          placeholder: 'Rev 0',
          defaultValue: 'Rev 0',
          required: true,
          icon: '🔄'
        },
        {
          name: 'project_name',
          label: 'Project Name',
          type: 'text',
          placeholder: 'Project Name',
          defaultValue: 'Project',
          required: true,
          icon: '🏗️'
        },
        {
          name: 'area',
          label: 'Process Area',
          type: 'text',
          placeholder: 'Area 100',
          defaultValue: 'Process Area',
          required: false,
          icon: '📐'
        }
      ]
    }
  ],

  // API endpoints
  api: {
    analyze: '/pid/pressure-instruments/analyze/',
    downloadExcel: '/pid/pressure-instruments/download-excel/',
    getTypes: '/pid/pressure-instruments/types/'
  },

  // Timeout configurations
  timeouts: {
    upload: 300000, // 5 minutes
    analysis: 180000, // 3 minutes
    download: 60000 // 1 minute
  },

  // Result display configuration
  results: {
    successTitle: 'P&ID Analysis Complete!',
    successMessage: 'Pressure instruments detected and analyzed successfully',
    downloadButtonText: 'Download Excel Datasheet',
    excelFileName: 'Pressure Instrument Data Sheet.xlsx',
    showInstrumentDetails: true,
    maxVisibleInstruments: 10
  },

  // Messages
  messages: {
    errors: {
      noFile: 'Please select a P&ID file to upload',
      uploadFailed: 'Failed to upload P&ID. Please try again.',
      analysisfailed: 'AI analysis failed. Please try again.',
      downloadFailed: 'Failed to download Excel file. Please try again.',
      invalidFormat: 'Unsupported file format. Please upload:',
      fileTooLarge: 'File size exceeds {size}MB limit',
      noInstruments: 'No pressure instruments detected in the P&ID'
    },
    success: {
      uploadComplete: 'Upload and analysis complete!',
      instrumentsDetected: '✅ Detected {count} pressure instrument(s)',
      downloadReady: 'Excel datasheet is ready for download'
    },
    info: {
      aiPowered: 'Our AI automatically identifies pressure instruments, extracts tag numbers, determines instrument types, and generates comprehensive datasheets.',
      oneClick: 'One-click analysis • No manual data entry required',
      autoDownload: 'Excel file will be automatically downloaded upon completion'
    }
  },

  // Color schemes for instrument types
  colors: {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      text: 'text-blue-800 dark:text-blue-200',
      border: 'border-blue-500',
      gradient: 'from-blue-500 to-blue-600'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/20',
      text: 'text-green-800 dark:text-green-200',
      border: 'border-green-500',
      gradient: 'from-green-500 to-green-600'
    },
    yellow: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/20',
      text: 'text-yellow-800 dark:text-yellow-200',
      border: 'border-yellow-500',
      gradient: 'from-yellow-500 to-yellow-600'
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/20',
      text: 'text-purple-800 dark:text-purple-200',
      border: 'border-purple-500',
      gradient: 'from-purple-500 to-purple-600'
    },
    cyan: {
      bg: 'bg-cyan-100 dark:bg-cyan-900/20',
      text: 'text-cyan-800 dark:text-cyan-200',
      border: 'border-cyan-500',
      gradient: 'from-cyan-500 to-cyan-600'
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/20',
      text: 'text-orange-800 dark:text-orange-200',
      border: 'border-orange-500',
      gradient: 'from-orange-500 to-orange-600'
    },
    red: {
      bg: 'bg-red-100 dark:bg-red-900/20',
      text: 'text-red-800 dark:text-red-200',
      border: 'border-red-500',
      gradient: 'from-red-500 to-red-600'
    }
  }
};

export default PRESSURE_INSTRUMENT_CONFIG;
