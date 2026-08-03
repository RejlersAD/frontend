/**
 * Process Equipment P&ID Upload Configuration
 * SOFT-CODED: Centralized configuration for P&ID upload and equipment detection
 * Version: 1.0.0
 */

export const PROCESS_EQUIPMENT_UPLOAD_CONFIG = {
  // Page metadata
  page: {
    title: 'Process Equipment Datasheet Generator',
    subtitle: 'Upload P&ID drawings to automatically detect and generate datasheets for process equipment',
    backRoute: '/engineering/process/datasheet',
    backText: 'Back to Process Datasheets'
  },

  // Upload configuration
  upload: {
    supportedFormats: ['PDF', 'DWG', 'DXF', 'PNG', 'JPG', 'JPEG', 'TIFF'],
    maxFileSize: 50, // MB per file
    maxFiles: 10, // Maximum number of files in multi-upload
    acceptString: '.pdf,.dwg,.dxf,.png,.jpg,.jpeg,.tiff',
    allowMultiple: true,
    dragDropText: 'Drop P&ID file(s) here or click to browse',
    dragDropTextMultiple: 'Drop multiple P&ID files here or click to browse',
    uploadButtonTextSingle: 'Analyze P&ID',
    uploadButtonTextMultiple: 'Analyze {count} P&IDs',
    uploadingText: 'Analyzing P&ID drawings...'
  },

  // Equipment types that can be detected
  equipmentTypes: [
    {
      id: 'mov',
      name: 'Motor Operated Valve',
      code: 'MOV',
      prefix: ['MOV', 'MV'],
      color: 'blue',
      icon: '⚙️',
      description: 'Electrically actuated on/off valves',
      priority: 1
    },
    {
      id: 'sdv',
      name: 'Shut Down Valve',
      code: 'SDV',
      prefix: ['SDV', 'XV'],
      color: 'red',
      icon: '🛑',
      description: 'Emergency shut down valves',
      priority: 1
    },
    {
      id: 'control_valve',
      name: 'Control Valve',
      code: 'CV',
      prefix: ['FV', 'LV', 'PV', 'TV', 'HV'],
      color: 'green',
      icon: '🎛️',
      description: 'Modulating control valves',
      priority: 2
    },
    {
      id: 'pump',
      name: 'Pump',
      code: 'P',
      prefix: ['P-', 'PA-', 'PB-'],
      color: 'purple',
      icon: '⚡',
      description: 'Centrifugal and positive displacement pumps',
      priority: 1
    },
    {
      id: 'vessel',
      name: 'Pressure Vessel',
      code: 'V',
      prefix: ['V-', 'D-', 'T-'],
      color: 'cyan',
      icon: '🛢️',
      description: 'Pressure vessels, drums, and tanks',
      priority: 2
    },
    {
      id: 'heat_exchanger',
      name: 'Heat Exchanger',
      code: 'E',
      prefix: ['E-', 'HE-'],
      color: 'orange',
      icon: '🔥',
      description: 'Shell & tube, plate heat exchangers',
      priority: 2
    },
    {
      id: 'compressor',
      name: 'Compressor',
      code: 'K',
      prefix: ['K-', 'C-'],
      color: 'indigo',
      icon: '💨',
      description: 'Centrifugal and reciprocating compressors',
      priority: 3
    },
    {
      id: 'pressure_instrument',
      name: 'Pressure Instrument',
      code: 'PI',
      prefix: ['PT-', 'PI-', 'PS-', 'PC-'],
      color: 'yellow',
      icon: '📊',
      description: 'Pressure transmitters, indicators, switches',
      priority: 2
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
      description: 'Classify equipment by type (valves, pumps, vessels, etc.)',
      default: true,
      icon: '🔍'
    },
    extractSpecs: {
      id: 'extract_specs',
      label: 'Extract Specifications',
      description: 'Read technical specifications from P&ID annotations',
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
      label: 'Map Process Connections',
      description: 'Identify upstream/downstream equipment connections',
      default: true,
      icon: '🔗'
    }
  },

  // Project metadata fields
  projectFields: {
    drawing_number: {
      label: 'Drawing Number',
      placeholder: 'e.g., P-1001-001',
      required: true,
      autoGenerate: true,
      pattern: '^[A-Z0-9-]+$'
    },
    drawing_title: {
      label: 'Drawing Title',
      placeholder: 'Process Flow Diagram',
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
      label: 'Process Area',
      placeholder: 'Area 100 - Compression',
      required: false
    },
    discipline: {
      label: 'Discipline',
      options: ['Process', 'Piping', 'Mechanical', 'Instrumentation', 'Electrical'],
      default: 'Process'
    }
  },

  // API endpoints - Soft-coded for easy backend integration
  api: {
    // Single file analysis endpoint
    analyze: '/pid/equipment/analyze/',
    
    // Multiple file batch analysis endpoint
    multiAnalyze: '/pid/equipment/analyze-batch/',
    
    // Download generated Excel datasheet
    downloadExcel: '/pid/equipment/download-excel/{upload_id}/',
    
    // Get analysis results by upload ID
    getResults: '/pid/equipment/results/{upload_id}/',
    
    // Get analysis status (for polling)
    getStatus: '/pid/equipment/status/{upload_id}/'
  },

  // Processing configuration
  processing: {
    timeout: 300000, // 5 minutes per file
    multiFileTimeout: 600000, // 10 minutes for multiple files
    retryAttempts: 2,
    retryDelay: 3000 // 3 seconds
  },

  // Results display configuration
  results: {
    successTitle: 'P&ID Analysis Complete!',
    successMessage: 'Equipment detected and analyzed successfully',
    downloadButtonText: 'Download Excel Datasheet',
    viewDetailsText: 'View Equipment Details',
    excelFileName: 'Process_Equipment_Datasheet.xlsx',
    showEquipmentSummary: true,
    showProcessFlow: true,
    maxVisibleEquipment: 20
  },

  // Messages - Soft-coded for easy localization
  messages: {
    errors: {
      noFile: 'Please select at least one P&ID file to upload',
      uploadFailed: 'Failed to upload P&ID. Please try again.',
      analysisFailed: 'AI analysis failed. Please try again.',
      downloadFailed: 'Failed to download Excel file. Please try again.',
      invalidFormat: 'Unsupported file format. Supported formats:',
      fileTooLarge: 'File size exceeds {size}MB limit',
      tooManyFiles: 'Maximum {max} files allowed',
      noEquipment: 'No equipment detected in the P&ID drawing(s)',
      networkError: 'Network connection error. Please check your internet connection.',
      timeout: 'Request timed out. The file may be too large or the server is busy.',
      serverError: 'Server error occurred. Please try again later.',
      unauthorized: 'Authentication failed. Please log in again.',
      forbidden: 'You do not have permission to access this resource.',
      notFound: 'The requested resource was not found.',
      validation: 'Validation error: {details}',
      unknownError: 'An unexpected error occurred: {message}'
    },
    success: {
      uploadComplete: 'Upload and analysis complete!',
      equipmentDetected: '✅ Detected {count} equipment item(s)',
      filesProcessed: '✅ Processed {count} P&ID file(s)',
      downloadReady: 'Excel datasheet is ready for download',
      downloadStarted: 'Download started...',
      downloadComplete: 'Excel file downloaded successfully!'
    },
    info: {
      aiPowered: 'Our AI automatically identifies equipment, extracts tag numbers, determines equipment types, and generates comprehensive datasheets from P&ID drawings.',
      multiFileSupport: 'Upload multiple P&ID files at once for batch processing',
      oneClick: 'One-click analysis • No manual data entry required',
      processing: 'Processing P&ID drawing(s)... This may take a few minutes.',
      retrying: 'Retrying... Attempt {attempt} of {max}'
    },
    warnings: {
      partialDetection: 'Some equipment may not have been detected. Please review results.',
      lowConfidence: 'Detection confidence is low. Manual verification recommended.',
      missingSpecs: 'Some specifications could not be extracted from P&ID'
    }
  },

  // Color schemes for equipment types
  colors: {
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500', icon: 'text-blue-600' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: 'text-red-600' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-500', icon: 'text-purple-600' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-500', icon: 'text-cyan-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500', icon: 'text-orange-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-500', icon: 'text-indigo-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: 'text-yellow-600' }
  },

  // UI theme
  theme: {
    primaryColor: 'emerald',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-green-600',
    accentColor: 'emerald-600'
  }
};

