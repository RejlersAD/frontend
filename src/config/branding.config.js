/**
 * ========================================
 * RADAI BRANDING CONFIGURATION
 * ========================================
 * Centralized branding system for consistent logo, colors, and messaging
 * across all pages and components of the RADAI platform.
 * 
 * USAGE:
 * import { BRANDING_CONFIG } from '../../config/branding.config'
 * 
 * <h1>{BRANDING_CONFIG.brand.primary}</h1>
 * <div className={BRANDING_CONFIG.colors.gradient.primary}>...</div>
 * 
 * MAINTENANCE:
 * - Update this file to change branding across entire application
 * - Avoid hardcoding brand names or colors in components
 * - Use getLogoPath() utility for logo image paths
 */

export const BRANDING_CONFIG = {
  /**
   * BRAND IDENTITY
   * Core brand names and taglines
   */
  brand: {
    // Primary brand name (displayed prominently)
    primary: 'RADAI',
    
    // Brand subtitle/description
    subtitle: 'AI-Powered Engineering Intelligence',
    
    // Alternative subtitle for compact displays
    subtitleShort: 'AI Platform',
    
    // Full company name
    company: 'Rejlers Engineering Solutions',
    
    // Extended company name (for formal contexts)
    companyFull: 'Rejlers International Engineering Solutions',
    
    // Parent company
    parentCompany: 'REJLERS AB',
    
    // Brand tagline
    tagline: 'Revolutionizing Engineering Workflows for Oil & Gas Industry',
    
    // Extended tagline with company attribution
    taglineExtended: 'Revolutionizing Engineering Workflows for Oil & Gas Industry by Rejlers Engineering Solutions',
    
    // Company establishment year
    established: 'Engineering Excellence Since 1942',
    
    // Platform version (update as needed)
    version: 'v1.0.0'
  },

  /**
   * LOGO CONFIGURATION
   * Logo images and display settings
   */
  logo: {
    // Primary logo (standard display)
    primary: {
      path: '/logo/rejlers-logo.png',
      alt: 'RADAI - Rejlers Engineering Solutions',
      height: '36px',
      width: 'auto'
    },
    
    // Compact logo (for small displays)
    compact: {
      path: '/logo/radai-icon.png',
      alt: 'RADAI Icon',
      height: '32px',
      width: '32px'
    },
    
    // White version (for dark backgrounds)
    white: {
      path: '/logo/rejlers-logo-white.png',
      alt: 'RADAI - Rejlers Engineering Solutions',
      height: '36px',
      width: 'auto'
    },
    
    // Fallback text when logo fails to load
    fallbackText: 'RADAI',
    
    // Logo container styling
    container: {
      background: 'bg-white/95',
      padding: 'p-2',
      borderRadius: 'rounded-xl',
      shadow: 'shadow-md hover:shadow-xl'
    }
  },

  /**
   * COLOR SYSTEM
   * Professional gradients and color schemes
   */
  colors: {
    // Primary gradient (headers, navigation)
    gradient: {
      primary: 'from-slate-900 via-blue-900 to-indigo-900',
      secondary: 'from-blue-600 to-indigo-600',
      accent: 'from-purple-600 to-pink-600',
      success: 'from-green-600 to-emerald-600',
      warning: 'from-yellow-600 to-orange-600',
      danger: 'from-red-600 to-pink-600'
    },
    
    // Brand colors (from Rejlers identity)
    brand: {
      primary: '#00a896',    // Teal
      secondary: '#73bdc8',  // Light blue
      accent: '#7fcab5',     // Mint
      dark: '#1e293b',       // Slate-900
      light: '#f8fafc'       // Slate-50
    },
    
    // Text gradient (for brand name)
    textGradient: {
      primary: 'from-[#00a896] to-[#73bdc8]',
      secondary: 'from-amber-400 to-orange-500',
      accent: 'from-purple-400 to-pink-500'
    },
    
    // Background colors
    background: {
      header: 'bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900',
      sidebar: 'bg-gradient-to-b from-slate-800 to-slate-900',
      page: 'bg-gray-50',
      card: 'bg-white',
      modal: 'bg-white'
    },
    
    // Border colors
    border: {
      light: 'border-white/10',
      medium: 'border-white/20',
      dark: 'border-gray-300'
    },
    
    // Hover effects
    hover: {
      background: 'hover:bg-white/20',
      scale: 'hover:scale-105',
      shadow: 'hover:shadow-xl'
    }
  },

  /**
   * TYPOGRAPHY
   * Font sizes, weights, and styling
   */
  typography: {
    // Brand name styling
    brandName: {
      size: 'text-lg md:text-xl lg:text-2xl',
      weight: 'font-black',
      gradient: 'bg-gradient-to-r from-[#00a896] to-[#73bdc8] bg-clip-text text-transparent',
      letterSpacing: 'tracking-tight'
    },
    
    // Subtitle styling
    subtitle: {
      size: 'text-[9px] md:text-xs',
      weight: 'font-medium',
      color: 'text-blue-200'
    },
    
    // Tagline styling
    tagline: {
      size: 'text-sm md:text-base',
      weight: 'font-semibold',
      color: 'text-gray-600'
    },
    
    // Section heading
    heading: {
      size: 'text-2xl md:text-3xl lg:text-4xl',
      weight: 'font-bold',
      color: 'text-gray-900'
    },
    
    // Body text
    body: {
      size: 'text-base',
      weight: 'font-normal',
      color: 'text-gray-700'
    }
  },

  /**
   * BADGES & CERTIFICATIONS
   * Security and compliance badges
   */
  badges: [
    {
      id: 'iso-27001',
      icon: '🔒',
      text: 'ISO 27001 Certified',
      description: 'Information Security Management',
      color: 'text-green-600'
    },
    {
      id: 'gdpr',
      icon: '✓',
      text: 'GDPR Compliance',
      description: 'Data Protection Regulation',
      color: 'text-blue-600'
    },
    {
      id: 'soc2',
      icon: '🛡️',
      text: 'SOC 2 Type II',
      description: 'Security & Availability',
      color: 'text-purple-600'
    },
    {
      id: 'enterprise',
      icon: '⭐',
      text: 'Enterprise Security',
      description: 'Advanced Protection',
      color: 'text-amber-600'
    }
  ],

  /**
   * KEY STATISTICS
   * Platform performance metrics
   */
  statistics: [
    {
      id: 'accuracy',
      value: '99.8%',
      label: 'Accuracy Rate',
      description: 'Industry-leading precision',
      icon: '🎯',
      color: 'text-green-600'
    },
    {
      id: 'speed',
      value: '10x',
      label: 'Faster Reviews',
      description: 'Accelerated workflows',
      icon: '⚡',
      color: 'text-blue-600'
    },
    {
      id: 'availability',
      value: '24/7',
      label: 'Availability',
      description: 'Always accessible',
      icon: '🌐',
      color: 'text-purple-600'
    },
    {
      id: 'compliance',
      value: '100%',
      label: 'Compliant',
      description: 'Full regulatory adherence',
      icon: '✓',
      color: 'text-emerald-600'
    }
  ],

  /**
   * SERVICES
   * Core platform capabilities
   */
  services: [
    {
      id: 'pid-verification',
      title: 'P&ID Analysis & Verification',
      description: 'Intelligent verification of Piping and Instrumentation Diagrams',
      icon: '📋',
      color: 'from-blue-600 to-indigo-600'
    },
    {
      id: 'pfd-conversion',
      title: 'PFD to P&ID Conversion',
      description: 'Automated conversion with AI-powered accuracy',
      icon: '🔄',
      color: 'from-purple-600 to-pink-600'
    },
    {
      id: 'asset-integrity',
      title: 'Asset Integrity Management',
      description: 'Comprehensive asset lifecycle management',
      icon: '🏭',
      color: 'from-green-600 to-emerald-600'
    },
    {
      id: 'engineering-consulting',
      title: 'Engineering Consulting',
      description: 'Expert guidance for engineering challenges',
      icon: '👷',
      color: 'from-amber-600 to-orange-600'
    }
  ],

  /**
   * CONTACT INFORMATION
   * Company contact details
   */
  contact: {
    // Physical address
    address: {
      building: 'Rejlers Tower, 13th floor',
      street: 'AI Hamdan Street',
      poBox: 'P.O. Box 39317',
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
      full: 'Rejlers Tower, 13th floor, AI Hamdan Street, P.O. Box 39317, Abu Dhabi, United Arab Emirates'
    },
    
    // Phone numbers
    phone: {
      display: '+971 50 560 6987',
      link: 'tel:+971505606987'
    },
    
    // Email addresses
    email: {
      display: 'tanzeem.agra@rejlers.ae',
      link: 'mailto:tanzeem.agra@rejlers.ae',
      support: 'support@radai.ae'
    },
    
    // Social media (optional, add as needed)
    social: {
      linkedin: 'https://www.linkedin.com/company/rejlers',
      twitter: '',
      website: 'https://www.radai.ae'
    }
  },

  /**
   * FOOTER CONFIGURATION
   * Copyright and legal information
   */
  footer: {
    // Primary copyright
    copyright: `© ${new Date().getFullYear()} REJLERS AB • Engineering Excellence Since 1942`,
    
    // Secondary copyright
    copyrightSecondary: `© ${new Date().getFullYear()} RADAI • Rejlers International Engineering Solutions • v1.0.0`,
    
    // Legal links
    legal: [
      { text: 'Privacy Policy', link: '/privacy' },
      { text: 'Terms of Service', link: '/terms' },
      { text: 'Data Governance', link: '/data-governance' }
    ],
    
    // Quick links
    quickLinks: [
      { text: 'About Us', link: '/about' },
      { text: 'Services', link: '/services' },
      { text: 'Contact', link: '/contact' },
      { text: 'Support', link: '/support' }
    ]
  },

  /**
   * PAGE TITLES
   * Standardized page title format
   */
  pageTitles: {
    dashboard: 'RADAI - Admin Dashboard',
    users: 'User Management - RADAI',
    profile: 'Profile - RADAI',
    settings: 'Settings - RADAI',
    login: 'Login - RADAI AI Platform',
    register: 'Register - RADAI AI Platform',
    pidVerification: 'P&ID QC - RADAI', // SOFT-CODED: renamed from 'P&ID Verification'
    pfdConversion: 'PFD to P&ID - RADAI',
    projectControl: 'Project Control - RADAI'
  }
}

