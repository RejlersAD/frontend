/**
 * Security Services Configuration
 * Centralized configuration for Cybersecurity & Information Security services
 * Soft-coded approach for easy maintenance and scalability
 */

import {
  ShieldCheckIcon,
  LockClosedIcon,
  FingerPrintIcon,
  EyeIcon,
  BellAlertIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  ServerIcon,
  CloudIcon,
  KeyIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  FireIcon,
  BoltIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'

/**
 * Service Information
 */
export const SECURITY_SERVICE_INFO = {
  id: 'security-services',
  title: 'Cybersecurity & Information Security',
  shortTitle: 'Security Services',
  tagline: 'Enterprise Security Solutions for Critical Infrastructure',
  description: 'Comprehensive cybersecurity services protecting your engineering systems, data, and operations from evolving threats. From security assessments to 24/7 monitoring, incident response, and compliance management - safeguarding your critical assets.',
  moduleCode: 'SEC_MODULE',
  version: '5.1',
  status: 'production',
  lastUpdated: '2026-01-07'
}

/**
 * Security Services
 */
export const SECURITY_SERVICES = [
  {
    id: 'threat-detection',
    title: 'Threat Detection & Monitoring',
    description: '24/7 real-time threat detection and security monitoring',
    icon: EyeIcon,
    color: 'from-red-500 to-orange-500',
    features: [
      'SIEM & log management',
      '24/7 SOC monitoring',
      'Advanced threat analytics',
      'Anomaly detection',
      'Real-time alerts',
      'Threat intelligence integration'
    ],
    metrics: {
      coverage: '24/7',
      detection: '<5 min',
      accuracy: '99.2%'
    }
  },
  {
    id: 'vulnerability-assessment',
    title: 'Vulnerability Assessment & Penetration Testing',
    description: 'Identify and remediate security vulnerabilities',
    icon: ExclamationTriangleIcon,
    color: 'from-orange-500 to-yellow-500',
    features: [
      'Network vulnerability scanning',
      'Application security testing',
      'Penetration testing',
      'API security assessment',
      'Infrastructure audits',
      'Remediation support'
    ],
    metrics: {
      tests: 'Quarterly',
      coverage: '100%',
      remediation: '<30 days'
    }
  },
  {
    id: 'identity-access',
    title: 'Identity & Access Management',
    description: 'Secure identity management and access control',
    icon: FingerPrintIcon,
    color: 'from-blue-500 to-cyan-500',
    features: [
      'Multi-factor authentication (MFA)',
      'Single sign-on (SSO)',
      'Role-based access control',
      'Privileged access management',
      'Identity governance',
      'Zero trust implementation'
    ],
    metrics: {
      mfa: '100%',
      sso: 'Integrated',
      access: 'Least privilege'
    }
  },
  {
    id: 'incident-response',
    title: 'Incident Response & Recovery',
    description: 'Rapid incident response and business continuity',
    icon: BellAlertIcon,
    color: 'from-purple-500 to-pink-500',
    features: [
      '24/7 incident response team',
      'Forensic investigation',
      'Containment & eradication',
      'Recovery procedures',
      'Post-incident analysis',
      'Business continuity planning'
    ],
    metrics: {
      response: '<15 min',
      availability: '99.99%',
      recovery: '<4 hours'
    }
  },
  {
    id: 'compliance-governance',
    title: 'Compliance & Governance',
    description: 'Security compliance and regulatory adherence',
    icon: DocumentCheckIcon,
    color: 'from-green-500 to-emerald-500',
    features: [
      'Compliance assessments',
      'Policy development',
      'Audit preparation',
      'Risk management',
      'Regulatory reporting',
      'Compliance automation'
    ],
    metrics: {
      standards: '20+',
      audits: '100% pass',
      automation: '85%'
    }
  },
  {
    id: 'cloud-security',
    title: 'Cloud Security',
    description: 'Secure cloud infrastructure and applications',
    icon: CloudIcon,
    color: 'from-cyan-500 to-blue-500',
    features: [
      'Cloud security posture management',
      'Container security',
      'Serverless security',
      'Cloud access security broker',
      'Multi-cloud security',
      'Cloud workload protection'
    ],
    metrics: {
      platforms: 'AWS/Azure/GCP',
      monitoring: 'Real-time',
      compliance: 'Full'
    }
  },
  {
    id: 'data-encryption',
    title: 'Data Protection & Encryption',
    description: 'End-to-end data encryption and protection',
    icon: LockClosedIcon,
    color: 'from-indigo-500 to-purple-500',
    features: [
      'Data encryption at rest',
      'Data encryption in transit',
      'Key management (KMS)',
      'Data loss prevention (DLP)',
      'Backup encryption',
      'Database security'
    ],
    metrics: {
      encryption: 'AES-256',
      coverage: '100%',
      keys: 'HSM protected'
    }
  },
  {
    id: 'security-training',
    title: 'Security Awareness & Training',
    description: 'Build security-conscious workforce',
    icon: UserGroupIcon,
    color: 'from-teal-500 to-green-500',
    features: [
      'Security awareness training',
      'Phishing simulations',
      'Role-based training',
      'Security champions program',
      'Compliance training',
      'Continuous education'
    ],
    metrics: {
      completion: '95%',
      phishing: '90% detection',
      frequency: 'Quarterly'
    }
  }
]

/**
 * Security Framework
 */
export const SECURITY_FRAMEWORK = [
  {
    id: 'assessment',
    step: 1,
    title: 'Security Assessment',
    description: 'Comprehensive security posture evaluation',
    icon: DocumentCheckIcon,
    duration: '2-3 weeks',
    activities: [
      'Current state analysis',
      'Vulnerability assessment',
      'Gap analysis',
      'Risk identification',
      'Compliance review'
    ]
  },
  {
    id: 'strategy',
    step: 2,
    title: 'Security Strategy',
    description: 'Develop comprehensive security roadmap',
    icon: ShieldCheckIcon,
    duration: '2-3 weeks',
    activities: [
      'Security architecture design',
      'Technology selection',
      'Policy framework',
      'Implementation roadmap',
      'Budget planning'
    ]
  },
  {
    id: 'implementation',
    step: 3,
    title: 'Security Implementation',
    description: 'Deploy security controls and tools',
    icon: ServerIcon,
    duration: '8-16 weeks',
    activities: [
      'Security tools deployment',
      'Network segmentation',
      'Access control implementation',
      'Encryption deployment',
      'Integration & testing'
    ]
  },
  {
    id: 'monitoring',
    step: 4,
    title: '24/7 Monitoring',
    description: 'Continuous security monitoring and threat detection',
    icon: EyeIcon,
    duration: 'Ongoing',
    activities: [
      'SOC operations',
      'Threat monitoring',
      'Alert management',
      'Incident detection',
      'Response coordination'
    ]
  },
  {
    id: 'improvement',
    step: 5,
    title: 'Continuous Improvement',
    description: 'Regular updates and optimization',
    icon: BoltIcon,
    duration: 'Ongoing',
    activities: [
      'Security testing',
      'Policy updates',
      'Technology upgrades',
      'Training & awareness',
      'Lessons learned'
    ]
  }
]

/**
 * Security Benefits
 */
export const SECURITY_BENEFITS = [
  {
    id: 'threat-prevention',
    metric: '99.9%',
    title: 'Threat Prevention',
    description: 'Success rate in threat prevention',
    icon: '🛡️',
    impact: 'critical'
  },
  {
    id: 'incident-response',
    metric: '<15 min',
    title: 'Response Time',
    description: 'Average incident response time',
    icon: '⚡',
    impact: 'high'
  },
  {
    id: 'compliance',
    metric: '100%',
    title: 'Compliance',
    description: 'Regulatory compliance rate',
    icon: '✅',
    impact: 'critical'
  },
  {
    id: 'cost-reduction',
    metric: '60%',
    title: 'Risk Reduction',
    description: 'Reduction in security incidents',
    icon: '📉',
    impact: 'high'
  },
  {
    id: 'uptime',
    metric: '99.99%',
    title: 'System Uptime',
    description: 'Protected system availability',
    icon: '⚙️',
    impact: 'high'
  },
  {
    id: 'detection',
    metric: '<5 min',
    title: 'Threat Detection',
    description: 'Average threat detection time',
    icon: '👁️',
    impact: 'critical'
  }
]

/**
 * Security Standards & Compliance
 */
export const SECURITY_STANDARDS = [
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description: 'Information Security Management',
    category: 'Framework',
    logo: '🔒'
  },
  {
    id: 'nist',
    name: 'NIST CSF',
    description: 'Cybersecurity Framework',
    category: 'Framework',
    logo: '🏛️'
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    description: 'Service Organization Control',
    category: 'Compliance',
    logo: '✓'
  },
  {
    id: 'pci-dss',
    name: 'PCI DSS',
    description: 'Payment Card Industry',
    category: 'Compliance',
    logo: '💳'
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'Data Protection Regulation',
    category: 'Privacy',
    logo: '🇪🇺'
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Healthcare Data Protection',
    category: 'Privacy',
    logo: '🏥'
  },
  {
    id: 'iec62443',
    name: 'IEC 62443',
    description: 'Industrial Automation Security',
    category: 'Industrial',
    logo: '🏭'
  },
  {
    id: 'nerc-cip',
    name: 'NERC CIP',
    description: 'Critical Infrastructure Protection',
    category: 'Industrial',
    logo: '⚡'
  }
]

