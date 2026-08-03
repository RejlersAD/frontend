/**
 * Personal Dashboard Configuration
 * Soft-coded role layouts, widget visibility, colours, and module-to-icon mapping.
 */

import { FEATURE_FLAGS } from './features.config'

// Polling & timing
export const PERSONAL_DASHBOARD_CONFIG = {
  pollIntervalMs:   60000,
  insightPollMs:    0,
  staggerMs:        60,
  fadeInMs:         480,
  shimmerMs:        1800,
  skeletonRows:     3,
}

// Role-specific layout switches
export const ROLE_LAYOUTS = {
  administrator: {
    greeting:            'Administrator Dashboard',
    showTeamSnapshot:    false,
    showPendingActions:  true,
    showUsageChart:      true,
    showActivityFeed:    true,
    kpiColorScheme:      'blue',
  },
  manager: {
    greeting:            'Manager Dashboard',
    showTeamSnapshot:    true,
    showPendingActions:  true,
    showUsageChart:      true,
    showActivityFeed:    true,
    kpiColorScheme:      'indigo',
  },
  engineer: {
    greeting:            'Engineering Dashboard',
    showTeamSnapshot:    false,
    showPendingActions:  false,
    showUsageChart:      true,
    showActivityFeed:    true,
    kpiColorScheme:      'cyan',
  },
  reviewer: {
    greeting:            'Reviewer Dashboard',
    showTeamSnapshot:    false,
    showPendingActions:  true,
    showUsageChart:      false,
    showActivityFeed:    true,
    kpiColorScheme:      'amber',
  },
  viewer: {
    greeting:            'My Dashboard',
    showTeamSnapshot:    false,
    showPendingActions:  false,
    showUsageChart:      false,
    showActivityFeed:    true,
    kpiColorScheme:      'slate',
  },
  default: {
    greeting:            'My Dashboard',
    showTeamSnapshot:    false,
    showPendingActions:  false,
    showUsageChart:      true,
    showActivityFeed:    true,
    kpiColorScheme:      'blue',
  },
}

