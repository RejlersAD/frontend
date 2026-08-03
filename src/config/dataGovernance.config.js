/**
 * Data Governance & Analytics Configuration
 * Centralized configuration for Data Governance, Quality, and Analytics services
 * Soft-coded approach for easy maintenance and scalability
 */

import {
  ShieldCheckIcon,
  DocumentCheckIcon,
  ChartBarIcon,
  LockClosedIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  CogIcon,
  ArrowPathIcon,
  FolderOpenIcon,
  DocumentMagnifyingGlassIcon,
  BeakerIcon,
  CloudArrowUpIcon,
  ServerIcon,
  KeyIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

/**
 * Service Information
 */
export const DATA_GOVERNANCE_INFO = {
  id: 'data-governance',
  title: 'Data Governance & Analytics',
  shortTitle: 'Data Governance',
  tagline: 'Enterprise-Grade Data Management & Compliance',
  description: 'Comprehensive data governance framework ensuring data quality, security, and compliance. Establish centralized data management, automated quality checks, access controls, and analytics capabilities across your engineering operations.',
  moduleCode: 'DGOV_MODULE',
  version: '4.2',
  status: 'production',
  lastUpdated: '2026-01-07'
}

/**
 * Core Capabilities
 */
export const GOVERNANCE_CAPABILITIES = [
  {
    id: 'data-quality',
    title: 'Data Quality Management',
    description: 'Automated data quality checks and validation rules',
    icon: CheckBadgeIcon,
    color: 'from-green-500 to-emerald-500',
    features: [
      'Automated quality profiling',
      'Data validation rules',
      'Anomaly detection',
      'Quality scoring & KPIs',
      'Cleansing workflows',
      'Quality monitoring dashboards'
    ],
    metrics: {
      accuracy: '99.5%',
      completeness: '98.2%',
      consistency: '97.8%'
    }
  },
  {
    id: 'data-catalog',
    title: 'Data Catalog & Discovery',
    description: 'Centralized metadata management and data discovery',
    icon: FolderOpenIcon,
    color: 'from-blue-500 to-cyan-500',
    features: [
      'Automated metadata extraction',
      'Business glossary',
      'Data lineage tracking',
      'Search & discovery',
      'Data classification',
      'Impact analysis'
    ],
    metrics: {
      assets: '10,000+',
      coverage: '95%',
      searchTime: '<2s'
    }
  },
  {
    id: 'access-control',
    title: 'Access Control & Security',
    description: 'Role-based access and data security policies',
    icon: LockClosedIcon,
    color: 'from-purple-500 to-pink-500',
    features: [
      'Role-based access control (RBAC)',
      'Data masking & encryption',
      'Access audit trails',
      'Policy enforcement',
      'Sensitive data protection',
      'Compliance monitoring'
    ],
    metrics: {
      security: '100%',
      auditTrail: 'Complete',
      compliance: 'SOC2'
    }
  },
  {
    id: 'data-lineage',
    title: 'Data Lineage & Traceability',
    description: 'End-to-end data flow visualization and impact analysis',
    icon: ArrowPathIcon,
    color: 'from-orange-500 to-red-500',
    features: [
      'Automated lineage capture',
      'Visual flow diagrams',
      'Impact analysis',
      'Change tracking',
      'Dependency mapping',
      'Root cause analysis'
    ],
    metrics: {
      tracking: 'Real-time',
      depth: 'Full chain',
      updates: 'Automatic'
    }
  },
  {
    id: 'compliance',
    title: 'Compliance & Regulatory',
    description: 'Automated compliance monitoring and reporting',
    icon: ShieldCheckIcon,
    color: 'from-yellow-500 to-orange-500',
    features: [
      'Regulatory compliance checks',
      'Policy management',
      'Automated reporting',
      'Audit preparation',
      'Risk assessment',
      'Compliance dashboards'
    ],
    metrics: {
      standards: '15+',
      automation: '90%',
      audits: 'Pass rate 100%'
    }
  },
  {
    id: 'analytics',
    title: 'Advanced Analytics',
    description: 'Self-service analytics and business intelligence',
    icon: ChartBarIcon,
    color: 'from-teal-500 to-cyan-500',
    features: [
      'Self-service BI tools',
      'Custom dashboards',
      'Predictive analytics',
      'Real-time reporting',
      'Data visualization',
      'ML model integration'
    ],
    metrics: {
      users: '500+',
      reports: '1,000+',
      performance: '<5s'
    }
  }
]

/**
 * Implementation Framework
 */
export const GOVERNANCE_FRAMEWORK = [
  {
    id: 'strategy',
    step: 1,
    title: 'Strategy & Assessment',
    description: 'Define governance strategy and assess current state',
    icon: DocumentCheckIcon,
    duration: '2-3 weeks',
    deliverables: [
      'Governance strategy document',
      'Current state assessment',
      'Gap analysis',
      'Roadmap & priorities',
      'Stakeholder alignment'
    ]
  },
  {
    id: 'architecture',
    step: 2,
    title: 'Architecture Design',
    description: 'Design data architecture and governance framework',
    icon: ServerIcon,
    duration: '3-4 weeks',
    deliverables: [
      'Technical architecture',
      'Data models & schemas',
      'Security framework',
      'Integration design',
      'Technology selection'
    ]
  },
  {
    id: 'policies',
    step: 3,
    title: 'Policies & Standards',
    description: 'Establish data policies, standards, and procedures',
    icon: ClipboardDocumentListIcon,
    duration: '2-3 weeks',
    deliverables: [
      'Data policies',
      'Quality standards',
      'Naming conventions',
      'Access control policies',
      'Retention policies'
    ]
  },
  {
    id: 'implementation',
    step: 4,
    title: 'Platform Implementation',
    description: 'Deploy governance tools and integrate systems',
    icon: CogIcon,
    duration: '8-12 weeks',
    deliverables: [
      'Platform deployment',
      'System integrations',
      'Metadata extraction',
      'Quality rules setup',
      'Security configuration'
    ]
  },
  {
    id: 'training',
    step: 5,
    title: 'Training & Adoption',
    description: 'Train teams and drive platform adoption',
    icon: UserGroupIcon,
    duration: '4-6 weeks',
    deliverables: [
      'Training programs',
      'User documentation',
      'Support materials',
      'Change management',
      'Adoption metrics'
    ]
  },
  {
    id: 'optimization',
    step: 6,
    title: 'Monitoring & Optimization',
    description: 'Continuous monitoring and improvement',
    icon: ChartBarIcon,
    duration: 'Ongoing',
    deliverables: [
      'Performance monitoring',
      'Quality reports',
      'Compliance audits',
      'Optimization initiatives',
      'Best practice updates'
    ]
  }
]

/**
 * Key Benefits
 */
export const GOVERNANCE_BENEFITS = [
  {
    id: 'data-quality',
    metric: '40%',
    title: 'Quality Improvement',
    description: 'Increase in data quality scores',
    icon: '✓',
    impact: 'high'
  },
  {
    id: 'decision-speed',
    metric: '60%',
    title: 'Faster Decisions',
    description: 'Reduced time to insights',
    icon: '⚡',
    impact: 'high'
  },
  {
    id: 'risk-reduction',
    metric: '75%',
    title: 'Risk Reduction',
    description: 'Lower compliance and security risks',
    icon: '🛡️',
    impact: 'high'
  },
  {
    id: 'cost-savings',
    metric: '35%',
    title: 'Cost Savings',
    description: 'Reduced data management costs',
    icon: '💰',
    impact: 'medium'
  },
  {
    id: 'productivity',
    metric: '50%',
    title: 'Productivity Gain',
    description: 'Faster data discovery and access',
    icon: '📈',
    impact: 'high'
  },
  {
    id: 'compliance',
    metric: '100%',
    title: 'Compliance',
    description: 'Full regulatory compliance',
    icon: '✅',
    impact: 'critical'
  }
]

/**
 * Data Governance Pillars
 */
export const GOVERNANCE_PILLARS = [
  {
    id: 'people',
    pillar: 'People & Organization',
    icon: '👥',
    components: [
      'Data Governance Council',
      'Data Stewards',
      'Data Owners',
      'Analytics Team',
      'Compliance Officers',
      'Business Users'
    ]
  },
  {
    id: 'process',
    pillar: 'Processes & Policies',
    icon: '📋',
    components: [
      'Data Quality Processes',
      'Access Request Workflow',
      'Issue Resolution Process',
      'Change Management',
      'Audit Procedures',
      'Incident Response'
    ]
  },
  {
    id: 'technology',
    pillar: 'Technology & Tools',
    icon: '🔧',
    components: [
      'Data Catalog Platform',
      'Quality Monitoring Tools',
      'MDM Solutions',
      'BI & Analytics Platforms',
      'Security & Encryption',
      'Workflow Automation'
    ]
  },
  {
    id: 'data',
    pillar: 'Data & Metadata',
    icon: '📊',
    components: [
      'Business Glossary',
      'Data Dictionary',
      'Metadata Repository',
      'Quality Dimensions',
      'Data Models',
      'Lineage Information'
    ]
  }
]

/**
 * Compliance Standards
 */
export const COMPLIANCE_STANDARDS = [
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'EU General Data Protection Regulation',
    region: 'Europe',
    coverage: 'Full'
  },
  {
    id: 'ccpa',
    name: 'CCPA',
    description: 'California Consumer Privacy Act',
    region: 'USA',
    coverage: 'Full'
  },
  {
    id: 'sox',
    name: 'SOX',
    description: 'Sarbanes-Oxley Act',
    region: 'USA',
    coverage: 'Full'
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Health Insurance Portability',
    region: 'USA',
    coverage: 'Healthcare'
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description: 'Information Security Management',
    region: 'Global',
    coverage: 'Full'
  },
  {
    id: 'soc2',
    name: 'SOC 2',
    description: 'Service Organization Control',
    region: 'Global',
    coverage: 'Full'
  }
]

