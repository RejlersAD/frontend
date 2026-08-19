/**
 * Consulting Services Configuration
 * Centralized configuration for Engineering & Digital Transformation Consulting
 * Soft-coded approach for easy maintenance and scalability
 */

import {
  LightBulbIcon,
  CogIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  AcademicCapIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  DocumentCheckIcon,
  CpuChipIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  BuildingOffice2Icon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  CloudArrowUpIcon,
  ChartPieIcon
} from '@heroicons/react/24/outline'

/**
 * Service Information
 */
export const CONSULTING_SERVICE_INFO = {
  id: 'consulting-services',
  title: 'Engineering & Digital Transformation Consulting',
  shortTitle: 'Consulting Services',
  tagline: 'Expert Guidance for Process Industry Excellence',
  description: 'Strategic consulting services combining deep engineering expertise with cutting-edge digital transformation. We help process industries optimize operations, implement Industry 4.0 technologies, and achieve operational excellence through data-driven insights.',
  moduleCode: 'CONSULT_MODULE',
  version: '2.8',
  status: 'production',
  lastUpdated: '2026-01-07'
}

/**
 * Consulting Service Areas
 */
export const CONSULTING_SERVICES = [
  {
    id: 'digital-transformation',
    title: 'Digital Transformation Strategy',
    description: 'End-to-end digital transformation roadmap and implementation',
    icon: CloudArrowUpIcon,
    color: 'from-blue-500 to-cyan-500',
    details: [
      'Industry 4.0 readiness assessment',
      'Digital roadmap development',
      'Technology selection & architecture',
      'Change management & training',
      'ROI analysis & business case',
      'Implementation support'
    ],
    outcomes: [
      'Clear transformation roadmap',
      'Technology stack selection',
      '30-50% efficiency gains',
      'Reduced operational costs'
    ]
  },
  {
    id: 'process-optimization',
    title: 'Process Optimization',
    description: 'Analyze and optimize your engineering and operational processes',
    icon: ChartBarIcon,
    color: 'from-purple-500 to-pink-500',
    details: [
      'Process mapping & analysis',
      'Bottleneck identification',
      'Workflow optimization',
      'KPI definition & tracking',
      'Performance benchmarking',
      'Continuous improvement programs'
    ],
    outcomes: [
      '25-40% productivity increase',
      'Reduced cycle times',
      'Improved quality metrics',
      'Cost optimization'
    ]
  },
  {
    id: 'ai-ml-implementation',
    title: 'AI & Machine Learning',
    description: 'Implement AI/ML solutions for predictive analytics and automation',
    icon: CpuChipIcon,
    color: 'from-green-500 to-emerald-500',
    details: [
      'Use case identification',
      'Data strategy & preparation',
      'Model development & training',
      'Integration with existing systems',
      'Deployment & monitoring',
      'Continuous model improvement'
    ],
    outcomes: [
      'Predictive maintenance',
      'Quality prediction',
      'Automated decision-making',
      'Reduced downtime'
    ]
  },
  {
    id: 'engineering-standards',
    title: 'Engineering Standards & Best Practices',
    description: 'Develop and implement engineering standards and procedures',
    icon: DocumentCheckIcon,
    color: 'from-orange-500 to-red-500',
    details: [
      'Standards development',
      'Drawing standards (P&ID, PFD)',
      'Design basis documentation',
      'Quality assurance procedures',
      'Compliance frameworks',
      'Document management systems'
    ],
    outcomes: [
      'Standardized workflows',
      'Improved consistency',
      'Regulatory compliance',
      'Faster project delivery'
    ]
  },
  {
    id: 'technology-assessment',
    title: 'Technology Assessment & Selection',
    description: 'Evaluate and select the right technologies for your needs',
    icon: BeakerIcon,
    color: 'from-yellow-500 to-orange-500',
    details: [
      'Technology landscape analysis',
      'Vendor evaluation & selection',
      'Proof of concept (POC)',
      'Risk assessment',
      'Cost-benefit analysis',
      'Implementation planning'
    ],
    outcomes: [
      'Optimal technology fit',
      'Reduced implementation risk',
      'Cost-effective solutions',
      'Vendor partnerships'
    ]
  },
  {
    id: 'change-management',
    title: 'Change Management & Training',
    description: 'Manage organizational change and build internal capabilities',
    icon: AcademicCapIcon,
    color: 'from-teal-500 to-cyan-500',
    details: [
      'Change impact assessment',
      'Stakeholder engagement',
      'Training program development',
      'Knowledge transfer',
      'Adoption tracking',
      'Continuous support'
    ],
    outcomes: [
      'Smooth transitions',
      'High user adoption',
      'Skilled workforce',
      'Sustainable change'
    ]
  }
]

