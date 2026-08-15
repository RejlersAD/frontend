/**
 * Engineering Structure Configuration
 * Hierarchical configuration for Engineering section and its sub-disciplines
 * This provides a flexible, soft-coded structure for engineering modules
 */

import { ROUTES } from './routes.config'
import {
  BeakerIcon,
  WrenchIcon,
  CpuChipIcon,
  BoltIcon,
  HomeModernIcon,
  CogIcon,
  SparklesIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentChartBarIcon,
  CircleStackIcon,
  DocumentMagnifyingGlassIcon,
  DocumentCheckIcon
} from '@heroicons/react/24/outline'

// SOFT-CODED: P&ID Feature Naming Configuration
// Easy to modify P&ID related naming across the application
const PID_NAMING_CONFIG = {
  displayName: 'P&ID Quality Checker',
  fullName: 'Piping & Instrumentation Diagram Quality Checker',
  shortDescription: 'AI-powered P&ID quality verification and standards compliance',
  longDescription: 'Advanced P&ID quality analysis with AI-powered error detection, standards compliance checking, and automated recommendations'
}

// SOFT-CODED: Toggle visibility of Digitization > Datasheets in frontend navigation
const ENABLE_DIGITIZATION_DATASHEET_FEATURE = false

/**
 * Engineering Disciplines Configuration
 * Each discipline can have multiple sub-features
 */
