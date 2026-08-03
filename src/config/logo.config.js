/**
 * Logo Configuration - REJLERS RADAI
 * Centralized logo paths and settings for easy maintenance
 * Supports multiple logo variants for different use cases
 * 
 * SOFT CODING APPROACH:
 * - All logo paths are defined in one place (this file)
 * - To change the logo across the entire application:
 *   1. Place new logo in: frontend/public/assets/images/
 *   2. Update the path in LOGO_CONFIG.primary.default
 *   3. Update fallback image if needed
 * - No need to search through multiple components
 * - Consistent logo usage across all pages (Home, Header, Privacy Policy, etc.)
 * 
 * CURRENT LOGO: Rejlers_Logo.png (Official Company Logo)
 * Location: /assets/images/rejlers-logo.png
 */

export const LOGO_CONFIG = {
  // Primary logos
  primary: {
    default: '/assets/images/rejlers-logo.png',
    svg: '/assets/images/rejlers-logo.svg',
    horizontal: '/assets/images/rejlers-logo-horizontal.svg',
    alt: 'Rejlers Engineering Solutions'
  },
  
  // Fallback configuration
  fallback: {
    text: 'REJLERS',
    subtext: 'Engineering Intelligence',
    image: '/assets/images/rejlers-logo.png'
  },
  
  // Responsive sizes
  sizes: {
    nav: {
      mobile: 'h-8 w-auto',
      desktop: 'h-9 w-auto'
    },
    hero: {
      mobile: 'h-12 w-auto',
      desktop: 'h-16 w-auto'
    },
    footer: {
      default: 'h-10 w-auto'
    }
  },
  
  // Animation settings
  animation: {
    hover: {
      scale: 'hover:scale-105',
      duration: 'transition-all duration-300'
    }
  }
}

// Logo component helper
export const getLogoPath = (variant = 'default') => {
  return LOGO_CONFIG.primary[variant] || LOGO_CONFIG.primary.default
}

export const getLogoSize = (location = 'nav', breakpoint = 'desktop') => {
  return LOGO_CONFIG.sizes[location]?.[breakpoint] || LOGO_CONFIG.sizes.nav.desktop
}