/**
 * Consulting Engagement Models
 */
export const ENGAGEMENT_MODELS = [
  {
    id: 'strategic-advisory',
    title: 'Strategic Advisory',
    description: 'High-level strategic guidance and roadmap development',
    icon: LightBulbIcon,
    duration: '1-3 months',
    deliverables: ['Strategy document', 'Roadmap', 'Business case', 'Recommendations'],
    bestFor: ['Digital transformation planning', 'Technology strategy', 'Process improvement initiatives']
  },
  {
    id: 'implementation-support',
    title: 'Implementation Support',
    description: 'Hands-on implementation and technical guidance',
    icon: WrenchScrewdriverIcon,
    duration: '3-12 months',
    deliverables: ['System configuration', 'Integration', 'Testing', 'Documentation', 'Training'],
    bestFor: ['Technology deployment', 'Process automation', 'System integration']
  },
  {
    id: 'managed-services',
    title: 'Managed Services',
    description: 'Ongoing operational support and continuous improvement',
    icon: CogIcon,
    duration: 'Ongoing',
    deliverables: ['24/7 support', 'Performance monitoring', 'Regular optimization', 'Monthly reports'],
    bestFor: ['Long-term partnerships', 'Continuous improvement', 'Operational excellence']
  },
  {
    id: 'project-based',
    title: 'Project-Based',
    description: 'Fixed-scope projects with defined outcomes',
    icon: RocketLaunchIcon,
    duration: '2-6 months',
    deliverables: ['Project plan', 'Implementation', 'Testing', 'Handover', 'Documentation'],
    bestFor: ['Specific initiatives', 'POC development', 'System upgrades']
  }
]

/**
 * Consulting Process
 */
export const CONSULTING_PROCESS = [
  {
    id: 'discovery',
    step: 1,
    title: 'Discovery & Assessment',
    description: 'Understand your challenges, goals, and current state',
    icon: ClipboardDocumentCheckIcon,
    duration: '1-2 weeks',
    activities: [
      'Stakeholder interviews',
      'Process assessment',
      'Technology audit',
      'Gap analysis',
      'Requirements gathering'
    ]
  },
  {
    id: 'strategy',
    step: 2,
    title: 'Strategy Development',
    description: 'Develop comprehensive strategy and roadmap',
    icon: LightBulbIcon,
    duration: '2-3 weeks',
    activities: [
      'Solution design',
      'Roadmap creation',
      'Resource planning',
      'Risk assessment',
      'Business case development'
    ]
  },
  {
    id: 'planning',
    step: 3,
    title: 'Planning & Design',
    description: 'Detailed planning and solution architecture',
    icon: DocumentCheckIcon,
    duration: '2-4 weeks',
    activities: [
      'Detailed design',
      'Technical specifications',
      'Implementation plan',
      'Change management plan',
      'Success criteria definition'
    ]
  },
  {
    id: 'implementation',
    step: 4,
    title: 'Implementation',
    description: 'Execute the plan with agile methodology',
    icon: CogIcon,
    duration: '8-16 weeks',
    activities: [
      'Phased rollout',
      'System configuration',
      'Integration & testing',
      'Training delivery',
      'Quality assurance'
    ]
  },
  {
    id: 'optimization',
    step: 5,
    title: 'Optimization & Support',
    description: 'Fine-tune and provide ongoing support',
    icon: ArrowPathIcon,
    duration: 'Ongoing',
    activities: [
      'Performance monitoring',
      'User feedback collection',
      'Continuous improvement',
      'Issue resolution',
      'Knowledge transfer'
    ]
  }
]

/**
 * Industry Expertise
 */
