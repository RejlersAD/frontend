/**
 * Footer Configuration - REJLERS RADAI
 * Centralized footer content for easy maintenance
 * 
 * SOFT CODING APPROACH:
 * - All footer content defined in one place
 * - Easy to update contact information, links, and services
 * - Consistent footer across all pages
 * - Industry-specific services for Oil & Gas sector
 */

import { REJLERS_COLORS } from './theme.config'

export const FOOTER_CONFIG = {
  // Company Contact Information
  contact: {
    title: 'Contact Us',
    company: 'Rejlers International Engineering Solutions',
    address: {
      building: 'Rejlers Tower, 13th floor',
      street: 'AI Hamdan Street, P.O. Box 39317',
      city: 'Abu Dhabi, United Arab Emirates'
    },
    phone: {
      display: '+971 50 560 6987',
      link: '+971505606987'
    },
    email: {
      display: 'tanzeem.agra@rejlers.ae',
      link: 'mailto:tanzeem.agra@rejlers.ae'
    }
  },

  // Quick Links Section
  quickLinks: {
    title: 'Quick Links',
    links: [
      {
        label: 'Career Opportunities',
        url: 'https://www.rejlers.com/ae/careers/',
        external: true
      },
      {
        label: 'Insights & News',
        url: 'https://www.rejlers.com/ae/newsroom/',
        external: true
      },
      {
        label: 'Contact',
        url: 'https://www.rejlers.com/ae/contact-us/',
        external: true
      },
      {
        label: 'Sign In',
        url: '/login',
        external: false
      },
      {
        label: 'Enquiry',
        url: '/enquiry',
        external: false,
        highlighted: true // Special styling for new link
      }
      // SOFT-CODED: Subscription link disabled for in-house deployment
      // {
      //   label: 'Subscription',
      //   url: '/pricing',
      //   external: false,
      //   highlighted: true
      // }
    ]
  },

  // Oil & Gas Industry Services
  services: {
    title: 'Our Services',
    items: [
      {
        label: 'P&ID Analysis & Verification',
        url: '/services/pid-analysis',
        description: 'AI-powered piping and instrumentation diagram analysis'
      },
      {
        label: 'PFD to P&ID Conversion',
        url: '/services/pfd-conversion',
        description: 'Automated process flow diagram to P&ID conversion'
      },
      {
        label: 'Asset Integrity Management',
        url: '/services/asset-integrity',
        description: 'Digital asset management solutions'
      },
      {
        label: 'Engineering Consulting',
        url: '/services/consulting',
        description: 'Expert engineering consultation services'
      }
    ]
  },

  // Data Security, Governance & Compliance
  compliance: {
    title: 'Data Security & Compliance',
    links: [
      {
        label: 'ISO 27001 Certified',
        url: 'https://www.rejlers.com/ae/quality-certifications/',
        icon: '🔒',
        external: true
      },
      {
        label: 'GDPR Compliance',
        url: '/privacy-policy',
        icon: '✓',
        external: false
      },
      {
        label: 'SOC 2 Type II',
        url: 'https://www.rejlers.com/ae/security-compliance/',
        icon: '🛡️',
        external: true
      },
      {
        label: 'Data Governance Policy',
        url: '/data-governance',
        icon: '📋',
        external: false
      },
      {
        label: 'Security Best Practices',
        url: '/security',
        icon: '🔐',
        external: false
      }
    ]
  },

  // Bottom Bar Links
  bottomBar: {
    copyright: `© ${new Date().getFullYear()} REJLERS AB • Engineering Excellence Since 1942`,
    links: [
      {
        label: 'Privacy Policy',
        url: '/privacy-policy'
      },
      {
        label: 'Terms of Service',
        url: '/terms-of-service'
      },
      {
        label: 'Cookie Settings',
        url: 'https://www.rejlers.com/ae/personal-data/',
        external: true
      },
      {
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/company/rejlers',
        external: true
      }
    ]
  },

  // Styling Configuration
  styling: {
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    accentColor: REJLERS_COLORS.secondary.green.base,
    hoverColor: 'hover:text-[#00a896]',
    borderColor: 'border-gray-700'
  }
}

// Helper function to get footer section
export const getFooterSection = (section) => {
  return FOOTER_CONFIG[section] || null
}

// Helper function to format phone number for tel: link
export const formatPhoneLink = (phone) => {
  return phone.replace(/[\s\-()]/g, '')
}