/**
 * Use Cases
 */
export const GOVERNANCE_USE_CASES = [
  {
    id: 'engineering-data',
    title: 'Engineering Data Management',
    industry: 'Oil & Gas',
    challenge: 'Fragmented engineering data across multiple systems with inconsistent quality',
    solution: 'Centralized data catalog with automated quality checks and unified access control',
    results: [
      '95% improvement in data discovery time',
      '40% reduction in data quality issues',
      '100% compliance with industry standards',
      'Single source of truth established'
    ]
  },
  {
    id: 'regulatory-compliance',
    title: 'Regulatory Compliance Automation',
    industry: 'Financial Services',
    challenge: 'Manual compliance reporting consuming 200+ hours monthly',
    solution: 'Automated compliance monitoring with real-time alerts and reporting',
    results: [
      '90% reduction in reporting time',
      'Zero compliance violations',
      'Real-time risk monitoring',
      'Automated audit trails'
    ]
  },
  {
    id: 'data-analytics',
    title: 'Self-Service Analytics Platform',
    industry: 'Manufacturing',
    challenge: 'IT bottleneck for report generation, 2-week turnaround time',
    solution: 'Self-service BI platform with governed data access and pre-built templates',
    results: [
      'From 2 weeks to 2 hours for reports',
      '500+ active business users',
      '1,000+ custom reports created',
      '85% IT workload reduction'
    ]
  }
]

