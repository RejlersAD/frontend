/**
 * Email Domain Filter Configuration
 * Centralized configuration for filtering users by email domain
 */

export const EMAIL_DOMAIN_CONFIG = {
  // Primary domain (default filter)
  primaryDomain: 'rejlers.ae',

  // Domain filter options
  filters: {
    ALL: {
      value: 'all',
      label: 'All Domains',
      description: 'Show users from all email domains',
      color: 'gray',
    },
    PRIMARY: {
      value: 'rejlers.ae',
      label: '@rejlers.ae',
      description: 'Show only Rejlers domain users',
      color: 'blue',
      isPrimary: true,
    },
    EXTERNAL: {
      value: 'external',
      label: 'External Domains',
      description: 'Show users from non-Rejlers domains',
      color: 'amber',
    },
    CUSTOM: {
      value: 'custom',
      label: 'Custom Domain',
      description: 'Filter by specific domain',
      color: 'purple',
    },
  },

  // Known domains in the system
  knownDomains: [
    { domain: 'rejlers.ae', label: 'Rejlers UAE', count: 0, type: 'primary' },
    { domain: 'rejlers.com', label: 'Rejlers Corporate', count: 0, type: 'internal' },
    { domain: 'rejler.ae', label: 'Rejler (typo)', count: 0, type: 'internal' },
    { domain: 'radai.ae', label: 'RADAI', count: 0, type: 'internal' },
    { domain: 'example.com', label: 'Example', count: 0, type: 'test' },
    { domain: 'gmail.com', label: 'Gmail', count: 0, type: 'external' },
    { domain: 'test.com', label: 'Test', count: 0, type: 'test' },
  ],

  // UI Configuration
  ui: {
    defaultFilter: 'rejlers.ae', // Default to show only @rejlers.ae
    showDomainBadge: true,
    showDomainStats: true,
    allowMultiDomain: false,
    
    colors: {
      primary: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
      },
      external: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-300',
      },
      test: {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        border: 'border-gray-300',
      },
    },

    labels: {
      filterTitle: 'Email Domain Filter',
      filterDescription: 'Filter users by email domain',
      statsTitle: 'Domain Statistics',
      primaryDomainLabel: 'Primary Domain Users',
      externalDomainLabel: 'External Domain Users',
    },
  },

  // Filter functions
  filterFunctions: {
    // Check if email belongs to primary domain
    isPrimaryDomain: (email) => {
      if (!email || typeof email !== 'string') return false;
      return email.toLowerCase().endsWith(`@${EMAIL_DOMAIN_CONFIG.primaryDomain}`);
    },

    // Check if email belongs to internal domains (Rejlers family)
    isInternalDomain: (email) => {
      if (!email || typeof email !== 'string') return false;
      const internalDomains = ['rejlers.ae', 'rejlers.com', 'rejler.ae', 'radai.ae'];
      return internalDomains.some(domain => 
        email.toLowerCase().endsWith(`@${domain}`)
      );
    },

    // Check if email is external (non-Rejlers)
    isExternalDomain: (email) => {
      return !EMAIL_DOMAIN_CONFIG.filterFunctions.isInternalDomain(email);
    },

    // Extract domain from email
    extractDomain: (email) => {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return 'unknown';
      }
      return email.split('@')[1].toLowerCase();
    },

    // Filter users by domain
    filterUsersByDomain: (users, filterValue) => {
      if (!users || !Array.isArray(users)) return [];
      
      if (filterValue === 'all') {
        return users;
      }

      if (filterValue === 'external') {
        return users.filter(user => {
          const email = user.user?.email || user.email;
          return EMAIL_DOMAIN_CONFIG.filterFunctions.isExternalDomain(email);
        });
      }

      // Filter by specific domain
      return users.filter(user => {
        const email = user.user?.email || user.email;
        if (!email) return false;
        return email.toLowerCase().endsWith(`@${filterValue}`);
      });
    },

    // Get domain statistics from users list
    getDomainStats: (users) => {
      if (!users || !Array.isArray(users)) return {};

      const stats = {};
      users.forEach(user => {
        const email = user.user?.email || user.email;
        if (email) {
          const domain = EMAIL_DOMAIN_CONFIG.filterFunctions.extractDomain(email);
          stats[domain] = (stats[domain] || 0) + 1;
        }
      });

      return stats;
    },

    // Format domain stats for display
    formatDomainStats: (users) => {
      const stats = EMAIL_DOMAIN_CONFIG.filterFunctions.getDomainStats(users);
      const primaryCount = stats[EMAIL_DOMAIN_CONFIG.primaryDomain] || 0;
      const externalCount = Object.entries(stats)
        .filter(([domain]) => domain !== EMAIL_DOMAIN_CONFIG.primaryDomain)
        .reduce((sum, [, count]) => sum + count, 0);

      return {
        total: users.length,
        primary: primaryCount,
        external: externalCount,
        byDomain: stats,
      };
    },
  },

  // Messages
  messages: {
    noPrimaryUsers: 'No users found with @rejlers.ae email domain',
    noExternalUsers: 'No external domain users found',
    noUsersFound: 'No users found for selected domain',
    switchingDomain: 'Switching to domain filter',
  },
};

/**
 * Helper function to get domain badge color
 */
export const getDomainBadgeColor = (email) => {
  if (EMAIL_DOMAIN_CONFIG.filterFunctions.isPrimaryDomain(email)) {
    return EMAIL_DOMAIN_CONFIG.ui.colors.primary;
  }
  if (EMAIL_DOMAIN_CONFIG.filterFunctions.isInternalDomain(email)) {
    return EMAIL_DOMAIN_CONFIG.ui.colors.primary;
  }
  return EMAIL_DOMAIN_CONFIG.ui.colors.external;
};

/**
 * Helper function to get domain display name
 */
export const getDomainDisplayName = (email) => {
  const domain = EMAIL_DOMAIN_CONFIG.filterFunctions.extractDomain(email);
  const knownDomain = EMAIL_DOMAIN_CONFIG.knownDomains.find(d => d.domain === domain);
  return knownDomain ? knownDomain.label : domain;
};

export default EMAIL_DOMAIN_CONFIG;
