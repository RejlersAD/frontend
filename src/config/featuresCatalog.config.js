/**
 * Features Catalog Configuration
 * Comprehensive soft-coded feature definitions for the dashboard
 * Easy to add, modify, and manage features without touching core logic
 * 
 * @description Dynamic features system that supports:
 * - Easy addition of new features
 * - Status badges (Active, Beta, New, Coming Soon)
 * - Usage metrics and popularity tracking
 * - Category-based organization
 * - Search and filtering capabilities
 * - Permission-based access control
 */

// SOFT-CODED: P&ID Feature Naming Configuration (centralized)
// Easy to modify P&ID related naming across the application
const PID_NAMING_CONFIG = {
  displayName: 'P&ID Quality Checker',
  shortName: 'Quality Checker',
  fullDescription: 'AI-powered Piping & Instrumentation Diagram quality verification',
  detailedDescription: 'Advanced P&ID quality analysis with AI-powered error detection, standards compliance checking (ADNOC DEP, API, ISA-5.1), symbol recognition, and automated quality recommendations.'
}

// SOFT-CODED: Toggle visibility of Digitization > Datasheets in feature catalog surfaces
const ENABLE_DIGITIZATION_DATASHEET_FEATURE = false

/**
 * Feature Status Types
 */
export const FEATURE_STATUS = {
  ACTIVE: { id: 'active', label: 'Active', color: 'green' },
  BETA: { id: 'beta', label: 'Beta', color: 'yellow' },
  NEW: { id: 'new', label: 'New', color: 'blue' },
  PREVIEW: { id: 'preview', label: 'Preview', color: 'purple' },
  COMING_SOON: { id: 'coming_soon', label: 'Coming Soon', color: 'gray' },
  // SOFT-CODED: Status for features moved to different sections to avoid duplication
  MOVED_TO_PROCESS_ENGINEERING: { id: 'moved', label: 'Moved to Process', color: 'orange' }
}

/**
 * Feature Badge Types
 */
export const FEATURE_BADGES = {
  AI_POWERED: { id: 'ai', label: 'AI Powered', icon: '🤖', color: 'purple' },
  POPULAR: { id: 'popular', label: 'Popular', icon: '⭐', color: 'yellow' },
  FEATURED: { id: 'featured', label: 'Featured', icon: '✨', color: 'blue' },
  BETA: { id: 'beta', label: 'Beta', icon: '🧪', color: 'orange' },
  NEW: { id: 'new', label: 'New', icon: '🎉', color: 'green' },
  ADVANCED: { id: 'advanced', label: 'Advanced', icon: '⚡', color: 'indigo' }
}

/**
 * Enhanced Features Catalog
 * Complete and extensible feature definitions
 */
