/**
 * SOFT-CODED: Electrical Checklist Template Configuration
 * 
 * Based on client-provided inspection checklist template
 * Defines all sections, fields, and extraction rules
 * 
 * Template: UPS/Battery System Inspection Checklist
 * Version: 1.0.0
 */

// ─── CHECKLIST TEMPLATE STRUCTURE ─────────────────────────────────────────────
// This configuration mirrors the client's PDF structure exactly
// Fields marked with `highlighted: true` are the yellow-highlighted fields in the PDF
// ──────────────────────────────────────────────────────────────────────────────

// Soft-coded project name length constraints (kept in sync with the backend
// PROJECT_NAME_MIN_LENGTH / MAX_LENGTH constants in serializers.py).
export const PROJECT_NAME_MIN_LENGTH = 3;
export const PROJECT_NAME_MAX_LENGTH = 200;

export const CHECKLIST_TEMPLATE = {
  id: 'ups_battery_inspection',
  name: 'UPS/Battery System Inspection Checklist',
  version: '1.0',
  category: 'Electrical',
  description: 'Comprehensive inspection checklist for UPS and battery systems',
  
  sections: [
    {
      id: 'general_site_info',
      order: 1,
      name: 'General Site Information',
      fields: [
        { key: 'site_name', label: 'Site', type: 'text', highlighted: true },
        { key: 'area_facility', label: 'Area / Facility', type: 'text', highlighted: true },
        { key: 'substation', label: 'Substation / DB / MDB', type: 'text', highlighted: true },
        { key: 'ups_room', label: 'UPS Room / Battery Room', type: 'text', highlighted: true },
        { key: 'date_visit', label: 'Date of Visit', type: 'date', highlighted: true },
        { key: 'attendance', label: 'Attendance (Site / Name / FEED)', type: 'text', highlighted: true },
        { key: 'taking_industries', label: 'Taking Industries Completed', type: 'checkbox', highlighted: false }
      ]
    },
    
    {
      id: 'ups_identification',
      order: 2,
      name: 'UPS Identification (One Row Per UPS)',
      fields: [
        { key: 'ups_tag', label: 'UPS Tag', type: 'text', highlighted: true },
        { key: 'ups_type', label: 'UPS Type (AC / DC / Static)', type: 'select', options: ['AC', 'DC', 'Static'], highlighted: true },
        { key: 'application', label: 'Application (DCS / ESD / ICSS)', type: 'text', highlighted: true },
        { key: 'ups_make_model', label: 'UPS Make & Model', type: 'text', highlighted: true },
        { key: 'rated_capacity', label: 'Rated Capacity (kVA / A)', type: 'number', highlighted: true }
      ]
    },
    
    {
      id: 'loading_data',
      order: 3,
      name: 'Loading Data',
      fields: [
        { key: 'pressure_operating_load', label: 'Pressure Operating Load (% / kVA / A)', type: 'text', highlighted: true },
        { key: 'load_measurement', label: 'Load Measurement Source (MMS / EOM / Device/Ammeter)', type: 'text', highlighted: true },
        { key: 'highest_observed_load', label: 'Highest Observed Load Encountered', type: 'text', highlighted: true },
        { key: 'operating_condition', label: 'Operating Condition During Peak Load', type: 'text', highlighted: true },
        { key: 'load_margin', label: 'Load Margin Adequate (<70%)', type: 'text', highlighted: true }
      ]
    },
    
    {
      id: 'battery_system',
      order: 4,
      name: 'Battery System Data',
      fields: [
        { key: 'battery_make', label: 'Battery Make', type: 'text', highlighted: true },
        { key: 'rating_voltage', label: 'Rating & Voltage', type: 'text', highlighted: true },
        { key: 'battery_model', label: 'Battery Model', type: 'text', highlighted: true },
        { key: 'type_manufacturer', label: 'Type of Manufacturer', type: 'text', highlighted: true },
        { key: 'battery_ah_rating', label: 'Battery Ah Rating', type: 'number', highlighted: true },
        { key: 'number_cells', label: 'Number of Cells', type: 'number', highlighted: true },
        { key: 'battery_installation_year', label: 'Battery Installation Year', type: 'year', highlighted: true },
        { key: 'battery_physical_condition', label: 'Battery Physical Condition', type: 'textarea', highlighted: true },
        { key: 'design_life', label: 'Design Life and Replacement Year', type: 'text', highlighted: true },
        { key: 'battery_disconnect', label: 'Battery Disconnect Panel on Capacity Test', type: 'textarea', highlighted: true }
      ]
    },
    
    {
      id: 'feeder_ratings_protection',
      order: 5,
      name: 'Feeder Ratings & Protection',
      fields: [
        { key: 'normal_feeder_rating', label: 'Normal Input Feeder Rating (A)', type: 'number', highlighted: true },
        { key: 'bypass_feeder_rating', label: 'Bypass Feeder Rating (A)', type: 'number', highlighted: true },
        { key: 'ups_output_feeder', label: 'UPS Output Feeder Rating (A)', type: 'number', highlighted: true },
        { key: 'downstream_db_ratings', label: 'Downstream DB Feeder Ratings', type: 'text', highlighted: true },
        { key: 'feeder_coordination', label: 'Feeder Coordination OK', type: 'select', options: ['Yes', 'No'], highlighted: true }
      ]
    },
    
    {
      id: 'load_rationalization',
      order: 6,
      name: 'Load Rationalization',
      fields: [
        { key: 'ups_db', label: 'UPS DB', type: 'text', highlighted: true },
        { key: 'feeder_list', label: 'Feeder List (showing 1 feeder as bkp B (S178))', type: 'textarea', highlighted: false },
        { key: 'feeder_db_identified', label: 'Feeder DB Identified?', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'load_criticality_checked', label: 'Load criticality to be checked', type: 'checkbox', highlighted: false },
        { key: 'shutdown_allowed', label: 'Is Shutdown Allowed?', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'load_rationalization_required', label: 'Load Rationalization is required?', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'cable_change', label: 'Cable change due to load Rationalization?', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'old_feeder', label: 'O/G feeder specifically for PDRA based on old circuit', type: 'textarea', highlighted: false },
        { key: 'each_feeder', label: 'Each feeder required against each loads', type: 'checkbox', highlighted: false }
      ]
    },
    
    {
      id: 'static_converter_switch',
      order: 7,
      name: 'Static / Converter Switch',
      fields: [
        { key: 'static_converter_present', label: 'Static / Converter Switch Present', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'rating', label: 'Rating', type: 'text', highlighted: false },
        { key: 'critical_load_supplied', label: 'Critical Load Supplied', type: 'checkbox', highlighted: false },
        { key: 'spare_available', label: 'Spare Available', type: 'select', options: ['Yes', 'No'], highlighted: false }
      ]
    },
    
    {
      id: 'bms_system',
      order: 8,
      name: 'BMS System',
      fields: [
        { key: 'existing_bms_make', label: 'Existing BMS Make', type: 'text', highlighted: false },
        { key: 'monitoring_level', label: 'Monitoring Level (DCS/String)', type: 'text', highlighted: false },
        { key: 'interface_dcs_fcn', label: 'Interface with DCS / FCN', type: 'text', highlighted: false }
      ]
    },
    
    {
      id: 'shutdown_temporary_ups',
      order: 9,
      name: 'Shutdown & Temporary UPS',
      fields: [
        { key: 'shutdown_window', label: 'Shutdown Window Available', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'temporary_ups_required', label: 'Temporary UPS Required', type: 'select', options: ['Yes', 'No'], highlighted: false }
      ]
    },
    
    {
      id: 'data_gaps_assumptions',
      order: 10,
      name: 'Data Gaps & Steps Assumptions',
      fields: [
        { key: 'missing_load_history', label: 'Missing Load History', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'missing_feeder_data', label: 'Missing Feeder Data', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'spare_availability_na', label: 'Is Spare Availability?', type: 'select', options: ['Yes', 'No'], highlighted: false },
        { key: 'in_existing_ups', label: 'In existing UPS', type: 'checkbox', highlighted: false },
        { key: 'temporary_ups', label: 'For Temporary UPS', type: 'checkbox', highlighted: false }
      ]
    },
    
    {
      id: 'spare_availability',
      order: 11,
      name: 'Spare Availability',
      fields: [
        { key: 'spare_breaker_available_ratings', label: 'Spare Breaker Available in Ratings', type: 'text', highlighted: true },
        { key: 'vacant_space', label: 'Vacant space and Height', type: 'text', highlighted: true },
        { key: 'shutdown_required_thym', label: 'Shutdown Required for Thym?', type: 'select', options: ['Yes', 'No'], highlighted: true }
      ]
    },
    
    {
      id: 'cable_size',
      order: 12,
      name: 'Cable Size',
      fields: [
        { key: 'incoming_cable', label: 'Incoming-1', type: 'text', highlighted: true },
        { key: 'incoming_cable_2', label: 'Incoming-2', type: 'text', highlighted: true },
        { key: 'bypass', label: 'Bypass', type: 'text', highlighted: true }
      ]
    },
    
    {
      id: 'documents_required',
      order: 13,
      name: 'Documents Required',
      fields: [
        { key: 'load_list_format_followed', label: '1. Load list format to be followed', type: 'checkbox', highlighted: false },
        { key: 'load_criticality_checked_doc', label: '2. Load criticality to be checked', type: 'checkbox', highlighted: false },
        { key: 'shutdown_allowed_doc', label: '3. Is Shutdown allowed?', type: 'checkbox', highlighted: false },
        { key: 'load_rationalization_required_doc', label: '4. Load Rationalization is required?', type: 'checkbox', highlighted: false },
        { key: 'cable_change_rationalization', label: '5. Cable change due to load Rationalization?', type: 'checkbox', highlighted: false },
        { key: 'old_feeder_circuit', label: '6. O/G feeder specifically for PDRA based on old circuit?', type: 'checkbox', highlighted: false },
        { key: 'each_feeder_number', label: '7. Each feeder number required against each loads', type: 'checkbox', highlighted: false }
      ]
    },
    
    {
      id: 'signatures',
      order: 14,
      name: 'Sign Data / Signatures',
      isSignatureSection: true,
      extractSignatures: true,
      fields: [
        { key: 'signature_1', label: 'Signature 1', type: 'signature', highlighted: false },
        { key: 'signature_2', label: 'Signature 2', type: 'signature', highlighted: false },
        { key: 'signature_3', label: 'Signature 3', type: 'signature', highlighted: false }
      ]
    }
  ]
};

