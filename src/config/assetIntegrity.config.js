/**
 * Asset Integrity Service Configuration
 * Centralized configuration for Asset Integrity Management service
 * Soft-coded approach for easy maintenance and scalability
 */

import {
  ShieldCheckIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  DocumentMagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  CpuChipIcon,
  ClockIcon,
  DocumentTextIcon,
  CogIcon
} from '@heroicons/react/24/outline'

/**
 * Service Information
 */
export const ASSET_SERVICE_INFO = {
  id: 'asset-integrity',
  title: 'Asset Integrity Management',
  shortTitle: 'Asset Integrity',
  tagline: 'AI-Powered Predictive Maintenance & Asset Performance Optimization',
  description: 'Comprehensive asset integrity management solution powered by AI and IoT. Monitor equipment health, predict failures before they happen, optimize maintenance schedules, and ensure regulatory compliance across your entire facility.',
  moduleCode: 'ASSET_MODULE',
  version: '3.5',
  status: 'production',
  lastUpdated: '2026-01-07'
}

/**
 * Key Features
 */
export const ASSET_FEATURES = [
  {
    id: 'predictive-analytics',
    title: 'Predictive Analytics',
    description: 'AI-powered prediction of equipment failures and performance degradation',
    icon: ArrowTrendingUpIcon,
    color: 'from-blue-500 to-cyan-500',
    accuracy: '95.3%',
    details: [
      'Machine learning failure prediction',
      'Remaining useful life (RUL) estimation',
      'Performance trend analysis',
      'Early warning system'
    ]
  },
  {
    id: 'condition-monitoring',
    title: 'Condition Monitoring',
    description: 'Real-time monitoring of critical equipment and asset health indicators',
    icon: ChartBarIcon,
    color: 'from-purple-500 to-pink-500',
    accuracy: '99.1%',
    details: [
      'IoT sensor integration',
      'Real-time data collection',
      'Threshold-based alerts',
      'Historical data analysis'
    ]
  },
  {
    id: 'inspection-management',
    title: 'Inspection Management',
    description: 'Digital inspection workflows with AI-assisted anomaly detection',
    icon: ClipboardDocumentCheckIcon,
    color: 'from-green-500 to-emerald-500',
    accuracy: '97.8%',
    details: [
      'Mobile inspection apps',
      'AI image analysis',
      'Defect classification',
      'Compliance tracking'
    ]
  },
  {
    id: 'maintenance-optimization',
    title: 'Maintenance Optimization',
    description: 'Optimize maintenance schedules based on actual equipment condition',
    icon: WrenchScrewdriverIcon,
    color: 'from-orange-500 to-red-500',
    accuracy: '93.5%',
    details: [
      'Risk-based maintenance',
      'Resource optimization',
      'Work order management',
      'Spare parts forecasting'
    ]
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    description: 'Continuous risk evaluation and mitigation strategy recommendations',
    icon: ExclamationTriangleIcon,
    color: 'from-yellow-500 to-orange-500',
    accuracy: '96.2%',
    details: [
      'Automated risk scoring',
      'Consequence analysis',
      'Mitigation planning',
      'Regulatory compliance'
    ]
  },
  {
    id: 'performance-tracking',
    title: 'Performance Tracking',
    description: 'Track and optimize asset performance and operational efficiency',
    icon: CogIcon,
    color: 'from-teal-500 to-cyan-500',
    accuracy: '98.7%',
    details: [
      'KPI monitoring',
      'OEE calculation',
      'Energy efficiency tracking',
      'Performance benchmarking'
    ]
  }
]

/**
 * Management Process Steps
 */
