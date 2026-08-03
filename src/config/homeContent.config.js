/**
 * Home Page Content Configuration
 * Smart soft-coded configuration for landing page content
 * Following best practices from salesModule.config.js
 * 
 * @version 1.0.0
 * @created 2024
 * @purpose Centralized home page content management
 */

import { REJLERS_COLORS } from './theme.config';

/**
 * ===========================================
 * HERO SECTION CONFIGURATION
 * ===========================================
 */
export const HERO_CONFIG = {
  badge: {
    icon: '🤖',
    text: 'AI-Powered Engineering Platform',
    gradient: {
      from: REJLERS_COLORS.secondary.green.base,
      to: REJLERS_COLORS.secondary.turbine.base
    }
  },
  
  headline: {
    main: 'Revolutionizing Engineering Workflows',
    subline: 'for Oil & Gas Industry by',
    company: 'Rejlers Engineering Solutions',
    emoji: '⚡'
  },
  
  description: 'Transform your engineering workflows with intelligent P&ID verification, automated compliance checking, seamless collaboration, and AI-powered insights across Finance, Sales, and Quality Management.',
  
  ctas: [
    {
      id: 'primary',
      label: 'Get Started Free',
      icon: '🚀',
      route: '/register',
      type: 'primary',
      gradient: {
        colors: [
          REJLERS_COLORS.secondary.green.base,
          REJLERS_COLORS.secondary.green.accent,
          REJLERS_COLORS.secondary.turbine.base,
          REJLERS_COLORS.secondary.green.base
        ],
        animation: 'gradient 3s linear infinite, glow 2s ease-in-out infinite'
      }
    },
    {
      id: 'secondary',
      label: 'Watch Demo',
      icon: '▶️',
      href: '#features',
      type: 'secondary',
      borderColor: REJLERS_COLORS.secondary.green.base
    }
  ],
  
  trustBadges: [
    {
      id: 'iso',
      icon: 'check',
      label: 'ISO 27001',
      gradient: { from: 'green-400', to: 'green-600' },
      iconColor: 'white'
    },
    {
      id: 'security',
      icon: 'shield',
      label: 'Enterprise Security',
      gradient: { from: 'blue-400', to: 'blue-600' },
      iconColor: 'white'
    },
    {
      id: 'experience',
      icon: 'badge',
      label: '80+ Years Experience',
      value: '80+',
      gradient: REJLERS_COLORS.secondary.green,
      iconColor: 'white'
    }
  ]
};

/**
 * ===========================================
 * PLATFORM STATISTICS
 * ===========================================
 */
export const PLATFORM_STATS = {
  title: 'Trusted by Industry Leaders',
  subtitle: 'Real numbers that matter',
  
  metrics: [
    {
      id: 'modules',
      value: '9+',
      label: 'Smart Modules',
      gradient: { from: REJLERS_COLORS.secondary.green.base, to: 'teal-600' },
      icon: '🎯',
      description: 'Comprehensive solutions'
    },
    {
      id: 'features',
      value: '50+',
      label: 'AI Features',
      gradient: { from: 'blue-600', to: 'indigo-600' },
      icon: '🤖',
      description: 'Intelligent automation'
    },
    {
      id: 'accuracy',
      value: '99.8%',
      label: 'Accuracy Rate',
      gradient: { from: 'purple-600', to: 'pink-600' },
      icon: '✨',
      description: 'Verified precision'
    },
    {
      id: 'speed',
      value: '10x',
      label: 'Faster Reviews',
      gradient: { from: 'green-600', to: 'teal-600' },
      icon: '⚡',
      description: 'Efficiency boost'
    }
  ]
};

/**
 * ===========================================
 * MAIN MODULES SHOWCASE
 * ===========================================
 */
