/**
 * QHSE Project Form Configuration
 * Soft-coded field definitions for creating/editing QHSE projects
 * All 31 fields from QHSERunningProject model
 */

export const projectFormSections = [
  {
    id: 'basic-info',
    title: 'Basic Project Information',
    icon: 'ClipboardList',
    defaultExpanded: true,
    fields: [
      {
        name: 'srNo',
        label: 'Serial Number',
        type: 'number',
        required: false,
        placeholder: 'Auto-generated if left empty',
        helperText: 'Leave empty to auto-generate next serial number',
        gridSize: 6
      },
      {
        name: 'projectNo',
        label: 'Project Number',
        type: 'text',
        required: true,
        placeholder: 'Enter project number (e.g., PRJ-2024-001)',
        helperText: 'Unique project identifier',
        gridSize: 6
      },
      {
        name: 'projectTitle',
        label: 'Project Title',
        type: 'textarea',
        required: true,
        placeholder: 'Enter project title',
        helperText: 'Full project title/description',
        gridSize: 12,
        rows: 2
      },
      {
        name: 'client',
        label: 'Client Name',
        type: 'text',
        required: true,
        placeholder: 'Enter client name',
        helperText: 'Name of the client organization',
        gridSize: 6
      },
      {
        name: 'projectManager',
        label: 'Project Manager',
        type: 'text',
        required: true,
        placeholder: 'Enter project manager name',
        helperText: 'Person responsible for project management',
        gridSize: 6
      },
      {
        name: 'projectQualityEng',
        label: 'Project Quality Engineer',
        type: 'text',
        required: true,
        placeholder: 'Enter quality engineer name',
        helperText: 'Person responsible for quality assurance',
        gridSize: 6
      }
    ]
  },
  {
    id: 'timeline',
    title: 'Project Timeline',
    icon: 'Calendar',
    defaultExpanded: true,
    fields: [
      {
        name: 'projectStartingDate',
        label: 'Project Starting Date',
        type: 'date',
        required: false,
        helperText: 'When the project begins',
        gridSize: 4
      },
      {
        name: 'projectClosingDate',
        label: 'Project Closing Date',
        type: 'date',
        required: false,
        helperText: 'Expected project completion date',
        gridSize: 4
      },
      {
        name: 'projectExtension',
        label: 'Project Extension Date',
        type: 'date',
        required: false,
        helperText: 'Extended deadline if applicable',
        gridSize: 4
      }
    ]
  },
  {
    id: 'manhours',
    title: 'Manhours Management',
    icon: 'TrendingUp',
    defaultExpanded: false,
    fields: [
      {
        name: 'manHourForQuality',
        label: 'Manhours for Quality',
        type: 'number',
        required: false,
        placeholder: '0.00',
        helperText: 'Total manhours allocated for quality assurance',
        gridSize: 4,
        step: 0.01,
        min: 0
      },
      {
        name: 'manhoursUsed',
        label: 'Manhours Used',
        type: 'number',
        required: false,
        placeholder: '0.00',
        helperText: 'Manhours consumed so far',
        gridSize: 4,
        step: 0.01,
        min: 0
      },
      {
        name: 'manhoursBalance',
        label: 'Manhours Balance',
        type: 'number',
        required: false,
        placeholder: '0.00',
        helperText: 'Remaining manhours available',
        gridSize: 4,
        step: 0.01,
        min: 0
      },
      {
        name: 'qualityBillabilityPercent',
        label: 'Quality Billability %',
        type: 'text',
        required: false,
        placeholder: '0%',
        helperText: 'Percentage of billable quality hours',
        gridSize: 4
      }
    ]
  },
  {
    id: 'quality-plan',
    title: 'Quality Plan Status',
    icon: 'BadgeCheck',
    defaultExpanded: false,
    fields: [
      {
        name: 'projectQualityPlanStatusRev',
        label: 'Quality Plan Status - Rev',
        type: 'text',
        required: false,
        placeholder: 'Enter revision number (e.g., Rev A, Rev 1)',
        helperText: 'Current revision of quality plan',
        gridSize: 6
      },
      {
        name: 'projectQualityPlanStatusIssueDate',
        label: 'Quality Plan Issue Date',
        type: 'date',
        required: false,
        helperText: 'Date when quality plan was issued',
        gridSize: 6
      }
    ]
  },
  {
    id: 'audits',
    title: 'Project & Client Audits',
    icon: 'ClipboardList',
    defaultExpanded: false,
    fields: [
      {
        name: 'projectAudit1',
        label: 'Project Audit - 1',
        type: 'date',
        required: false,
        helperText: 'Date of first project audit',
        gridSize: 3
      },
      {
        name: 'projectAudit2',
        label: 'Project Audit - 2',
        type: 'date',
        required: false,
        helperText: 'Date of second project audit',
        gridSize: 3
      },
      {
        name: 'projectAudit3',
        label: 'Project Audit - 3',
        type: 'date',
        required: false,
        helperText: 'Date of third project audit',
        gridSize: 3
      },
      {
        name: 'projectAudit4',
        label: 'Project Audit - 4',
        type: 'date',
        required: false,
        helperText: 'Date of fourth project audit',
        gridSize: 3
      },
      {
        name: 'clientAudit1',
        label: 'Client Audit - 1',
        type: 'date',
        required: false,
        helperText: 'Date of first client audit',
        gridSize: 6
      },
      {
        name: 'clientAudit2',
        label: 'Client Audit - 2',
        type: 'date',
        required: false,
        helperText: 'Date of second client audit',
        gridSize: 6
      },
      {
        name: 'delayInAuditsNoDays',
        label: 'Delay in Audits (Days)',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Number of days audits are delayed',
        gridSize: 4,
        min: 0
      }
    ]
  },
  {
    id: 'cars',
    title: 'CARs (Corrective Action Requests)',
    icon: 'AlertTriangle',
    defaultExpanded: false,
    fields: [
      {
        name: 'carsOpen',
        label: 'CARs Open',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Number of open CARs',
        gridSize: 4,
        min: 0
      },
      {
        name: 'carsDelayedClosingNoDays',
        label: 'CARs Delayed Closing (Days)',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Days CARs are delayed in closing',
        gridSize: 4,
        min: 0
      },
      {
        name: 'carsClosed',
        label: 'CARs Closed',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Number of closed CARs',
        gridSize: 4,
        min: 0
      }
    ]
  },
  {
    id: 'observations',
    title: 'Observations',
    icon: 'Info',
    defaultExpanded: false,
    fields: [
      {
        name: 'obsOpen',
        label: 'Observations Open',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Number of open observations',
        gridSize: 4,
        min: 0
      },
      {
        name: 'obsDelayedClosingNoDays',
        label: 'Observations Delayed Closing (Days)',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Days observations are delayed in closing',
        gridSize: 4,
        min: 0
      },
      {
        name: 'obsClosed',
        label: 'Observations Closed',
        type: 'number',
        required: false,
        placeholder: '0',
        helperText: 'Number of closed observations',
        gridSize: 4,
        min: 0
      }
    ]
  },
  {
    id: 'performance',
    title: 'Performance Metrics',
    icon: 'TrendingUp',
    defaultExpanded: false,
    fields: [
      {
        name: 'projectKPIsAchievedPercent',
        label: 'Project KPIs Achieved %',
        type: 'text',
        required: false,
        placeholder: '0%',
        helperText: 'Percentage of KPIs achieved',
        gridSize: 4
      },
      {
        name: 'projectCompletionPercent',
        label: 'Project Completion %',
        type: 'text',
        required: false,
        placeholder: '0%',
        helperText: 'Overall project completion percentage',
        gridSize: 4
      },
      {
        name: 'rejectionOfDeliverablesPercent',
        label: 'Rejection of Deliverables %',
        type: 'text',
        required: false,
        placeholder: '0%',
        helperText: 'Percentage of rejected deliverables',
        gridSize: 4
      },
      {
        name: 'costOfPoorQualityAed',
        label: 'Cost of Poor Quality (AED)',
        type: 'number',
        required: false,
        placeholder: '0.00',
        helperText: 'Financial cost of quality issues',
        gridSize: 6,
        step: 0.01,
        min: 0
      }
    ]
  },
  {
    id: 'remarks',
    title: 'Additional Information',
    icon: 'Info',
    defaultExpanded: false,
    fields: [
      {
        name: 'remarks',
        label: 'Remarks',
        type: 'textarea',
        required: false,
        placeholder: 'Enter any additional notes or comments',
        helperText: 'Additional notes about the project',
        gridSize: 12,
        rows: 3
      }
    ]
  }
];