/**
 * Threat Landscape
 */
export const THREAT_TYPES = [
  {
    id: 'ransomware',
    threat: 'Ransomware',
    severity: 'Critical',
    frequency: 'High',
    impact: 'Business disruption, data loss',
    protection: [
      'Advanced endpoint protection',
      'Email security gateway',
      'Network segmentation',
      'Offline backups',
      'Incident response plan'
    ]
  },
  {
    id: 'phishing',
    threat: 'Phishing & Social Engineering',
    severity: 'High',
    frequency: 'Very High',
    impact: 'Credential theft, initial access',
    protection: [
      'Email filtering',
      'User awareness training',
      'MFA enforcement',
      'Anti-phishing tools',
      'Simulated attacks'
    ]
  },
  {
    id: 'insider-threat',
    threat: 'Insider Threats',
    severity: 'High',
    frequency: 'Medium',
    impact: 'Data exfiltration, sabotage',
    protection: [
      'User behavior analytics',
      'Privileged access management',
      'Data loss prevention',
      'Access monitoring',
      'Background checks'
    ]
  },
  {
    id: 'apt',
    threat: 'Advanced Persistent Threats',
    severity: 'Critical',
    frequency: 'Medium',
    impact: 'Long-term compromise, espionage',
    protection: [
      'Threat intelligence',
      'Advanced detection',
      'Network monitoring',
      'Segmentation',
      'Incident response'
    ]
  },
  {
    id: 'supply-chain',
    threat: 'Supply Chain Attacks',
    severity: 'High',
    frequency: 'Growing',
    impact: 'Third-party compromise',
    protection: [
      'Vendor security assessment',
      'Software composition analysis',
      'Third-party monitoring',
      'Contractual security',
      'Code signing verification'
    ]
  },
  {
    id: 'ot-scada',
    threat: 'OT/SCADA Attacks',
    severity: 'Critical',
    frequency: 'Increasing',
    impact: 'Operational disruption, safety',
    protection: [
      'OT network isolation',
      'Industrial firewalls',
      'Asset inventory',
      'Patch management',
      'Anomaly detection'
    ]
  }
]

