/**
 * AWS S3 Upload Configuration
 * Soft-coded configuration for profile photo and document uploads
 */

export const S3_UPLOAD_CONFIG = {
  // Upload settings - Profile Photos
  maxFileSize: 5 * 1024 * 1024, // 5MB in bytes
  allowedFileTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  
  // Image processing
  imageCompression: {
    enabled: true,
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8
  },
  
  // Upload paths
  paths: {
    profilePhotos: 'profile_photos/',
    documents: 'documents/',
    profileDocuments: 'profile_documents/',
    temp: 'temp/'
  },
  
  // Error messages
  messages: {
    fileTooLarge: 'File size must be less than 5MB',
    invalidFileType: 'Only JPG, PNG, GIF, and WebP images are allowed',
    uploadFailed: 'Failed to upload file. Please try again.',
    uploadSuccess: 'File uploaded successfully',
    processingError: 'Error processing image. Please try another file.'
  },
  
  // UI settings
  ui: {
    showPreview: true,
    showProgress: true,
    dragAndDropEnabled: true,
    previewMaxWidth: '200px',
    previewMaxHeight: '200px'
  }
};

/**
 * Document Upload Configuration
 * Configuration for profile documents (Emirates ID, Driving License, etc.)
 */
export const DOCUMENT_UPLOAD_CONFIG = {
  // Upload settings
  maxFileSize: 5 * 1024 * 1024, // 5MB in bytes
  allowedFileTypes: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ],
  allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
  
  // Upload paths
  path: 'profile_documents/',
  
  // Error messages
  messages: {
    fileTooLarge: 'File size must be less than 5MB',
    invalidFileType: 'Only PDF, JPG, JPEG, and PNG files are allowed',
    uploadFailed: 'Failed to upload document. Please try again.',
    uploadSuccess: 'Document uploaded successfully',
    deleteFailed: 'Failed to delete document. Please try again.',
    deleteSuccess: 'Document deleted successfully',
    verifyFailed: 'Failed to verify document. Please try again.',
    verifySuccess: 'Document verified successfully',
    rejectFailed: 'Failed to reject document. Please try again.',
    rejectSuccess: 'Document rejected successfully'
  },
  
  // UI settings
  ui: {
    showPreview: true,
    showProgress: true,
    dragAndDropEnabled: true,
    previewMaxWidth: '100%',
    previewMaxHeight: '400px',
    thumbnailSize: '150px'
  },
  
  // ✅ SOFT-CODED: Document action buttons configuration
  actions: {
    view: {
      enabled: true,
      label: 'View',
      icon: 'Eye',
      showInCard: true,
      showInModal: false,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      hoverColor: 'hover:bg-blue-100',
      order: 1
    },
    download: {
      enabled: true,
      label: 'Download',
      icon: 'Download',
      showInCard: true,
      showInModal: false,
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      hoverColor: 'hover:bg-green-100',
      order: 2
    },
    edit: {
      enabled: true,
      label: 'Edit Details',
      icon: 'Edit2',
      showInCard: true,
      showInModal: true,
      color: 'orange',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      hoverColor: 'hover:bg-orange-100',
      order: 3,
      description: 'Update document details (number, dates, notes)',
      requiresReupload: false
    },
    replace: {
      enabled: true,
      label: 'Replace File',
      icon: 'Upload',
      showInCard: true,
      showInModal: true,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      hoverColor: 'hover:bg-blue-100',
      order: 4,
      description: 'Upload a new version of this document',
      requiresReupload: true,
      confirmMessage: 'Are you sure you want to replace this document?'
    },
    delete: {
      enabled: true,
      label: 'Delete',
      icon: 'Trash2',
      showInCard: true,
      showInModal: false,
      color: 'red',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      hoverColor: 'hover:bg-red-100',
      order: 5,
      confirmMessage: 'Are you sure you want to delete this document? This action cannot be undone.',
      requiresConfirmation: true
    }
  }
};

/**
 * Validate file before upload
 */
export const validateFile = (file) => {
  const errors = [];
  
  // Check file size
  if (file.size > S3_UPLOAD_CONFIG.maxFileSize) {
    errors.push(S3_UPLOAD_CONFIG.messages.fileTooLarge);
  }
  
  // Check file type
  if (!S3_UPLOAD_CONFIG.allowedFileTypes.includes(file.type)) {
    errors.push(S3_UPLOAD_CONFIG.messages.invalidFileType);
  }
  
  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!S3_UPLOAD_CONFIG.allowedExtensions.includes(extension)) {
    errors.push(S3_UPLOAD_CONFIG.messages.invalidFileType);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate document before upload
 */
export const validateDocument = (file) => {
  const errors = [];
  
  // Check file size
  if (file.size > DOCUMENT_UPLOAD_CONFIG.maxFileSize) {
    errors.push(DOCUMENT_UPLOAD_CONFIG.messages.fileTooLarge);
  }
  
  // Check file type
  if (!DOCUMENT_UPLOAD_CONFIG.allowedFileTypes.includes(file.type)) {
    errors.push(DOCUMENT_UPLOAD_CONFIG.messages.invalidFileType);
  }
  
  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!DOCUMENT_UPLOAD_CONFIG.allowedExtensions.includes(extension)) {
    errors.push(DOCUMENT_UPLOAD_CONFIG.messages.invalidFileType);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file extension icon
 */
export const getFileIcon = (fileName) => {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  
  const iconMap = {
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.png': '🖼️',
    '.gif': '🖼️',
    '.webp': '🖼️',
    '.pdf': '📄',
    '.doc': '📝',
    '.docx': '📝',
    '.xls': '📊',
    '.xlsx': '📊',
    '.txt': '📄'
  };
  
  return iconMap[extension] || '📎';
};

export default { 
  S3_UPLOAD_CONFIG, 
  DOCUMENT_UPLOAD_CONFIG,
  validateFile,
  validateDocument,
  formatFileSize,
  getFileIcon
};