export const INTEGRITY_PROCESS = [
  {
    id: 'asset-registration',
    step: 1,
    title: 'Asset Registration',
    description: 'Register and catalog all critical assets with specifications',
    icon: DocumentTextIcon,
    estimatedTime: 'One-time',
    actions: ['Equipment inventory', 'Technical specifications', 'Criticality assessment', 'Baseline data collection']
  },
  {
    id: 'monitoring-setup',
    step: 2,
    title: 'Monitoring Setup',
    description: 'Configure sensors, thresholds, and monitoring parameters',
    icon: CpuChipIcon,
    estimatedTime: '1-2 days',
    actions: ['IoT sensor deployment', 'Alert configuration', 'Dashboard setup', 'Integration with SCADA']
  },
  {
    id: 'data-collection',
    step: 3,
    title: 'Data Collection',
    description: 'Continuous collection of equipment health and performance data',
    icon: ChartBarIcon,
    estimatedTime: 'Continuous',
    actions: ['Real-time monitoring', 'Historical data logging', 'Manual inspection data', 'Operator observations']
  },
  {
    id: 'ai-analysis',
    step: 4,
    title: 'AI Analysis',
    description: 'Machine learning models analyze patterns and predict issues',
    icon: CpuChipIcon,
    estimatedTime: 'Real-time',
    actions: ['Anomaly detection', 'Pattern recognition', 'Failure prediction', 'Performance optimization']
  },
  {
    id: 'alert-response',
    step: 5,
    title: 'Alert & Response',
    description: 'Automated alerts and recommended actions for issues',
    icon: BellAlertIcon,
    estimatedTime: 'Immediate',
    actions: ['Smart notifications', 'Priority ranking', 'Action recommendations', 'Work order creation']
  },
  {
    id: 'continuous-improvement',
    step: 6,
    title: 'Optimization',
    description: 'Continuous learning and process improvement',
    icon: ArrowTrendingUpIcon,
    estimatedTime: 'Ongoing',
    actions: ['Model refinement', 'Strategy optimization', 'Performance analysis', 'Best practice updates']
  }
]

/**
 * Benefits & ROI
 */
export const ASSET_BENEFITS = [
  {
    id: 'downtime-reduction',
    metric: '45%',
    title: 'Downtime Reduction',
    description: 'Reduce unplanned downtime through predictive maintenance',
    icon: '⚡',
    impact: 'high'
  },
  {
    id: 'maintenance-savings',
    metric: '30%',
    title: 'Cost Savings',
    description: 'Lower maintenance costs through optimization',
    icon: '💰',
    impact: 'high'
  },
  {
    id: 'asset-life',
    metric: '25%',
    title: 'Extended Life',
    description: 'Extend asset lifespan through better care',
    icon: '📈',
    impact: 'medium'
  },
  {
    id: 'safety',
    metric: '60%',
    title: 'Safety Improvement',
    description: 'Reduce safety incidents through early detection',
    icon: '🛡️',
    impact: 'high'
  },
  {
    id: 'efficiency',
    metric: '20%',
    title: 'OEE Increase',
    description: 'Improve overall equipment effectiveness',
    icon: '⚙️',
    impact: 'medium'
  },
  {
    id: 'compliance',
    metric: '100%',
    title: 'Compliance',
    description: 'Ensure regulatory compliance and auditability',
    icon: '✅',
    impact: 'high'
  }
]

/**
 * Asset Categories
 */
export const ASSET_CATEGORIES = [
  {
    id: 'rotating-equipment',
    category: 'Rotating Equipment',
    items: [
      'Pumps & Compressors',
      'Motors & Drives',
      'Turbines',
      'Fans & Blowers',
      'Gearboxes',
      'Bearings & Seals'
    ]
  },
  {
    id: 'static-equipment',
    category: 'Static Equipment',
    items: [
      'Pressure Vessels',
      'Storage Tanks',
      'Heat Exchangers',
      'Piping Systems',
      'Reactors',
      'Columns & Towers'
    ]
  },
  {
    id: 'instrumentation',
    category: 'Instrumentation & Control',
    items: [
      'Control Valves',
      'Safety Systems',
      'Sensors & Transmitters',
      'Analyzers',
      'DCS/PLC Systems',
      'Emergency Shutdown'
    ]
  },
  {
    id: 'electrical',
    category: 'Electrical Systems',
    items: [
      'Transformers',
      'Switchgear',
      'Circuit Breakers',
      'UPS Systems',
      'Generators',
      'Power Distribution'
    ]
  }
]

/**
 * Monitoring Technologies
 */