export const MODULES_CONFIG = {
  title: 'Comprehensive Engineering & Business Solutions',
  subtitle: 'End-to-end platform covering all aspects of engineering, quality, finance, and sales',
  
  modules: [
    // ============ ENGINEERING MODULES ============
    {
      id: 'pid_verification',
      name: 'P&ID Design Verification',
      description: 'AI-powered engineering review for oil & gas P&ID drawings with comprehensive compliance checking',
      icon: '📋',
      route: '/engineering/process/pid-verification', // SOFT-CODED: redirected from /pid/upload
      category: 'Engineering',
      gradient: { from: 'blue-500', to: 'indigo-600' },
      capabilities: [
        'Equipment & instrumentation verification',
        'Safety systems & PSV isolation compliance',
        'ADNOC / DEP / API / ISA standard checks',
        'Automated report generation'
      ],
      stats: { accuracy: '99.8%', speed: '10x faster' },
      badge: 'Core',
      isNew: false
    },
    {
      id: 'pfd_converter',
      name: 'PFD to P&ID Converter',
      description: 'Intelligent conversion from Process Flow Diagrams to detailed P&IDs with AI-powered enhancements',
      icon: '🔄',
      route: '/pfd/upload',
      category: 'Engineering',
      gradient: { from: 'purple-500', to: 'pink-600' },
      capabilities: [
        'Auto-generate instrumentation & control loops',
        'Intelligent piping & valve specifications',
        'Standards-compliant safety systems',
        'ADNOC DEP & API compliance'
      ],
      stats: { automation: '85%', time: '5x faster' },
      badge: 'AI-Powered',
      isNew: true
    },
    {
      id: 'crs_documents',
      name: 'CRS Document Management',
      description: 'Centralized repository for Company Required Specifications with version control',
      icon: '📑',
      route: '/crs/documents',
      category: 'Document Management',
      gradient: { from: 'emerald-500', to: 'teal-600' },
      capabilities: [
        'Document version control & tracking',
        'Automated compliance verification',
        'Multi-department access management',
        'AI-powered document search'
      ],
      stats: { documents: '1000+', users: '200+' },
      badge: 'Essential',
      isNew: false
    },
    
    // ============ QUALITY & SAFETY ============
    {
      id: 'qhse',
      name: 'QHSE Management',
      description: 'Quality, Health, Safety & Environment management with comprehensive tracking and reporting',
      icon: '🛡️',
      route: '/qhse',
      category: 'Quality & Safety',
      gradient: { from: 'orange-500', to: 'red-600' },
      capabilities: [
        'Incident & hazard reporting',
        'Safety audit management',
        'Compliance tracking',
        'Risk assessment tools'
      ],
      stats: { incidents: '0 target', compliance: '100%' },
      badge: 'Critical',
      isNew: false
    },
    
    // ============ FINANCE MODULE ============
    {
      id: 'finance',
      name: 'Finance & Invoice Management',
      description: 'Comprehensive financial operations with AI-powered invoice processing and analytics',
      icon: '💰',
      route: '/finance',
      category: 'Finance',
      gradient: { from: 'green-500', to: 'emerald-600' },
      capabilities: [
        'Invoice creation & management',
        'Payment tracking & reconciliation',
        'Financial reporting & analytics',
        'Budget management & forecasting'
      ],
      stats: { invoices: 'Automated', accuracy: '99.9%' },
      badge: 'Business',
      isNew: false
    },
    
    // ============ SALES MODULE ============
    {
      id: 'sales',
      name: 'Sales & CRM',
      description: 'Advanced sales management with AI-powered insights, pipeline tracking, and client 360° view',
      icon: '🚀',
      route: '/sales',
      category: 'Sales',
      gradient: { from: 'cyan-500', to: 'blue-600' },
      capabilities: [
        'Client 360° relationship management',
        'Deal pipeline & opportunity tracking',
        'AI-powered sales forecasting',
        'Revenue analytics & insights'
      ],
      stats: { features: '22 sub-features', ai: '4 AI modules' },
      badge: 'AI-Enhanced',
      isNew: true,
      highlight: true // Special highlight for new advanced features
    },
    
    // ============ PROCUREMENT ============
    {
      id: 'procurement',
      name: 'Smart Procurement',
      description: 'Intelligent procurement management with vendor tracking and purchase order automation',
      icon: '📦',
      route: '/procurement',
      category: 'Operations',
      gradient: { from: 'indigo-500', to: 'purple-600' },
      capabilities: [
        'Vendor management & evaluation',
        'Purchase order automation',
        'Budget tracking & approval workflows',
        'Supplier performance analytics'
      ],
      stats: { vendors: 'Centralized', efficiency: '40% faster' },
      badge: 'Smart',
      isNew: false
    },
    
    // ============ PROJECT CONTROL ============
    {
      id: 'project_control',
      name: 'Project Control',
      description: 'Complete project lifecycle management with task tracking and team collaboration',
      icon: '📊',
      route: '/projects',
      category: 'Operations',
      gradient: { from: 'teal-500', to: 'cyan-600' },
      capabilities: [
        'Project planning & scheduling',
        'Resource allocation & tracking',
        'Milestone & deliverable management',
        'Team collaboration tools'
      ],
      stats: { projects: 'Unlimited', tracking: 'Real-time' },
      badge: 'Essential',
      isNew: false
    },
    
    // ============ ADMIN ============
    {
      id: 'admin',
      name: 'Admin Dashboard',
      description: 'System overview, analytics, and comprehensive configuration management',
      icon: '⚙️',
      route: '/admin',
      category: 'Administration',
      gradient: { from: 'amber-500', to: 'orange-600' },
      capabilities: [
        'System health monitoring',
        'Feature usage analytics',
        'Global configuration management',
        'Audit logs & activity tracking'
      ],
      stats: { uptime: '99.9%', monitoring: '24/7' },
      badge: 'Admin Only',
      isNew: false
    }
  ]
};

/**
 * ===========================================
 * KEY FEATURES GRID (4 main highlights)
 * ===========================================
 */