export const ENGINEERING_DISCIPLINES = {
  process: {
    id: 'process',
    name: 'Process',
    fullName: 'Process Engineering',
    icon: BeakerIcon,
    description: 'Process flow diagrams and engineering',
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    order: 1,
    subFeatures: [
      // SOFT-CODED: Old /pid/upload sidebar entry removed — replaced by pid-verification below
      // {
      //   id: 'pid',
      //   name: PID_NAMING_CONFIG.displayName,
      //   fullName: PID_NAMING_CONFIG.fullName,
      //   icon: DocumentChartBarIcon,
      //   path: '/pid/upload',
      //   description: PID_NAMING_CONFIG.shortDescription,
      //   moduleCode: 'pid_analysis',
      //   badge: 'AI'
      // },
      // SOFT-CODED: P&ID Verification feature entry — add/remove here only
      // SOFT-CODED: display name changed from 'P&ID Verification' → 'P&ID QC'
      // SOFT-CODED: V2 access via in-page switcher — no separate sidebar entry needed
      {
        id: 'pidVerification',
        name: 'P&ID QC',
        fullName: 'P&ID Quality Control',

        icon: DocumentChartBarIcon,
        path: ROUTES.PID_VERIFICATION, // SOFT-CODED: Using centralized route config
        description: 'AI-powered P&ID drawing verification and tag validation',
        moduleCode: 'pid_analysis',
        badge: 'NEW'
      },
      // SOFT-CODED: PFD Quality Checker — deterministic rule engine
      // SOFT-CODED: display name changed from 'PFD Quality Checker' → 'PFD QC'
      {
        id: 'pfdQualityChecker',
        name: 'PFD QC',
        fullName: 'PFD Quality Control',
        icon: DocumentChartBarIcon,
        path: '/engineering/process/pfd-quality-checker',
        description: 'Deterministic PFD quality checks — equipment tags, streams, title block & safety',
        moduleCode: 'pfd_quality',
        badge: 'NEW'
      },
      // SOFT-CODED: PFD Verification disabled — source files preserved
      // {
      //   id: 'pfdVerification',
      //   name: 'PFD Verification',
      //   fullName: 'Process Flow Diagram Verification',
      //   icon: DocumentTextIcon,
      //   path: '/designiq/pfd-verification',
      //   description: 'AI-powered PFD design verification with reference documents',
      //   moduleCode: 'designiq',
      //   badge: 'NEW'
      // },
      {
        id: 'processDataSheet',
        name: 'Datasheets',
        fullName: 'Process Datasheets',
        icon: DocumentTextIcon,
        path: '/engineering/process/datasheet',
        description: 'Process equipment datasheets',
        moduleCode: 'process_datasheet',
        badge: 'New'
      }
    ,      {        id: 'lineList',
        name: 'Line List',
        fullName: 'Line List - Base Extraction',
        icon: TableCellsIcon,
        path: '/engineering/process/line-list',
        description: 'Extract 8 base columns from P&ID (P&ID-only, no enrichment)',
        moduleCode: 'pid_line_list'
      }
      ,
      {
        id: 'equipmentList',
        name: 'Equipment List',
        fullName: 'Equipment List - P&ID Extraction',
        icon: TableCellsIcon,
        path: '/engineering/process/equipment-list',
        description: 'Extract equipment tags (Vessels, Pumps, HE, Reactors…) from P&ID with type classification and line connections',
        moduleCode: 'pid_equipment_list',
        badge: 'NEW'
      }
    ]
  },

  piping: {
    id: 'piping',
    name: 'Piping',
    fullName: 'Piping Engineering',
    icon: WrenchIcon,
    description: 'Critical line management and piping specifications',
    color: 'orange',
    gradient: 'from-orange-500 to-orange-600',
    order: 2,
    subFeatures: [
      {
        id: 'criticalLineList',
        name: 'Critical Line List',
        fullName: 'Critical Line List - Full Enrichment',
        icon: TableCellsIcon,
        path: '/engineering/piping/critical-line-list',
        description: '5-document upload (P&ID+PFD+HMB+PMS+NACE) for full 35-column extraction with enrichment',
        moduleCode: 'piping_critical_line_list',
        badge: 'FULL'
      },
      {
        id: 'pms',
        name: 'Valve MTO',
        fullName: 'Valve Material Take-Off',
        icon: TableCellsIcon,
        path: '/engineering/piping/pms',
        description: 'Valve material take-off list — quantities, specs and project rollup',
        moduleCode: 'piping_pms',
        badge: 'New'
      },
      {
        id: 'pipingDataSheet',
        name: 'Datasheets',
        fullName: 'Piping Datasheets',
        icon: DocumentTextIcon,
        path: '/engineering/piping/datasheet',
        description: 'Piping component datasheets',
        moduleCode: 'piping_datasheet',
      }
    ]
  },

  instrument: {
    id: 'instrument',
    name: 'Instrument',
    fullName: 'Instrumentation Engineering',
    icon: CpuChipIcon,
    description: 'Instrumentation and control systems',
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
    order: 3,
    subFeatures: [
      {
        id: 'instrumentIndex',
        name: 'Instrument Index',
        fullName: 'Instrument Index',
        icon: TableCellsIcon,
        path: '/engineering/instrument/index',
        description: 'Comprehensive instrument index management',
        moduleCode: 'instrument_index',
        badge: 'New'
      },
      // SOFT-CODED: IO List promoted from the Datasheets hub to a first-class
      // sub-feature under 1.3 Instrument (route unchanged — reuses existing
      // IOListPage at /engineering/instrument/datasheet/io-list).
      {
        id: 'instrumentIoList',
        name: 'IO List',
        fullName: 'Instrument IO List',
        icon: CircleStackIcon,
        path: '/engineering/instrument/datasheet/io-list',
        description: 'Generate a canonical Input/Output list from the instrument register, or run a deterministic QC on an existing list',
        moduleCode: 'instrument_io_list',
        badge: 'Generator + QC'
      },
      {
        id: 'instrumentDataSheet',
        name: 'Datasheets',
        fullName: 'Instrument Datasheets',
        icon: DocumentTextIcon,
        path: '/engineering/instrument/datasheet',
        description: 'Instrument specification datasheets',
        moduleCode: 'instrument_datasheet',
        badge: 'New'
      }
    ]
  },

  electrical: {
    id: 'electrical',
    name: 'Electrical',
    fullName: 'Electrical Engineering',
    icon: BoltIcon,
    description: 'Electrical systems and power distribution',
    color: 'yellow',
    gradient: 'from-yellow-500 to-yellow-600',
    order: 4,
    subFeatures: [
      {
        id: 'sld',
        name: 'SLD',
        fullName: 'Single Line Diagram',
        icon: DocumentChartBarIcon,
        path: '/engineering/electrical/sld',
        description: 'Single line diagram design and analysis',
        moduleCode: 'electrical_sld',
        badge: 'New'
      },
      // SOFT-CODED: Electrical Check List - NEW FEATURE
      {
        id: 'electricalCheckList',
        name: 'Check List',
        fullName: 'Electrical Check List',
        icon: DocumentCheckIcon,
        path: '/engineering/electrical/checklist',
        description: 'Electrical engineering quality check lists and compliance verification',
        moduleCode: 'electrical_checklist',
        badge: 'New'
      },
      // SOFT-CODED: Electrical Datasheet - RE-ENABLED
      {
        id: 'electricalDatasheets',
        name: 'Datasheets',
        fullName: 'Electrical Datasheets',
        icon: DocumentTextIcon,
        path: '/engineering/electrical/datasheet',
        description: '27 electrical engineering initiatives - Datasheets, diagrams, layouts, schedules',
        moduleCode: 'electrical_datasheet',
        badge: 'New'
      }
    ]
  },

  civil: {
    id: 'civil',
    name: 'Civil',
    fullName: 'Civil Engineering',
    icon: HomeModernIcon,
    description: 'Civil and structural engineering',
    color: 'gray',
    gradient: 'from-gray-500 to-gray-600',
    order: 5,
    subFeatures: [
      {
        id: 'civilDataSheet',
        name: 'Datasheets',
        fullName: 'Civil Datasheets',
        icon: DocumentTextIcon,
        path: '/engineering/civil/datasheet',
        description: 'Civil and structural datasheets',
        moduleCode: 'civil_datasheet',
        badge: 'New'
      }
    ]
  },

  mechanical: {
    id: 'mechanical',
    name: 'Mechanical',
    fullName: 'Mechanical Engineering',
    icon: CogIcon,
    description: 'Mechanical equipment and systems',
    color: 'indigo',
    gradient: 'from-indigo-500 to-indigo-600',
    order: 6,
    subFeatures: [
      {
        id: 'mechanicalDataSheet',
        name: 'Datasheets',
        fullName: 'Mechanical Datasheets',
        icon: DocumentTextIcon,
        path: '/engineering/mechanical/datasheet',
        description: 'Mechanical equipment datasheets',
        moduleCode: 'mechanical_datasheet',
        badge: 'New'
      }
    ]
  },

  digitization: {
    id: 'digitization',
    name: 'Digitization',
    fullName: 'Digital Transformation',
    icon: SparklesIcon,
    description: 'Digital tools and automation',
    color: 'pink',
    gradient: 'from-pink-500 to-pink-600',
    order: 7,
    subFeatures: [
      {
        id: 'specCustomization',
        name: 'Spec Customization',
        fullName: 'Specification Customization',
        icon: CircleStackIcon,
        path: '/engineering/digitization/spec-customization',
        description: 'AI-powered spec generation and customization',
        moduleCode: 'spec_customization',
        badge: 'AI'
      },
      ...(ENABLE_DIGITIZATION_DATASHEET_FEATURE
        ? [{
          id: 'digitizationDatasheet',
          name: 'Datasheets',
          fullName: 'Digitization Datasheets',
          icon: DocumentTextIcon,
          path: '/engineering/digitization/datasheet',
          description: 'Digital transformation datasheets and documentation',
          moduleCode: 'digitization_datasheet',
          badge: 'New'
        }]
        : []),
      {
        id: 'nonTeffMetadata',
        name: 'SPF-NON-TEF',
        fullName: 'Non-TEF Metadata Generator',
        icon: DocumentMagnifyingGlassIcon,
        path: '/engineering/digitization/non-teff-metadata',
        description: 'Extract metadata from Non-TEFF documents (PDF, Excel, Word, AutoCAD)',
        moduleCode: 'non_teff_metadata',
        badge: 'AI'
      }
    ]
  }
}