export const MONITORING_TECHNOLOGIES = [
  {
    id: 'vibration',
    name: 'Vibration Analysis',
    description: 'Detect mechanical issues in rotating equipment',
    icon: '📊',
    applications: ['Pumps', 'Compressors', 'Motors', 'Turbines']
  },
  {
    id: 'thermography',
    name: 'Infrared Thermography',
    description: 'Identify hot spots and thermal anomalies',
    icon: '🌡️',
    applications: ['Electrical', 'Mechanical', 'Insulation', 'Process']
  },
  {
    id: 'ultrasonic',
    name: 'Ultrasonic Testing',
    description: 'Detect leaks, corrosion, and structural defects',
    icon: '🔊',
    applications: ['Pressure Vessels', 'Piping', 'Tanks', 'Valves']
  },
  {
    id: 'oil-analysis',
    name: 'Oil & Fluid Analysis',
    description: 'Monitor lubricant condition and contamination',
    icon: '🧪',
    applications: ['Hydraulics', 'Lubrication', 'Transformers', 'Gearboxes']
  },
  {
    id: 'corrosion',
    name: 'Corrosion Monitoring',
    description: 'Track corrosion rates and metal loss',
    icon: '🔬',
    applications: ['Piping', 'Vessels', 'Tanks', 'Structures']
  },
  {
    id: 'performance',
    name: 'Performance Monitoring',
    description: 'Track efficiency, throughput, and energy use',
    icon: '⚡',
    applications: ['All Equipment', 'Process Units', 'Utilities', 'Systems']
  }
]

/**
 * Compliance Standards
 */
export const COMPLIANCE_STANDARDS = [
  {
    id: 'api-580',
    name: 'API 580',
    description: 'Risk-Based Inspection',
    category: 'Inspection'
  },
  {
    id: 'api-581',
    name: 'API 581',
    description: 'Risk-Based Inspection Methodology',
    category: 'Inspection'
  },
  {
    id: 'asme-pcc',
    name: 'ASME PCC-3',
    description: 'Inspection Planning Using Risk-Based Methods',
    category: 'Inspection'
  },
  {
    id: 'iso-55000',
    name: 'ISO 55000',
    description: 'Asset Management System',
    category: 'Management'
  },
  {
    id: 'nace',
    name: 'NACE Standards',
    description: 'Corrosion Control and Prevention',
    category: 'Corrosion'
  },
  {
    id: 'osha-psp',
    name: 'OSHA PSM',
    description: 'Process Safety Management',
    category: 'Safety'
  }
]

/**
 * Industry Applications
 */
export const INDUSTRY_USE_CASES = [
  {
    id: 'oil-gas',
    title: 'Oil & Gas',
    description: 'Upstream, midstream, downstream facilities',
    icon: '🛢️',
    challenges: [
      'High-risk environments',
      'Remote locations',
      'Aging infrastructure',
      'Regulatory compliance'
    ]
  },
  {
    id: 'power',
    title: 'Power Generation',
    description: 'Thermal, nuclear, renewable facilities',
    icon: '⚡',
    challenges: [
      'High availability requirements',
      'Critical infrastructure',
      'Safety-critical systems',
      'Environmental regulations'
    ]
  },
  {
    id: 'chemical',
    title: 'Chemical Processing',
    description: 'Chemical and petrochemical plants',
    icon: '🧪',
    challenges: [
      'Corrosive environments',
      'High temperatures',
      'Process variability',
      'Material degradation'
    ]
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing',
    description: 'Discrete and process manufacturing',
    icon: '🏭',
    challenges: [
      'Production efficiency',
      'Quality consistency',
      'Equipment reliability',
      'Maintenance optimization'
    ]
  }
]

/**
 * Technical Specifications
 */
export const TECHNICAL_SPECS = {
  dataFrequency: 'Real-time to daily',
  sensorTypes: ['Vibration', 'Temperature', 'Pressure', 'Flow', 'Level', 'Corrosion'],
  integrations: ['SCADA', 'DCS', 'CMMS', 'ERP', 'Historian', 'IoT Platforms'],
  aiModels: ['LSTM', 'Random Forest', 'XGBoost', 'Neural Networks', 'Anomaly Detection'],
  dataRetention: 'Unlimited historical data',
  reportingFormats: ['PDF', 'Excel', 'PowerBI', 'Tableau', 'Custom Dashboards'],
  apiAvailable: true,
  mobileApps: true,
  cloudBased: true,
  onPremiseOption: true
}

