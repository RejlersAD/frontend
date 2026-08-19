/**
 * SOFT-CODED: Electrical Checklist Project Management Configuration
 * ==================================================================
 * 
 * PROFESSIONAL PROJECT-BASED APPLICATION
 * - Project creation and management
 * - AWS S3 integration for files
 * - Multi-user collaboration
 * - Complete audit trail
 * 
 * All project-related constants, thresholds, and settings are soft-coded here.
 */

import { 
  FolderOpen, 
  CloudUpload, 
  Assessment, 
  People, 
  Timeline,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  HourglassEmpty
} from '@mui/icons-material';

// ─── PROJECT API ENDPOINTS ────────────────────────────────────────────────────
export const PROJECT_ENDPOINTS = {
  list: '/electrical-checklist/projects/',
  create: '/electrical-checklist/projects/',
  detail: '/electrical-checklist/projects/',          // Append {projectId}/
  update: '/electrical-checklist/projects/',          // Append {projectId}/
  delete: '/electrical-checklist/projects/',          // Append {projectId}/
  checklists: '/electrical-checklist/projects/',      // Append {projectId}/checklists/
  statistics: '/electrical-checklist/projects/',      // Append {projectId}/statistics/
  export: '/electrical-checklist/projects/',          // Append {projectId}/export/
  members: '/electrical-checklist/projects/',         // Append {projectId}/members/
};

// ─── PROJECT TEMPLATES ────────────────────────────────────────────────────────
// Pre-defined project templates for quick setup
export const PROJECT_TEMPLATES = [
  {
    id: 'ups_battery_standard',
    name: 'UPS/Battery Inspection - Standard',
    description: 'Standard UPS and Battery system inspection project',
    category: 'Electrical',
    icon: FolderOpen,
    defaultSettings: {
      extractSignatures: true,
      requireApproval: true,
      autoGenerateExcel: true,
      s3Storage: true
    },
    tags: ['UPS', 'Battery', 'Inspection']
  },
  {
    id: 'ups_battery_commissioning',
    name: 'UPS/Battery - Commissioning',
    description: 'UPS commissioning and acceptance testing',
    category: 'Electrical',
    icon: CheckCircle,
    defaultSettings: {
      extractSignatures: true,
      requireApproval: true,
      autoGenerateExcel: true,
      s3Storage: true
    },
    tags: ['UPS', 'Commissioning', 'Testing']
  },
  {
    id: 'custom_project',
    name: 'Custom Project',
    description: 'Create a custom checklist project from scratch',
    category: 'Custom',
    icon: CloudUpload,
    defaultSettings: {
      extractSignatures: false,
      requireApproval: false,
      autoGenerateExcel: true,
      s3Storage: true
    },
    tags: ['Custom']
  }
];

// ─── PROJECT STATUS CONFIGURATION ─────────────────────────────────────────────
export const PROJECT_STATUS = {
  ACTIVE: {
    value: 'active',
    label: 'Active',
    color: 'success',
    icon: CheckCircle,
    description: 'Project is active and accepting new checklists'
  },
  ON_HOLD: {
    value: 'on_hold',
    label: 'On Hold',
    color: 'warning',
    icon: HourglassEmpty,
    description: 'Project is temporarily paused'
  },
  COMPLETED: {
    value: 'completed',
    label: 'Completed',
    color: 'info',
    icon: Assessment,
    description: 'Project is completed'
  },
  ARCHIVED: {
    value: 'archived',
    label: 'Archived',
    color: 'default',
    icon: FolderOpen,
    description: 'Project is archived'
  },
  CANCELLED: {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'error',
    icon: ErrorIcon,
    description: 'Project has been cancelled'
  }
};

// ─── PROJECT VALIDATION RULES ─────────────────────────────────────────────────
export const PROJECT_VALIDATION = {
  projectName: {
    minLength: 3,
    maxLength: 200,
    pattern: /^[a-zA-Z0-9\s\-_()]+$/,
    errorMessages: {
      required: 'Project name is required',
      minLength: 'Project name must be at least 3 characters',
      maxLength: 'Project name cannot exceed 200 characters',
      pattern: 'Project name can only contain letters, numbers, spaces, and ( ) - _'
    }
  },
  description: {
    maxLength: 1000,
    errorMessages: {
      maxLength: 'Description cannot exceed 1000 characters'
    }
  },
  location: {
    maxLength: 500,
    errorMessages: {
      maxLength: 'Location cannot exceed 500 characters'
    }
  },
  clientName: {
    maxLength: 200,
    errorMessages: {
      maxLength: 'Client name cannot exceed 200 characters'
    }
  },
  projectCode: {
    pattern: /^[A-Z0-9\-]+$/,
    errorMessages: {
      pattern: 'Project code must be uppercase letters, numbers, or hyphens'
    }
  }
};

