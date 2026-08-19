/**
 * About Page Configuration
 * Centralized configuration for company information, mission, team, and values
 * Soft-coded approach for easy maintenance and updates
 */

import {
  RocketLaunchIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  GlobeAltIcon,
  SparklesIcon,
  AcademicCapIcon,
  HeartIcon,
  ChartBarIcon,
  BeakerIcon,
  BuildingOfficeIcon,
  TrophyIcon
} from '@heroicons/react/24/outline'

/**
 * Company Information
 */
export const COMPANY_INFO = {
  name: 'RADAI',
  fullName: 'Rejlers Advanced Digital AI',
  tagline: 'AI-Powered Engineering Intelligence',
  foundedYear: 1942,
  parentCompany: 'Rejlers Group',
  headquarters: 'Stockholm, Sweden',
  employees: '2,500+',
  countries: '12+',
  industries: ['Oil & Gas', 'Energy', 'Infrastructure', 'Industry'],
  description: 'RADAI is Rejlers Group\'s cutting-edge AI division, combining 80+ years of engineering excellence with advanced artificial intelligence to revolutionize engineering workflows across industries.',
  vision: 'To be the global leader in AI-powered engineering solutions, transforming how complex engineering projects are designed, executed, and optimized.',
  mission: 'Empower engineering teams with intelligent automation that reduces errors, accelerates delivery, and unlocks unprecedented insights from engineering data.'
}

/**
 * Core Values
 */
export const CORE_VALUES = [
  {
    id: 'innovation',
    title: 'Innovation',
    description: 'We push boundaries with cutting-edge AI and machine learning technologies',
    icon: LightBulbIcon,
    color: 'from-yellow-400 to-orange-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
  },
  {
    id: 'excellence',
    title: 'Excellence',
    description: '80+ years of engineering expertise delivering world-class solutions',
    icon: TrophyIcon,
    color: 'from-purple-400 to-pink-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20'
  },
  {
    id: 'reliability',
    title: 'Reliability',
    description: 'Enterprise-grade solutions you can trust for mission-critical projects',
    icon: ShieldCheckIcon,
    color: 'from-green-400 to-emerald-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    description: 'Partnering closely with clients to understand and solve their challenges',
    icon: UserGroupIcon,
    color: 'from-blue-400 to-cyan-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  {
    id: 'sustainability',
    title: 'Sustainability',
    description: 'Building efficient solutions that reduce waste and environmental impact',
    icon: GlobeAltIcon,
    color: 'from-teal-400 to-green-500',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20'
  },
  {
    id: 'integrity',
    title: 'Integrity',
    description: 'Operating with transparency, ethics, and accountability in everything we do',
    icon: HeartIcon,
    color: 'from-red-400 to-pink-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20'
  }
]

/**
 * Timeline / Milestones
 */
export const MILESTONES = [
  {
    year: '1942',
    title: 'Rejlers Founded',
    description: 'Rejlers established as an engineering consultancy in Sweden',
    icon: BuildingOfficeIcon,
    type: 'foundation'
  },
  {
    year: '2010',
    title: 'Digital Transformation',
    description: 'Began investing heavily in digital engineering tools and automation',
    icon: SparklesIcon,
    type: 'innovation'
  },
  {
    year: '2018',
    title: 'AI Research Initiated',
    description: 'Launched dedicated AI research division for engineering applications',
    icon: BeakerIcon,
    type: 'research'
  },
  {
    year: '2022',
    title: 'RADAI Platform Launch',
    description: 'Released first version of RADAI platform for PFD digitization',
    icon: RocketLaunchIcon,
    type: 'product'
  },
  {
    year: '2024',
    title: 'AI-Powered P&ID',
    description: 'Introduced advanced AI-assisted P&ID creation and automation',
    icon: SparklesIcon,
    type: 'innovation'
  },
  {
    year: '2025',
    title: 'Global Expansion',
    description: 'Expanded to 50+ clients across 12 countries worldwide',
    icon: GlobeAltIcon,
    type: 'growth'
  },
  {
    year: '2026',
    title: 'Full Suite Release',
    description: 'Complete engineering intelligence platform with 8+ AI solutions',
    icon: RocketLaunchIcon,
    type: 'product'
  }
]

/**
 * Statistics
 */
export const COMPANY_STATS = [
  {
    id: 'experience',
    value: '80+',
    label: 'Years Experience',
    description: 'Engineering excellence since 1942',
    icon: '🏆'
  },
  {
    id: 'countries',
    value: '12+',
    label: 'Countries',
    description: 'Global presence and reach',
    icon: '🌍'
  },
  {
    id: 'accuracy',
    value: '99.5%',
    label: 'AI Accuracy',
    description: 'Industry-leading precision',
    icon: '🎯'
  },
  {
    id: 'time-saved',
    value: '70%',
    label: 'Time Reduction',
    description: 'Average efficiency gain',
    icon: '⚡'
  }
]

/**
 * Expertise Areas
 */
