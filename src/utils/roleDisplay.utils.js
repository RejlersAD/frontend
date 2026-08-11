/**
 * Role Display Utilities
 * Centralized role display logic to ensure consistency across all admin pages
 * Single source of truth: ROLE_DISPLAY_CONFIG in userManagement.config.js
 */

import { ROLE_DISPLAY_CONFIG, getRoleDisplay } from '../config/userManagement.config';
import { ROLE_LEVEL_COLORS, DEFAULT_LEVEL_COLOR, ROLE_LEVEL_LABELS } from '../config/rbacAccess.config';

/**
 * Get the display name for a role
 * Priority:
 *  1. ROLE_DISPLAY_CONFIG.label (soft-coded)
 *  2. role.name (database)
 *  3. role.code (fallback)
 * 
 * @param {Object} role - Role object from API
 * @returns {string} Display name
 */
export const getRoleName = (role) => {
  if (!role) return 'Unknown Role';
  
  // Try soft-coded config first
  const config = getRoleDisplay(role.code);
  if (config && config.label && config.label !== 'User') {
    return config.label;
  }
  
  // Fall back to database name or code
  return role.name || role.code || 'Unknown Role';
};

/**
 * Get the short label for a role (for compact displays)
 * 
 * @param {Object} role - Role object from API
 * @returns {string} Short label
 */
export const getRoleShortLabel = (role) => {
  if (!role) return 'Unknown';
  
  const config = getRoleDisplay(role.code);
  if (config && config.shortLabel) {
    return config.shortLabel;
  }
  
  return role.name || role.code || 'Unknown';
};

/**
 * Get the badge styling for a role
 * Priority:
 *  1. ROLE_DISPLAY_CONFIG.badge (soft-coded)
 *  2. ROLE_LEVEL_COLORS[role.level] (level-based)
 *  3. DEFAULT_LEVEL_COLOR
 * 
 * @param {Object} role - Role object from API
 * @returns {Object} {bg, text, dot} Tailwind classes
 */
export const getRoleBadgeColors = (role) => {
  if (!role) return DEFAULT_LEVEL_COLOR;
  
  // Try soft-coded config first
  const config = getRoleDisplay(role.code);
  if (config && config.badge) {
    return {
      bg: config.badge,
      text: config.badge,
      dot: config.dot || 'bg-gray-400'
    };
  }
  
  // Fall back to level-based colors
  const levelColor = ROLE_LEVEL_COLORS[role.level];
  if (levelColor) {
    return {
      bg: `${levelColor.bg} ${levelColor.text}`,
      text: levelColor.text,
      dot: levelColor.dot
    };
  }
  
  return {
    bg: `${DEFAULT_LEVEL_COLOR.bg} ${DEFAULT_LEVEL_COLOR.text}`,
    text: DEFAULT_LEVEL_COLOR.text,
    dot: DEFAULT_LEVEL_COLOR.dot
  };
};

/**
 * Get the description for a role
 * 
 * @param {Object} role - Role object from API
 * @returns {string} Role description
 */
export const getRoleDescription = (role) => {
  if (!role) return '';
  
  const config = getRoleDisplay(role.code);
  if (config && config.description) {
    return config.description;
  }
  
  return role.description || '';
};

/**
 * Get the discipline/category for a role
 * 
 * @param {Object} role - Role object from API
 * @returns {string} Discipline name
 */
export const getRoleDiscipline = (role) => {
  if (!role) return 'General';
  
  const config = getRoleDisplay(role.code);
  if (config && config.discipline) {
    return config.discipline;
  }
  
  return 'General';
};

/**
 * Format role for dropdown display
 * Shows: "L{level} · {name}" or just "{name}" if no level
 * 
 * @param {Object} role - Role object from API
 * @param {boolean} includeLevel - Whether to show level prefix
 * @returns {string} Formatted display string
 */
export const formatRoleForDropdown = (role, includeLevel = true) => {
  if (!role) return 'Select Role';
  
  const name = getRoleName(role);
  const level = role.level;
  
  if (includeLevel && level && ROLE_LEVEL_LABELS[level]) {
    return `L${level} · ${name}`;
  }
  
  return name;
};

/**
 * Check if role display config matches database
 * Used for diagnostics and consistency checks
 * 
 * @param {Object} role - Role object from API
 * @returns {Object} {synced, differences}
 */
export const checkRoleConfigSync = (role) => {
  if (!role) return { synced: true, differences: [] };
  
  const config = getRoleDisplay(role.code);
  const differences = [];
  
  // Check if config exists
  if (!config || config === ROLE_DISPLAY_CONFIG._default) {
    differences.push({
      field: 'config',
      issue: 'No soft-coded configuration found',
      dbValue: role.code,
      configValue: null,
    });
  }
  
  // Check name consistency
  if (config && config.label && config.label !== role.name && config.label !== 'User') {
    differences.push({
      field: 'name',
      issue: 'Name mismatch between config and database',
      dbValue: role.name,
      configValue: config.label,
      recommendation: `Update database: role.name = "${config.label}"`,
    });
  }
  
  return {
    synced: differences.length === 0,
    differences,
  };
};

/**
 * Get all roles grouped by discipline
 * Useful for organized role pickers
 * 
 * @param {Array} roles - Array of role objects
 * @returns {Object} Roles grouped by discipline
 */
export const getRolesByDiscipline = (roles) => {
  if (!Array.isArray(roles)) return {};
  
  const grouped = {};
  
  roles.forEach(role => {
    const discipline = getRoleDiscipline(role);
    if (!grouped[discipline]) {
      grouped[discipline] = [];
    }
    grouped[discipline].push(role);
  });
  
  return grouped;
};

/**
 * Sort roles by discipline order (Platform → Engineering → HR → General)
 * 
 * @param {Array} roles - Array of role objects
 * @returns {Array} Sorted roles
 */
export const sortRolesByDiscipline = (roles) => {
  if (!Array.isArray(roles)) return [];
  
  const disciplineOrder = [
    'Platform',
    'Engineering',
    'Process',
    'Electrical',
    'Instrument',
    'Mechanical',
    'Civil',
    'Piping',
    'QHSE',
    'Design',
    'Management',
    'Human Resources',
    'General',
  ];
  
  return [...roles].sort((a, b) => {
    const disciplineA = getRoleDiscipline(a);
    const disciplineB = getRoleDiscipline(b);
    
    const indexA = disciplineOrder.indexOf(disciplineA);
    const indexB = disciplineOrder.indexOf(disciplineB);
    
    // If disciplines are the same, sort by level then name
    if (indexA === indexB) {
      if (a.level !== b.level) {
        return (a.level || 999) - (b.level || 999);
      }
      return getRoleName(a).localeCompare(getRoleName(b));
    }
    
    return indexA - indexB;
  });
};