/**
 * Technology Stack
 */
export const TECHNOLOGY_STACK = {
  dataCatalog: ['Collibra', 'Alation', 'Informatica', 'Azure Purview'],
  dataQuality: ['Talend', 'Informatica DQ', 'Great Expectations', 'Ataccama'],
  mdm: ['Informatica MDM', 'Semarchy', 'Reltio', 'Profisee'],
  analytics: ['Power BI', 'Tableau', 'Qlik', 'Looker'],
  dataIntegration: ['Azure Data Factory', 'Talend', 'Informatica', 'Apache Airflow'],
  security: ['Azure AD', 'Okta', 'HashiCorp Vault', 'AWS IAM']
}

/**
 * FAQ
 */
export const GOVERNANCE_FAQ = [
  {
    id: 'what-is-governance',
    question: 'What is data governance and why is it important?',
    answer: 'Data governance is a framework of policies, procedures, and standards that ensure data is managed as a strategic asset. It ensures data quality, security, compliance, and accessibility. For engineering and process industries, it\'s critical for regulatory compliance, operational efficiency, and data-driven decision making. Without governance, organizations face data quality issues, security risks, compliance violations, and inability to trust their data.'
  },
  {
    id: 'implementation-time',
    question: 'How long does it take to implement data governance?',
    answer: 'A comprehensive data governance program typically takes 4-6 months for initial implementation, including strategy, framework setup, tool deployment, and training. However, we use a phased approach starting with high-priority domains. Phase 1 (pilot) can deliver value in 8-10 weeks with critical data domains. Full enterprise rollout depends on organization size and complexity but typically completed within 12-18 months.'
  },
  {
    id: 'roles-responsibilities',
    question: 'What roles are needed for data governance?',
    answer: 'Key roles include: Data Governance Council (executive oversight), Chief Data Officer, Data Stewards (business domain experts), Data Owners (accountable for data quality), Data Custodians (technical management), and Business Users. We help define clear RACI matrices and provide role descriptions. Many organizations start with part-time stewards (10-20% of time) before moving to dedicated roles.'
  },
  {
    id: 'tools-required',
    question: 'What tools and technologies are required?',
    answer: 'Core tools include: Data catalog platform (metadata management), data quality monitoring, MDM solution, BI/analytics tools, and workflow automation. We work with leading platforms like Collibra, Informatica, Alation, Azure Purview, and can integrate with your existing technology stack. Tool selection depends on your requirements, existing infrastructure, and budget. We provide vendor-neutral recommendations.'
  },
  {
    id: 'roi-timeline',
    question: 'What ROI can we expect and when?',
    answer: 'Most organizations see positive ROI within 12-18 months. Typical benefits include 30-40% reduction in data quality issues, 50-60% faster data discovery, 35% lower data management costs, and significant risk reduction. Quick wins in first 3-6 months include improved data discovery, faster reporting, and reduced compliance risks. Full ROI depends on scope and maturity but typically 2-3x investment over 3 years.'
  },
  {
    id: 'change-management',
    question: 'How do you handle organizational change?',
    answer: 'Change management is critical for governance success. We use a structured approach: stakeholder engagement from day one, clear communication of benefits, hands-on training programs, executive sponsorship, quick wins to build momentum, and ongoing support. We establish a center of excellence and champion network to drive adoption. Success metrics track both technical implementation and user adoption to ensure sustainable change.'
  }
]

