/**
 * Upload Requirements Configuration
 * Soft-coded upload rules and validation settings
 * 
 * Centralized configuration for PFD upload requirements
 * Easy to modify without touching component code
 */

export const UPLOAD_REQUIREMENTS = {
  // Document Requirements
  documents: {
    pfd: {
      required: true,
      label: 'PFD Document',
      description: 'Process Flow Diagram for conversion',
      icon: '📄',
      color: 'purple'
    },
    philosophy: {
      required: false, // Changed to optional
      label: 'Philosophy Document',
      description: 'Process control philosophy (Optional)',
      icon: '📚',
      color: 'blue',
      helpText: 'Upload philosophy document for enhanced P&ID generation with control logic'
    }
  },

  // File Validation Rules
  validation: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    maxFileSize: 10 * 1024 * 1024, // 10MB in bytes
    maxFileSizeMB: 10,
  },

  // Upload Modes
  modes: {
    pfdOnly: {
      enabled: true,
      description: 'Upload PFD only for basic P&ID conversion',
      requiredDocs: ['pfd'],
      processingTime: '3-5 minutes',
      features: [
        'Equipment extraction',
        'Basic instrumentation',
        'Standard P&ID generation'
      ]
    },
    pfdWithPhilosophy: {
      enabled: true,
      description: 'Upload PFD with Philosophy for enhanced conversion',
      requiredDocs: ['pfd', 'philosophy'],
      processingTime: '5-8 minutes',
      features: [
        'Equipment extraction',
        'Advanced instrumentation',
        'Control logic integration',
        'Safety interlocks',
        'Enhanced P&ID generation'
      ]
    }
  },

  // UI Messages
  messages: {
    pfdRequired: 'Please select a PFD file to upload',
    philosophyOptional: 'Philosophy document is optional but recommended for enhanced results',
    bothUploaded: 'Both documents uploaded - Enhanced conversion mode enabled',
    pfdOnlyUploaded: 'PFD uploaded - Standard conversion mode',
    processingWithPhilosophy: 'Processing with philosophy integration for enhanced P&ID',
    processingWithoutPhilosophy: 'Processing PFD for standard P&ID conversion'
  },

  // Feature Comparison
  featureComparison: {
    withPhilosophy: {
      title: 'With Philosophy',
      benefits: [
        '✅ Control logic integration',
        '✅ Safety interlocks',
        '✅ Alarm management',
        '✅ Operator actions',
        '✅ Advanced instrumentation'
      ]
    },
    withoutPhilosophy: {
      title: 'Without Philosophy',
      benefits: [
        '✅ Basic equipment conversion',
        '✅ Standard instrumentation',
        '✅ Faster processing',
        '✅ Simple P&ID output'
      ]
    }
  }
}

/**
 * Helper function to check if all required documents are uploaded
 */
export const areRequiredDocumentsUploaded = (uploadedDocs) => {
  const requiredDocs = Object.entries(UPLOAD_REQUIREMENTS.documents)
    .filter(([key, config]) => config.required)
    .map(([key]) => key);
  
  return requiredDocs.every(docType => uploadedDocs[docType]);
}

/**
 * Helper function to get upload mode based on uploaded documents
 */
export const getUploadMode = (uploadedDocs) => {
  if (uploadedDocs.pfd && uploadedDocs.philosophy) {
    return UPLOAD_REQUIREMENTS.modes.pfdWithPhilosophy;
  } else if (uploadedDocs.pfd) {
    return UPLOAD_REQUIREMENTS.modes.pfdOnly;
  }
  return null;
}

/**
 * Helper function to validate file
 */
export const validateFile = (file) => {
  const { allowedTypes, maxFileSize, maxFileSizeMB } = UPLOAD_REQUIREMENTS.validation;
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Please select a valid file (JPEG, PNG, or PDF)`
    };
  }
  
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File size must be less than ${maxFileSizeMB}MB`
    };
  }
  
  return { valid: true };
}

export default UPLOAD_REQUIREMENTS;
