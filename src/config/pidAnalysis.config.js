/**
 * PID Analysis Service Configuration
 * Centralized configuration for P&ID Analysis & Verification service
 * Soft-coded approach for easy maintenance and scalability
 */

import {
  DocumentMagnifyingGlassIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

/**
 * Service Information
 */
export const PID_SERVICE_INFO = {
  id: 'pid-analysis',
  title: 'P&ID Analysis & Verification',
  shortTitle: 'P&ID Analysis',
  tagline: 'AI-Powered Piping & Instrumentation Diagram Intelligence',
  description: 'Advanced AI-powered analysis, verification, and quality control for Piping & Instrumentation Diagrams (P&IDs). Ensure compliance, detect errors, and optimize your engineering drawings with unprecedented accuracy.',
  moduleCode: 'PID_MODULE',
  version: '3.0',
  status: 'production',
  lastUpdated: '2026-01-07'
}

/**
 * Key Features
 */
export const PID_FEATURES = [
  {
    id: 'equipment-detection',
    title: 'Equipment Detection',
    description: 'Automatically identify and classify all equipment types including pumps, valves, vessels, heat exchangers, and instruments',
    icon: BeakerIcon,
    color: 'from-blue-500 to-cyan-500',
    accuracy: '99.5%',
    details: [
      'Multi-class equipment recognition',
      'Symbol library matching',
      'Tag number extraction',
      'Equipment specification linking'
    ]
  },
  {
    id: 'line-tracking',
    title: 'Piping Line Tracking',
    description: 'Trace and analyze piping connections, line numbers, and flow directions throughout the entire diagram',
    icon: ArrowPathIcon,
    color: 'from-purple-500 to-pink-500',
    accuracy: '98.2%',
    details: [
      'Automatic line number identification',
      'Connection path tracing',
      'Flow direction analysis',
      'Line specification extraction'
    ]
  },
  {
    id: 'instrument-verification',
    title: 'Instrument Verification',
    description: 'Validate instrument loops, control strategies, and ISA compliance for all instrumentation',
    icon: CpuChipIcon,
    color: 'from-green-500 to-emerald-500',
    accuracy: '99.1%',
    details: [
      'ISA standard compliance check',
      'Loop integrity verification',
      'Tag number validation',
      'I/O list generation'
    ]
  },
  {
    id: 'quality-control',
    title: 'Quality Control',
    description: 'Comprehensive quality checks against industry standards and best practices',
    icon: ShieldCheckIcon,
    color: 'from-orange-500 to-red-500',
    accuracy: '97.8%',
    details: [
      'Standards compliance checking',
      'Drafting quality assessment',
      'Consistency validation',
      'Missing element detection'
    ]
  },
  {
    id: 'data-extraction',
    title: 'Data Extraction',
    description: 'Extract structured data from P&IDs for databases, equipment lists, and line lists',
    icon: DocumentTextIcon,
    color: 'from-teal-500 to-cyan-500',
    accuracy: '99.3%',
    details: [
      'Equipment database generation',
      'Line list compilation',
      'Instrument index creation',
      'Valve schedule extraction'
    ]
  },
  {
    id: 'error-detection',
    title: 'Error Detection',
    description: 'Identify potential errors, inconsistencies, and areas requiring engineer review',
    icon: ExclamationTriangleIcon,
    color: 'from-yellow-500 to-orange-500',
    accuracy: '96.5%',
    details: [
      'Dangling connections',
      'Missing specifications',
      'Inconsistent labeling',
      'Duplicate tag numbers'
    ]
  }
]

/**
 * Analysis Process Steps
 */
export const ANALYSIS_STEPS = [
  {
    id: 'upload',
    step: 1,
    title: 'Upload Drawing',
    description: 'Upload your P&ID in PDF format with metadata',
    icon: CloudArrowUpIcon,
    estimatedTime: '< 1 min',
    actions: ['Drag and drop or select file', 'Enter drawing information', 'Configure analysis options']
  },
  {
    id: 'preprocessing',
    step: 2,
    title: 'Image Preprocessing',
    description: 'AI enhances and prepares the drawing for analysis',
    icon: SparklesIcon,
    estimatedTime: '1-2 min',
    actions: ['Image enhancement', 'Noise reduction', 'Region segmentation', 'Text extraction']
  },
  {
    id: 'detection',
    step: 3,
    title: 'Object Detection',
    description: 'Deep learning models identify all elements',
    icon: DocumentMagnifyingGlassIcon,
    estimatedTime: '2-3 min',
    actions: ['Equipment detection', 'Line tracking', 'Instrument identification', 'Symbol recognition']
  },
  {
    id: 'verification',
    step: 4,
    title: 'Verification & QC',
    description: 'Validate against standards and detect errors',
    icon: ClipboardDocumentCheckIcon,
    estimatedTime: '1-2 min',
    actions: ['Standards compliance', 'Connection verification', 'Quality checks', 'Error detection']
  },
  {
    id: 'reporting',
    step: 5,
    title: 'Report Generation',
    description: 'Comprehensive analysis report with recommendations',
    icon: ChartBarIcon,
    estimatedTime: '< 1 min',
    actions: ['Data compilation', 'Error summary', 'Recommendations', 'Export options']
  }
]

/**
 * Benefits & ROI
 */
export const PID_BENEFITS = [
  {
    id: 'time-saving',
    metric: '70%',
    title: 'Time Reduction',
    description: 'Reduce manual P&ID review time by 70%',
    icon: '⚡',
    impact: 'high'
  },
  {
    id: 'accuracy',
    metric: '99%',
    title: 'Error Detection',
    description: 'Catch 99% of common P&ID errors automatically',
    icon: '🎯',
    impact: 'high'
  },
  {
    id: 'consistency',
    metric: '100%',
    title: 'Standards Compliance',
    description: 'Ensure 100% compliance with chosen standards',
    icon: '✅',
    impact: 'high'
  },
  {
    id: 'cost-saving',
    metric: '$50K+',
    title: 'Cost Savings',
    description: 'Average annual savings per project',
    icon: '💰',
    impact: 'medium'
  },
  {
    id: 'quality',
    metric: '85%',
    title: 'Quality Improvement',
    description: 'Reduce downstream issues by 85%',
    icon: '📈',
    impact: 'high'
  },
  {
    id: 'scalability',
    metric: '10x',
    title: 'Throughput Increase',
    description: 'Process 10x more drawings with same team',
    icon: '🚀',
    impact: 'medium'
  }
]

/**
 * Supported Standards
 */
export const SUPPORTED_STANDARDS = [
  {
    id: 'isa-5-1',
    name: 'ISA-5.1',
    fullName: 'ISA-5.1-2009 (R2019)',
    description: 'Instrumentation Symbols and Identification',
    category: 'Instrumentation',
    compliance: 'Full'
  },
  {
    id: 'iso-10628',
    name: 'ISO 10628',
    fullName: 'ISO 10628-2:2012',
    description: 'Diagrams for the chemical and petrochemical industry',
    category: 'P&ID',
    compliance: 'Full'
  },
  {
    id: 'api-rp-551',
    name: 'API RP 551',
    fullName: 'API Recommended Practice 551',
    description: 'Process Measurement and Control',
    category: 'Process Control',
    compliance: 'Partial'
  },
  {
    id: 'asme-y14-2',
    name: 'ASME Y14.2',
    fullName: 'ASME Y14.2-2014',
    description: 'Line Conventions and Lettering',
    category: 'Drafting',
    compliance: 'Full'
  },
  {
    id: 'din-19227',
    name: 'DIN 19227',
    fullName: 'DIN 19227',
    description: 'Graphical symbols and identifying letters',
    category: 'Instrumentation',
    compliance: 'Full'
  },
  {
    id: 'company-standards',
    name: 'Custom Standards',
    fullName: 'Company-Specific Standards',
    description: 'Upload and verify against your company standards',
    category: 'Custom',
    compliance: 'Configurable'
  }
]

/**
 * Use Cases
 */
export const PID_USE_CASES = [
  {
    id: 'new-design',
    title: 'New Plant Design',
    description: 'Verify P&IDs during design phase to catch errors early',
    industry: 'All',
    scenarios: [
      'Design review automation',
      'Interdisciplinary check',
      'Client deliverable QC',
      'Regulatory submission prep'
    ]
  },
  {
    id: 'brownfield',
    title: 'Brownfield Modifications',
    description: 'Update and verify existing P&IDs for plant modifications',
    industry: 'Oil & Gas, Chemicals',
    scenarios: [
      'As-built verification',
      'Modification impact analysis',
      'Tie-in point identification',
      'Safety system review'
    ]
  },
  {
    id: 'digital-twin',
    title: 'Digital Twin Creation',
    description: 'Extract data to build digital twins of process plants',
    industry: 'All',
    scenarios: [
      'Data extraction for simulation',
      'Asset database population',
      'Maintenance system integration',
      'Operator training systems'
    ]
  },
  {
    id: 'compliance',
    title: 'Compliance Auditing',
    description: 'Ensure drawings meet industry and regulatory standards',
    industry: 'All',
    scenarios: [
      'Pre-submission review',
      'Standards compliance check',
      'Safety system verification',
      'Documentation quality assurance'
    ]
  }
]

/**
 * Technical Specifications
 */
export const TECHNICAL_SPECS = {
  inputFormats: ['PDF', 'High-resolution images (PNG, JPEG, TIFF)'],
  maxFileSize: '50 MB',
  maxResolution: '10,000 x 10,000 pixels',
  processingTime: '5-10 minutes per drawing',
  outputFormats: ['JSON', 'Excel', 'CSV', 'PDF Report'],
  apiAvailable: true,
  batchProcessing: true,
  cloudBased: true,
  onPremiseOption: true
}

/**
 * Pricing Tiers
 */
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: '30-day trial',
    description: 'Perfect for testing and small projects',
    features: [
      '10 drawings per month',
      'Basic analysis features',
      'Email support',
      'Standard processing speed'
    ],
    limitations: [
      'No batch processing',
      'Limited export options'
    ],
    cta: 'Start Free Trial',
    recommended: false
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$499',
    period: 'per month',
    description: 'For engineering teams and consultancies',
    features: [
      '100 drawings per month',
      'All analysis features',
      'Priority support',
      'Fast processing',
      'Batch processing',
      'All export formats',
      'API access'
    ],
    limitations: [],
    cta: 'Subscribe Now',
    recommended: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact sales',
    description: 'For large organizations with high volumes',
    features: [
      'Unlimited drawings',
      'Custom AI model training',
      'Dedicated support',
      'On-premise deployment',
      'Custom integrations',
      'SLA guarantee',
      'Training & onboarding'
    ],
    limitations: [],
    cta: 'Contact Sales',
    recommended: false
  }
]