export const INDUSTRY_EXPERTISE = [
  {
    id: 'oil-gas',
    industry: 'Oil & Gas',
    icon: '🛢️',
    experience: '15+ years',
    projects: '200+',
    specialties: [
      'Upstream operations',
      'Refining & petrochemicals',
      'Pipeline & transportation',
      'Safety & compliance',
      'Asset integrity management'
    ]
  },
  {
    id: 'power-energy',
    industry: 'Power & Energy',
    icon: '⚡',
    experience: '12+ years',
    projects: '150+',
    specialties: [
      'Thermal power plants',
      'Renewable energy',
      'Nuclear facilities',
      'Grid management',
      'Energy efficiency'
    ]
  },
  {
    id: 'chemical',
    industry: 'Chemical & Pharma',
    icon: '🧪',
    experience: '10+ years',
    projects: '180+',
    specialties: [
      'Batch processing',
      'Continuous operations',
      'Quality systems',
      'Regulatory compliance',
      'Process safety'
    ]
  },
  {
    id: 'manufacturing',
    industry: 'Manufacturing',
    icon: '🏭',
    experience: '8+ years',
    projects: '120+',
    specialties: [
      'Smart manufacturing',
      'Supply chain optimization',
      'Quality control',
      'Production planning',
      'Lean operations'
    ]
  }
]

/**
 * Success Metrics
 */
export const SUCCESS_METRICS = [
  {
    id: 'projects',
    metric: '500+',
    label: 'Projects Delivered',
    icon: '📊',
    description: 'Successful consulting engagements'
  },
  {
    id: 'satisfaction',
    metric: '98%',
    label: 'Client Satisfaction',
    icon: '⭐',
    description: 'Average client satisfaction score'
  },
  {
    id: 'roi',
    metric: '3.5x',
    label: 'Average ROI',
    icon: '💰',
    description: 'Return on consulting investment'
  },
  {
    id: 'time-savings',
    metric: '40%',
    label: 'Time Savings',
    icon: '⏱️',
    description: 'Average project time reduction'
  },
  {
    id: 'cost-reduction',
    metric: '30%',
    label: 'Cost Reduction',
    icon: '📉',
    description: 'Average operational cost savings'
  },
  {
    id: 'uptime',
    metric: '25%',
    label: 'Uptime Improvement',
    icon: '⚙️',
    description: 'Average equipment availability gain'
  }
]

/**
 * Client Success Stories
 */
export const SUCCESS_STORIES = [
  {
    id: 'refinery-optimization',
    title: 'Major Refinery Digital Transformation',
    industry: 'Oil & Gas',
    client: 'Large Integrated Refinery',
    challenge: 'Aging infrastructure, manual processes, and increasing operational costs',
    solution: 'Implemented AI-driven predictive maintenance, automated workflows, and real-time monitoring',
    results: [
      '45% reduction in unplanned downtime',
      '$8M annual cost savings',
      '60% faster engineering workflows',
      'Zero safety incidents post-implementation'
    ],
    duration: '14 months'
  },
  {
    id: 'power-plant-ai',
    title: 'AI-Powered Performance Optimization',
    industry: 'Power Generation',
    client: 'Thermal Power Plant (800 MW)',
    challenge: 'Inefficient operations, high fuel consumption, and frequent equipment failures',
    solution: 'Deployed ML models for combustion optimization, predictive maintenance, and performance monitoring',
    results: [
      '3.2% efficiency improvement',
      '$5M fuel savings annually',
      '70% reduction in forced outages',
      'Extended equipment life by 5 years'
    ],
    duration: '10 months'
  },
  {
    id: 'chemical-compliance',
    title: 'Engineering Standards Implementation',
    industry: 'Chemical Processing',
    client: 'Specialty Chemicals Manufacturer',
    challenge: 'Inconsistent documentation, compliance issues, and quality variations',
    solution: 'Developed comprehensive engineering standards, digital documentation system, and quality framework',
    results: [
      '100% regulatory compliance',
      '50% faster project approvals',
      '35% reduction in rework',
      'Improved audit scores by 40%'
    ],
    duration: '8 months'
  }
]

/**
 * Consultant Expertise Areas
 */
export const EXPERTISE_AREAS = [
  {
    category: 'Process Engineering',
    skills: ['Process simulation', 'Heat & mass balance', 'Process optimization', 'Safety studies', 'Equipment selection']
  },
  {
    category: 'Digital Technologies',
    skills: ['AI/ML', 'IoT & sensors', 'Cloud computing', 'Data analytics', 'Digital twins']
  },
  {
    category: 'Project Management',
    skills: ['Agile methodology', 'Risk management', 'Stakeholder management', 'Budget control', 'Quality assurance']
  },
  {
    category: 'Regulatory Compliance',
    skills: ['API standards', 'ASME codes', 'ISO certifications', 'OSHA compliance', 'Environmental regulations']
  }
]