// ─── PROJECT MEMBER ROLES ─────────────────────────────────────────────────────
export const PROJECT_ROLES = {
  OWNER: {
    value: 'owner',
    label: 'Project Owner',
    permissions: ['view', 'upload', 'edit', 'delete', 'manage_members', 'export', 'settings'],
    color: 'primary',
    icon: People
  },
  MANAGER: {
    value: 'manager',
    label: 'Project Manager',
    permissions: ['view', 'upload', 'edit', 'export', 'manage_members'],
    color: 'secondary',
    icon: People
  },
  ENGINEER: {
    value: 'engineer',
    label: 'Engineer',
    permissions: ['view', 'upload', 'edit', 'export'],
    color: 'info',
    icon: People
  },
  VIEWER: {
    value: 'viewer',
    label: 'Viewer',
    permissions: ['view', 'export'],
    color: 'default',
    icon: People
  }
};

// ─── PROJECT DISPLAY SETTINGS ─────────────────────────────────────────────────
export const PROJECT_DISPLAY = {
  // Card view settings
  card: {
    defaultView: 'grid',           // 'grid' or 'list'
    cardsPerPage: 12,
    gridColumns: { xs: 1, sm: 2, md: 3, lg: 4 },
    showThumbnails: true,
    showStatistics: true
  },
  
  // List view settings
  list: {
    itemsPerPage: 25,
    showMiniStats: true,
    compactMode: false
  },
  
  // Search and filter
  search: {
    debounceMs: 500,
    minSearchLength: 2,
    searchFields: ['project_name', 'description', 'location', 'client_name', 'project_code']
  },
  
  // Sort options
  sortOptions: [
    { value: '-created_at', label: 'Newest First' },
    { value: 'created_at', label: 'Oldest First' },
    { value: 'project_name', label: 'Name (A-Z)' },
    { value: '-project_name', label: 'Name (Z-A)' },
    { value: '-updated_at', label: 'Recently Updated' },
    { value: 'status', label: 'Status' }
  ],
  defaultSort: '-created_at'
};

// ─── AWS S3 CONFIGURATION ─────────────────────────────────────────────────────
export const S3_CONFIG = {
  // Folder structure in S3 bucket
  folders: {
    pdf: 'electrical_checklist/{projectCode}/pdfs/',
    excel: 'electrical_checklist/{projectCode}/exports/',
    signatures: 'electrical_checklist/{projectCode}/signatures/',
    temp: 'electrical_checklist/temp/'
  },
  
  // File naming patterns
  fileNaming: {
    pdf: '{timestamp}_{originalName}',
    excel: '{projectCode}_checklist_{jobId}_{timestamp}.xlsx',
    signature: 'signature_{sectionId}_{timestamp}.png'
  },
  
  // Presigned URL settings
  presignedUrl: {
    expirationSeconds: 3600,      // 1 hour
    downloadExpirationSeconds: 300 // 5 minutes for downloads
  },
  
  // File retention
  retention: {
    tempFilesHours: 24,            // Delete temp files after 24 hours
    archiveAfterDays: 90,          // Archive old files after 90 days
    deleteArchivedAfterDays: 365   // Delete archived files after 1 year
  }
};

// ─── PROJECT STATISTICS METRICS ───────────────────────────────────────────────
export const PROJECT_METRICS = {
  overview: [
    {
      key: 'total_checklists',
      label: 'Total Checklists',
      icon: Assessment,
      color: 'primary',
      format: 'number'
    },
    {
      key: 'fields_extracted',
      label: 'Fields Extracted',
      icon: CheckCircle,
      color: 'success',
      format: 'number'
    },
    {
      key: 'signatures_found',
      label: 'Signatures Found',
      icon: People,
      color: 'info',
      format: 'number'
    },
    {
      key: 'avg_confidence',
      label: 'Avg. Confidence',
      icon: Timeline,
      color: 'warning',
      format: 'percentage'
    }
  ],
  
  // Chart configuration
  charts: {
    extractionTrend: {
      type: 'line',
      title: 'Extraction Progress Over Time',
      xAxis: 'date',
      yAxis: 'count',
      color: '#1976d2'
    },
    confidenceDistribution: {
      type: 'bar',
      title: 'Confidence Score Distribution',
      xAxis: 'score_range',
      yAxis: 'count',
      color: '#2e7d32'
    },
    statusBreakdown: {
      type: 'pie',
      title: 'Checklist Status Breakdown',
      colors: ['#2e7d32', '#ed6c02', '#d32f2f', '#0288d1']
    }
  }
};

