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
    subtitle: 'Get instant access from desktop, tablet, or mobile',
    badge: {
      text: 'One-Click Install',
      gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)'
    }
  },

  // App Information
  appInfo: {
    name: 'RADAI',
    tagline: 'AI-Powered Engineering for Oil & Gas',
    description: 'Transform your workflow with intelligent P&ID verification, automated compliance checking, and real-time collaboration from any supported device.',
    publisher: 'Rejlers Abu Dhabi',
    version: '2.0'
  },

  // Installation Steps
  steps: [
    {
      id: 1,
      icon: '📥',
      title: 'Add RADAI to this device',
      description: 'Select "Install Now" and follow the secure browser installation prompt',
      color: '#0ea5e9'
    },
    {
      id: 2,
      icon: '🖥️',
      title: 'Quick access created',
      description: 'Open RADAI from Apps, Start, Dock, or your mobile home screen',
      color: '#2AA784'
    },
    {
      id: 3,
      icon: '⚡',
      title: 'Launch & Work',
      description: 'Open in a focused standalone window with automatic application updates',
      color: '#7FCAB5'
    }
  ],

  // Key Benefits
  benefits: [
    {
      icon: '🚄',
      title: 'Lightning Fast',
      description: 'Core application assets are cached for faster repeat launches',
      metric: 'Fast launch'
    },
    {
      icon: '🔄',
      title: 'Auto-Updates',
      description: 'Always latest version - no manual updates',
      metric: 'Always current'
    },
    {
      icon: '🔒',
      title: 'Secure Data Access',
      description: 'Authenticated business data remains online and access-controlled',
      metric: 'Network protected'
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
    platform: 'Windows, macOS, Linux, Android, iOS and iPadOS',
    requirements: 'Current Chrome, Edge or Safari',
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
    '✓ Existing identity and access controls remain active',
    '✓ Uninstall anytime from Settings',
    '✓ One workspace across supported devices'
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