/**
 * FAQ
 */
export const CONSULTING_FAQ = [
  {
    id: 'engagement-start',
    question: 'How do we start a consulting engagement?',
    answer: 'Start with a free initial consultation where we discuss your challenges and objectives. We then conduct a brief assessment (1-2 weeks) to understand your needs and propose a tailored engagement model. Once agreed, we kick off with the discovery phase, typically within 2 weeks of contract signing.'
  },
  {
    id: 'team-composition',
    question: 'What does a typical consulting team look like?',
    answer: 'Teams are tailored to your project but typically include a Project Manager, Senior Consultant (domain expert), Technical Consultants (2-3), and a Change Management Specialist. For larger engagements, we add Data Scientists, Integration Specialists, and Training Coordinators. All consultants have 10+ years of industry experience.'
  },
  {
    id: 'pricing-model',
    question: 'How is consulting priced?',
    answer: 'We offer flexible pricing models: Time & Materials (hourly/daily rates), Fixed-Price Projects (defined scope), Retainer-Based (monthly fee for ongoing support), and Value-Based (linked to outcomes). Most strategic advisory engagements are fixed-price, while implementation support uses T&M with capped budgets.'
  },
  {
    id: 'deliverables',
    question: 'What deliverables can we expect?',
    answer: 'Deliverables vary by engagement but typically include: Strategy documents, Technical specifications, Implementation roadmaps, Training materials, Documentation, Best practice guides, Performance reports, and Knowledge transfer sessions. All deliverables are reviewed and approved at project milestones.'
  },
  {
    id: 'industry-experience',
    question: 'Do you have experience in our industry?',
    answer: 'We specialize in process industries including Oil & Gas (15+ years), Power Generation (12+ years), Chemicals (10+ years), and Manufacturing (8+ years). Our consultants have worked on 500+ projects across these sectors, with deep expertise in both engineering and digital transformation.'
  },
  {
    id: 'post-engagement',
    question: 'What support is available after the engagement?',
    answer: 'We offer various post-engagement support options: 90-day hypercare support (included), Extended support contracts, On-demand consulting hours, Training refreshers, Performance reviews, and Managed services. Most clients transition to a lightweight retainer for ongoing optimization and support.'
  }
]

/**
 * Call to Actions
 */
export const CONSULTING_CTA = {
  primary: {
    text: 'Schedule Free Consultation',
    link: '/enquiry',
    description: 'Discuss your challenges with our experts'
  },
  secondary: {
    text: 'View Case Studies',
    link: '/enquiry',
    description: 'See our successful projects'
  },
  demo: {
    text: 'Request Proposal',
    link: '/enquiry',
    description: 'Get a tailored consulting proposal'
  }
}

/**
 * Helper Functions
 */

/**
 * Get services by category
 */
export const getServicesByCategory = (category) => {
  // Categories could be: 'strategy', 'implementation', 'optimization'
  return CONSULTING_SERVICES.filter(service => 
    service.id.includes(category)
  )
}

/**
 * Get engagement model by id
 */
export const getEngagementModelById = (id) => {
  return ENGAGEMENT_MODELS.find(model => model.id === id)
}

/**
 * Calculate estimated timeline
 */
export const calculateTimeline = (services) => {
  const baseWeeks = 8
  const perServiceWeeks = 4
  return baseWeeks + (services.length * perServiceWeeks)
}

/**
 * Get relevant expertise for industry
 */
export const getExpertiseForIndustry = (industryId) => {
  return INDUSTRY_EXPERTISE.find(exp => exp.id === industryId)
}

export default {
  CONSULTING_SERVICE_INFO,
  CONSULTING_SERVICES,
  ENGAGEMENT_MODELS,
  CONSULTING_PROCESS,
  INDUSTRY_EXPERTISE,
  SUCCESS_METRICS,
  SUCCESS_STORIES,
  EXPERTISE_AREAS,
  CONSULTING_FAQ,
  CONSULTING_CTA,
  getServicesByCategory,
  getEngagementModelById,
  calculateTimeline,
  getExpertiseForIndustry
}