/**
 * UTILITY FUNCTIONS
 * Helper functions for branding usage
 */

/**
 * Get full brand title (RADAI - AI-Powered Engineering Intelligence)
 */
export const getFullBrandTitle = () => {
  return `${BRANDING_CONFIG.brand.primary} - ${BRANDING_CONFIG.brand.subtitle}`
}

/**
 * Get compact brand title (RADAI AI Platform)
 */
export const getCompactBrandTitle = () => {
  return `${BRANDING_CONFIG.brand.primary} ${BRANDING_CONFIG.brand.subtitleShort}`
}

/**
 * Get logo path based on theme/context
 * @param {string} variant - 'primary', 'compact', or 'white'
 */
export const getLogoPath = (variant = 'primary') => {
  return BRANDING_CONFIG.logo[variant]?.path || BRANDING_CONFIG.logo.primary.path
}

/**
 * Get page title with RADAI branding
 * @param {string} pageName - Name of the page
 */
export const getPageTitle = (pageName) => {
  return `${pageName} - ${BRANDING_CONFIG.brand.primary}`
}

/**
 * Get copyright text for current year
 * @param {boolean} extended - Include extended version info
 */
export const getCopyrightText = (extended = false) => {
  return extended 
    ? BRANDING_CONFIG.footer.copyrightSecondary 
    : BRANDING_CONFIG.footer.copyright
}

// Export default
export default BRANDING_CONFIG
