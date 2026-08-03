/**
 * Electrical Equipment Single Line Diagram Upload Configuration
 * SOFT-CODED: Centralized configuration for SLD upload and equipment detection
 * Version: 1.0.0
 */

export const ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG = {
  // Page metadata
  page: {
    title: 'Electrical Equipment Datasheet Generator',
    subtitle: 'Upload Single Line Diagrams (SLD) to automatically detect and generate datasheets for electrical equipment',
    backRoute: '/engineering/electrical/datasheet',
    backText: 'Back to Electrical Datasheets'
  },

  // Upload configuration
  upload: {
    supportedFormats: ['PDF', 'DWG', 'DXF', 'PNG', 'JPG', 'JPEG', 'TIFF'],
    maxFileSize: 50, // MB per file
    maxFiles: 10, // Maximum number of files in multi-upload
    acceptString: '.pdf,.dwg,.dxf,.png,.jpg,.jpeg,.tiff',
    allowMultiple: true,
    dragDropText: 'Drop SLD file(s) here or click to browse',
    dragDropTextMultiple: 'Drop multiple SLD files here or click to browse',
    uploadButtonTextSingle: 'Analyze SLD',
    uploadButtonTextMultiple: 'Analyze {count} SLDs',
    uploadingText: 'Analyzing Single Line Diagrams...'
  },

  // Equipment types that can be detected
  equipmentTypes: [
    {
      id: 'transformer',
      name: 'Transformer (Power & Distribution)',
      code: 'TR',
      prefix: ['TR-', 'T-', 'TX-'],
      color: 'blue',
      icon: '⚡',
      description: 'Power and distribution transformers',
      priority: 1
    },
    {
      id: 'diesel_generator',
      name: 'Emergency Diesel Generator',
      code: 'DG',
      prefix: ['DG-', 'GEN-', 'G-'],
      color: 'orange',
      icon: '🔋',
      description: 'Emergency diesel generator sets',
      priority: 1
    },
    {
      id: 'switchgear_11kv',
      name: '11KV Switchgear',
      code: 'SWG',
      prefix: ['SWG-', 'SW-', 'SG-'],
      color: 'purple',
      icon: '🔌',
      description: '11KV metal-clad switchgear',
      priority: 1
    },
    {
      id: 'circuit_breaker',
      name: 'Circuit Breaker',
      code: 'CB',
      prefix: ['CB-', 'BR-'],
      color: 'red',
      icon: '🔴',
      description: 'High voltage circuit breakers',
      priority: 2
    },
    {
      id: 'motor',
      name: 'Electric Motor',
      code: 'M',
      prefix: ['M-', 'MT-', 'MOT-'],
      color: 'green',
      icon: '⚙️',
      description: 'AC/DC electric motors',
      priority: 2
    },
    {
      id: 'vfd',
      name: 'Variable Frequency Drive',
      code: 'VFD',
      prefix: ['VFD-', 'VSD-'],
      color: 'indigo',
      icon: '📊',
      description: 'Variable frequency drives',
      priority: 2
    },
    {
      id: 'ups',
      name: 'Uninterruptible Power Supply',
      code: 'UPS',
      prefix: ['UPS-', 'U-'],
      color: 'cyan',
      icon: '🔋',
      description: 'UPS systems',
      priority: 2
    },
    {
      id: 'capacitor_bank',
      name: 'Capacitor Bank',
      code: 'CAP',
      prefix: ['CAP-', 'CB-', 'C-'],
      color: 'yellow',
      icon: '⚡',
      description: 'Power factor correction capacitor banks',
      priority: 3
    }
  ],

  // SOFT-CODED: Datasheet Types Configuration
  // These are the primary technical datasheets that can be generated
  datasheetTypes: [
    {
      id: 'transformer',
      name: 'Transformer (Power & Distribution)',
      shortName: 'Transformer',
      icon: '⚡',
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-600',
      description: 'Technical datasheet for power and distribution transformers',
      route: '/engineering/electrical/datasheet/transformer',
      defaultSelected: true,
      specifications: [
        'Voltage Ratings (Primary/Secondary)',
        'Power Rating (kVA/MVA)',
        'Vector Group & Connections',
        'Impedance & Losses',
        'Cooling Type (ONAN/ONAF)',
        'Standards (IEC/ADNOC)'
      ]
    },
    {
      id: 'diesel_generator',
      name: 'Emergency Diesel Generator',
      shortName: 'Diesel Generator',
      icon: '🔋',
      color: 'orange',
      gradient: 'from-orange-500 to-red-600',
      description: 'Technical datasheet for emergency diesel generator sets',
      route: '/engineering/electrical/datasheet/diesel-generator',
      defaultSelected: true,
      specifications: [
        'Rated Power Output (kW/kVA)',
        'Voltage & Frequency',
        'Engine Make & Model',
        'Fuel Consumption',
        'Starting System',
        'Enclosure & Noise Level'
      ]
    },
    {
      id: 'switchgear_11kv',
      name: '11KV Switchgear',
      shortName: '11KV Switchgear',
      icon: '🔌',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-600',
      description: 'Technical datasheet for 11KV metal-clad switchgear',
      route: '/engineering/electrical/datasheet/switchgear-11kv',
      defaultSelected: true,
      specifications: [
        'Rated Voltage & Current',
        'Short Circuit Rating (kA)',
        'Circuit Breaker Type',
        'Protection Relays',
        'Busbar Configuration',
        'Type Testing Requirements'
      ]
    }
  ],

  // Analysis options configuration
  analysisOptions: {
    extractTags: {
      id: 'extract_tags',
      label: 'Extract Equipment Tags',
      description: 'Identify and extract all equipment tag numbers',
      default: true,
      icon: '🏷️'
    },
    detectTypes: {
      id: 'detect_types',
      label: 'Detect Equipment Types',
      description: 'Classify equipment by type (transformers, generators, switchgear, etc.)',
      default: true,
      icon: '🔍'
    },
    extractSpecs: {
      id: 'extract_specs',
      label: 'Extract Specifications',
      description: 'Read technical specifications from SLD annotations',
      default: true,
      icon: '📝'
    },
    generateDatasheets: {
      id: 'generate_datasheets',
      label: 'Generate Datasheets',
      description: 'Create preliminary datasheets for detected equipment',
      default: false,
      icon: '📄'
    },
    identifyConnections: {
      id: 'identify_connections',
      label: 'Map Electrical Connections',
      description: 'Identify upstream/downstream electrical connections',
      default: true,
      icon: '🔗'
    }
  },

  // Project metadata fields
  projectFields: {
    drawing_number: {
      label: 'Drawing Number',
      placeholder: 'e.g., E-1001-001',
      required: true,
      autoGenerate: true,
      pattern: '^[A-Z0-9-]+$'
    },
    drawing_title: {
      label: 'Drawing Title',
      placeholder: 'Single Line Diagram',
      required: true
    },
    revision: {
      label: 'Revision',
      placeholder: 'Rev 0',
      required: true,
      default: 'Rev 0'
    },
    project_name: {
      label: 'Project Name',
      placeholder: 'Project Name',
      required: false
    },
    project_code: {
      label: 'Project Code',
      placeholder: 'PROJ-001',
      required: false
    },
    area: {
      label: 'Electrical Area',
      placeholder: 'Area 100 - Main Substation',
      required: false
    },
    discipline: {
      label: 'Discipline',
      options: ['Electrical', 'Instrumentation', 'Control Systems', 'Power Distribution'],
      default: 'Electrical'
    },
    voltage_level: {
      label: 'Voltage Level',
      placeholder: 'e.g., 11KV, 33KV, 415V',
      required: false,
      options: ['11KV', '33KV', '132KV', '415V', '230V', 'Mixed']
    }
  },

  // API endpoints - Soft-coded for easy backend integration
  api: {
    // Single file analysis endpoint
    analyze: '/sld/equipment/analyze/',
    
    // Multiple file batch analysis endpoint
    batchAnalyze: '/sld/equipment/batch-analyze/',
    
    // Equipment detail endpoint
    equipmentDetail: '/sld/equipment/',
    
    // Datasheet generation endpoint
    generateDatasheet: '/sld/equipment/generate-datasheet/',
    
    // Export endpoint
    export: '/sld/equipment/export/'
  },

  // Messages and notifications
  messages: {
    info: {
      aiPowered: 'AI-powered electrical equipment detection from Single Line Diagrams with automatic technical specification extraction',
      multiFileSupport: 'Upload multiple SLD files for batch processing',
      oneClick: 'One-click datasheet generation for transformers, generators, and switchgear'
    },
    success: {
      uploadComplete: 'Analysis complete! {count} equipment items detected',
      datasheetGenerated: 'Datasheet generated successfully',
      exported: 'Data exported successfully'
    },
    errors: {
      uploadFailed: 'Upload failed. Please try again.',
      invalidFormat: 'Invalid file format. Supported formats:',
      fileTooLarge: 'File size exceeds {size}MB limit',
      tooManyFiles: 'Maximum {max} files allowed',
      noEquipmentDetected: 'No electrical equipment detected in the drawing',
      analysisError: 'Analysis failed. Please check your drawing and try again.'
    },
    warnings: {
      lowConfidence: 'Some equipment detected with low confidence. Please verify results.',
      missingSpecs: 'Some technical specifications could not be extracted',
      ambiguousTag: 'Ambiguous tag detected. Manual verification recommended.'
    }
  },

  // Theme configuration
  theme: {
    primary: 'blue',
    secondary: 'indigo',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-indigo-600',
    accent: 'purple'
  },

  // Feature flags
  features: {
    enableBatchUpload: true,
    enableAutoDatasheetGeneration: true,
    enableExport: true,
    enablePreview: true,
    enableAdvancedFilters: true
  }
};

// Validation functions
export const validateFileSize = (file) => {
  const maxSize = ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG.upload.maxFileSize * 1024 * 1024; // Convert MB to bytes
  return file.size <= maxSize;
};

export const validateFileFormat = (file) => {
  const supportedFormats = ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG.upload.supportedFormats.map(f => f.toLowerCase());
  const fileExtension = file.name.split('.').pop().toLowerCase();
  return supportedFormats.includes(fileExtension);
};

export const getEquipmentTypeById = (id) => {
  return ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG.equipmentTypes.find(type => type.id === id);
};

export const getColorScheme = (color) => {
  const colors = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' }
  };
  return colors[color] || colors.blue;
};

export const getApiEndpoint = (endpoint) => {
  return ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG.api[endpoint];
};

export const handleApiError = (error) => {
  console.error('API Error:', error);
  if (error.response) {
    return error.response.data.message || ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG.messages.errors.analysisError;
  }
  return ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG.messages.errors.uploadFailed;
};

export const retryRequest = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

export default ELECTRICAL_EQUIPMENT_UPLOAD_CONFIG;
