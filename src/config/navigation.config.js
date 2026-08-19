/**
 * Navigation Configuration
 * Soft-coded navigation menu items for public and authenticated pages
 * 
 * USAGE:
 * - Import and map over NAV_ITEMS.public or NAV_ITEMS.authenticated
 * - Each item has: label, path, order, visibility flags
 * - Easy to add/remove/reorder menu items without touching component code
 * 
 * @see Home.jsx - Public navigation (desktop + mobile)
 * @see Login.jsx - Login page links
 * @see Layout.jsx - Authenticated navigation
 */

export const NAV_ITEMS = {
  // ===== PUBLIC NAVIGATION (Landing Page) =====
  public: [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      order: 1,
      showInDesktop: true,
      showInMobile: true,
      exact: true, // Exact match for highlighting
    },
    {
      id: 'enquiry',
      label: 'Enquiry',
      path: '/enquiry',
      order: 2,
      showInDesktop: true,
      showInMobile: true,
      icon: 'MessageSquare', // Optional icon name (for future use)
      description: 'Contact us with any questions or requests',
    },
    {
      id: 'solutions',
      label: 'Solutions',
      path: '/solutions',
      order: 3,
      showInDesktop: true,
      showInMobile: true,
      description: 'Explore our AI-powered engineering solutions',
    },
    {
      id: 'about',
      label: 'About',
      path: '/about',
      order: 4,
      showInDesktop: true,
      showInMobile: true,
      description: 'Learn about Rejlers and RADAI',
    },
    {
      id: 'contact',
      label: 'Contact',
      path: '/contact',
      order: 5,
      showInDesktop: true,
      showInMobile: true,
      description: 'Get in touch with our team',
    },
  ],

  // ===== AUTHENTICATED NAVIGATION (Inside App) =====
  authenticated: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      order: 1,
      icon: 'LayoutDashboard',
    },
    {
      id: 'projects',
      label: 'Projects',
      path: '/projects',
      order: 2,
      icon: 'FolderKanban',
    },
    {
      id: 'reports',
      label: 'Reports',
      path: '/reports',
      order: 3,
      icon: 'FileText',
    },
  ],

  // ===== LOGIN PAGE LINKS =====
  loginPage: {
    forgotPassword: {
      label: 'Forgot Password?',
      path: '/forgot-password',
      description: 'Reset your password or submit an enquiry',
    },
    register: {
      label: 'Sign Up',
      path: '/register',
      description: 'Create a new account',
      enabled: false, // Set to true to show registration link
    },
    enquiry: {
      label: 'General Enquiry',
      path: '/enquiry',
      description: 'Contact us with questions or requests',
      enabled: true,
    },
  },

  // ===== CTA BUTTONS =====
  cta: {
    public: {
      label: 'Sign In',
      path: '/login',
      variant: 'primary',
      icon: 'ArrowRight',
    },
    authenticated: {
      label: 'Get Started',
      path: '/dashboard',
      variant: 'primary',
      icon: 'Rocket',
    },
  },
};

/**
 * Helper: Get navigation items sorted by order
 * @param {string} context - 'public' | 'authenticated'
 * @returns {Array} Sorted navigation items
 */
export function getNavItems(context = 'public') {
  const items = NAV_ITEMS[context] || [];
  return items
    .filter(item => item.showInDesktop !== false)
    .sort((a, b) => a.order - b.order);
}

/**
 * Helper: Get mobile navigation items
 * @param {string} context - 'public' | 'authenticated'
 * @returns {Array} Items visible in mobile menu
 */
export function getMobileNavItems(context = 'public') {
  const items = NAV_ITEMS[context] || [];
  return items
    .filter(item => item.showInMobile !== false)
    .sort((a, b) => a.order - b.order);
}

/**
 * Helper: Find nav item by path
 * @param {string} path - Current URL path
 * @param {string} context - 'public' | 'authenticated'
 * @returns {Object|null} Matching nav item
 */
export function getActiveNavItem(path, context = 'public') {
  const items = NAV_ITEMS[context] || [];
  return items.find(item => {
    if (item.exact) {
      return path === item.path;
    }
    return path.startsWith(item.path);
  });
}

/**
 * Navigation Styling Configuration
 */
export const NAV_STYLES = {
  desktop: {
    linkBase: 'text-gray-300 hover:text-white text-sm font-semibold transition-colors duration-200',
    linkActive: 'text-white',
    linkHover: 'hover:text-[#7FCAB5]',
    spacing: 'space-x-6 lg:space-x-8',
  },
  mobile: {
    linkBase: 'block text-gray-300 hover:text-[#7FCAB5] py-2 text-sm font-semibold transition-colors',
    linkActive: 'text-[#7FCAB5]',
    spacing: 'space-y-2',
  },
  cta: {
    base: 'px-5 py-2 rounded-full text-sm font-bold text-white transition-all duration-300',
    hover: 'hover:scale-105 glow-btn',
    gradient: 'linear-gradient(135deg,#2AA784,#7FCAB5)',
  },
};

/**
 * Footer Navigation (Quick Links)
 */
export const FOOTER_NAV = {
  columns: [
    {
      title: 'Solutions',
      links: [
        { label: 'P&ID Verification', path: '/services/pid-analysis' },
        { label: 'PFD Conversion', path: '/services/pfd-conversion' },
        { label: 'Asset Integrity', path: '/services/asset-integrity' },
        { label: 'Engineering Consulting', path: '/services/consulting' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', path: '/about' },
        { label: 'Contact', path: '/contact' },
        { label: 'Enquiry', path: '/enquiry' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', path: '/docs' },
        { label: 'API Reference', path: '/api-docs' },
        { label: 'Support', path: '/support' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', path: '/privacy-policy' },
        { label: 'Terms of Service', path: '/terms-of-service' },
        { label: 'Data Governance', path: '/data-governance' },
      ],
    },
  ],
};

export default NAV_ITEMS;