// ─── UI TEXT AND MESSAGES ─────────────────────────────────────────────────────
export const PROJECT_UI_TEXT = {
  // Page headers
  headers: {
    projectList: 'Electrical Checklist Projects',
    projectDetail: 'Project Overview',
    createProject: 'Create New Project',
    editProject: 'Edit Project'
  },
  
  // Buttons
  buttons: {
    createProject: 'Create New Project',
    selectTemplate: 'Select Template',
    viewDetails: 'View Details',
    uploadChecklist: 'Upload Checklist',
    exportData: 'Export Data',
    manageMembers: 'Manage Members',
    archiveProject: 'Archive Project',
    deleteProject: 'Delete Project',
    cancel: 'Cancel',
    save: 'Save',
    update: 'Update',
    close: 'Close'
  },
  
  // Form labels
  labels: {
    projectName: 'Project Name',
    description: 'Description',
    location: 'Site Location',
    clientName: 'Client Name',
    projectCode: 'Project Code',
    startDate: 'Start Date',
    endDate: 'End Date',
    status: 'Status',
    template: 'Template',
    tags: 'Tags',
    settings: 'Project Settings'
  },
  
  // Placeholders
  placeholders: {
    projectName: 'Enter project name (e.g., Al-Ruwais UPS Inspection)',
    description: 'Enter project description and scope...',
    location: 'Enter site location (e.g., Abu Dhabi, UAE)',
    clientName: 'Enter client/company name',
    projectCode: 'Auto-generated or enter custom code',
    search: 'Search projects by name, location, client...',
    tags: 'Add tags (comma-separated)'
  },
  
  // Success messages
  success: {
    projectCreated: 'Project created successfully!',
    projectUpdated: 'Project updated successfully!',
    projectDeleted: 'Project deleted successfully!',
    memberAdded: 'Team member added successfully!',
    dataExported: 'Data exported successfully!'
  },
  
  // Error messages
  errors: {
    loadFailed: 'Failed to load projects',
    createFailed: 'Failed to create project',
    updateFailed: 'Failed to update project',
    deleteFailed: 'Failed to delete project',
    exportFailed: 'Failed to export data',
    invalidData: 'Please check your input and try again',
    unauthorized: 'You don\'t have permission to perform this action'
  },
  
  // Confirmation dialogs
  confirmations: {
    deleteProject: 'Are you sure you want to delete this project? This action cannot be undone.',
    archiveProject: 'Archive this project? It will be moved to archived projects.',
    leaveProject: 'Leave this project? You will lose access to all project data.',
    removeMemb: 'Remove this member from the project?'
  },
  
  // Empty states
  emptyStates: {
    noProjects: 'No projects found',
    noChecklists: 'No checklists uploaded yet',
    noResults: 'No results found for your search',
    createFirst: 'Create your first project to get started'
  }
};

// ─── EXPORT CONFIGURATION ─────────────────────────────────────────────────────
export const EXPORT_CONFIG = {
  formats: [
    {
      value: 'excel',
      label: 'Excel (.xlsx)',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      icon: Assessment,
      color: 'success'
    },
    {
      value: 'csv',
      label: 'CSV (.csv)',
      mimeType: 'text/csv',
      icon: Assessment,
      color: 'info'
    },
    {
      value: 'json',
      label: 'JSON (.json)',
      mimeType: 'application/json',
      icon: Assessment,
      color: 'warning'
    }
  ],
  
  // Export options
  options: {
    includeSignatures: true,
    includeMetadata: true,
    includeStatistics: true,
    compressFiles: false,
    separateSheets: true
  },
  
  // Batch export limits
  limits: {
    maxChecklistsPerExport: 100,
    maxFileSizeMB: 50,
    timeoutSeconds: 300
  }
};

// ─── NOTIFICATION SETTINGS ────────────────────────────────────────────────────
export const NOTIFICATION_CONFIG = {
  // Auto-hide duration (ms)
  duration: {
    success: 4000,
    info: 5000,
    warning: 6000,
    error: 8000
  },
  
  // Notification position
  position: {
    vertical: 'top',
    horizontal: 'right'
  },
  
  // Enable/disable specific notifications
  enabled: {
    projectCreated: true,
    projectUpdated: true,
    checklistUploaded: true,
    extractionComplete: true,
    extractionFailed: true,
    exportReady: true,
    memberAdded: true
  }
};

// ─── DEFAULT EXPORT ───────────────────────────────────────────────────────────
export default {
  PROJECT_ENDPOINTS,
  PROJECT_TEMPLATES,
  PROJECT_STATUS,
  PROJECT_VALIDATION,
  PROJECT_ROLES,
  PROJECT_DISPLAY,
  S3_CONFIG,
  PROJECT_METRICS,
  PROJECT_UI_TEXT,
  EXPORT_CONFIG,
  NOTIFICATION_CONFIG
};
