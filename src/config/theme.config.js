/**
 * Theme Configuration
 * Official Rejlers Brand Guidelines 2024
 * Source: RejlersBrandGuidelines2024_FINAL.pdf
 * Soft-coded, dynamic, and fully responsive design system
 */

export const REJLERS_COLORS = {
  // Primary Brand Color - Rejlers Deep Blue
  primary: {
    base: '#2B3A55',           // Main brand color - Rejlers Deep Blue (Impact)
    accent: '#617AAD',         // Accent blue for highlights
    complement: '#D3DAEA',     // Light complement for backgrounds
    hover: '#1f2a3d',          // Darker shade for hover states
  },
  
  // Secondary Brand Colors
  secondary: {
    green: {
      base: '#7FCAB5',         // Rejlers Green (Impact)
      accent: '#2AA784',       // Deep green for accents
      complement: '#D4EDE7',   // Light green for backgrounds
    },
    passion: {
      base: '#F6B2BB',         // Rejlers Passion Pink (Impact)
      accent: '#EE767E',       // Deep passion for accents
      complement: '#FCE4E5',   // Light pink for backgrounds
    },
    turbine: {
      base: '#73BDC8',         // Rejlers Turbine Blue (Impact)
      accent: '#0093A3',       // Deep turbine for accents
      complement: '#E3F2F4',   // Light turbine for backgrounds
    },
    graphite: {
      base: '#484d52',         // Rejlers Graphite (Impact)
      accent: '#B1A8A4',       // Light graphite for text
      complement: '#DBDBDC',   // Very light for backgrounds
    }
  },
  
  // Neutral Colors - For layouts and text
  neutral: {
    white: '#ffffff',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',
  },
  
  // Status Colors - Functional UI
  status: {
    success: '#2AA784',        // Using Rejlers Green accent
    warning: '#f59e0b',
    error: '#EE767E',          // Using Rejlers Passion accent
    info: '#617AAD',           // Using Rejlers Deep Blue accent
  }
}

export const BRAND_TEXT = {
  company: 'REJLERS',
  tagline: 'RADAI - AI-Powered Engineering Intelligence',
  vision: 'RADAI by Rejlers Engineering Solutions',
  visionDescription: 'Revolutionizing Oil & Gas engineering workflows with AI-powered P&ID verification, automated compliance checking, and intelligent analysis. Built by Rejlers, a leader in engineering excellence since 1942.',
  founded: 'Since 1942',
  location: 'Abu Dhabi, UAE',
  product: 'RADAI',
  productTagline: 'AI-Powered Engineering Intelligence',
  fullCompanyName: 'Rejlers International Engineering Solutions',
  values: [
    { name: 'Open Source Culture', description: 'We form a learning culture where we willingly share our knowledge and insights' },
    { name: 'Love the Challenge', description: 'We embrace challenges' },
    { name: 'Brilliant Networks', description: 'We build strong professional networks' }
  ]
}

export const TYPOGRAPHY = {
  // Official Rejlers Typography
  fontFamily: {
    primary: 'Helvetica, Arial, sans-serif',              // Body text - Helvetica Now (fallback)
    heading: 'Oswald, Arial Narrow, sans-serif',          // Headlines - Montefiore (fallback: Oswald)
    display: 'Oswald, Arial Narrow, sans-serif',          // Display text
  },
  fontSize: {
    hero: '3.5rem',      // 56px
    h1: '2.5rem',        // 40px
    h2: '2rem',          // 32px
    h3: '1.5rem',        // 24px
    body: '1rem',        // 16px
    small: '0.875rem',   // 14px
  },
  weights: {
    thin: '100',
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  }
}

export const SPACING = {
  section: {
    sm: '5rem',   // 80px
    md: '7.5rem', // 120px
    lg: '10rem',  // 160px
  },
  container: {
    maxWidth: '1280px', // 7xl
    padding: '1rem',    // 16px
  }
}

export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
}

export const ANIMATIONS = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  }
}

// Export complete theme
export const REJLERS_THEME = {
  colors: REJLERS_COLORS,
  brand: BRAND_TEXT,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  breakpoints: BREAKPOINTS,
  animations: ANIMATIONS,
}

export default REJLERS_THEME