export const FEATURES_CATALOG = {
  // Engineering Features
  engineering: {
    id: 'engineering',
    name: 'Engineering',
    icon: '⚙️',
    color: 'blue',
    description: 'Engineering design and analysis tools',
    order: 1,
    features: [
      {
        id: 'eng-pid-design',
        name: PID_NAMING_CONFIG.displayName,
        shortName: PID_NAMING_CONFIG.shortName,
        description: PID_NAMING_CONFIG.fullDescription,
        longDescription: PID_NAMING_CONFIG.detailedDescription,
        path: '/engineering/process/pid-verification', // SOFT-CODED: redirected from /pid/upload
        moduleCode: 'pid_analysis',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.POPULAR],
        metrics: {
          accuracy: '98%',
          avgProcessingTime: '2-3 min',
          documentsProcessed: 10547,
          usersActive: 156
        },
        capabilities: [
          'Automated error detection',
          'Standards compliance checking',
          'Symbol recognition & validation',
          'Intelligent recommendations',
          'Multi-standard support (ADNOC, API, ISA-5.1)'
        ],
        usageStats: {
          monthlyUses: 2450,
          totalUses: 15340,
          avgRating: 4.8,
          lastUsed: '2024-01-23'
        }
      },
      {
        id: 'eng-process-datasheet',
        name: 'Process Datasheets',
        shortName: 'Datasheets',
        description: 'Equipment data sheets generation and management',
        path: '/engineering/process/datasheet',
        moduleCode: 'process_datasheet',
        status: FEATURE_STATUS.NEW,
        badges: [FEATURE_BADGES.NEW],
        capabilities: [
          'Automated data sheet generation',
          'Template management',
          'Equipment specifications',
          'Standards compliance'
        ],
        usageStats: {
          monthlyUses: 340,
          totalUses: 450,
          avgRating: 4.5
        }
      },
      {
        id: 'eng-piping-pms',
        name: 'Valve MTO',
        shortName: 'Valve MTO',
        description: 'Valve Material Take-Off — quantities, specs and project rollup',
        path: '/engineering/piping/pms',
        moduleCode: 'piping_pms',
        status: FEATURE_STATUS.NEW,
        badges: [FEATURE_BADGES.NEW],
        capabilities: [
          'Valve register and take-off',
          'Per-line valve quantification',
          'Compliance tracking',
          'Cost estimation'
        ],
        usageStats: {
          monthlyUses: 245,
          totalUses: 320,
          avgRating: 4.6
        }
      },
      {
        id: 'eng-instrument-index',
        name: 'Instrument Index',
        shortName: 'Instruments',
        description: 'Comprehensive instrument index management',
        path: '/engineering/instrument/index',
        moduleCode: 'instrument_index',
        status: FEATURE_STATUS.NEW,
        badges: [FEATURE_BADGES.NEW, FEATURE_BADGES.ADVANCED],
        capabilities: [
          'Instrument catalog',
          'Tag number management',
          'Specifications tracking',
          'Calibration scheduling'
        ],
        usageStats: {
          monthlyUses: 189,
          totalUses: 267,
          avgRating: 4.7
        }
      },
      {
        id: 'eng-electrical-sld',
        name: 'Single Line Diagram',
        shortName: 'SLD',
        description: 'Single line diagram design and electrical analysis',
        path: '/engineering/electrical/sld',
        moduleCode: 'electrical_sld',
        status: FEATURE_STATUS.NEW,
        badges: [FEATURE_BADGES.NEW],
        capabilities: [
          'SLD creation',
          'Load analysis',
          'Equipment sizing',
          'Fault calculations'
        ],
        usageStats: {
          monthlyUses: 156,
          totalUses: 198,
          avgRating: 4.4
        }
      },
      {
        id: 'eng-spec-customization',
        name: 'Spec Customization',
        shortName: 'Specs',
        description: 'AI-powered specification generation and customization',
        path: '/engineering/digitization/spec-customization',
        moduleCode: 'spec_customization',
        status: FEATURE_STATUS.BETA,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.BETA],
        capabilities: [
          'Automated spec generation',
          'Template customization',
          'AI recommendations',
          'Version control'
        ],
        usageStats: {
          monthlyUses: 423,
          totalUses: 856,
          avgRating: 4.6
        }
      },
      ...(ENABLE_DIGITIZATION_DATASHEET_FEATURE
        ? [{
          id: 'eng-digitization-datasheet',
          name: 'Datasheets',
          shortName: 'Datasheets',
          description: 'Digital transformation datasheets and documentation',
          path: '/engineering/digitization/datasheet',
          moduleCode: 'digitization_datasheet',
          status: FEATURE_STATUS.NEW,
          badges: [FEATURE_BADGES.NEW],
          capabilities: [
            'Digital documentation management',
            'Automated datasheet generation',
            'Template library',
            'Standards compliance'
          ],
          usageStats: {
            monthlyUses: 0,
            totalUses: 0,
            avgRating: 0
          }
        }]
        : [])
    ]
  },

  // Common Features
  common: {
    id: 'common',
    name: 'COMMON',
    icon: '🔧',
    color: 'purple',
    description: 'Common features and tools',
    order: 2,
    features: [
      {
        id: 'common-crs-documents',
        name: 'CRS Documents',
        shortName: 'Documents',
        description: 'Centralized correspondence and records repository',
        longDescription: 'Complete document management system for correspondence, records, and communication tracking with version control and access management.',
        path: '/crs/documents',
        moduleCode: 'crs_documents',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.POPULAR],
        capabilities: [
          'Document repository',
          'Version control',
          'Search and filter',
          'Access control',
          'Audit trail'
        ],
        metrics: {
          totalDocuments: 8456,
          storageUsed: '125 GB',
          activeUsers: 234
        },
        usageStats: {
          monthlyUses: 4567,
          totalUses: 45890,
          avgRating: 4.7,
          lastUsed: '2024-01-24'
        }
      },
      {
        id: 'common-revision-tracking',
        name: 'Multi-Revision Tracking',
        shortName: 'Revisions',
        description: 'AI-powered document revision tracking and comparison',
        path: '/crs/multiple-revision',
        moduleCode: 'crs_documents',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED],
        capabilities: [
          'Automated change detection',
          'Revision comparison',
          'History tracking',
          'Smart notifications'
        ],
        usageStats: {
          monthlyUses: 1234,
          totalUses: 8945,
          avgRating: 4.8
        }
      },
      // SOFT-CODED REMOVAL: P&ID Checker moved to Process Engineering discipline
      // Use Process -> P&ID instead of common-pid-checker to avoid duplication
      // Path: /pid/upload is accessed via Process Engineering section only
      {
        id: 'common-pid-checker-removed',
        name: '(Moved) P&ID Checker',
        status: FEATURE_STATUS.MOVED_TO_PROCESS_ENGINEERING,
        redirectPath: '/engineering/process/pid-verification', // SOFT-CODED: redirected from /pid/upload
        note: 'Feature moved to Process Engineering -> P&ID for better organization'
      },
      {
        id: 'common-designiq',
        name: 'DesignIQ',
        shortName: 'DesignIQ',
        description: 'AI-powered design optimization and intelligence',
        longDescription: 'Advanced AI assistant for engineering design optimization, recommendations, and intelligent analysis with predictive capabilities.',
        path: '/designiq',
        moduleCode: 'designiq',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.FEATURED],
        capabilities: [
          'Design optimization',
          'AI recommendations',
          'Best practices analysis',
          'Cost estimation',
          'Predictive analytics'
        ],
        metrics: {
          designsOptimized: 3456,
          avgCostSavings: '18%',
          satisfactionRate: '96%'
        },
        usageStats: {
          monthlyUses: 3245,
          totalUses: 18790,
          avgRating: 4.9,
          lastUsed: '2024-01-24'
        }
      },
      {
        id: 'common-pfd-converter',
        name: 'PFD to P&ID Converter',
        shortName: 'PFD Convert',
        description: 'Intelligent PFD to P&ID conversion with AI',
        path: '/pfd/upload',
        moduleCode: 'pfd_to_pid',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED],
        capabilities: [
          'Automated conversion',
          'Symbol mapping',
          'Layout optimization',
          'Standards compliance'
        ],
        usageStats: {
          monthlyUses: 678,
          totalUses: 4567,
          avgRating: 4.7
        }
      }
    ]
  },

  // Finance Features
  finance: {
    id: 'finance',
    name: 'Finance',
    icon: '💰',
    color: 'green',
    description: 'Financial management and invoicing',
    order: 3,
    features: [
      // SOFT-CODED: finance-invoice-upload feature retired — link removed from UI
      // SOFT-CODED: finance-invoice-management feature retired — link removed from UI
      // SOFT-CODED: finance-salary-slip feature retired — link removed from UI
    ]
  },

  // Project Control Features
  projectControl: {
    id: 'project_control',
    name: 'Project Control',
    icon: '📊',
    color: 'indigo',
    description: 'Project management and tracking',
    order: 4,
    features: [
      {
        id: 'project-management',
        name: 'Project Management',
        shortName: 'Projects',
        description: 'Comprehensive project tracking and management',
        longDescription: 'End-to-end project management with timelines, milestones, resource allocation, and progress tracking.',
        path: '/projects',
        moduleCode: 'project_control',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.POPULAR, FEATURE_BADGES.ADVANCED],
        capabilities: [
          'Project planning',
          'Milestone tracking',
          'Resource management',
          'Progress reporting',
          'Risk assessment'
        ],
        metrics: {
          activeProjects: 47,
          completedProjects: 189,
          onTimeDelivery: '94%'
        },
        usageStats: {
          monthlyUses: 3456,
          totalUses: 28790,
          avgRating: 4.7
        }
      },
      {
        id: 'planning-package',
        name: 'Planning Package',
        shortName: 'Planning',
        description: 'Work package planning and tracking',
        longDescription: 'Break down projects into manageable work packages with budgets, timelines, deliverables, and progress tracking for enhanced project control.',
        path: '/planning-packages',
        moduleCode: 'project_control',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.NEW],
        capabilities: [
          'Package creation & management',
          'Budget allocation & tracking',
          'Schedule planning',
          'Progress monitoring',
          'WBS integration',
          'Deliverable tracking'
        ],
        metrics: {
          totalPackages: 0,
          activePackages: 0,
          avgProgress: '0%'
        },
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 0
        }
      }
    ]
  },

  // Procurement Features
  procurement: {
    id: 'procurement',
    name: 'Procurement',
    icon: '🚚',
    color: 'orange',
    description: 'Procurement and supply chain',
    order: 5,
    features: [
      {
        id: 'procurement-dashboard',
        name: 'Procurement Dashboard',
        shortName: 'Dashboard',
        description: 'Comprehensive procurement overview and analytics',
        path: '/procurement',
        moduleCode: 'procurement',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.POPULAR],
        capabilities: [
          'Real-time analytics',
          'KPI tracking',
          'Performance metrics',
          'Spend analysis'
        ],
        metrics: {
          totalOrders: 3456,
          activeVendors: 234,
          avgLeadTime: '12 days'
        },
        usageStats: {
          monthlyUses: 2890,
          totalUses: 15678,
          avgRating: 4.6
        }
      },
      {
        id: 'procurement-vendors',
        name: 'Vendor Management',
        shortName: 'Vendors',
        description: 'Complete vendor database and performance tracking',
        path: '/procurement/vendors',
        moduleCode: 'procurement',
        status: FEATURE_STATUS.ACTIVE,
        capabilities: [
          'Vendor database',
          'Performance ratings',
          'Contract management',
          'Compliance tracking'
        ],
        metrics: {
          totalVendors: 234,
          approvedVendors: 198,
          avgRating: 4.2
        },
        usageStats: {
          monthlyUses: 1234,
          totalUses: 8456,
          avgRating: 4.5
        }
      },
      {
        id: 'procurement-requisitions',
        name: 'Purchase Requisitions',
        shortName: 'Requisitions',
        description: 'AI-powered purchase recommendations and requisitions',
        path: '/procurement/requisitions',
        moduleCode: 'procurement',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED],
        capabilities: [
          'Smart recommendations',
          'Approval workflows',
          'Budget tracking',
          'Predictive ordering'
        ],
        usageStats: {
          monthlyUses: 1567,
          totalUses: 9876,
          avgRating: 4.7
        }
      },
      {
        id: 'procurement-orders',
        name: 'Purchase Orders',
        shortName: 'POs',
        description: 'Purchase order creation and tracking',
        path: '/procurement/orders',
        moduleCode: 'procurement',
        status: FEATURE_STATUS.ACTIVE,
        capabilities: [
          'PO generation',
          'Status tracking',
          'Supplier communication',
          'Invoice matching'
        ],
        usageStats: {
          monthlyUses: 2134,
          totalUses: 13456,
          avgRating: 4.6
        }
      },
      {
        id: 'procurement-receipts',
        name: 'Goods Receipt',
        shortName: 'Receipts',
        description: 'AI-powered goods receipt and quality inspection',
        path: '/procurement/receipts',
        moduleCode: 'procurement',
        status: FEATURE_STATUS.NEW,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.NEW],
        capabilities: [
          'Receipt processing',
          'Quality checks',
          'Inventory updates',
          'Automated notifications'
        ],
        usageStats: {
          monthlyUses: 890,
          totalUses: 2345,
          avgRating: 4.8
        }
      }
    ]
  },

  // Sales Features (Section 4)
  sales: {
    id: 'sales',
    name: 'Dept of Sales',
    icon: '💼',
    color: 'cyan',
    description: 'Sales CRM and pipeline management',
    order: 4,
    features: [
      {
        id: 'sales-dashboard',
        name: 'Sales Dashboard',
        shortName: 'Dashboard',
        description: 'Comprehensive sales overview with AI-powered insights',
        longDescription: 'Real-time sales metrics, revenue tracking, pipeline analytics, and AI-powered forecasting for data-driven decision making.',
        path: '/finance/sales',
        moduleCode: 'sales',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.POPULAR, FEATURE_BADGES.NEW],
        capabilities: [
          'Real-time KPI tracking',
          'Revenue & pipeline analytics',
          'AI-powered forecasting',
          'Performance metrics',
          'Interactive charts & graphs'
        ],
        metrics: {
          activeDeals: 0,
          totalRevenue: '$0',
          winRate: '0%',
          pipelineValue: '$0'
        },
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 5.0
        }
      },
      {
        id: 'sales-crm',
        name: 'Client Management (CRM)',
        shortName: 'CRM',
        description: 'Complete customer relationship management system',
        longDescription: 'Manage clients, contacts, interactions, and relationships with AI-powered insights and lead scoring.',
        path: '/finance/sales',
        moduleCode: 'sales',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.NEW],
        capabilities: [
          'Client & contact management',
          'Interaction history tracking',
          'AI-powered lead scoring',
          'Relationship analytics',
          'Contact segmentation'
        ],
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 5.0
        }
      },
      {
        id: 'sales-pipeline',
        name: 'Sales Pipeline',
        shortName: 'Pipeline',
        description: 'Visual deal tracking and stage management',
        longDescription: 'Manage your sales pipeline with drag-and-drop interface, deal stages, probability tracking, and automated workflows.',
        path: '/finance/sales',
        moduleCode: 'sales',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.POPULAR, FEATURE_BADGES.NEW],
        capabilities: [
          'Visual pipeline management',
          'Deal stage tracking',
          'Win/loss probability',
          'Pipeline value analytics',
          'Automated stage updates'
        ],
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 5.0
        }
      },
      {
        id: 'sales-ai-insights',
        name: 'AI Sales Insights',
        shortName: 'AI Insights',
        description: 'Machine learning powered sales intelligence',
        longDescription: 'Leverage AI for predictive sales forecasting, deal prioritization, churn risk analysis, and next best action recommendations.',
        path: '/finance/sales',
        moduleCode: 'sales',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.AI_POWERED, FEATURE_BADGES.ADVANCED, FEATURE_BADGES.NEW],
        capabilities: [
          'Predictive sales forecasting',
          'Deal prioritization AI',
          'Churn risk analysis',
          'Next best action recommendations',
          'Sentiment analysis'
        ],
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 5.0
        }
      },
      {
        id: 'sales-quotes',
        name: 'Quote Management',
        shortName: 'Quotes',
        description: 'Professional quote creation and tracking',
        longDescription: 'Generate professional quotes, track revisions, manage approvals, and convert to deals seamlessly.',
        path: '/finance/sales',
        moduleCode: 'sales',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.NEW],
        capabilities: [
          'Professional quote generation',
          'Template management',
          'Revision tracking',
          'Approval workflows',
          'Quote-to-deal conversion'
        ],
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 5.0
        }
      },
      {
        id: 'sales-activities',
        name: 'Sales Activities',
        shortName: 'Activities',
        description: 'Track all sales interactions and tasks',
        longDescription: 'Comprehensive activity tracking including calls, meetings, emails, and follow-ups with automated reminders.',
        path: '/finance/sales',
        moduleCode: 'sales',
        status: FEATURE_STATUS.ACTIVE,
        badges: [FEATURE_BADGES.NEW],
        capabilities: [
          'Activity logging',
          'Task management',
          'Automated reminders',
          'Activity analytics',
          'Team collaboration'
        ],
        usageStats: {
          monthlyUses: 0,
          totalUses: 0,
          avgRating: 5.0
        }
      }
    ]
  },

  // QHSE Features
  qhse: {
    id: 'qhse',
    name: 'QHSE',
    icon: '🛡️',
    color: 'red',
    description: 'Quality, Health, Safety & Environment',
    order: 6,
    features: [
      {
        id: 'qhse-general',
        name: 'Project Quality',
        shortName: 'Project Quality',
        description: 'Comprehensive project quality management system',
        path: '/qhse/general',
        moduleCode: 'qhse',
        status: FEATURE_STATUS.ACTIVE,
        capabilities: [
          'Incident tracking',
          'Audit management',
          'Compliance monitoring',
          'Risk assessment'
        ],
        metrics: {
          incidentsFreedays: 456,
          auditsCompleted: 67,
          complianceRate: '98.5%'
        },
        usageStats: {
          monthlyUses: 1678,
          totalUses: 11234,
          avgRating: 4.7
        }
      },
      {
        id: 'qhse-quality',
        name: 'Quality Management',
        shortName: 'Quality',
        description: 'Quality metrics, audits, and continuous improvement',
        path: '/qhse/general/quality',
        moduleCode: 'qhse',
        status: FEATURE_STATUS.ACTIVE,
        capabilities: [
          'Quality metrics',
          'Audit scheduling',
          'Non-conformance tracking',
          'CAPA management'
        ],
        usageStats: {
          monthlyUses: 890,
          totalUses: 6789,
          avgRating: 4.6
        }
      },
      {
        id: 'qhse-safety',
        name: 'Health & Safety',
        shortName: 'Safety',
        description: 'Health and safety management and reporting',
        path: '/qhse/general/health-safety',
        moduleCode: 'qhse',
        status: FEATURE_STATUS.ACTIVE,
        capabilities: [
          'Incident reporting',
          'Risk assessments',
          'Safety training tracking',
          'PPE management'
        ],
        usageStats: {
          monthlyUses: 1234,
          totalUses: 8945,
          avgRating: 4.8
        }
      },
      {
        id: 'qhse-environmental',
        name: 'Environmental Management',
        shortName: 'Environment',
        description: 'Environmental compliance and sustainability',
        path: '/qhse/general/environmental',
        moduleCode: 'qhse',
        status: FEATURE_STATUS.ACTIVE,
        capabilities: [
          'Environmental monitoring',
          'Emissions tracking',
          'Sustainability reports',
          'Waste management'
        ],
        usageStats: {
          monthlyUses: 567,
          totalUses: 4123,
          avgRating: 4.5
        }
      }
    ]
  }
}

