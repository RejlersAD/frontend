/**
 * PWA Installation Modal Configuration
 * Soft-coded content for PWA installation experience
 * 
 * @version 1.0.0
 * @created 2026-07-08
 * @purpose Centralized PWA installation content and branding
 */

export const PWA_MODAL_CONFIG = {
  // Modal Header
  header: {
    logo: '/assets/Rejlers_Logo.png', // Professional Rejlers branding
    title: 'Install RADAI',
    subtitle: 'Get instant access from your desktop',
    badge: {
      text: 'One-Click Install',
      gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)'
    }
  },

  // App Information
  appInfo: {
    name: 'RADAI',
    tagline: 'AI-Powered Engineering for Oil & Gas',
    description: 'Transform your workflow with intelligent P&ID verification, automated compliance checking, and real-time collaboration - all from your desktop.',
    publisher: 'Rejlers Abu Dhabi',
    version: '2.0'
  },

  // Installation Steps
  steps: [
    {
      id: 1,
      icon: '📥',
      title: 'One-Click Installation',
      description: 'Click "Install Now" below - the app downloads instantly to your desktop',
      color: '#0ea5e9'
    },
    {
      id: 2,
      icon: '🖥️',
      title: 'Desktop Shortcut Created',
      description: 'RAD AI icon appears in your Start Menu and Desktop with Rejlers branding',
      color: '#2AA784'
    },
    {
      id: 3,
      icon: '⚡',
      title: 'Launch & Work',
      description: 'Open like any desktop app - faster loading, offline access, auto-updates',
      color: '#7FCAB5'
    }
  ],

  // Key Benefits
  benefits: [
    {
      icon: '🚄',
      title: 'Lightning Fast',
      description: 'Cached assets load 5x faster than web',
      metric: '75% faster'
    },
    {
      icon: '🔄',
      title: 'Auto-Updates',
      description: 'Always latest version - no manual updates',
      metric: 'Always current'
    },
    {
      icon: '📴',
      title: 'Works Offline',
      description: 'Access cached data without internet',
      metric: 'Offline ready'
    },
    {
      icon: '🎯',
      title: 'Native Feel',
      description: 'Full-screen, no browser clutter',
      metric: 'Desktop app'
    }
  ],

  // Technical Details (expandable section)
  technicalInfo: {
    size: '~15 MB',
    platform: 'Windows, Mac, Linux',
    requirements: 'Chrome 90+, Edge 90+',
    updates: 'Automatic background sync',
    security: 'HTTPS encrypted, same as web version',
    storage: 'Browser cache (can be cleared anytime)'
  },

  // CTA Buttons
  cta: {
    primary: {
      text: 'Install Now',
      icon: '⚡',
      gradient: 'linear-gradient(135deg, #2AA784, #7FCAB5)'
    },
    secondary: {
      text: 'Maybe Later',
      icon: '⏭️'
    }
  },

  // Trust Signals
  trustSignals: [
    '✓ Same security as web version',
    '✓ No personal data stored locally',
    '✓ Uninstall anytime from Settings',
    '✓ Used by 1,200+ engineers'
  ],

  // Animation Settings
  animations: {
    modalEnter: 'scale(0.95) translateY(20px)',
    modalDuration: '0.3s',
    stepDelay: 0.1, // seconds between each step animation
    benefitDelay: 0.08
  },

  // Theme Colors
  theme: {
    primary: '#2AA784',
    secondary: '#7FCAB5',
    accent: '#0891b2',
    navy: '#2B3A55',
    dark: '#1c2e48'
  }
}

export const PWA_BROWSER_MESSAGES = {
  chrome: 'Click "Install" in the browser prompt that appears next',
  edge: 'Click "Install" in the browser prompt that appears next',
  safari: 'Tap the Share button, then "Add to Home Screen"',
  firefox: 'Click "Install" when prompted',
  default: 'Follow your browser\'s installation prompt'
}

export default PWA_MODAL_CONFIG