export const KEY_FEATURES = {
  title: 'Intelligent Engineering Solutions',
  subtitle: 'Comprehensive AI-powered tools designed for modern engineering workflows',
  
  features: [
    {
      id: 'pid',
      title: 'P&ID QC', // SOFT-CODED: renamed from 'P&ID Verification'
      description: 'AI-powered compliance checking against ADNOC, Shell DEP, and international standards.',
      icon: 'check-circle',
      gradient: { from: REJLERS_COLORS.secondary.green.base, to: REJLERS_COLORS.secondary.green.accent },
      link: '/engineering/process/pid-verification' // SOFT-CODED: redirected from /pid/upload
    },
    {
      id: 'pfd',
      title: 'PFD to P&ID Conversion',
      description: 'Intelligent conversion with automated symbol recognition and smart placement.',
      icon: 'image',
      gradient: { from: REJLERS_COLORS.primary.accent, to: REJLERS_COLORS.secondary.turbine.accent },
      link: '/pfd/upload'
    },
    {
      id: 'comments',
      title: 'Comment Resolution',
      description: 'Extract and manage comments with real-time collaboration and tracking.',
      icon: 'document',
      gradient: { from: REJLERS_COLORS.secondary.passion.base, to: REJLERS_COLORS.secondary.passion.accent },
      link: '/comments'
    },
    {
      id: 'project',
      title: 'Project Control',
      description: 'Complete lifecycle management with task tracking and team collaboration.',
      icon: 'chart',
      gradient: { from: REJLERS_COLORS.secondary.turbine.base, to: REJLERS_COLORS.secondary.turbine.accent },
      link: '/projects'
    }
  ]
};

/**
 * ===========================================
 * AI CAPABILITIES SHOWCASE
 * ===========================================
 */
export const AI_CAPABILITIES = {
  title: 'Powered by Advanced AI',
  subtitle: 'Cutting-edge machine learning and artificial intelligence across all modules',
  
  capabilities: [
    {
      id: 'vision',
      name: 'Computer Vision',
      description: 'Advanced P&ID symbol recognition and layout analysis',
      icon: '👁️',
      modules: ['P&ID QC', 'PFD Converter'], // SOFT-CODED: renamed from 'P&ID Verification'
      gradient: { from: 'blue-500', to: 'cyan-500' }
    },
    {
      id: 'nlp',
      name: 'Natural Language Processing',
      description: 'Intelligent document parsing and comment extraction',
      icon: '💬',
      modules: ['CRS Documents', 'Comment Resolution'],
      gradient: { from: 'purple-500', to: 'pink-500' }
    },
    {
      id: 'forecasting',
      name: 'Predictive Analytics',
      description: 'Sales forecasting and revenue predictions',
      icon: '📈',
      modules: ['Sales & CRM', 'Finance'],
      gradient: { from: 'green-500', to: 'emerald-500' }
    },
    {
      id: 'insights',
      name: 'Smart Insights',
      description: 'Automated recommendations and decision support',
      icon: '🧠',
      modules: ['All Modules'],
      gradient: { from: 'orange-500', to: 'red-500' }
    }
  ]
};

/**
 * ===========================================
 * CALL TO ACTION CONFIGURATION
 * ===========================================
 */
export const CTA_CONFIG = {
  title: 'Ready to Transform Your Workflow?',
  subtitle: 'Join industry leaders in the UAE who trust Rejlers for engineering excellence',
  
  button: {
    label: 'Start Your Free Trial Today',
    route: '/register',
    icon: '→'
  },
  
  gradient: {
    from: REJLERS_COLORS.secondary.green.base,
    via: 'teal-500',
    to: 'blue-500'
  }
};

/**
 * ===========================================
 * TESTIMONIALS / SOCIAL PROOF
 * ===========================================
 */
export const SOCIAL_PROOF = {
  title: 'Trusted by Engineering Leaders',
  
  stats: [
    { value: '80+', label: 'Years of Engineering Excellence', icon: '🏆' },
    { value: '500+', label: 'Projects Delivered', icon: '📊' },
    { value: '200+', label: 'Active Users', icon: '👥' },
    { value: '99.8%', label: 'Client Satisfaction', icon: '⭐' }
  ]
};

/**
 * ===========================================
 * QUICK LINKS FOR INDUSTRIES
 * ===========================================
 */
export const INDUSTRY_FOCUS = {
  title: 'Oil & Gas Industry Expertise',
  subtitle: 'Specialized solutions for upstream, midstream, and downstream operations',
  
  industries: [
    {
      id: 'upstream',
      name: 'Upstream Operations',
      description: 'Exploration & production engineering',
      icon: '🛢️',
      color: 'blue'
    },
    {
      id: 'midstream',
      name: 'Midstream Processing',
      description: 'Transportation & storage facilities',
      icon: '⚙️',
      color: 'green'
    },
    {
      id: 'downstream',
      name: 'Downstream Refining',
      description: 'Refining & petrochemical plants',
      icon: '🏭',
      color: 'orange'
    },
    {
      id: 'offshore',
      name: 'Offshore Platforms',
      description: 'Marine & offshore facilities',
      icon: '🌊',
      color: 'cyan'
    }
  ]
};

/**
 * ===========================================
 * EXPORT ALL CONFIGURATIONS
 * ===========================================
 */
export default {
  HERO_CONFIG,
  PLATFORM_STATS,
  MODULES_CONFIG,
  KEY_FEATURES,
  AI_CAPABILITIES,
  CTA_CONFIG,
  SOCIAL_PROOF,
  INDUSTRY_FOCUS
};
