/**
 * Procurement Configuration - Oil & Gas Industry
 * Centralized procurement categories, standards, and workflows
 * 
 * SOFT CODING APPROACH:
 * - All procurement categories defined in one place
 * - Industry-specific standards and certifications
 * - Easy to update and maintain
 * - Aligned with backend PROCUREMENT_CATEGORIES
 */

export const PROCUREMENT_CONFIG = {
  // Order Management Tabs - Soft-coded tab configuration
  orderTabs: {
    purchaseOrders: {
      id: 'purchase_orders',
      label: 'Purchase Orders',
      description: 'Manage purchase orders sent to vendors',
      icon: 'ShoppingCartIcon',
      color: 'indigo',
      apiEndpoint: '/procurement/orders/',
      createLabel: 'Create PO',
      emptyMessage: 'No purchase orders found',
      emptyDescription: 'Get started by creating a new purchase order.',
      searchPlaceholder: 'Search by PO number or vendor...',
      filterFields: ['status', 'vendor', 'project']
    },
    purchaseRequisitions: {
      id: 'purchase_requisitions',
      label: 'Purchase Requisitions',
      description: 'Internal purchase requests awaiting approval',
      icon: 'DocumentTextIcon',
      color: 'purple',
      apiEndpoint: '/procurement/requisitions/',
      createLabel: 'Create PR',
      emptyMessage: 'No purchase requisitions found',
      emptyDescription: 'Create a requisition to request materials or services.',
      searchPlaceholder: 'Search by PR number or title...',
      filterFields: ['status', 'priority', 'type']
    }
  },

  // Oil & Gas Procurement Categories
  categories: {
    // Core Equipment
    rotating_equipment: {
      name: 'Rotating Equipment',
      description: 'Pumps, Compressors, Turbines',
      icon: 'Cog6ToothIcon',
      color: 'blue',
      standards: ['API 610', 'API 617', 'API 618', 'ASME'],
      requiresCertification: true,
      typicalLeadTime: '16-24 weeks'
    },
    static_equipment: {
      name: 'Static Equipment',
      description: 'Vessels, Tanks, Heat Exchangers',
      icon: 'CubeIcon',
      color: 'indigo',
      standards: ['ASME VIII', 'API 650', 'API 620', 'API 660'],
      requiresCertification: true,
      typicalLeadTime: '12-20 weeks'
    },
    instrumentation: {
      name: 'Instrumentation & Control',
      description: 'Sensors, Transmitters, Control Systems',
      icon: 'CircuitBoardIcon',
      color: 'purple',
      standards: ['ISA', 'IEC 61511', 'IEC 61508'],
      requiresCertification: true,
      typicalLeadTime: '8-12 weeks'
    },
    valves_fittings: {
      name: 'Valves & Fittings',
      description: 'Control Valves, Safety Valves, Pipe Fittings',
      icon: 'AdjustmentsHorizontalIcon',
      color: 'cyan',
      standards: ['API 6D', 'API 6A', 'ASME B16.5', 'ASME B16.34'],
      requiresCertification: true,
      typicalLeadTime: '10-16 weeks'
    },
    
    // Materials & Spares
    piping_materials: {
      name: 'Piping & Pipeline Materials',
      description: 'Pipes, Elbows, Reducers, Flanges',
      icon: 'ArrowsRightLeftIcon',
      color: 'green',
      standards: ['ASME B31.3', 'API 5L', 'ASTM A106'],
      requiresCertification: true,
      typicalLeadTime: '6-10 weeks'
    },
    electrical_materials: {
      name: 'Electrical Materials',
      description: 'Cables, Panels, Motors, Drives',
      icon: 'BoltIcon',
      color: 'amber',
      standards: ['IEC', 'IEEE', 'NEC', 'NEMA'],
      requiresCertification: true,
      typicalLeadTime: '8-14 weeks'
    },
    spare_parts: {
      name: 'Spare Parts & Components',
      description: 'Mechanical Spares, Seals, Bearings',
      icon: 'WrenchScrewdriverIcon',
      color: 'orange',
      standards: ['OEM Specifications'],
      requiresCertification: false,
      typicalLeadTime: '4-8 weeks'
    },
    chemicals: {
      name: 'Chemicals & Additives',
      description: 'Process Chemicals, Corrosion Inhibitors',
      icon: 'BeakerIcon',
      color: 'red',
      standards: ['MSDS', 'API'],
      requiresCertification: true,
      typicalLeadTime: '4-6 weeks'
    },
    
    // Services
    maintenance_services: {
      name: 'Maintenance & Repair Services',
      description: 'Preventive, Corrective, Predictive Maintenance',
      icon: 'WrenchIcon',
      color: 'purple',
      standards: ['ISO 55000'],
      requiresCertification: false,
      typicalLeadTime: '2-4 weeks'
    },
    inspection_testing: {
      name: 'Inspection & Testing Services',
      description: 'NDT, Pressure Testing, Third-Party Inspection',
      icon: 'MagnifyingGlassIcon',
      color: 'blue',
      standards: ['ASNT', 'API 570', 'API 510', 'API 653'],
      requiresCertification: true,
      typicalLeadTime: '1-2 weeks'
    },
    engineering_services: {
      name: 'Engineering & Consulting',
      description: 'Design, Analysis, Project Management',
      icon: 'AcademicCapIcon',
      color: 'indigo',
      standards: ['ISO 9001', 'PMI'],
      requiresCertification: false,
      typicalLeadTime: '4-12 weeks'
    },
    
    // Others
    safety_equipment: {
      name: 'Safety & PPE',
      description: 'Personal Protective Equipment, Safety Systems',
      icon: 'ShieldCheckIcon',
      color: 'green',
      standards: ['OSHA', 'ANSI', 'ISO 45001'],
      requiresCertification: true,
      typicalLeadTime: '2-4 weeks'
    },
    consumables: {
      name: 'Consumables & Supplies',
      description: 'Office Supplies, Tools, General Consumables',
      icon: 'ShoppingCartIcon',
      color: 'yellow',
      standards: [],
      requiresCertification: false,
      typicalLeadTime: '1-2 weeks'
    },
    software_licenses: {
      name: 'Software & Licenses',
      description: 'Engineering Software, Analysis Tools',
      icon: 'ComputerDesktopIcon',
      color: 'teal',
      standards: [],
      requiresCertification: false,
      typicalLeadTime: '1-2 weeks'
    },
    other: {
      name: 'Other',
      description: 'Miscellaneous Items',
      icon: 'EllipsisHorizontalIcon',
      color: 'gray',
      standards: [],
      requiresCertification: false,
      typicalLeadTime: '4-8 weeks'
    }
  },

  // Material Certifications Required for Oil & Gas
  certifications: {
    mtc: {
      name: 'Material Test Certificate (3.1)',
      description: 'EN 10204 3.1 certificate from manufacturer',
      required: true,
      icon: 'DocumentCheckIcon'
    },
    mtr: {
      name: 'Material Test Report',
      description: 'Complete material test results',
      required: true,
      icon: 'DocumentTextIcon'
    },
    coc: {
      name: 'Certificate of Conformance',
      description: 'Conformance to specifications',
      required: true,
      icon: 'CheckBadgeIcon'
    },
    mds: {
      name: 'Material Data Sheet',
      description: 'Technical material specifications',
      required: false,
      icon: 'DocumentIcon'
    },
    msds: {
      name: 'Material Safety Data Sheet',
      description: 'Safety handling information',
      required: true,
      icon: 'ShieldExclamationIcon'
    },
    pqr: {
      name: 'Procedure Qualification Record',
      description: 'Welding procedure qualification',
      required: false,
      icon: 'ClipboardDocumentCheckIcon'
    },
    wps: {
      name: 'Welding Procedure Specification',
      description: 'Approved welding procedures',
      required: false,
      icon: 'DocumentDuplicateIcon'
    },
    ndt: {
      name: 'Non-Destructive Testing Report',
      description: 'UT, RT, PT, MT test results',
      required: true,
      icon: 'MagnifyingGlassCircleIcon'
    },
    hydro: {
      name: 'Hydrostatic Test Certificate',
      description: 'Pressure test certification',
      required: true,
      icon: 'BeakerIcon'
    },
    pmi: {
      name: 'Positive Material Identification',
      description: 'PMI test verification report',
      required: true,
      icon: 'FingerPrintIcon'
    }
  },

  // Quality Standards
  qualityStandards: {
    api: {
      name: 'American Petroleum Institute',
      description: 'API standards for oil & gas equipment',
      website: 'https://www.api.org'
    },
    asme: {
      name: 'ASME Boiler & Pressure Vessel Code',
      description: 'ASME design and manufacturing standards',
      website: 'https://www.asme.org'
    },
    astm: {
      name: 'ASTM International Standards',
      description: 'Material testing and quality standards',
      website: 'https://www.astm.org'
    },
    iso: {
      name: 'ISO Quality Standards',
      description: 'International quality management standards',
      website: 'https://www.iso.org'
    },
    nace: {
      name: 'NACE International (Corrosion)',
      description: 'Corrosion control and prevention',
      website: 'https://www.nace.org'
    },
    ansi: {
      name: 'American National Standards Institute',
      description: 'US industry standards',
      website: 'https://www.ansi.org'
    },
    iec: {
      name: 'International Electrotechnical Commission',
      description: 'Electrical and electronic standards',
      website: 'https://www.iec.ch'
    },
    ieee: {
      name: 'Institute of Electrical and Electronics Engineers',
      description: 'Electrical engineering standards',
      website: 'https://www.ieee.org'
    }
  },

  // Procurement Workflow Statuses
  statuses: {
    requisition: {
      draft: { label: 'Draft', color: 'gray', icon: 'PencilIcon' },
      submitted: { label: 'Submitted', color: 'blue', icon: 'PaperAirplaneIcon' },
      approved: { label: 'Approved', color: 'green', icon: 'CheckCircleIcon' },
      rejected: { label: 'Rejected', color: 'red', icon: 'XCircleIcon' },
      cancelled: { label: 'Cancelled', color: 'gray', icon: 'XMarkIcon' },
      converted: { label: 'Converted to PO', color: 'indigo', icon: 'ArrowRightIcon' }
    },
    purchaseOrder: {
      draft: { label: 'Draft', color: 'gray', icon: 'PencilIcon' },
      sent: { label: 'Sent to Vendor', color: 'blue', icon: 'PaperAirplaneIcon' },
      acknowledged: { label: 'Acknowledged', color: 'cyan', icon: 'CheckIcon' },
      in_progress: { label: 'In Progress', color: 'yellow', icon: 'ClockIcon' },
      partially_received: { label: 'Partially Received', color: 'amber', icon: 'ArchiveBoxArrowDownIcon' },
      completed: { label: 'Completed', color: 'green', icon: 'CheckCircleIcon' },
      cancelled: { label: 'Cancelled', color: 'red', icon: 'XCircleIcon' }
    },
    receipt: {
      pending: { label: 'Pending Inspection', color: 'yellow', icon: 'ClockIcon' },
      accepted: { label: 'Accepted', color: 'green', icon: 'CheckCircleIcon' },
      rejected: { label: 'Rejected', color: 'red', icon: 'XCircleIcon' },
      partial: { label: 'Partially Accepted', color: 'amber', icon: 'ExclamationTriangleIcon' }
    },
    vendor: {
      active: { label: 'Active', color: 'green', icon: 'CheckCircleIcon' },
      inactive: { label: 'Inactive', color: 'gray', icon: 'MinusCircleIcon' },
      pending: { label: 'Pending Approval', color: 'yellow', icon: 'ClockIcon' },
      blacklisted: { label: 'Blacklisted', color: 'red', icon: 'XCircleIcon' }
    }
  },

  // Priority Levels
  priorities: {
    urgent: { label: 'Urgent', color: 'red', days: 7 },
    high: { label: 'High', color: 'orange', days: 14 },
    normal: { label: 'Normal', color: 'blue', days: 30 },
    low: { label: 'Low', color: 'gray', days: 60 }
  },

  // Vendor Rating System
  vendorRatings: {
    5: { label: 'Excellent', color: 'green', icon: '⭐⭐⭐⭐⭐' },
    4: { label: 'Good', color: 'blue', icon: '⭐⭐⭐⭐' },
    3: { label: 'Average', color: 'yellow', icon: '⭐⭐⭐' },
    2: { label: 'Below Average', color: 'orange', icon: '⭐⭐' },
    1: { label: 'Poor', color: 'red', icon: '⭐' }
  }
}