/**
 * Call to Actions
 */
export const GOVERNANCE_CTA = {
  primary: {
    text: 'Request Assessment',
    link: '/enquiry',
    description: 'Get a free data governance maturity assessment'
  },
  secondary: {
    text: 'View Demo',
    link: '/enquiry',
    description: 'See governance platform in action'
  },
  demo: {
    text: 'Download Framework',
    link: '/enquiry',
    description: 'Get our governance framework guide'
  }
}

/**
 * Helper Functions
 */

/**
 * Get capabilities by category
 */
export const getCapabilitiesByCategory = (category) => {
  return GOVERNANCE_CAPABILITIES.filter(cap => cap.id.includes(category))
}

/**
 * Get critical benefits
 */
export const getCriticalBenefits = () => {
  return GOVERNANCE_BENEFITS.filter(b => b.impact === 'critical' || b.impact === 'high')
}

/**
 * Calculate governance maturity
 */
export const calculateMaturity = (assessment) => {
  const scores = {
    initial: 1,
    managed: 2,
    defined: 3,
    quantified: 4,
    optimized: 5
  }
  return scores[assessment] || 1
}

export default {
  DATA_GOVERNANCE_INFO,
  GOVERNANCE_CAPABILITIES,
  GOVERNANCE_FRAMEWORK,
  GOVERNANCE_BENEFITS,
  GOVERNANCE_PILLARS,
  COMPLIANCE_STANDARDS,
  GOVERNANCE_USE_CASES,
  TECHNOLOGY_STACK,
  GOVERNANCE_FAQ,
  GOVERNANCE_CTA,
  getCapabilitiesByCategory,
  getCriticalBenefits,
  calculateMaturity
}