/**
 * Security Architecture Layers
 */
export const SECURITY_LAYERS = [
  {
    layer: 'Perimeter Security',
    icon: '🌐',
    components: [
      'Next-gen Firewalls',
      'Web Application Firewall',
      'DDoS Protection',
      'Email Security Gateway',
      'DNS Security'
    ]
  },
  {
    layer: 'Network Security',
    icon: '🔌',
    components: [
      'Network Segmentation',
      'IDS/IPS',
      'Network Access Control',
      'VPN & Remote Access',
      'Network Monitoring'
    ]
  },
  {
    layer: 'Endpoint Security',
    icon: '💻',
    components: [
      'Endpoint Detection & Response',
      'Antivirus/Antimalware',
      'Device Encryption',
      'Mobile Device Management',
      'Application Control'
    ]
  },
  {
    layer: 'Application Security',
    icon: '📱',
    components: [
      'Secure Development',
      'Code Analysis',
      'API Security',
      'Container Security',
      'Secrets Management'
    ]
  },
  {
    layer: 'Data Security',
    icon: '🔐',
    components: [
      'Data Encryption',
      'Key Management',
      'Data Loss Prevention',
      'Database Security',
      'Backup Encryption'
    ]
  },
  {
    layer: 'Identity & Access',
    icon: '👤',
    components: [
      'Multi-Factor Authentication',
      'Single Sign-On',
      'Privileged Access',
      'Identity Governance',
      'Zero Trust'
    ]
  }
]

/**
 * Use Cases
 */
export const SECURITY_USE_CASES = [
  {
    id: 'oil-gas-security',
    title: 'Oil & Gas SCADA Security',
    industry: 'Oil & Gas',
    challenge: 'Critical SCADA systems vulnerable to cyber attacks with potential safety impacts',
    solution: 'Implemented OT security with network segmentation, industrial firewalls, and 24/7 monitoring',
    results: [
      'Zero security incidents in 24 months',
      '100% IEC 62443 compliance',
      'Real-time threat detection',
      'No operational disruptions'
    ],
    duration: '6 months'
  },
  {
    id: 'ransomware-prevention',
    title: 'Ransomware Attack Prevention',
    industry: 'Manufacturing',
    challenge: 'Multiple ransomware attempts targeting production systems',
    solution: 'Deployed advanced endpoint protection, email security, and offline backups',
    results: [
      '100% ransomware prevention',
      'Zero successful attacks',
      '95% phishing detection',
      '$5M+ potential loss prevented'
    ],
    duration: '4 months'
  },
  {
    id: 'compliance-audit',
    title: 'SOC 2 Compliance Achievement',
    industry: 'Technology',
    challenge: 'Failed initial SOC 2 audit with 47 findings',
    solution: 'Comprehensive security program with controls, policies, and continuous monitoring',
    results: [
      'SOC 2 Type II certification',
      'Zero audit findings',
      'Automated compliance',
      'Customer confidence restored'
    ],
    duration: '8 months'
  }
]