// ─── EXTRACTION CONFIGURATION ─────────────────────────────────────────────────
// PRIMARY: FREE OCR extractors (Tesseract, EasyOCR)
// FALLBACK: AI Vision (optional, paid - disabled by default)
export const EXTRACTION_CONFIG = {
  // API endpoints - Matches Django ViewSet routes
  endpoints: {
    upload: '/electrical-checklist/extract/',                         // legacy stub extractor
    uploadHandwriting: '/electrical-checklist/extract-handwriting/',  // NEW: handwriting pipeline
    status: '/electrical-checklist/',        // Append {jobId}/status/
    result: '/electrical-checklist/',        // Append {jobId}/result/
    download: '/electrical-checklist/'       // Append {jobId}/download-excel/
  },

  // Handwriting extraction pipeline (soft-coded toggle)
  handwriting: {
    enabled: true,                    // Use new handwriting pipeline instead of legacy stub
    allowUserApiKey: true,            // BYOK — allow user to supply own OpenAI key from UI
    apiKeyStorage: 'session',         // 'session' | 'none' — where to remember the key in the browser
    apiKeyStorageKey: 'radai_user_openai_key',
    isSynchronous: true,              // New endpoint returns result inline (no polling needed)

    // ── Extraction Mode Presets (mirror of EXTRACTION_MODE_PRESETS in backend) ──
    // The `id` MUST match backend keys in template_v2_config.EXTRACTION_MODE_PRESETS.
    defaultMode: 'balanced',
    modeStorageKey: 'radai_extraction_mode',
    modes: [
      {
        id: 'fast',
        label: 'Fast',
        tagline: 'Free · Printed forms',
        description: 'Local Tesseract OCR only. No AI cost. Works best on clean, printed text.',
        cost: 'FREE',
        accuracy: 'Low on handwriting',
      },
      {
        id: 'balanced',
        label: 'Balanced',
        tagline: 'Recommended',
        description: 'Free OCR first; falls back to GPT-4o Vision only when handwriting is weak.',
        cost: '$ (only if needed)',
        accuracy: 'Good',
        recommended: true,
      },
      {
        id: 'deep',
        label: 'Deep Analysis',
        tagline: 'Best for cursive',
        description: 'OCR + multi-pass GPT-4o Vision with consensus. ~2× AI cost. Best for messy handwriting.',
        cost: '$$',
        accuracy: 'High',
      },
      {
        id: 'vision_only',
        label: 'Vision-Only',
        tagline: 'Max accuracy · BYOK',
        description: 'Skip OCR; go straight to multi-pass GPT-4o Vision. Highest accuracy, highest cost. Provide your own OpenAI key.',
        cost: '$$$',
        accuracy: 'Very High',
        requiresApiKey: true,
      },
    ],
  },
  
  // File upload constraints
  upload: {
    acceptedFormats: '.pdf',
    maxFileSizeMB: 50,
    maxFiles: 10
  },
  
  // OCR extraction settings (FREE!)
  ocr: {
    primaryEngine: 'tesseract',      // FREE: Tesseract OCR (fast, good for printed text)
    secondaryEngine: 'easyocr',      // FREE: EasyOCR (ML-based, better for complex layouts)
    enableAiFallback: false,         // Set true to use Gemini/GPT-4o when OCR fails (PAID)
    extractHighlightedOnly: false,   // Extract all fields, not just highlighted
    extractSignatures: true,         // Enable signature detection
    signatureMethod: 'opencv',       // FREE: OpenCV computer vision
    minConfidence: 60,               // Minimum OCR confidence (0-100)
  },
  
  // AI extraction settings (OPTIONAL - only if ai_fallback enabled)
  ai: {
    primaryEngine: 'gemini_vision',  // Gemini 2.0 Flash (only if OCR fails)
    fallbackEngine: 'openai_vision', // GPT-4o (only if Gemini fails)
    signatureDetectionThreshold: 0.7 // Confidence threshold for AI signature detection
  },
  
  // Polling for async extraction
  polling: {
    intervalMs: 2000,
    maxAttempts: 180, // 6 minutes max
    timeoutMs: 360000 // 6 minutes
  },
  
  // Excel export configuration
  excel: {
    includeEmptyFields: true,
    highlightFilledFields: true,
    includeSignatureImages: true,
    sheetName: 'UPS_Battery_Checklist'
  }
};