/**
 * Legacy features to maintain backward compatibility
 * These map to the old structure
 */
export const LEGACY_ENGINEERING_FEATURES = {
  designiq: {
    id: 'designiq',
    name: 'DesignIQ',
    fullName: 'DesignIQ - AI Design Assistant',
    icon: SparklesIcon,
    path: '/designiq',
    description: 'AI-powered design optimization',
    moduleCode: 'designiq',
    badge: 'AI',
    showInLegacy: true
  },
  pfdConverter: {
    id: 'pfd',
    name: 'PFD Converter',
    fullName: 'PFD to P&ID Converter',
    icon: DocumentChartBarIcon,
    path: '/pfd/upload',
    description: 'Intelligent PFD conversion',
    moduleCode: 'pfd_to_pid',
    badge: 'AI',
    showInLegacy: true
  }
}

/**
 * Get all engineering disciplines sorted by order
 */
export const getEngineeringDisciplines = () => {
  return Object.values(ENGINEERING_DISCIPLINES).sort((a, b) => a.order - b.order)
}

/**
 * Get a specific discipline by ID
 */
export const getDiscipline = (disciplineId) => {
  return ENGINEERING_DISCIPLINES[disciplineId]
}

/**
 * Get all sub-features for a discipline
 */
export const getDisciplineSubFeatures = (disciplineId) => {
  const discipline = ENGINEERING_DISCIPLINES[disciplineId]
  return discipline ? discipline.subFeatures : []
}

/**
 * Find a sub-feature by path
 */
export const findSubFeatureByPath = (path) => {
  for (const discipline of Object.values(ENGINEERING_DISCIPLINES)) {
    const subFeature = discipline.subFeatures.find(sf => sf.path === path)
    if (subFeature) {
      return { discipline, subFeature }
    }
  }
  return null
}

/**
 * Get color classes for a discipline
 */
export const getDisciplineColors = (disciplineId) => {
  const discipline = ENGINEERING_DISCIPLINES[disciplineId]
  if (!discipline) return {}

  const colorMap = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      hover: 'hover:bg-blue-100'
    },
    orange: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
      hover: 'hover:bg-orange-100'
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      hover: 'hover:bg-purple-100'
    },
    yellow: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      hover: 'hover:bg-yellow-100'
    },
    gray: {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-100'
    },
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      hover: 'hover:bg-indigo-100'
    },
    pink: {
      bg: 'bg-pink-50',
      text: 'text-pink-700',
      border: 'border-pink-200',
      hover: 'hover:bg-pink-100'
    }
  }

  return colorMap[discipline.color] || colorMap.blue
}

/**
 * Check if user has access to a discipline or sub-feature
 */
export const hasAccess = (moduleCode, userModules, isAdmin) => {
  if (isAdmin) return true
  if (!moduleCode) return true
  return userModules.includes(moduleCode)
}

export default ENGINEERING_DISCIPLINES