/**
 * FAQ
 */
export const PID_FAQ = [
  {
    id: 'accuracy',
    question: 'How accurate is the AI analysis?',
    answer: 'Our AI models achieve 98-99.5% accuracy across different element types. Accuracy varies based on drawing quality, complexity, and adherence to standards. We continuously improve models with user feedback.'
  },
  {
    id: 'standards',
    question: 'Which standards do you support?',
    answer: 'We support major international standards including ISA-5.1, ISO 10628, API RP 551, ASME Y14.2, and DIN 19227. We can also configure custom company-specific standards.'
  },
  {
    id: 'time',
    question: 'How long does analysis take?',
    answer: 'Typical analysis takes 5-10 minutes per drawing depending on size and complexity. Batch processing is available for multiple drawings.'
  },
  {
    id: 'formats',
    question: 'What file formats are supported?',
    answer: 'We accept PDF files and high-resolution images (PNG, JPEG, TIFF). Maximum file size is 50MB. For best results, use vector PDFs at 300 DPI or higher.'
  },
  {
    id: 'security',
    question: 'Is my data secure?',
    answer: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are ISO 27001 certified and GDPR compliant. On-premise deployment is available for sensitive projects.'
  },
  {
    id: 'integration',
    question: 'Can I integrate with existing tools?',
    answer: 'Yes. We provide REST API access and can integrate with common engineering tools like AutoCAD, SmartPlant, AVEVA, and enterprise systems via custom integrations.'
  }
]