// ─── FIELD TYPE DEFINITIONS ───────────────────────────────────────────────────
export const FIELD_TYPES = {
  text: { component: 'Input', validation: 'string' },
  number: { component: 'InputNumber', validation: 'number' },
  date: { component: 'DatePicker', validation: 'date' },
  year: { component: 'YearPicker', validation: 'year' },
  select: { component: 'Select', validation: 'enum' },
  checkbox: { component: 'Checkbox', validation: 'boolean' },
  textarea: { component: 'TextArea', validation: 'string' },
  signature: { component: 'SignatureField', validation: 'image' }
};

// ─── UI CONFIGURATION ──────────────────────────────────────────────────────────
export const UI_CONFIG = {
  title: 'Electrical Checklist Extraction',
  subtitle: 'Upload inspection checklists and extract data using AI',
  
  uploadArea: {
    title: 'Upload Checklist PDF',
    subtitle: 'Drag and drop or click to upload',
    helperText: 'Supports PDF format, up to 50MB per file'
  },
  
  extractionStages: [
    'Uploading PDF...',
    'Converting to images...',
    'Running Tesseract OCR (FREE)...',
    'Extracting field data...',
    'Detecting signatures (OpenCV)...',
    'Validating extracted data...',
    'Generating Excel output...'
  ],
  
  resultView: {
    showRawData: true,
    showConfidenceScores: true,
    allowManualEdit: true,
    showSignaturePreviews: true
  },
  
  colors: {
    primary: 'yellow',
    secondary: 'blue',
    success: 'green',
    warning: 'orange',
    error: 'red',
    highlighted: 'yellow-100' // For highlighted fields from PDF
  }
};

export default {
  CHECKLIST_TEMPLATE,
  EXTRACTION_CONFIG,
  FIELD_TYPES,
  UI_CONFIG
};