// Helper functions
export const getEquipmentTypeById = (id) => {
  return PROCESS_EQUIPMENT_UPLOAD_CONFIG.equipmentTypes.find(type => type.id === id);
};

export const getEquipmentTypeByPrefix = (prefix) => {
  return PROCESS_EQUIPMENT_UPLOAD_CONFIG.equipmentTypes.find(type => 
    type.prefix.some(p => prefix.toUpperCase().startsWith(p))
  );
};

export const validateFileSize = (file) => {
  const maxSizeMB = PROCESS_EQUIPMENT_UPLOAD_CONFIG.upload.maxFileSize;
  const fileSizeMB = file.size / (1024 * 1024);
  return fileSizeMB <= maxSizeMB;
};

export const validateFileFormat = (file) => {
  const supportedFormats = PROCESS_EQUIPMENT_UPLOAD_CONFIG.upload.supportedFormats;
  const fileExtension = file.name.split('.').pop().toUpperCase();
  return supportedFormats.includes(fileExtension);
};

export const getColorScheme = (colorName) => {
  return PROCESS_EQUIPMENT_UPLOAD_CONFIG.colors[colorName] || PROCESS_EQUIPMENT_UPLOAD_CONFIG.colors.blue;
};

// API Helper Functions
export const getApiEndpoint = (endpointKey, params = {}) => {
  let endpoint = PROCESS_EQUIPMENT_UPLOAD_CONFIG.api[endpointKey];
  
  // Replace placeholders like {upload_id} with actual values
  Object.keys(params).forEach(key => {
    endpoint = endpoint.replace(`{${key}}`, params[key]);
  });
  
  return endpoint;
};

// Error Handling Helper
export const handleApiError = (error, config = PROCESS_EQUIPMENT_UPLOAD_CONFIG) => {
  const { messages } = config;
  
  // Network error (no response from server)
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return messages.errors.timeout;
    }
    return messages.errors.networkError;
  }
  
  // HTTP error responses
  const status = error.response.status;
  const data = error.response.data;
  
  switch (status) {
    case 400:
      // Validation error
      const details = data?.detail || data?.message || JSON.stringify(data);
      return messages.errors.validation.replace('{details}', details);
    
    case 401:
      return messages.errors.unauthorized;
    
    case 403:
      return messages.errors.forbidden;
    
    case 404:
      return messages.errors.notFound;
    
    case 500:
    case 502:
    case 503:
      return messages.errors.serverError;
    
    default:
      const errorMessage = data?.detail || data?.message || error.message || 'Unknown error';
      return messages.errors.unknownError.replace('{message}', errorMessage);
  }
};

// Retry Helper with Exponential Backoff
export const retryRequest = async (requestFn, maxAttempts = 2, delay = 3000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`[Retry] Attempt ${attempt} failed. Retrying in ${waitTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

export default PROCESS_EQUIPMENT_UPLOAD_CONFIG;
