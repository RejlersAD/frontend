/**
 * Project Organizer — shared, cross-tool project registry (soft-coded config)
 * ============================================================================
 * Any adopting tool (HMB Extractor first) imports this config instead of
 * hardcoding API paths, statuses or theme tokens.
 */

export const PROJECT_ORGANIZER_CONFIG = {
  api: {
    list:     '/project-organizer/projects/',
    detail:   (id) => `/project-organizer/projects/${id}/`,
    activity: (id) => `/project-organizer/projects/${id}/activity/`,
  },
  routes: {
    manage: '/project-organizer/projects',
  },
  statuses: [
    { value: 'active',    label: 'Active',    color: '#0f766e', bg: 'rgba(15,118,110,0.10)'  },
    { value: 'on_hold',   label: 'On hold',   color: '#b45309', bg: 'rgba(180,83,9,0.10)'    },
    { value: 'completed', label: 'Completed', color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)'   },
    { value: 'archived',  label: 'Archived',  color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
  ],
  nameMaxLen: 255,
  descMaxLen: 2000,
  defaultTheme: {
    accent:       '#0f766e',   // teal-700
    accentAlt:    '#0891b2',   // cyan-600 (gradient pair)
    accentSoft:   'rgba(15,118,110,0.08)',
    accentBorder: 'rgba(15,118,110,0.22)',
    cardBg:       '#ffffff',
    pageBg:       '#f0fdfa',   // teal-50
    text:         '#0f172a',
    muted:        '#64748b',
  },
};

export const statusMeta = (value) =>
  PROJECT_ORGANIZER_CONFIG.statuses.find((s) => s.value === value) || PROJECT_ORGANIZER_CONFIG.statuses[0];
