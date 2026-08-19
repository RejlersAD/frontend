/**
 * PFD Conversion Service Configuration
 * Centralized configuration for PFD to P&ID Conversion service
 * Soft-coded approach for easy maintenance and scalability
 */

import {
  DocumentArrowUpIcon,
  CpuChipIcon,
  SparklesIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowUpIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline'

/**
 * Service Information
 */
export const PFD_SERVICE_INFO = {
  id: 'pfd-conversion',
  title: 'PFD to P&ID Conversion',
  shortTitle: 'PFD Conversion',
  tagline: 'Transform Process Flow Diagrams into Detailed P&IDs with AI',
  description: 'Advanced AI-powered conversion service that transforms Process Flow Diagrams (PFDs) into detailed Piping & Instrumentation Diagrams (P&IDs). Accelerate your engineering design workflow with intelligent automation and expert-level accuracy.',
  moduleCode: 'PFD_MODULE',
  version: '4.0',
  status: 'production',
  lastUpdated: '2026-01-07'
}

/**
 * Key Features
 */
export const PFD_FEATURES = [
  {
    id: 'intelligent-conversion',
    title: 'Intelligent Conversion',
    description: 'AI automatically converts PFD symbols and equipment into detailed P&ID representations',
    icon: SparklesIcon,
    color: 'from-blue-500 to-cyan-500',
    accuracy: '98.7%',
    details: [
      'Equipment symbol transformation',
      'Automatic tag generation',
      'Industry standard compliance',
      'Multiple output formats'
    ]
  },
  {
    id: 'equipment-enrichment',
    title: 'Equipment Enrichment',
    description: 'Automatically add instrumentation, control systems, and detailed equipment specifications',
    icon: Cog6ToothIcon,
    color: 'from-purple-500 to-pink-500',
    accuracy: '97.5%',
    details: [
      'Instrument loop creation',
      'Control valve placement',
      'Safety device addition',
      'Equipment detail expansion'
    ]
  },
  {
    id: 'piping-detail',
    title: 'Piping Detail Generation',
    description: 'Generate comprehensive piping details including line specs, routing, and connections',
    icon: ArrowPathIcon,
    color: 'from-green-500 to-emerald-500',
    accuracy: '96.8%',
    details: [
      'Line number generation',
      'Pipe spec assignment',
      'Valve placement',
      'Connection optimization'
    ]
  },
  {
    id: 'annotation-system',
    title: 'Smart Annotation',
    description: 'Intelligent placement of tags, labels, and annotations following industry best practices',
    icon: PencilSquareIcon,
    color: 'from-orange-500 to-red-500',
    accuracy: '99.2%',
    details: [
      'ISA-compliant tagging',
      'Automatic labeling',
      'Dimension annotations',
      'Note placement'
    ]
  },
  {
    id: 'validation',
    title: 'Design Validation',
    description: 'Verify converted P&IDs against engineering standards and best practices',
    icon: ClipboardDocumentCheckIcon,
    color: 'from-teal-500 to-cyan-500',
    accuracy: '98.5%',
    details: [
      'Standards compliance check',
      'Connection verification',
      'Loop integrity validation',
      'Safety system review'
    ]
  },
  {
    id: 'customization',
    title: 'Customization Engine',
    description: 'Configure conversion rules to match your company standards and preferences',
    icon: Cog6ToothIcon,
    color: 'from-yellow-500 to-orange-500',
    accuracy: '100%',
    details: [
      'Custom symbol libraries',
      'Tagging conventions',
      'Line spec templates',
      'Company standard rules'
    ]
  }
]

/**
 * Conversion Process Steps
 */
export const CONVERSION_STEPS = [
  {
    id: 'upload-pfd',
    step: 1,
    title: 'Upload PFD',
    description: 'Upload your Process Flow Diagram in supported formats',
    icon: CloudArrowUpIcon,
    estimatedTime: '< 1 min',
    actions: ['Upload PDF or image', 'Enter project details', 'Select conversion options', 'Configure preferences']
  },
  {
    id: 'analysis',
    step: 2,
    title: 'PFD Analysis',
    description: 'AI analyzes and extracts all elements from your PFD',
    icon: DocumentArrowUpIcon,
    estimatedTime: '2-3 min',
    actions: ['Equipment identification', 'Stream extraction', 'Connection mapping', 'Data extraction']
  },
  {
    id: 'conversion',
    step: 3,
    title: 'AI Conversion',
    description: 'Transform PFD elements into detailed P&ID components',
    icon: SparklesIcon,
    estimatedTime: '5-8 min',
    actions: ['Symbol transformation', 'Instrumentation addition', 'Piping detail generation', 'Tag assignment']
  },
  {
    id: 'enrichment',
    step: 4,
    title: 'Detail Enrichment',
    description: 'Add comprehensive engineering details and specifications',
    icon: BeakerIcon,
    estimatedTime: '3-5 min',
    actions: ['Control loops', 'Safety devices', 'Utility connections', 'Support equipment']
  },
  {
    id: 'validation',
    step: 5,
    title: 'Validation & QC',
    description: 'Verify and validate the converted P&ID',
    icon: CheckCircleIcon,
    estimatedTime: '2-3 min',
    actions: ['Standards verification', 'Connection checks', 'Loop validation', 'Error detection']
  },
  {
    id: 'export',
    step: 6,
    title: 'Export & Deliver',
    description: 'Export in multiple formats ready for your engineering tools',
    icon: DocumentDuplicateIcon,
    estimatedTime: '< 1 min',
    actions: ['CAD file generation', 'PDF export', 'Data packages', 'Integration files']
  }
]

/**
 * Benefits & ROI
 */
export const PFD_BENEFITS = [
  {
    id: 'time-saving',
    metric: '80%',
    title: 'Time Reduction',
    description: 'Reduce P&ID development time by up to 80%',
    icon: '⚡',
    impact: 'high'
  },
  {
    id: 'accuracy',
    metric: '98%',
    title: 'Conversion Accuracy',
    description: 'Industry-leading AI conversion accuracy',
    icon: '🎯',
    impact: 'high'
  },
  {
    id: 'consistency',
    metric: '100%',
    title: 'Standards Compliance',
    description: 'Perfect compliance with engineering standards',
    icon: '✅',
    impact: 'high'
  },
  {
    id: 'cost-saving',
    metric: '$75K+',
    title: 'Cost Savings',
    description: 'Average savings per major project',
    icon: '💰',
    impact: 'medium'
  },
  {
    id: 'speed',
    metric: '5-10x',
    title: 'Faster Delivery',
    description: 'Complete P&IDs 5-10x faster than manual',
    icon: '🚀',
    impact: 'high'
  },
  {
    id: 'quality',
    metric: '90%',
    title: 'Error Reduction',
    description: 'Reduce design errors and iterations',
    icon: '📈',
    impact: 'medium'
  }
]

/**
 * Conversion Capabilities
 */
export const CONVERSION_CAPABILITIES = [
  {
    id: 'equipment-types',
    category: 'Equipment Recognition',
    items: [
      'Pumps & Compressors',
      'Heat Exchangers',
      'Vessels & Tanks',
      'Reactors',
      'Filters & Separators',
      'Turbines & Generators'
    ]
  },
  {
    id: 'instrumentation',
    category: 'Instrumentation',
    items: [
      'Flow Instruments',
      'Pressure Instruments',
      'Temperature Instruments',
      'Level Instruments',
      'Analytical Instruments',
      'Control Valves'
    ]
  },
  {
    id: 'control-systems',
    category: 'Control Systems',
    items: [
      'PID Controllers',
      'On/Off Control',
      'Cascade Control',
      'Ratio Control',
      'Safety Interlocks',
      'Alarm Systems'
    ]
  },
  {
    id: 'piping-components',
    category: 'Piping Components',
    items: [
      'Manual Valves',
      'Check Valves',
      'Relief Valves',
      'Strainers & Filters',
      'Pipe Fittings',
      'Specialty Items'
    ]
  }
]

/**
 * Output Formats
 */
export const OUTPUT_FORMATS = [
  {
    id: 'autocad-dwg',
    name: 'AutoCAD DWG',
    description: 'Native AutoCAD format with layers and blocks',
    icon: '📐',
    compatibility: 'AutoCAD 2018+',
    popular: true
  },
  {
    id: 'autocad-dxf',
    name: 'AutoCAD DXF',
    description: 'Universal CAD exchange format',
    icon: '🔄',
    compatibility: 'All major CAD systems',
    popular: true
  },
  {
    id: 'pdf',
    name: 'PDF',
    description: 'High-resolution PDF for review and printing',
    icon: '📄',
    compatibility: 'Universal',
    popular: true
  },
  {
    id: 'smartplant',
    name: 'SmartPlant P&ID',
    description: 'Native SmartPlant format',
    icon: '🏭',
    compatibility: 'SmartPlant P&ID',
    popular: false
  },
  {
    id: 'aveva',
    name: 'AVEVA Diagrams',
    description: 'AVEVA Engineering format',
    icon: '⚙️',
    compatibility: 'AVEVA Engineering',
    popular: false
  },
  {
    id: 'data-export',
    name: 'Data Packages',
    description: 'Equipment lists, line lists, instrument indexes',
    icon: '📊',
    compatibility: 'Excel, CSV, JSON',
    popular: true
  }
]

/**
 * Industry Applications
 */
export const INDUSTRY_APPLICATIONS = [
  {
    id: 'oil-gas',
    title: 'Oil & Gas',
    description: 'Upstream, midstream, and downstream facilities',
    icon: '🛢️',
    examples: [
      'Refineries',
      'Gas processing plants',
      'Offshore platforms',
      'Pipeline systems'
    ]
  },
  {
    id: 'chemical',
    title: 'Chemical Processing',
    description: 'Chemical and petrochemical plants',
    icon: '🧪',
    examples: [
      'Chemical reactors',
      'Separation units',
      'Polymer plants',
      'Specialty chemicals'
    ]
  },
  {
    id: 'power',
    title: 'Power Generation',
    description: 'Thermal, nuclear, and renewable power',
    icon: '⚡',
    examples: [
      'Power plants',
      'Cogeneration',
      'Steam systems',
      'Cooling systems'
    ]
  },
  {
    id: 'pharmaceutical',
    title: 'Pharmaceutical',
    description: 'Process and utilities for pharma facilities',
    icon: '💊',
    examples: [
      'API production',
      'Sterile processing',
      'Utilities (WFI, CIP)',
      'Clean rooms'
    ]
  }
]

/**
 * Technical Specifications
 */
export const TECHNICAL_SPECS = {
  inputFormats: ['PDF', 'PNG', 'JPEG', 'TIFF', 'DWG', 'DXF'],
  maxFileSize: '100 MB',
  maxComplexity: '500+ equipment items',
  processingTime: '15-30 minutes per drawing',
  outputFormats: ['DWG', 'DXF', 'PDF', 'SmartPlant', 'AVEVA', 'Data Packages'],
  apiAvailable: true,
  batchProcessing: true,
  cloudBased: true,
  onPremiseOption: true
}

/**
 * Quality Standards
 */
export const QUALITY_STANDARDS = [
  {
    id: 'isa-5-1',
    name: 'ISA-5.1',
    description: 'Instrumentation Symbols and Identification',
    compliance: 'Full'
  },
  {
    id: 'iso-10628',
    name: 'ISO 10628',
    description: 'Flow diagrams for process plants',
    compliance: 'Full'
  },
  {
    id: 'asme-y14',
    name: 'ASME Y14',
    description: 'Engineering drawing standards',
    compliance: 'Full'
  },
  {
    id: 'api-rp',
    name: 'API RP 551',
    description: 'Process measurement instrumentation',
    compliance: 'Partial'
  }
]

/**
 * FAQ
 */
export const PFD_FAQ = [
  {
    id: 'conversion-time',
    question: 'How long does the conversion take?',
    answer: 'Typical conversion takes 15-30 minutes per drawing depending on complexity. Simple PFDs (10-20 equipment items) convert in 10-15 minutes, while complex diagrams (100+ items) may take 30-45 minutes. Batch processing is available for multiple drawings.'
  },
  {
    id: 'manual-review',
    question: 'Do I need to review the converted P&ID?',
    answer: 'Yes, we recommend engineering review of all AI-generated P&IDs. While our AI achieves 98%+ accuracy, human review ensures project-specific requirements are met and catches edge cases. Our system highlights areas that may need attention.'
  },
  {
    id: 'customization',
    question: 'Can I customize the conversion rules?',
    answer: 'Absolutely! You can configure symbol libraries, tagging conventions, line specifications, and company-specific rules. The system learns from your corrections and improves over time for your organization.'
  },
  {
    id: 'cad-formats',
    question: 'What CAD formats do you support?',
    answer: 'We export to AutoCAD DWG/DXF (2018+), SmartPlant P&ID, AVEVA Diagrams, and high-resolution PDF. We can also provide data packages in Excel, CSV, or JSON format. Custom formats available on request.'
  },
  {
    id: 'quality-assurance',
    question: 'How do you ensure quality?',
    answer: 'Our AI includes built-in validation checks for standards compliance, connection integrity, loop validation, and common errors. The system generates a quality report highlighting any issues found and areas requiring engineer attention.'
  },
  {
    id: 'integration',
    question: 'Can it integrate with our existing workflow?',
    answer: 'Yes. We provide API access, direct CAD tool integration, and can connect with PLM/PDM systems. Our team can help set up custom workflows and integrations for your specific engineering environment.'
  }
]

/**
 * Call to Actions
 */
export const PFD_CTA = {
  primary: {
    text: 'Start Converting Now',
    link: '/pfd-upload',
    description: 'Upload your PFD and see the results'
  },
  secondary: {
    text: 'View Sample Conversion',
    link: '/pfd-history',
    description: 'See real conversion examples'
  },
  demo: {
    text: 'Schedule Demo',
    link: '/enquiry',
    description: 'Get a personalized walkthrough'
  },
  documentation: {
    text: 'Read Documentation',
    link: '/documentation',
    description: 'Learn more about the conversion process'
  }
}

/**
 * Helper Functions
 */

/**
 * Calculate conversion time estimate
 */
export const estimateConversionTime = (equipmentCount) => {
  const baseTime = 10 // minutes
  const perItemTime = 0.3 // minutes per equipment
  const totalMinutes = Math.ceil(baseTime + (equipmentCount * perItemTime))
  return totalMinutes <= 60 ? `${totalMinutes} min` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}

/**
 * Get capabilities by category
 */
export const getCapabilitiesByCategory = (categoryName) => {
  return CONVERSION_CAPABILITIES.find(cap => cap.category === categoryName)
}

/**
 * Get high-impact benefits
 */
export const getHighImpactBenefits = () => {
  return PFD_BENEFITS.filter(benefit => benefit.impact === 'high')
}

/**
 * Get popular output formats
 */
export const getPopularFormats = () => {
  return OUTPUT_FORMATS.filter(format => format.popular)
}

/**
 * Get industry by id
 */
export const getIndustryById = (industryId) => {
  return INDUSTRY_APPLICATIONS.find(industry => industry.id === industryId)
}

export default {
  PFD_SERVICE_INFO,
  PFD_FEATURES,
  CONVERSION_STEPS,
  PFD_BENEFITS,
  CONVERSION_CAPABILITIES,
  OUTPUT_FORMATS,
  INDUSTRY_APPLICATIONS,
  TECHNICAL_SPECS,
  QUALITY_STANDARDS,
  PFD_FAQ,
  PFD_CTA,
  estimateConversionTime,
  getCapabilitiesByCategory,
  getHighImpactBenefits,
  getPopularFormats,
  getIndustryById
}