/**
 * FAQ
 */
export const SECURITY_FAQ = [
  {
    id: 'soc-service',
    question: 'What is included in 24/7 SOC monitoring?',
    answer: 'Our Security Operations Center provides round-the-clock monitoring of your entire IT infrastructure including networks, endpoints, applications, and cloud environments. Services include real-time threat detection using SIEM, log analysis, alert triage, incident investigation, threat hunting, and immediate response. We monitor for over 1,000 threat indicators and provide detailed incident reports with recommended actions.'
  },
  {
    id: 'response-time',
    question: 'What are your incident response times?',
    answer: 'Our SLAs guarantee: Critical incidents (P1) - 15 minutes initial response, 1 hour containment; High priority (P2) - 1 hour response, 4 hours containment; Medium (P3) - 4 hours response, 24 hours resolution. We maintain a dedicated incident response team available 24/7 with average actual response times of 8 minutes for critical incidents. All incidents include forensic analysis and detailed post-incident reports.'
  },
  {
    id: 'compliance-support',
    question: 'Which compliance standards do you support?',
    answer: 'We support 20+ security and compliance standards including ISO 27001, SOC 2 Type II, PCI DSS, GDPR, HIPAA, NIST CSF, IEC 62443, NERC CIP, and industry-specific regulations. Services include gap assessments, control implementation, policy development, audit preparation, continuous compliance monitoring, and automated reporting. We maintain our own ISO 27001 and SOC 2 certifications.'
  },
  {
    id: 'ot-scada',
    question: 'Do you have experience with OT/SCADA security?',
    answer: 'Yes, we specialize in operational technology and industrial control systems security. Our team includes certified IEC 62443 professionals with experience in oil & gas, power generation, and manufacturing. We provide OT security assessments, network segmentation, industrial firewall deployment, anomaly detection for SCADA/DCS systems, and compliance with NERC CIP and IEC 62443 standards.'
  },
  {
    id: 'cost',
    question: 'How is security service priced?',
    answer: 'We offer flexible pricing models: (1) Managed Security Services - monthly subscription based on asset count and service level; (2) Project-Based - fixed price for assessments, implementations, audits; (3) Retainer - monthly hours for advisory and support; (4) Incident Response - on-demand with priority access. Most clients start with assessment ($15K-50K) then move to managed services ($5K-25K/month depending on size). ROI typically achieved within 12-18 months.'
  },
  {
    id: 'implementation',
    question: 'How long does security implementation take?',
    answer: 'Timeline varies by scope: Security assessment (2-3 weeks), Quick wins implementation (4-6 weeks), Comprehensive program (3-6 months), Full enterprise rollout (6-12 months). We use phased approach starting with highest-risk areas. Basic 24/7 monitoring can be operational in 2 weeks. Most critical controls deployed within first 8 weeks. We prioritize based on risk assessment to deliver immediate value.'
  }
]

/**
 * Call to Actions
 */
export const SECURITY_CTA = {
  primary: {
    text: 'Request Security Assessment',
    link: '/enquiry',
    description: 'Get a free cybersecurity risk assessment'
  },
  secondary: {
    text: 'Contact Security Team',
    link: '/enquiry',
    description: '24/7 security hotline available'
  },
  demo: {
    text: 'View SOC Demo',
    link: '/enquiry',
    description: 'See our Security Operations Center'
  }
}

/**
 * Helper Functions
 */

/**
 * Get critical services
 */
export const getCriticalServices = () => {
  return SECURITY_SERVICES.filter(s => 
    ['threat-detection', 'incident-response', 'identity-access'].includes(s.id)
  )
}

/**
 * Calculate risk score
 */
export const calculateRiskScore = (vulnerabilities, threats, controls) => {
  const baseScore = (vulnerabilities * threats) / controls
  return Math.min(Math.round(baseScore * 10), 100)
}

/**
 * Get compliance standards by category
 */
export const getStandardsByCategory = (category) => {
  return SECURITY_STANDARDS.filter(std => std.category === category)
}

export default {
  SECURITY_SERVICE_INFO,
  SECURITY_SERVICES,
  SECURITY_FRAMEWORK,
  SECURITY_BENEFITS,
  SECURITY_STANDARDS,
  THREAT_TYPES,
  SECURITY_LAYERS,
  SECURITY_USE_CASES,
  SECURITY_FAQ,
  SECURITY_CTA,
  getCriticalServices,
  calculateRiskScore,
  getStandardsByCategory
}