/**
 * Helper Functions for Feature Management
 */

// Get all features as a flat array
export const getAllFeatures = () => {
  return Object.values(FEATURES_CATALOG).flatMap(category => 
    category.features.map(feature => ({
      ...feature,
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color
    }))
  )
}

// Get features by category
export const getFeaturesByCategory = (categoryId) => {
  const category = FEATURES_CATALOG[categoryId]
  return category ? category.features : []
}

// Get feature by ID
export const getFeatureById = (featureId) => {
  for (const category of Object.values(FEATURES_CATALOG)) {
    const feature = category.features.find(f => f.id === featureId)
    if (feature) {
      return {
        ...feature,
        categoryId: category.id,
        categoryName: category.name
      }
    }
  }
  return null
}

// Search features
export const searchFeatures = (query) => {
  const lowerQuery = query.toLowerCase()
  return getAllFeatures().filter(f => 
    f.name.toLowerCase().includes(lowerQuery) ||
    f.description.toLowerCase().includes(lowerQuery) ||
    f.shortName.toLowerCase().includes(lowerQuery) ||
    (f.capabilities && f.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery)))
  )
}

// Filter features by status
export const getFeaturesByStatus = (statusId) => {
  return getAllFeatures().filter(f => f.status?.id === statusId)
}