/**
 * Get initial form values with defaults
 */
export const getInitialFormValues = () => {
  const values = {};
  
  projectFormSections.forEach(section => {
    section.fields.forEach(field => {
      // Set default values based on field type
      if (field.type === 'number') {
        values[field.name] = field.min || 0;
      } else if (field.type === 'date') {
        values[field.name] = '';
      } else if (field.type === 'text' || field.type === 'textarea') {
        values[field.name] = '';
      }
    });
  });
  
  return values;
};

/**
 * Validate form data
 */
export const validateFormData = (formData) => {
  const errors = {};
  
  projectFormSections.forEach(section => {
    section.fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
      
      // Additional validation for number fields
      if (field.type === 'number' && formData[field.name] !== '') {
        const value = parseFloat(formData[field.name]);
        if (isNaN(value)) {
          errors[field.name] = `${field.label} must be a valid number`;
        } else if (field.min !== undefined && value < field.min) {
          errors[field.name] = `${field.label} must be at least ${field.min}`;
        }
      }
    });
  });
  
  return errors;
};

/**
 * Format form data for API submission
 * Converts form field names to backend camelCase format
 * SOFT-CODED: Remove srNo if 0 or empty to let backend auto-generate
 */
export const formatFormDataForAPI = (formData) => {
  const formatted = { ...formData };
  
  // Remove srNo if it's 0 or empty (let backend auto-generate)
  if (!formatted.srNo || formatted.srNo === 0) {
    delete formatted.srNo;
  }
  
  // Convert empty strings to null for date fields
  Object.keys(formatted).forEach(key => {
    if (formatted[key] === '') {
      formatted[key] = null;
    }
  });
  
  return formatted;
};