// Insight type visual styles
export const INSIGHT_STYLES = {
  tip:         { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'   },
  achievement: { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700', dot: 'bg-green-500'  },
  alert:       { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500'  },
  suggestion:  { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
}

// Module to icon + route + category + accent colour
// Categories: 'engineering' | 'ai' | 'operations' | 'business'
export const MODULE_META = {
  pid_analysis:          { icon: '🔬', label: 'P&ID QC',           route: '/engineering/process/pid-quality-checker', category: 'engineering', accent: 'from-cyan-500 to-blue-600' },
  pid_verification:      { icon: '✅', label: 'P&ID Verify',        route: '/engineering/process/pid-verification',    category: 'engineering', accent: 'from-emerald-500 to-teal-600' },
  pfd_to_pid:            { icon: '📐', label: 'PFD Digitisation',   route: '/pfd-upload',                              category: 'engineering', accent: 'from-blue-500 to-indigo-600' },
  pfd_quality:           { icon: '📊', label: 'PFD Quality',        route: '/engineering/process/pfd-quality-checker', category: 'engineering', accent: 'from-sky-500 to-cyan-600' },
  process_datasheet:     { icon: '🔧', label: 'Process Datasheet',  route: '/process-datasheet',                       category: 'engineering', accent: 'from-teal-500 to-emerald-600' },
  electrical_datasheet:  { icon: '⚡', label: 'Electrical',          route: '/engineering/electrical/datasheets',       category: 'engineering', accent: 'from-yellow-500 to-orange-600' },
  electrical_sld:        { icon: '🔌', label: 'Electrical SLD',     route: '/engineering/electrical/sld',              category: 'engineering', accent: 'from-amber-500 to-yellow-600' },
  instrument_datasheet:  { icon: '🎛️', label: 'Instrument',          route: '/engineering/instrument',                  category: 'engineering', accent: 'from-purple-500 to-indigo-600' },
  instrument_index:      { icon: '📇', label: 'Instrument Index',   route: '/engineering/instrument/index',            category: 'engineering', accent: 'from-fuchsia-500 to-purple-600' },
  mechanical_datasheet:  { icon: '⚙️', label: 'Mechanical',          route: '/engineering/mechanical',                  category: 'engineering', accent: 'from-slate-500 to-gray-700' },
  civil_datasheet:       { icon: '🏗️', label: 'Civil',               route: '/engineering/civil',                       category: 'engineering', accent: 'from-stone-500 to-neutral-700' },
  piping_datasheet:      { icon: '🧵', label: 'Piping',              route: '/engineering/piping',                      category: 'engineering', accent: 'from-rose-500 to-pink-600' },
  piping_pms:            { icon: '📎', label: 'Piping Material Spec', route: '/engineering/piping/pms',                 category: 'engineering', accent: 'from-pink-500 to-rose-600' },
  spec_customization:    { icon: '🧩', label: 'Spec Customization',  route: '/engineering/piping/spec-customization',   category: 'engineering', accent: 'from-violet-500 to-purple-600' },
  non_teff_metadata:     { icon: '🗂️', label: 'Non-TEFF Metadata',   route: '/engineering/non-teff',                    category: 'engineering', accent: 'from-neutral-500 to-slate-600' },
  pid_line_list:         { icon: '📏', label: 'Line List',           route: '/engineering/process/line-list',           category: 'engineering', accent: 'from-blue-500 to-sky-600' },
  pid_equipment_list:    { icon: '🏷️', label: 'Equipment List',      route: '/engineering/process/equipment-list',      category: 'engineering', accent: 'from-indigo-500 to-blue-600' },

  designiq:              { icon: '🧠', label: 'DesignIQ',            route: '/designiq',                                 category: 'ai',          accent: 'from-purple-600 to-pink-600' },
  crs_documents:         { icon: '📋', label: 'CRS Documents',       route: '/crs',                                      category: 'ai',          accent: 'from-indigo-500 to-purple-600' },

  project_control:       { icon: '📊', label: 'Projects',            route: '/project-control',                          category: 'operations',  accent: 'from-blue-600 to-indigo-700' },
  qhse:                  { icon: '🛡️', label: 'QHSE',                route: '/qhse',                                     category: 'operations',  accent: 'from-emerald-500 to-green-700' },
  timesheet:             { icon: '⏱️', label: 'Timesheet',           route: '/timesheet',                                category: 'operations',  accent: 'from-orange-500 to-red-600' },
  wrench_integration:    { icon: '🔗', label: 'Wrench',              route: '/wrench-integration',                       category: 'operations',  accent: 'from-teal-500 to-cyan-600' },

  finance:               { icon: '💰', label: 'Finance',             route: '/finance',                                  category: 'business',    accent: 'from-emerald-600 to-green-700' },
  procurement:           { icon: '🏭', label: 'Procurement',         route: '/procurement',                              category: 'business',    accent: 'from-amber-600 to-orange-700' },
  sales:                 { icon: '📈', label: 'Sales',               route: '/sales',                                    category: 'business',    accent: 'from-rose-500 to-red-600' },
  // SOFT-CODED: human_resource only included if FEATURE_FLAGS.enableHRModule is true
  ...(FEATURE_FLAGS.enableHRModule ? {
    human_resource:      { icon: '👥', label: 'HR',                  route: '/hr',                                       category: 'business',    accent: 'from-cyan-500 to-blue-600' },
  } : {}),
}

// Category display metadata for grouping in the module grid
export const MODULE_CATEGORY_META = {
  engineering: { label: 'Engineering',       icon: '⚙️', order: 1 },
  ai:          { label: 'AI & Intelligence', icon: '🧠', order: 2 },
  operations:  { label: 'Operations',        icon: '🎯', order: 3 },
  business:    { label: 'Business',          icon: '💼', order: 4 },
}

// KPI colour palettes
export const KPI_COLORS = {
  blue:    { card: 'bg-blue-500',    text: 'text-white', sub: 'text-blue-100'   },
  indigo:  { card: 'bg-indigo-500',  text: 'text-white', sub: 'text-indigo-100' },
  cyan:    { card: 'bg-cyan-500',    text: 'text-white', sub: 'text-cyan-100'   },
  amber:   { card: 'bg-amber-500',   text: 'text-white', sub: 'text-amber-100'  },
  emerald: { card: 'bg-emerald-500', text: 'text-white', sub: 'text-emerald-100'},
  slate:   { card: 'bg-slate-500',   text: 'text-white', sub: 'text-slate-100'  },
}

// Activity type to icon + colour
export const ACTIVITY_META = {
  user_login:          { icon: '🔓', label: 'Logged in',          color: 'text-green-600',  ring: 'ring-green-100'  },
  document_uploaded:   { icon: '📤', label: 'Uploaded document',  color: 'text-blue-600',   ring: 'ring-blue-100'   },
  ai_analysis:         { icon: '🤖', label: 'AI Analysis',        color: 'text-purple-600', ring: 'ring-purple-100' },
  user_created:        { icon: '👤', label: 'User created',       color: 'text-indigo-600', ring: 'ring-indigo-100' },
  permission_changed:  { icon: '🔒', label: 'Permission changed', color: 'text-amber-600',  ring: 'ring-amber-100'  },
  api_call:            { icon: '🔌', label: 'API call',           color: 'text-cyan-600',   ring: 'ring-cyan-100'   },
  api_request:         { icon: '🔌', label: 'API request',        color: 'text-cyan-600',   ring: 'ring-cyan-100'   },
  default:             { icon: '📌', label: 'Activity',           color: 'text-slate-600',  ring: 'ring-slate-100'  },
}

// Welcome hero gradients per role
export const ROLE_GRADIENTS = {
  administrator: 'from-blue-600 via-blue-700 to-indigo-800',
  manager:       'from-indigo-600 via-purple-600 to-purple-800',
  engineer:      'from-cyan-600 via-teal-600 to-blue-700',
  reviewer:      'from-amber-500 via-orange-500 to-red-600',
  viewer:        'from-slate-600 via-slate-700 to-gray-800',
  default:       'from-blue-600 via-indigo-600 to-purple-700',
}