/**
 * FAQ
 */
export const ASSET_FAQ = [
  {
    id: 'implementation-time',
    question: 'How long does implementation take?',
    answer: 'Typical implementation takes 4-8 weeks depending on the number of assets and complexity of integrations. Phase 1 (pilot) can be completed in 2-3 weeks with critical assets. Full rollout includes asset registration, sensor deployment, system integration, and team training.'
  },
  {
    id: 'sensor-requirements',
    question: 'Do I need to install new sensors?',
    answer: 'Not necessarily. We can work with your existing sensors and monitoring systems. However, adding strategic sensors can significantly improve prediction accuracy. We conduct an assessment to recommend optimal sensor placement for your critical assets.'
  },
  {
    id: 'accuracy',
    question: 'How accurate are the failure predictions?',
    answer: 'Our AI models achieve 90-95% accuracy for failure prediction, depending on asset type and data quality. Accuracy improves over time as the system learns from your specific equipment patterns. Early warnings are typically provided 2-4 weeks before failure.'
  },
  {
    id: 'existing-systems',
    question: 'Can it integrate with our existing systems?',
    answer: 'Yes. We integrate with all major CMMS, ERP, SCADA, DCS, and historian systems including SAP, Maximo, Ellipse, PI System, OSIsoft, and more. Our REST API enables custom integrations with proprietary systems.'
  },
  {
    id: 'roi',
    question: 'What kind of ROI can we expect?',
    answer: 'Most clients see positive ROI within 6-12 months. Typical benefits include 30-45% reduction in unplanned downtime, 20-30% lower maintenance costs, and 15-25% improvement in asset reliability. Actual ROI varies by industry and asset criticality.'
  },
  {
    id: 'data-security',
    question: 'How secure is our operational data?',
    answer: 'We employ enterprise-grade security including end-to-end encryption (TLS 1.3, AES-256), role-based access control, SOC 2 Type II compliance, and can deploy on-premise or in private cloud. All data is isolated per customer with no data sharing.'
  }
]

/**
 * Call to Actions
 */
export const ASSET_CTA = {
  primary: {
    text: 'Start Free Assessment',
    link: '/enquiry',
    description: 'Get a free asset integrity assessment'
  },
  secondary: {
    text: 'View Demo',
    link: '/enquiry',
    description: 'See the platform in action'
  },
  demo: {
    text: 'Schedule Consultation',
    link: '/enquiry',
    description: 'Speak with our asset integrity experts'
  },
  documentation: {
    text: 'Read Documentation',
    link: '/documentation',
    description: 'Learn more about asset integrity management'
  }
}

/**
 * Helper Functions
 */

/**
 * Get high-impact benefits
 */
export const getHighImpactBenefits = () => {
  return ASSET_BENEFITS.filter(benefit => benefit.impact === 'high')
}

/**
 * Get asset categories
 */
export const getAssetCategoryById = (categoryId) => {
  return ASSET_CATEGORIES.find(cat => cat.id === categoryId)
}

/**
 * Calculate potential savings
 */
export const calculateSavings = (maintenanceBudget) => {
  const savingsPercent = 0.30 // 30% savings
  const downtimePercent = 0.45 // 45% downtime reduction
  
  return {
    maintenanceSavings: Math.round(maintenanceBudget * savingsPercent),
    downtimeReduction: downtimePercent * 100
  }
}

/**
 * Get monitoring technologies by application
 */
export const getTechnologiesByApplication = (application) => {
  return MONITORING_TECHNOLOGIES.filter(tech => 
    tech.applications.some(app => app.toLowerCase().includes(application.toLowerCase()))
  )
}

export default {
  ASSET_SERVICE_INFO,
  ASSET_FEATURES,
  INTEGRITY_PROCESS,
  ASSET_BENEFITS,
  ASSET_CATEGORIES,
  MONITORING_TECHNOLOGIES,
  COMPLIANCE_STANDARDS,
  INDUSTRY_USE_CASES,
  TECHNICAL_SPECS,
  ASSET_FAQ,
  ASSET_CTA,
  getHighImpactBenefits,
  getAssetCategoryById,
  calculateSavings,
  getTechnologiesByApplication
}