// Helper functions
export const getCategoryByCode = (code) => {
  return PROCUREMENT_CONFIG.categories[code] || PROCUREMENT_CONFIG.categories.other
}

export const getCertificationByCode = (code) => {
  return PROCUREMENT_CONFIG.certifications[code] || null
}

export const getStatusConfig = (type, status) => {
  return PROCUREMENT_CONFIG.statuses[type]?.[status] || { label: status, color: 'gray', icon: 'QuestionMarkCircleIcon' }
}

export const getPriorityConfig = (priority) => {
  return PROCUREMENT_CONFIG.priorities[priority] || PROCUREMENT_CONFIG.priorities.normal
}

export const getVendorRating = (rating) => {
  return PROCUREMENT_CONFIG.vendorRatings[rating] || PROCUREMENT_CONFIG.vendorRatings[3]
}

export const getCategoriesList = () => {
  return Object.entries(PROCUREMENT_CONFIG.categories).map(([code, config]) => ({
    code,
    ...config
  }))
}

export const getCertificationsList = () => {
  return Object.entries(PROCUREMENT_CONFIG.certifications).map(([code, config]) => ({
    code,
    ...config
  }))
}

export const getQualityStandardsList = () => {
  return Object.entries(PROCUREMENT_CONFIG.qualityStandards).map(([code, config]) => ({
    code,
    ...config
  }))
}

export const getOrderTabs = () => {
  return Object.entries(PROCUREMENT_CONFIG.orderTabs).map(([key, config]) => ({
    key,
    ...config
  }))
}

export const getOrderTabByKey = (key) => {
  return PROCUREMENT_CONFIG.orderTabs[key] || null
}