// Get active features only
export const getActiveFeatures = () => {
  return getAllFeatures().filter(f => 
    f.status?.id === 'active' || f.status?.id === 'beta'
  )
}

// Get featured features (with Featured badge)
export const getFeaturedFeatures = () => {
  return getAllFeatures().filter(f => 
    f.badges && f.badges.some(badge => badge.id === 'featured')
  ).slice(0, 6)
}

// Get popular features (with Popular badge)
export const getPopularFeatures = () => {
  return getAllFeatures().filter(f => 
    f.badges && f.badges.some(badge => badge.id === 'popular')
  )
}

// Get AI-powered features
export const getAIFeatures = () => {
  return getAllFeatures().filter(f => 
    f.badges && f.badges.some(badge => badge.id === 'ai')
  )
}

// Check user access to feature
export const hasFeatureAccess = (feature, userModules, isAdmin) => {
  if (isAdmin) return true
  if (!feature.moduleCode) return true
  return userModules && userModules.includes(feature.moduleCode)
}

// Get features with access control
export const getUserAccessibleFeatures = (userModules, isAdmin) => {
  return getAllFeatures().filter(feature => 
    hasFeatureAccess(feature, userModules, isAdmin)
  )
}

// Sort features
export const sortFeatures = (features, sortBy = 'name') => {
  const sorted = [...features]
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'category':
      return sorted.sort((a, b) => a.categoryName.localeCompare(b.categoryName))
    case 'popularity':
      return sorted.sort((a, b) => 
        (b.usageStats?.monthlyUses || 0) - (a.usageStats?.monthlyUses || 0)
      )
    case 'rating':
      return sorted.sort((a, b) => 
        (b.usageStats?.avgRating || 0) - (a.usageStats?.avgRating || 0)
      )
    default:
      return sorted
  }
}

// Get category statistics
export const getCategoryStats = (categoryId) => {
  const features = getFeaturesByCategory(categoryId)
  return {
    total: features.length,
    active: features.filter(f => f.status?.id === 'active').length,
    beta: features.filter(f => f.status?.id === 'beta').length,
    new: features.filter(f => f.status?.id === 'new').length,
    ai: features.filter(f => f.badges?.some(b => b.id === 'ai')).length
  }
}

export default FEATURES_CATALOG