export const EXPERTISE_AREAS = [
  {
    id: 'ai-ml',
    title: 'Artificial Intelligence & Machine Learning',
    description: 'Deep learning, computer vision, NLP, and predictive analytics',
    icon: SparklesIcon,
    technologies: ['TensorFlow', 'PyTorch', 'OpenCV', 'Scikit-learn'],
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'engineering',
    title: 'Engineering Design',
    description: 'Process, mechanical, piping, instrumentation, and electrical engineering',
    icon: BeakerIcon,
    technologies: ['AutoCAD', 'P&ID', 'PFD', '3D Modeling'],
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'data-science',
    title: 'Data Science & Analytics',
    description: 'Big data processing, predictive modeling, and business intelligence',
    icon: ChartBarIcon,
    technologies: ['Python', 'R', 'SQL', 'Power BI'],
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 'cloud-infrastructure',
    title: 'Cloud Infrastructure',
    description: 'Scalable, secure cloud solutions and DevOps practices',
    icon: GlobeAltIcon,
    technologies: ['AWS', 'Azure', 'Docker', 'Kubernetes'],
    color: 'from-green-500 to-emerald-500'
  }
]

/**
 * Team Structure (Can be extended with actual team members)
 */
export const TEAM_DEPARTMENTS = [
  {
    id: 'ai-research',
    name: 'AI Research & Development',
    description: 'Pioneering next-generation AI algorithms and models',
    size: '50+',
    icon: BeakerIcon,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'engineering',
    name: 'Engineering Solutions',
    description: 'Domain experts in process, mechanical, and instrumentation engineering',
    size: '150+',
    icon: AcademicCapIcon,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'product',
    name: 'Product & Design',
    description: 'Creating intuitive, user-centered engineering tools',
    size: '30+',
    icon: SparklesIcon,
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 'customer-success',
    name: 'Customer Success',
    description: 'Ensuring clients achieve maximum value from our platform',
    size: '40+',
    icon: UserGroupIcon,
    color: 'from-green-500 to-emerald-500'
  }
]

/**
 * Certifications & Standards
 */
export const CERTIFICATIONS = [
  {
    id: 'iso-9001',
    name: 'ISO 9001:2015',
    description: 'Quality Management Systems',
    category: 'Quality'
  },
  {
    id: 'iso-27001',
    name: 'ISO 27001',
    description: 'Information Security Management',
    category: 'Security'
  },
  {
    id: 'iso-14001',
    name: 'ISO 14001',
    description: 'Environmental Management',
    category: 'Environment'
  },
  {
    id: 'gdpr',
    name: 'GDPR Compliant',
    description: 'European Data Protection',
    category: 'Privacy'
  }
]

/**
 * Industry Recognition
 */
export const AWARDS = [
  {
    year: 2025,
    title: 'AI Innovation Award',
    organization: 'European Engineering Excellence',
    description: 'Recognition for breakthrough AI applications in engineering'
  },
  {
    year: 2024,
    title: 'Digital Transformation Leader',
    organization: 'Oil & Gas Industry Awards',
    description: 'Leading digital transformation in the oil and gas sector'
  },
  {
    year: 2023,
    title: 'Best Engineering Software',
    organization: 'Tech Innovation Summit',
    description: 'Best new engineering automation software platform'
  }
]

/**
 * Contact Information
 */
export const CONTACT_INFO = {
  headquarters: {
    address: 'Rejlers Group Headquarters',
    city: 'Stockholm',
    country: 'Sweden',
    coordinates: { lat: 59.3293, lng: 18.0686 }
  },
  support: {
    email: 'support@radai.rejlers.com',
    phone: '+46 (0)771 78 00 00',
    hours: '24/7 Support Available'
  },
  sales: {
    email: 'sales@radai.rejlers.com',
    phone: '+46 (0)771 78 00 01',
    hours: 'Mon-Fri: 8:00-18:00 CET'
  },
  social: {
    linkedin: 'https://www.linkedin.com/company/rejlers',
    twitter: 'https://twitter.com/rejlers',
    github: 'https://github.com/rejlers'
  }
}

/**
 * Call to Actions
 */
export const ABOUT_CTA = {
  primary: {
    text: 'Start Your Journey',
    link: '/register',
    description: 'Join RADAI and transform your engineering workflow'
  },
  secondary: {
    text: 'View Solutions',
    link: '/solutions',
    description: 'Explore our AI-powered engineering solutions'
  },
  contact: {
    text: 'Contact Us',
    link: '/enquiry',
    description: 'Get in touch with our team'
  }
}

/**
 * Helper Functions
 */

/**
 * Get milestones by type
 */
export const getMilestonesByType = (type) => {
  return MILESTONES.filter(milestone => milestone.type === type)
}

/**
 * Get recent awards (last N years)
 */
export const getRecentAwards = (years = 3) => {
  const currentYear = new Date().getFullYear()
  return AWARDS.filter(award => currentYear - award.year <= years)
}

/**
 * Calculate company age
 */
export const getCompanyAge = () => {
  const currentYear = new Date().getFullYear()
  return currentYear - COMPANY_INFO.foundedYear
}

/**
 * Get core values by category
 */
export const getValuesByIds = (ids) => {
  return CORE_VALUES.filter(value => ids.includes(value.id))
}

export default {
  COMPANY_INFO,
  CORE_VALUES,
  MILESTONES,
  COMPANY_STATS,
  EXPERTISE_AREAS,
  TEAM_DEPARTMENTS,
  CERTIFICATIONS,
  AWARDS,
  CONTACT_INFO,
  ABOUT_CTA,
  getMilestonesByType,
  getRecentAwards,
  getCompanyAge,
  getValuesByIds
}