/**
 * Call to Actions
 */
export const PID_CTA = {
  primary: {
    text: 'Upload & Analyze Now',
    link: '/pid-upload',
    description: 'Start analyzing your P&IDs in minutes'
  },
  secondary: {
    text: 'View Sample Report',
    link: '/pid-report',
    description: 'See what insights you can get'
  },
  demo: {
    text: 'Schedule Demo',
    link: '/enquiry',
    description: 'Get a personalized walkthrough'
  },
  documentation: {
    text: 'Read Documentation',
    link: '/documentation',
    description: 'Learn more about features and API'
  }
}

/**
 * Helper Functions
 */

/**
 * Get features by accuracy threshold
 */
export const getFeaturesByAccuracy = (minAccuracy = 98) => {
  return PID_FEATURES.filter(feature => {
    const accuracy = parseFloat(feature.accuracy)
    return accuracy >= minAccuracy
  })
}

/**
 * Get high-impact benefits
 */
export const getHighImpactBenefits = () => {
  return PID_BENEFITS.filter(benefit => benefit.impact === 'high')
}

/**
 * Get use cases by industry
 */
export const getUseCasesByIndustry = (industry) => {
  return PID_USE_CASES.filter(useCase => 
    useCase.industry === 'All' || useCase.industry.includes(industry)
  )
}

/**
 * Get recommended pricing tier
 */
export const getRecommendedTier = () => {
  return PRICING_TIERS.find(tier => tier.recommended)
}

/**
 * Calculate total processing time
 */
export const calculateProcessingTime = (numDrawings) => {
  const avgTime = 7.5 // minutes per drawing
  const totalMinutes = numDrawings * avgTime
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default {
  PID_SERVICE_INFO,
  PID_FEATURES,
  ANALYSIS_STEPS,
  PID_BENEFITS,
  SUPPORTED_STANDARDS,
  PID_USE_CASES,
  TECHNICAL_SPECS,
  PRICING_TIERS,
  PID_FAQ,
  PID_CTA,
  getFeaturesByAccuracy,
  getHighImpactBenefits,
  getUseCasesByIndustry,
  getRecommendedTier,
  calculateProcessingTime
}
