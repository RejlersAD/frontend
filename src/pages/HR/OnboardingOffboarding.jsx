/**
 * Onboarding & Offboarding Management
 * Employee lifecycle management — joining, exit, equipment, documents, access provisioning
 * 
 * ✅ MIGRATED: Now uses EmployeeMaster backend (employee_master_id, auto-generated employee_number)
 */
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import * as HeroIcons from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'
import DatePicker from '../../components/DatePicker'

// ── Soft-coded API endpoints ──────────────────────────────────────────────
// Note: apiClient baseURL already includes /api/v1, so paths are relative to that
const API_ENDPOINTS = {
  onboarding: '/onboarding',
  employees: '/users/employees',
  documents: '/onboarding/documents',
}

const API_BASE = API_ENDPOINTS.onboarding

// ── Soft-coded quick-edit fields for list view ────────────────────────────
const QUICK_EDIT_FIELDS = [
  { key: 'first_name', label: 'First Name', type: 'text', source: 'employee_master' },
  { key: 'last_name', label: 'Last Name', type: 'text', source: 'employee_master' },
  { key: 'email', label: 'Email', type: 'email', source: 'employee_master' },
  { key: 'job_title_uae', label: 'Job Title (UAE)', type: 'text', source: 'employee_master' },
  { key: 'division', label: 'Division', type: 'text', source: 'employee_master' },
  { key: 'department', label: 'Department', type: 'text', source: 'employee_master' },
]

// ── Soft-coded status badges ──────────────────────────────────────────────
const ONBOARDING_STATUS_CONFIG = {
  initiated: { label: 'Initiated', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  documentation: { label: 'Documentation', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  equipment: { label: 'Equipment', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  access_provisioning: { label: 'Access Setup', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  training: { label: 'Training', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200' },
}

const OFFBOARDING_STATUS_CONFIG = {
  initiated: { label: 'Initiated', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  access_revocation: { label: 'Access Revoked', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  equipment_return: { label: 'Equipment Return', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  exit_interview: { label: 'Exit Interview', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  final_settlement: { label: 'Final Settlement', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700 border-rose-200' },
}

const EXIT_REASON_CONFIG = {
  resignation: { label: 'Resignation', icon: HeroIcons.UserMinusIcon },
  termination: { label: 'Termination', icon: HeroIcons.ExclamationTriangleIcon },
  contract_end: { label: 'Contract End', icon: HeroIcons.DocumentTextIcon },
  retirement: { label: 'Retirement', icon: HeroIcons.SparklesIcon },
  relocation: { label: 'Relocation', icon: HeroIcons.GlobeAltIcon },
  health: { label: 'Health', icon: HeroIcons.HeartIcon },
  performance: { label: 'Performance', icon: HeroIcons.ChartBarIcon },
  redundancy: { label: 'Redundancy', icon: HeroIcons.MinusCircleIcon },
  other: { label: 'Other', icon: HeroIcons.QuestionMarkCircleIcon },
}

const BRANCH_CONFIG = {
  RAD: { label: 'Rejlers Abu Dhabi', color: 'text-blue-600' },
  RIN: { label: 'Rejlers India', color: 'text-emerald-600' },
}

// ── Soft-coded success message configuration ──────────────────────────────
const SUCCESS_CONFIG = {
  autoReloadDelay: 2000, // milliseconds - delay before page reload after successful employee creation
  defaultRole: 'Default', // Default RBAC role assigned to new employees
  visibilityLocations: [
    'Overview tab (this page)',
    'HR/Employees list',
    'Admin/Users dashboard',
    'Profile (when user logs in)'
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SMART BUTTON CONFIGURATION FOR OVERVIEW TAB ────────────────────────────
// All buttons in the Overview section are configured here for easy maintenance
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Navigation Action Types
 * Defines how the button should behave when clicked
 */
const NAV_ACTIONS = {
  HASH: 'hash',           // Navigate using window.location.hash
  TAB: 'tab',             // Switch to a different tab
  ROUTE: 'route',         // Navigate to a different route
  CALLBACK: 'callback',   // Execute a custom callback function
  EXTERNAL: 'external',   // Open external URL
}

/**
 * Button Size Presets
 * Consistent sizing across all buttons
 */
const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

/**
 * Button Style Variants
 * Pre-defined color schemes for different button types
 */
const BUTTON_VARIANTS = {
  primary: {
    base: 'bg-blue-600 hover:bg-blue-700 text-white',
    outline: 'text-blue-600 hover:bg-blue-50 border border-blue-200',
    ghost: 'text-blue-600 hover:bg-blue-50',
  },
  secondary: {
    base: 'bg-slate-600 hover:bg-slate-700 text-white',
    outline: 'text-slate-600 hover:bg-slate-50 border border-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-50',
  },
  success: {
    base: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    outline: 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200',
    ghost: 'text-emerald-600 hover:bg-emerald-50',
  },
  warning: {
    base: 'bg-amber-600 hover:bg-amber-700 text-white',
    outline: 'text-amber-600 hover:bg-amber-50 border border-amber-200',
    ghost: 'text-amber-600 hover:bg-amber-50',
  },
  danger: {
    base: 'bg-rose-600 hover:bg-rose-700 text-white',
    outline: 'text-rose-600 hover:bg-rose-50 border border-rose-200',
    ghost: 'text-rose-600 hover:bg-rose-50',
  },
}

/**
 * Smart Button Configuration for Overview Tab
 * Each button can be configured with:
 * - id: unique identifier
 * - label: button text
 * - section: which section this button belongs to ('onboarding' | 'offboarding' | 'global')
 * - actionType: type of navigation (hash, tab, route, callback, external)
 * - actionValue: value for the action (hash name, tab id, route path, callback function, external URL)
 * - variant: color scheme (primary, secondary, success, warning, danger)
 * - style: display style (base, outline, ghost)
 * - size: button size (sm, md, lg)
 * - icon: HeroIcon component to display
 * - iconPosition: where to place the icon ('left' | 'right' | 'both')
 * - showBadge: whether to show a badge with count
 * - badgeSource: function to get badge value from stats
 * - visible: function to determine if button should be shown
 * - disabled: function to determine if button should be disabled
 * - tooltip: tooltip text on hover
 * - analytics: analytics event name to track
 * - confirmBefore: show confirmation dialog before action
 * - confirmMessage: message to show in confirmation dialog
 */
const OVERVIEW_BUTTONS = [
  // ── Onboarding Section Buttons ──
  {
    id: 'view-all-onboarding',
    label: 'View All',
    section: 'onboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('all-onboarding')
    },
    variant: 'primary',
    style: 'ghost',
    size: 'md',
    icon: HeroIcons.ArrowRightIcon,
    iconPosition: 'right',
    showBadge: false,
    visible: (stats) => true,
    disabled: (stats) => false,
    tooltip: 'View complete onboarding list',
    analytics: 'onboarding_view_all_click',
  },
  {
    id: 'add-new-employee',
    label: 'Add New',
    section: 'onboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('create')
    },
    variant: 'success',
    style: 'outline',
    size: 'md',
    icon: HeroIcons.PlusCircleIcon,
    iconPosition: 'left',
    showBadge: false,
    visible: (stats) => true,
    disabled: (stats) => false,
    tooltip: 'Create new employee onboarding',
    analytics: 'onboarding_add_new_click',
  },
  {
    id: 'view-overdue-onboarding',
    label: 'Overdue Items',
    section: 'onboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('overdue-onboarding')
    },
    variant: 'danger',
    style: 'outline',
    size: 'sm',
    icon: HeroIcons.ExclamationTriangleIcon,
    iconPosition: 'left',
    showBadge: true,
    badgeSource: (stats) => stats?.overdue ?? 0,
    visible: (stats) => (stats?.overdue ?? 0) > 0, // Only show if there are overdue items
    disabled: (stats) => false,
    tooltip: 'View overdue onboarding items',
    analytics: 'onboarding_overdue_click',
  },
  {
    id: 'view-upcoming-joiners',
    label: 'Upcoming Joiners',
    section: 'onboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('upcoming-onboarding')
    },
    variant: 'primary',
    style: 'outline',
    size: 'sm',
    icon: HeroIcons.CalendarDaysIcon,
    iconPosition: 'left',
    showBadge: true,
    badgeSource: (stats) => stats?.upcoming_joiners ?? 0,
    visible: (stats) => (stats?.upcoming_joiners ?? 0) > 0,
    disabled: (stats) => false,
    tooltip: 'View employees joining in next 30 days',
    analytics: 'onboarding_upcoming_click',
  },

  // ── Offboarding Section Buttons ──
  {
    id: 'view-all-offboarding',
    label: 'View All',
    section: 'offboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('all-offboarding')
    },
    variant: 'danger',
    style: 'ghost',
    size: 'md',
    icon: HeroIcons.ArrowRightIcon,
    iconPosition: 'right',
    showBadge: false,
    visible: (stats) => true,
    disabled: (stats) => false,
    tooltip: 'View complete offboarding list',
    analytics: 'offboarding_view_all_click',
  },
  {
    id: 'initiate-offboarding',
    label: 'Initiate Exit',
    section: 'offboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      // The real "Initiate Exit" form lives on the Offboarding List tab.
      if (onTabChange) onTabChange('offboarding')
    },
    variant: 'warning',
    style: 'outline',
    size: 'md',
    icon: HeroIcons.UserMinusIcon,
    iconPosition: 'left',
    showBadge: false,
    visible: (stats) => true,
    disabled: (stats) => false,
    tooltip: 'Start offboarding process for an employee',
    analytics: 'offboarding_initiate_click',
  },
  {
    id: 'view-overdue-offboarding',
    label: 'Overdue Items',
    section: 'offboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('overdue-offboarding')
    },
    variant: 'danger',
    style: 'outline',
    size: 'sm',
    icon: HeroIcons.ExclamationTriangleIcon,
    iconPosition: 'left',
    showBadge: true,
    badgeSource: (stats) => stats?.overdue ?? 0,
    visible: (stats) => (stats?.overdue ?? 0) > 0,
    disabled: (stats) => false,
    tooltip: 'View overdue offboarding items',
    analytics: 'offboarding_overdue_click',
  },
  {
    id: 'view-upcoming-exits',
    label: 'Upcoming Exits',
    section: 'offboarding',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, onTabChange) => {
      if (onTabChange) onTabChange('upcoming-offboarding')
    },
    variant: 'warning',
    style: 'outline',
    size: 'sm',
    icon: HeroIcons.CalendarDaysIcon,
    iconPosition: 'left',
    showBadge: true,
    badgeSource: (stats) => stats?.upcoming_exits ?? 0,
    visible: (stats) => (stats?.upcoming_exits ?? 0) > 0,
    disabled: (stats) => false,
    tooltip: 'View employees leaving in next 30 days',
    analytics: 'offboarding_upcoming_click',
  },

  // ── Global Actions (appear in both sections or top-level) ──
  {
    id: 'refresh-statistics',
    label: 'Refresh',
    section: 'global',
    actionType: NAV_ACTIONS.CALLBACK,
    actionValue: (stats, loadFunction) => {
      if (loadFunction) loadFunction()
    },
    variant: 'secondary',
    style: 'ghost',
    size: 'sm',
    icon: HeroIcons.ArrowPathIcon,
    iconPosition: 'left',
    showBadge: false,
    visible: (stats) => true,
    disabled: (stats) => false,
    tooltip: 'Refresh statistics',
    analytics: 'overview_refresh_click',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// ── SMART KPI CARD CONFIGURATION FOR OVERVIEW TAB ──────────────────────────
// All KPI metric cards in the Overview section are configured here
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KPI Color Schemes
 * Pre-defined color combinations for different metrics
 */
const KPI_COLOR_SCHEMES = {
  blue: {
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-100',
  },
  violet: {
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    iconBg: 'bg-violet-100',
  },
  rose: {
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    iconBg: 'bg-rose-100',
  },
  emerald: {
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    iconBg: 'bg-emerald-100',
  },
  amber: {
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    iconBg: 'bg-amber-100',
  },
  slate: {
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    iconBg: 'bg-slate-100',
  },
  indigo: {
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    iconBg: 'bg-indigo-100',
  },
}

/**
 * Smart KPI Card Configuration
 * Each KPI card can be configured with:
 * - id: unique identifier
 * - label: card title
 * - section: which section this card belongs to ('onboarding' | 'offboarding')
 * - valueSource: function to extract value from stats
 * - icon: HeroIcon component to display
 * - colorScheme: pre-defined color scheme (blue, violet, rose, emerald, amber, slate, indigo)
 * - subtitle: optional subtitle text or function
 * - urgent: function to determine if card should show urgent state
 * - visible: function to determine if card should be shown
 * - order: display order (lower numbers appear first)
 * - onClick: optional click handler function
 * - tooltip: tooltip text on hover
 * - animation: enable/disable animations
 */
const KPI_CARDS_CONFIG = {
  onboarding: [
    {
      id: 'onboarding-total-active',
      label: 'Total Active',
      section: 'onboarding',
      valueSource: (stats) => stats?.total ?? 0,
      icon: HeroIcons.UsersIcon,
      colorScheme: 'blue',
      subtitle: null,
      urgent: (stats) => false,
      visible: (stats) => true,
      order: 1,
      onClick: (stats, onAction) => {
        if (onAction) onAction('all-onboarding')
      },
      tooltip: 'Total active onboarding processes',
      animation: true,
    },
    {
      id: 'onboarding-joining-soon',
      label: 'Joining Soon',
      section: 'onboarding',
      valueSource: (stats) => stats?.upcoming_joiners ?? 0,
      icon: HeroIcons.CalendarDaysIcon,
      colorScheme: 'violet',
      subtitle: 'Next 30 days',
      urgent: (stats) => false,
      visible: (stats) => true,
      order: 2,
      onClick: (stats, onAction) => {
        if (onAction) onAction('upcoming-onboarding')
      },
      tooltip: 'Employees joining in the next 30 days',
      animation: true,
    },
    {
      id: 'onboarding-overdue',
      label: 'Overdue',
      section: 'onboarding',
      valueSource: (stats) => stats?.overdue ?? 0,
      icon: HeroIcons.ExclamationCircleIcon,
      colorScheme: 'rose',
      subtitle: null,
      urgent: (stats) => (stats?.overdue ?? 0) > 0,
      visible: (stats) => true,
      order: 3,
      onClick: (stats, onAction) => {
        if (onAction) onAction('overdue-onboarding')
      },
      tooltip: 'Overdue onboarding items requiring attention',
      animation: true,
    },
    {
      id: 'onboarding-completed',
      label: 'Completed',
      section: 'onboarding',
      valueSource: (stats) => stats?.completed_this_month ?? 0,
      icon: HeroIcons.CheckCircleIcon,
      colorScheme: 'emerald',
      subtitle: 'This month',
      urgent: (stats) => false,
      visible: (stats) => true,
      order: 4,
      onClick: (stats, onAction) => {
        if (onAction) onAction('completed-onboarding')
      },
      tooltip: 'Completed onboarding processes this month',
      animation: true,
    },
  ],
  offboarding: [
    {
      id: 'offboarding-total-active',
      label: 'Total Active',
      section: 'offboarding',
      valueSource: (stats) => stats?.total ?? 0,
      icon: HeroIcons.UsersIcon,
      colorScheme: 'slate',
      subtitle: null,
      urgent: (stats) => false,
      visible: (stats) => true,
      order: 1,
      onClick: (stats, onAction) => {
        if (onAction) onAction('all-offboarding')
      },
      tooltip: 'Total active offboarding processes',
      animation: true,
    },
    {
      id: 'offboarding-leaving-soon',
      label: 'Leaving Soon',
      section: 'offboarding',
      valueSource: (stats) => stats?.upcoming_exits ?? 0,
      icon: HeroIcons.CalendarDaysIcon,
      colorScheme: 'amber',
      subtitle: 'Next 30 days',
      urgent: (stats) => false,
      visible: (stats) => true,
      order: 2,
      onClick: (stats, onAction) => {
        if (onAction) onAction('upcoming-offboarding')
      },
      tooltip: 'Employees leaving in the next 30 days',
      animation: true,
    },
    {
      id: 'offboarding-overdue',
      label: 'Overdue',
      section: 'offboarding',
      valueSource: (stats) => stats?.overdue ?? 0,
      icon: HeroIcons.ExclamationCircleIcon,
      colorScheme: 'rose',
      subtitle: null,
      urgent: (stats) => (stats?.overdue ?? 0) > 0,
      visible: (stats) => true,
      order: 3,
      onClick: (stats, onAction) => {
        if (onAction) onAction('overdue-offboarding')
      },
      tooltip: 'Overdue offboarding items requiring attention',
      animation: true,
    },
    {
      id: 'offboarding-completed',
      label: 'Completed',
      section: 'offboarding',
      valueSource: (stats) => stats?.completed_this_month ?? 0,
      icon: HeroIcons.CheckCircleIcon,
      colorScheme: 'emerald',
      subtitle: 'This month',
      urgent: (stats) => false,
      visible: (stats) => true,
      order: 4,
      onClick: (stats, onAction) => {
        if (onAction) onAction('completed-offboarding')
      },
      tooltip: 'Completed offboarding processes this month',
      animation: true,
    },
  ],
}

/**
 * Smart KPI Card Renderer Component
 * Renders a KPI card based on configuration with all smart features
 */
const SmartKPICard = ({ config, stats, onAction }) => {
  // Check visibility
  const isVisible = typeof config.visible === 'function' ? config.visible(stats) : true
  if (!isVisible) return null

  // Get value
  const value = typeof config.valueSource === 'function' ? config.valueSource(stats) : 0

  // Check urgent state
  const isUrgent = typeof config.urgent === 'function' ? config.urgent(stats) : false

  // Get icon component
  const Icon = config.icon

  // Get color scheme
  const colors = KPI_COLOR_SCHEMES[config.colorScheme] || KPI_COLOR_SCHEMES.blue

  // Get subtitle (can be string or function)
  const subtitle = typeof config.subtitle === 'function' ? config.subtitle(stats) : config.subtitle

  // Handle click
  const handleClick = () => {
    if (typeof config.onClick === 'function') {
      config.onClick(stats, onAction)
    }
  }

  return (
    <div 
      className={`rounded-xl border border-slate-200 p-4 ${colors.bgColor} hover:shadow-lg transition-all duration-300 cursor-pointer group`}
      onClick={handleClick}
      title={config.tooltip}
      data-kpi-id={config.id}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className={`text-xs font-semibold ${colors.textColor} opacity-80 uppercase tracking-wide`}>
            {config.label}
          </div>
          {subtitle && (
            <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        <div 
          className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center ${
            isUrgent ? 'animate-pulse' : ''
          } ${config.animation ? 'group-hover:scale-110 transition-transform duration-300' : ''}`}
        >
          <Icon className={`w-5 h-5 ${colors.textColor}`} />
        </div>
      </div>
      <div className={`text-3xl font-bold ${colors.textColor} ${isUrgent ? 'text-4xl' : ''}`}>
        {value}
      </div>
      {isUrgent && value > 0 && (
        <div className="mt-2 text-[10px] font-medium text-rose-600 flex items-center gap-1">
          <HeroIcons.ExclamationTriangleIcon className="w-3 h-3" />
          Requires attention
        </div>
      )}
    </div>
  )
}

/**
 * Smart KPI Card Grid Component
 * Renders a grid of KPI cards for a specific section with smart layout
 */
const SmartKPICardGrid = ({ section, stats, onAction }) => {
  const cards = KPI_CARDS_CONFIG[section] || []

  // Sort by order
  const sortedCards = [...cards].sort((a, b) => a.order - b.order)

  if (sortedCards.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {sortedCards.map((cardConfig) => (
        <SmartKPICard key={cardConfig.id} config={cardConfig} stats={stats} onAction={onAction} />
      ))}
    </div>
  )
}

/**
 * Smart Button Renderer Component
 * Renders a button based on configuration with all smart features
 */
const SmartButton = ({ config, stats, customCallback, className = '' }) => {
  // Check visibility
  const isVisible = typeof config.visible === 'function' ? config.visible(stats) : true
  if (!isVisible) return null

  // Check disabled state
  const isDisabled = typeof config.disabled === 'function' ? config.disabled(stats) : false

  // Get badge value if applicable
  const badgeValue = config.showBadge && typeof config.badgeSource === 'function' 
    ? config.badgeSource(stats) 
    : null

  // Get icon component
  const Icon = config.icon

  // Build CSS classes
  const variantStyle = BUTTON_VARIANTS[config.variant || 'primary'][config.style || 'ghost']
  const sizeClass = BUTTON_SIZES[config.size || 'md']
  const baseClasses = 'font-medium rounded-lg transition-all flex items-center gap-2 relative'
  const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
  const allClasses = `${baseClasses} ${variantStyle} ${sizeClass} ${disabledClasses} ${className}`

  // Handle click
  const handleClick = (e) => {
    if (isDisabled) return

    // Track analytics
    if (config.analytics) {
      console.log(`[Analytics] ${config.analytics}`, { stats })
    }

    // Show confirmation if required
    if (config.confirmBefore) {
      const confirmed = window.confirm(config.confirmMessage || 'Are you sure?')
      if (!confirmed) return
    }

    // Execute action based on type
    switch (config.actionType) {
      case NAV_ACTIONS.HASH:
        window.location.hash = config.actionValue
        if (customCallback) customCallback(config.actionValue.replace('#', '').split('?')[0])
        break
      case NAV_ACTIONS.TAB:
        if (customCallback) customCallback(config.actionValue)
        break
      case NAV_ACTIONS.ROUTE:
        window.location.href = config.actionValue
        break
      case NAV_ACTIONS.CALLBACK:
        if (typeof config.actionValue === 'function') {
          config.actionValue(stats, customCallback)
        }
        break
      case NAV_ACTIONS.EXTERNAL:
        window.open(config.actionValue, '_blank', 'noopener,noreferrer')
        break
      default:
        console.warn('Unknown action type:', config.actionType)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={allClasses}
      title={config.tooltip}
      data-button-id={config.id}
      data-section={config.section}
    >
      {/* Left Icon */}
      {Icon && (config.iconPosition === 'left' || config.iconPosition === 'both') && (
        <Icon className="w-4 h-4 flex-shrink-0" />
      )}

      {/* Label */}
      <span>{config.label}</span>

      {/* Badge */}
      {config.showBadge && badgeValue !== null && badgeValue > 0 && (
        <span className="ml-1 px-2 py-0.5 bg-white bg-opacity-20 text-xs font-bold rounded-full min-w-[1.5rem] text-center">
          {badgeValue}
        </span>
      )}

      {/* Right Icon */}
      {Icon && (config.iconPosition === 'right') && (
        <Icon className="w-4 h-4 flex-shrink-0" />
      )}
    </button>
  )
}

/**
 * Button Group Component
 * Renders a group of buttons for a specific section with smart layout
 */
const SmartButtonGroup = ({ section, stats, buttons = OVERVIEW_BUTTONS, onTabChange, className = '' }) => {
  const sectionButtons = buttons.filter(btn => btn.section === section)
  
  if (sectionButtons.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {sectionButtons.map(config => (
        <SmartButton 
          key={config.id} 
          config={config} 
          stats={stats}
          customCallback={onTabChange}
        />
      ))}
    </div>
  )
}

// ── Soft-coded probation period configuration ─────────────────────────────
const PROBATION_PERIOD_MONTHS = 6

// ── Utility function to calculate probation end date ──────────────────────
const calculateProbationEndDate = (joiningDate) => {
  if (!joiningDate) return null
  const date = new Date(joiningDate)
  date.setMonth(date.getMonth() + PROBATION_PERIOD_MONTHS)
  return date.toISOString().split('T')[0]
}

// ── Spinner Component ──────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
)

// ── Main Component ─────────────────────────────────────────────────────────
export default function OnboardingOffboarding() {
  const user = useSelector((state) => state.auth.user)
  const [activeTab, setActiveTab] = useState('overview')
  // Filter applied to the Offboarding List tab when navigating there from an Overview card/button
  const [offboardingFilter, setOffboardingFilter] = useState(null)

  // Direct tab-bar navigation clears any pending filter (only Overview cards/buttons should set one)
  const goToTab = (tabId) => {
    if (tabId === 'offboarding') setOffboardingFilter(null)
    setActiveTab(tabId)
  }

  // Tabs configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: HeroIcons.ChartBarIcon },
    { id: 'onboarding', label: 'Onboarding List', icon: HeroIcons.UserPlusIcon },
    { id: 'offboarding', label: 'Offboarding List', icon: HeroIcons.UserMinusIcon },
    { id: 'create', label: 'Create New Employee', icon: HeroIcons.PlusCircleIcon },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <HeroIcons.UsersIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Onboarding | Offboarding</h1>
            <p className="text-sm text-slate-500">Employee lifecycle management — joining, exit, equipment, documents, access</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => goToTab(tab.id)}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-lg transition-all duration-200 whitespace-nowrap min-w-fit ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-md shadow-blue-500/30 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                  <span className="text-sm">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab onTabChange={setActiveTab} onOffboardingFilter={setOffboardingFilter} />}
        {activeTab === 'onboarding' && <OnboardingListTab />}
        {activeTab === 'offboarding' && <OffboardingListTab initialFilter={offboardingFilter} />}
        {activeTab === 'create' && <CreateEmployeeTab />}
      </div>
    </div>
  )
}

// Statuses that count as "not yet completed" — mirrors backend statistics() overdue/upcoming definitions
const ONBOARDING_ACTIVE_STATUSES = ['initiated', 'documentation', 'equipment', 'access_provisioning', 'training']
const OFFBOARDING_ACTIVE_STATUSES = ['initiated', 'access_revocation', 'equipment_return', 'exit_interview', 'final_settlement']

const ONBOARDING_MODAL_TITLES = {
  all: 'All Onboarding Processes',
  upcoming: 'Employees Joining Soon',
  overdue: 'Overdue Onboarding Items',
  completed: 'Onboarding Completed This Month',
}

// Maps a KPI/button action id to the onboarding modal filter it should apply
const ONBOARDING_FILTER_SIGNALS = {
  'all-onboarding': 'all',
  'upcoming-onboarding': 'upcoming',
  'overdue-onboarding': 'overdue',
  'completed-onboarding': 'completed',
}

// Maps a KPI/button action id to the offboarding list filter it should apply
const OFFBOARDING_FILTER_SIGNALS = {
  'all-offboarding': 'all',
  'upcoming-offboarding': 'upcoming',
  'overdue-offboarding': 'overdue',
  'completed-offboarding': 'completed',
}

const filterOnboardingRecords = (records, filterType, filterValue) => {
  const today = new Date().toISOString().split('T')[0]
  const upcomingLimit = new Date()
  upcomingLimit.setDate(upcomingLimit.getDate() + 30)
  const upcomingLimitStr = upcomingLimit.toISOString().split('T')[0]
  const now = new Date()

  switch (filterType) {
    case 'upcoming':
      return records.filter(
        (r) => r.joining_date && r.joining_date >= today && r.joining_date <= upcomingLimitStr && ONBOARDING_ACTIVE_STATUSES.includes(r.status)
      )
    case 'overdue':
      return records.filter((r) => r.joining_date && r.joining_date < today && ONBOARDING_ACTIVE_STATUSES.includes(r.status))
    case 'completed':
      return records.filter((r) => {
        if (r.status !== 'completed' || !r.actual_completion_date) return false
        const d = new Date(r.actual_completion_date)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
    case 'branch':
      return records.filter((r) => r.branch === filterValue)
    case 'all':
    default:
      return records
  }
}

// ── Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab({ onTabChange, onOffboardingFilter }) {
  const [onboardingStats, setOnboardingStats] = useState(null)
  const [offboardingStats, setOffboardingStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false)
  const [onboardingModalTitle, setOnboardingModalTitle] = useState('')
  const [onboardingModalItems, setOnboardingModalItems] = useState([])
  const [onboardingModalLoading, setOnboardingModalLoading] = useState(false)

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadOnboardingRecords = (filterType, filterValue) => {
    setOnboardingModalOpen(true)
    setOnboardingModalLoading(true)
    setOnboardingModalTitle(
      filterType === 'branch'
        ? `Onboarding — ${BRANCH_CONFIG[filterValue]?.label || filterValue}`
        : ONBOARDING_MODAL_TITLES[filterType] || 'Onboarding Processes'
    )
    apiClient
      .get(`${API_BASE}/onboarding/`)
      .then((res) => {
        const records = res.data?.results || []
        setOnboardingModalItems(filterOnboardingRecords(records, filterType, filterValue))
      })
      .catch((err) => console.error('Failed to load onboarding records:', err))
      .finally(() => setOnboardingModalLoading(false))
  }

  const handleOnboardingAction = (action) => {
    if (typeof action === 'string' && action.startsWith('branch-onboarding:')) {
      loadOnboardingRecords('branch', action.slice('branch-onboarding:'.length))
    } else if (ONBOARDING_FILTER_SIGNALS[action]) {
      loadOnboardingRecords(ONBOARDING_FILTER_SIGNALS[action])
    } else if (onTabChange) {
      onTabChange(action)
    }
  }

  const handleOffboardingAction = (action) => {
    if (typeof action === 'string' && action.startsWith('branch-offboarding:')) {
      if (onOffboardingFilter) onOffboardingFilter({ branch: action.slice('branch-offboarding:'.length) })
      if (onTabChange) onTabChange('offboarding')
    } else if (OFFBOARDING_FILTER_SIGNALS[action]) {
      if (onOffboardingFilter) onOffboardingFilter({ dateFilter: OFFBOARDING_FILTER_SIGNALS[action] })
      if (onTabChange) onTabChange('offboarding')
    } else if (onTabChange) {
      onTabChange(action)
    }
  }

  const loadStatistics = () => {
    setLoading(true)
    Promise.all([
      apiClient.get(`${API_BASE}/onboarding/statistics/`),
      apiClient.get(`${API_BASE}/offboarding/statistics/`),
    ])
      .then(([onRes, offRes]) => {
        setOnboardingStats(onRes.data)
        setOffboardingStats(offRes.data)
      })
      .catch((err) => console.error('Failed to load statistics:', err))
      .finally(() => setLoading(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
        <span className="ml-2 text-slate-500">Loading statistics...</span>
      </div>
    )
  }

  const totalActive = (onboardingStats?.total ?? 0) + (offboardingStats?.total ?? 0)
  const totalUrgent = (onboardingStats?.overdue ?? 0) + (offboardingStats?.overdue ?? 0)

  return (
    <div className="space-y-6">
      {/* Global Actions Bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <HeroIcons.ChartBarIcon className="w-5 h-5 text-slate-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Overview Dashboard</h3>
            <p className="text-xs text-slate-500">Real-time employee lifecycle metrics</p>
          </div>
        </div>
        {/* Global Action Buttons */}
        <SmartButtonGroup 
          section="global" 
          stats={{ onboarding: onboardingStats, offboarding: offboardingStats }}
          customCallback={loadStatistics}
        />
      </div>

      {/* Hero Stats */}
      <div className="bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm font-medium opacity-90 mb-1">Total Active Processes</div>
            <div className="text-4xl font-bold">{totalActive}</div>
            <div className="text-xs opacity-75 mt-1">
              {onboardingStats?.total ?? 0} onboarding • {offboardingStats?.total ?? 0} offboarding
            </div>
          </div>
          <div>
            <div className="text-sm font-medium opacity-90 mb-1">Upcoming Actions</div>
            <div className="text-4xl font-bold">
              {(onboardingStats?.upcoming_joiners ?? 0) + (offboardingStats?.upcoming_exits ?? 0)}
            </div>
            <div className="text-xs opacity-75 mt-1">Next 30 days</div>
          </div>
          <div>
            <div className="text-sm font-medium opacity-90 mb-1 flex items-center gap-2">
              {totalUrgent > 0 && <HeroIcons.ExclamationTriangleIcon className="w-4 h-4 animate-pulse" />}
              Urgent Attention
            </div>
            <div className="text-4xl font-bold">{totalUrgent}</div>
            <div className="text-xs opacity-75 mt-1">
              {totalUrgent > 0 ? 'Overdue items requiring action' : 'All on track'}
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <HeroIcons.UserPlusIcon className="w-6 h-6 text-white" />
            </div>
            Onboarding Pipeline
          </h2>
          {/* Smart Button Group for Onboarding Actions */}
          <SmartButtonGroup
            section="onboarding"
            stats={onboardingStats}
            onTabChange={handleOnboardingAction}
            className="flex-shrink-0"
          />
        </div>

        {/* Main KPIs - Smart Card Grid */}
        <div className="mb-6">
          <SmartKPICardGrid section="onboarding" stats={onboardingStats} onAction={handleOnboardingAction} />
        </div>

        {/* Status Pipeline */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Status Pipeline</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {Object.entries(onboardingStats?.by_status ?? {}).map(([status, count]) => {
              const cfg = ONBOARDING_STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
              return (
                <div key={status} className={`rounded-lg border px-3 py-3 text-center hover:shadow-md transition-all cursor-pointer ${cfg.color}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-[10px] font-semibold opacity-80 mt-1 uppercase tracking-wide">{cfg.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Branch Breakdown */}
        {onboardingStats?.by_branch && Object.keys(onboardingStats.by_branch).length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">By Branch</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(onboardingStats.by_branch).map(([branch, count]) => {
                const branchCfg = BRANCH_CONFIG[branch] || { label: branch, color: 'text-slate-600' }
                return (
                  <div
                    key={branch}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleOnboardingAction(`branch-onboarding:${branch}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-xs font-medium ${branchCfg.color}`}>{branchCfg.label}</div>
                        <div className="text-2xl font-bold text-slate-700 mt-1">{count}</div>
                      </div>
                      <HeroIcons.BuildingOfficeIcon className={`w-8 h-8 opacity-20 ${branchCfg.color}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Offboarding Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-md">
              <HeroIcons.UserMinusIcon className="w-6 h-6 text-white" />
            </div>
            Offboarding Pipeline
          </h2>
          {/* Smart Button Group for Offboarding Actions */}
          <SmartButtonGroup
            section="offboarding"
            stats={offboardingStats}
            onTabChange={handleOffboardingAction}
            className="flex-shrink-0"
          />
        </div>

        {/* Main KPIs - Smart Card Grid */}
        <div className="mb-6">
          <SmartKPICardGrid section="offboarding" stats={offboardingStats} onAction={handleOffboardingAction} />
        </div>

        {/* Status Pipeline */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Status Pipeline</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {Object.entries(offboardingStats?.by_status ?? {}).map(([status, count]) => {
              const cfg = OFFBOARDING_STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
              return (
                <div key={status} className={`rounded-lg border px-3 py-3 text-center hover:shadow-md transition-all cursor-pointer ${cfg.color}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-[10px] font-semibold opacity-80 mt-1 uppercase tracking-wide">{cfg.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Exit Reasons */}
        {offboardingStats?.by_exit_reason && Object.keys(offboardingStats.by_exit_reason).length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Exit Reasons Analysis</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
              {Object.entries(offboardingStats.by_exit_reason).map(([reason, count]) => {
                const cfg = EXIT_REASON_CONFIG[reason] || { label: reason, icon: HeroIcons.QuestionMarkCircleIcon }
                const Icon = cfg.icon
                return (
                  <div key={reason} className="bg-white rounded-lg border border-slate-200 px-2 py-3 text-center hover:shadow-lg hover:border-rose-300 transition-all cursor-pointer group">
                    <Icon className="w-6 h-6 mx-auto text-slate-500 mb-2 group-hover:text-rose-600 transition-colors" />
                    <div className="text-xl font-bold text-slate-700">{count}</div>
                    <div className="text-[9px] text-slate-500 mt-1 font-medium">{cfg.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Branch Breakdown */}
        {offboardingStats?.by_branch && Object.keys(offboardingStats.by_branch).length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">By Branch</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(offboardingStats.by_branch).map(([branch, count]) => {
                const branchCfg = BRANCH_CONFIG[branch] || { label: branch, color: 'text-slate-600' }
                return (
                  <div
                    key={branch}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleOffboardingAction(`branch-offboarding:${branch}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-xs font-medium ${branchCfg.color}`}>{branchCfg.label}</div>
                        <div className="text-2xl font-bold text-slate-700 mt-1">{count}</div>
                      </div>
                      <HeroIcons.BuildingOfficeIcon className={`w-8 h-8 opacity-20 ${branchCfg.color}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Records Modal (Total Active / Joining Soon / Overdue / Completed / By Branch) */}
      {onboardingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOnboardingModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <HeroIcons.ExclamationTriangleIcon className="w-5 h-5 text-rose-500" />
                {onboardingModalTitle}
              </h3>
              <button
                onClick={() => setOnboardingModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                title="Close"
              >
                <HeroIcons.XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {onboardingModalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                  <span className="ml-2 text-slate-500 text-sm">Loading...</span>
                </div>
              ) : onboardingModalItems.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No matching onboarding items.</p>
              ) : (
                onboardingModalItems.map((item) => {
                  const cfg = ONBOARDING_STATUS_CONFIG[item.status] || { label: item.status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-800">{item.employee_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Joining date: {item.joining_date ? new Date(item.joining_date).toLocaleDateString() : '—'}
                          {item.department ? ` • ${item.department}` : ''}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs border ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onboarding List Tab ────────────────────────────────────────────────────
function OnboardingListTab() {
  const [employees, setEmployees] = useState([])
  const [fieldGroups, setFieldGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [viewMode, setViewMode] = useState('compact') // 'cards' or 'compact'
  const [editingRow, setEditingRow] = useState(null) // userId of row being edited
  const [editFormData, setEditFormData] = useState({}) // Form data for inline editing

  useEffect(() => {
    loadEmployees()
  }, [searchQuery])

  const loadEmployees = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery) params.append('search', searchQuery)

    apiClient
      .get(`${API_ENDPOINTS.employees}/active_employees/?${params}`)
      .then((res) => {
        setEmployees(res.data.results || [])
        setFieldGroups(res.data.field_groups || [])
      })
      .catch((err) => console.error('Failed to load employees:', err))
      .finally(() => setLoading(false))
  }

  const handleEdit = (userId, field, currentValue, source) => {
    setEditingField({ userId, field, source })
    setEditValue(currentValue || '')
  }

  const handleSave = () => {
    if (!editingField) return
    
    setSaving(true)
    const { userId, field, source } = editingField

    apiClient
      .patch(`${API_ENDPOINTS.employees}/${userId}/update_profile_field/`, {
        field,
        value: editValue,
        source,
      })
      .then(() => {
        setAlert({ type: 'success', message: 'Field updated successfully' })
        loadEmployees() // Reload to show updated data
        setEditingField(null)
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to update field' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setSaving(false))
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditValue('')
  }

  // ── Quick Edit Functions (for list view) ────────────────────────────────────
  const handleQuickEdit = (employee) => {
    setEditingRow(employee.user_id)
    // Initialize edit form with current values
    const formData = {}
    QUICK_EDIT_FIELDS.forEach(field => {
      formData[field.key] = employee[field.key] || ''
    })
    setEditFormData(formData)
  }

  const handleQuickSave = (userId) => {
    setSaving(true)
    
    // Prepare updates for each changed field
    const updates = []
    QUICK_EDIT_FIELDS.forEach(field => {
      const currentValue = employees.find(e => e.user_id === userId)?.[field.key] || ''
      const newValue = editFormData[field.key] || ''
      if (currentValue !== newValue) {
        updates.push(
          apiClient.patch(`${API_ENDPOINTS.employees}/${userId}/update_profile_field/`, {
            field: field.key,
            value: newValue,
            source: field.source,
          })
        )
      }
    })

    if (updates.length === 0) {
      setEditingRow(null)
      setSaving(false)
      return
    }

    Promise.all(updates)
      .then(() => {
        setAlert({ type: 'success', message: `Updated ${updates.length} field(s) successfully` })
        loadEmployees() // Reload to show updated data
        setEditingRow(null)
        setEditFormData({})
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to update fields' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setSaving(false))
  }

  const handleQuickCancel = () => {
    setEditingRow(null)
    setEditFormData({})
  }

  const handleFieldChange = (fieldKey, value) => {
    setEditFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
  }

  const renderFieldValue = (employee, field) => {
    const value = employee[field.key]
    const isEmpty = !value || value === ''
    const isEditing = editingField?.userId === employee.user_id && editingField?.field === field.key

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <input
            type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
            title="Save"
          >
            <HeroIcons.CheckIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"
            title="Cancel"
          >
            <HeroIcons.XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )
    }

    if (isEmpty) {
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-slate-400 italic text-xs">Empty</span>
          <button
            onClick={() => handleEdit(employee.user_id, field.key, value, field.source)}
            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit"
          >
            <HeroIcons.PencilIcon className="w-3 h-3" />
          </button>
        </div>
      )
    }

    // Display value based on type
    if (field.type === 'boolean') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {value ? 'Yes' : 'No'}
        </span>
      )
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className="text-xs text-slate-700">{value}</span>
        <button
          onClick={() => handleEdit(employee.user_id, field.key, value, field.source)}
          className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
          title="Edit"
        >
          <HeroIcons.PencilIcon className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Alert */}
      {alert && (
        <div className={`rounded-lg border p-3 flex items-center gap-2 ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <HeroIcons.CheckCircleIcon className="w-5 h-5" />
          ) : (
            <HeroIcons.ExclamationCircleIcon className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{alert.message}</span>
        </div>
      )}

      {/* Search & View Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2">
            <HeroIcons.MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, employee number, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card View"
            >
              <HeroIcons.Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'compact'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Compact View"
            >
              <HeroIcons.ListBulletIcon className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg font-medium">
            {employees.length} {employees.length === 1 ? 'Employee' : 'Employees'}
          </div>
        </div>
      </div>

      {/* Employee List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Spinner />
          <span className="ml-2 text-slate-500 mt-2">Loading employees...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border-2 border-dashed border-slate-300 p-16 text-center">
          <HeroIcons.InboxIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No employees found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((employee) => (
            <div
              key={employee.user_id}
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden group"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-500 to-violet-500 p-4 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-base">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    {employee.preferred_given_name && (
                      <p className="text-xs text-blue-100 mt-0.5">
                        "{employee.preferred_given_name}"
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-xs font-medium backdrop-blur-sm">
                        <HeroIcons.IdentificationIcon className="w-3 h-3 mr-1" />
                        {employee.employee_number || 'No ID'}
                      </span>
                      {employee.is_active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/90 text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                    <HeroIcons.UserIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Email */}
                <div className="flex items-center gap-2">
                  <HeroIcons.EnvelopeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-600 truncate">{employee.email}</span>
                </div>

                {/* Manager */}
                {employee.manager_name && (
                  <div className="flex items-center gap-2">
                    <HeroIcons.UserCircleIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600">
                      Reports to: <span className="font-medium text-slate-700">{employee.manager_name}</span>
                    </span>
                  </div>
                )}

                {/* Organization */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Department</p>
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {employee.division || employee.department || <span className="text-slate-400 italic">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Title</p>
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {employee.job_title_uae || employee.job_title_finland || <span className="text-slate-400 italic">—</span>}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => setExpandedRow(expandedRow === employee.user_id ? null : employee.user_id)}
                  className="w-full mt-3 px-3 py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-blue-300"
                >
                  {expandedRow === employee.user_id ? (
                    <>
                      <HeroIcons.ChevronUpIcon className="w-4 h-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <HeroIcons.ChevronDownIcon className="w-4 h-4" />
                      View Full Details
                    </>
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {expandedRow === employee.user_id && (
                <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                  <div className="space-y-4">
                    {/* Employee Fields Grid */}
                    <div className="grid grid-cols-1 gap-3">
                      {fieldGroups.map((group) => (
                        <div key={group.group} className="bg-white rounded-lg border border-slate-200 p-3">
                          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <HeroIcons.TagIcon className="w-3.5 h-3.5 text-blue-500" />
                            {group.group}
                          </h4>
                          <div className="space-y-2 mt-2">
                            {group.fields.map((field) => (
                              <div key={field.key} className="flex justify-between items-start gap-2 py-1">
                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide flex-shrink-0 pt-0.5">
                                  {field.label}:
                                </span>
                                <div className="flex-1 text-right">
                                  {renderFieldValue(employee, field)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Document Upload Section */}
                    <DocumentManagementSection employeeId={employee.user_id} employeeEmail={employee.email} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Compact List View */
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {employees.map((employee) => (
            <div key={employee.user_id} className="hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                  {employee.first_name?.[0]}{employee.last_name?.[0]}
                </div>

                {/* Info Grid */}
                <div className="flex-1 min-w-0">
                  {editingRow === employee.user_id ? (
                    /* Edit Mode */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">First Name</label>
                        <input
                          type="text"
                          value={editFormData.first_name || ''}
                          onChange={(e) => handleFieldChange('first_name', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="First Name"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editFormData.last_name || ''}
                          onChange={(e) => handleFieldChange('last_name', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Last Name"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Email</label>
                        <input
                          type="email"
                          value={editFormData.email || ''}
                          onChange={(e) => handleFieldChange('email', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Email"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Job Title</label>
                        <input
                          type="text"
                          value={editFormData.job_title_uae || ''}
                          onChange={(e) => handleFieldChange('job_title_uae', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Job Title"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Division</label>
                        <input
                          type="text"
                          value={editFormData.division || ''}
                          onChange={(e) => handleFieldChange('division', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Division"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Department</label>
                        <input
                          type="text"
                          value={editFormData.department || ''}
                          onChange={(e) => handleFieldChange('department', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Department"
                        />
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-1 items-center">
                      {/* Name & Email */}
                      <div className="md:col-span-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{employee.email}</p>
                      </div>
                      
                      {/* Employee # */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Emp #</p>
                        <p className="text-xs text-slate-700 font-medium">{employee.employee_number || '—'}</p>
                      </div>
                      
                      {/* Manager */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Manager</p>
                        <p className="text-xs text-slate-700 truncate">{employee.manager_name || '—'}</p>
                      </div>
                      
                      {/* Department */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Department</p>
                        <p className="text-xs text-slate-700 truncate">{employee.division || employee.department || '—'}</p>
                      </div>
                      
                      {/* Job Title */}
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Job Title</p>
                        <p className="text-xs text-slate-700 truncate">{employee.job_title_uae || employee.job_title_finland || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingRow === employee.user_id ? (
                    /* Edit Mode Actions */
                    <>
                      <button
                        onClick={() => handleQuickSave(employee.user_id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save Changes"
                      >
                        <HeroIcons.CheckIcon className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleQuickCancel}
                        disabled={saving}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Cancel"
                      >
                        <HeroIcons.XMarkIcon className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    /* View Mode Actions */
                    <>
                      {employee.is_active && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide hidden lg:inline">Active</span>
                        </div>
                      )}
                      <button
                        onClick={() => handleQuickEdit(employee)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Employee"
                      >
                        <HeroIcons.PencilSquareIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setExpandedRow(expandedRow === employee.user_id ? null : employee.user_id)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={expandedRow === employee.user_id ? "Hide Details" : "Show Details"}
                      >
                        {expandedRow === employee.user_id ? (
                          <HeroIcons.ChevronUpIcon className="w-5 h-5" />
                        ) : (
                          <HeroIcons.ChevronDownIcon className="w-5 h-5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRow === employee.user_id && (
                <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/20 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fieldGroups.map((group) => (
                      <div key={group.group} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                        <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                          <HeroIcons.TagIcon className="w-3.5 h-3.5 text-blue-500" />
                          {group.group}
                        </h4>
                        <div className="space-y-1.5 mt-2">
                          {group.fields.map((field) => (
                            <div key={field.key} className="flex justify-between items-start gap-2 py-0.5">
                              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide flex-shrink-0">
                                {field.label}:
                              </span>
                              <div className="text-right flex-1">
                                {renderFieldValue(employee, field)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <DocumentManagementSection employeeId={employee.user_id} employeeEmail={employee.email} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SMART OFFBOARDING LIST CONFIGURATION ───────────────────────────────────
// All table columns, filters, and actions are configured here
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Offboarding Table Column Configuration
 * Each column can be configured with:
 * - id: unique identifier
 * - label: column header text
 * - field: data field key
 * - type: data type (text, date, number, badge, progress)
 * - width: column width (sm, md, lg, xl, auto)
 * - sortable: enable sorting
 * - filterable: enable filtering
 * - visible: default visibility
 * - order: display order
 * - render: custom render function
 */
const OFFBOARDING_TABLE_COLUMNS = [
  {
    id: 'employee',
    label: 'Employee',
    field: 'employee_name',
    type: 'text',
    width: 'lg',
    sortable: true,
    filterable: true,
    visible: true,
    order: 1,
    render: (record) => (
      <div>
        <p className="text-sm font-semibold text-slate-700">{record.employee_name || 'N/A'}</p>
        <p className="text-xs text-slate-500">{record.employee_email || ''}</p>
      </div>
    ),
  },
  {
    id: 'position',
    label: 'Position',
    field: 'position',
    type: 'text',
    width: 'md',
    sortable: true,
    filterable: false,
    visible: true,
    order: 2,
    render: (record) => (
      <span className="text-sm text-slate-600">{record.position || '—'}</span>
    ),
  },
  {
    id: 'branch',
    label: 'Branch',
    field: 'branch',
    type: 'badge',
    width: 'sm',
    sortable: true,
    filterable: true,
    visible: true,
    order: 3,
    render: (record) => {
      const branchCfg = BRANCH_CONFIG[record.branch] || BRANCH_CONFIG.RAD
      return <span className={`text-xs font-medium ${branchCfg.color}`}>{branchCfg.label}</span>
    },
  },
  {
    id: 'last_working_day',
    label: 'Last Working Day',
    field: 'last_working_day',
    type: 'date',
    width: 'md',
    sortable: true,
    filterable: false,
    visible: true,
    order: 4,
    render: (record) => {
      const daysUntil = record.days_until_exit
      const isUrgent = daysUntil <= 7 && daysUntil >= 0
      return (
        <div>
          <p className="text-sm text-slate-700">{record.last_working_day ? new Date(record.last_working_day).toLocaleDateString() : '—'}</p>
          {daysUntil !== undefined && (
            <p className={`text-xs ${isUrgent ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
              {daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`}
            </p>
          )}
        </div>
      )
    },
  },
  {
    id: 'exit_reason',
    label: 'Exit Reason',
    field: 'exit_reason',
    type: 'text',
    width: 'md',
    sortable: false,
    filterable: true,
    visible: true,
    order: 5,
    render: (record) => {
      const exitCfg = EXIT_REASON_CONFIG[record.exit_reason] || EXIT_REASON_CONFIG.other
      return <span className="text-xs text-slate-700">{exitCfg.label}</span>
    },
  },
  {
    id: 'status',
    label: 'Status',
    field: 'status',
    type: 'badge',
    width: 'md',
    sortable: true,
    filterable: true,
    visible: true,
    order: 6,
    render: (record) => {
      const statusCfg = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      )
    },
  },
  {
    id: 'progress',
    label: 'Progress',
    field: 'progress_percentage',
    type: 'progress',
    width: 'md',
    sortable: true,
    filterable: false,
    visible: true,
    order: 7,
    render: (record) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-rose-500 h-full transition-all"
            style={{ width: `${record.progress_percentage || 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600">{record.progress_percentage || 0}%</span>
      </div>
    ),
  },
]

/**
 * Offboarding List Action Buttons Configuration
 */
const OFFBOARDING_LIST_ACTIONS = [
  {
    id: 'add-offboarding',
    label: 'Initiate Exit',
    icon: HeroIcons.UserMinusIcon,
    variant: 'warning',
    style: 'base',
    size: 'md',
    onClick: (records, loadRecords, setShowInitiateModal) => {
      if (setShowInitiateModal) setShowInitiateModal(true)
    },
    visible: true,
    tooltip: 'Start new offboarding process',
  },
  {
    id: 'export-list',
    label: 'Export',
    icon: HeroIcons.ArrowDownTrayIcon,
    variant: 'secondary',
    style: 'outline',
    size: 'md',
    onClick: (records) => {
      console.log('Export records:', records)
      alert('Export feature - to be implemented')
    },
    visible: true,
    tooltip: 'Export offboarding list to Excel',
  },
  {
    id: 'refresh',
    label: 'Refresh',
    icon: HeroIcons.ArrowPathIcon,
    variant: 'secondary',
    style: 'ghost',
    size: 'md',
    onClick: (records, loadRecords) => {
      if (loadRecords) loadRecords()
    },
    visible: true,
    tooltip: 'Reload offboarding records',
  },
]

/**
 * Initiate Exit Form Field Configuration
 * All form fields are soft-coded here for easy maintenance
 */
const INITIATE_EXIT_FORM_FIELDS = [
  {
    id: 'employee',
    label: 'Select Employee',
    field: 'employee_id',
    type: 'select-search',
    required: true,
    section: 'employee',
    placeholder: 'Search by name or email...',
    tooltip: 'Select the employee who is leaving',
    validation: (value) => value ? null : 'Employee is required',
  },
  {
    id: 'position',
    label: 'Position',
    field: 'position',
    type: 'text',
    required: true,
    section: 'employee',
    placeholder: 'e.g., Senior Engineer',
    tooltip: 'Current position/job title',
    validation: (value) => value?.trim() ? null : 'Position is required',
  },
  {
    id: 'department',
    label: 'Department',
    field: 'department',
    type: 'text',
    required: true,
    section: 'employee',
    placeholder: 'e.g., Engineering',
    tooltip: 'Current department',
    validation: (value) => value?.trim() ? null : 'Department is required',
  },
  {
    id: 'reporting_manager',
    label: 'Reporting Manager',
    field: 'reporting_manager',
    type: 'text',
    required: false,
    section: 'employee',
    placeholder: 'Manager name',
    tooltip: 'Direct supervisor/manager',
  },
  {
    id: 'branch',
    label: 'Branch',
    field: 'branch',
    type: 'select',
    required: true,
    section: 'employee',
    options: Object.entries(BRANCH_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    defaultValue: 'RAD',
    tooltip: 'Office branch location',
  },
  {
    id: 'exit_reason',
    label: 'Exit Reason',
    field: 'exit_reason',
    type: 'select',
    required: true,
    section: 'exit',
    options: Object.entries(EXIT_REASON_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    tooltip: 'Primary reason for leaving',
    validation: (value) => value ? null : 'Exit reason is required',
  },
  {
    id: 'exit_reason_detail',
    label: 'Exit Reason Details',
    field: 'exit_reason_detail',
    type: 'textarea',
    required: false,
    section: 'exit',
    placeholder: 'Provide additional details about the exit reason...',
    tooltip: 'Optional detailed explanation',
    rows: 3,
  },
  {
    id: 'last_working_day',
    label: 'Last Working Day',
    field: 'last_working_day',
    type: 'date',
    required: true,
    section: 'exit',
    tooltip: 'Expected last day at work',
    validation: (value) => {
      if (!value) return 'Last working day is required'
      const date = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (date < today) return 'Last working day cannot be in the past'
      return null
    },
  },
  {
    id: 'notice_period_days',
    label: 'Notice Period (Days)',
    field: 'notice_period_days',
    type: 'number',
    required: false,
    section: 'exit',
    defaultValue: 30,
    min: 0,
    max: 180,
    placeholder: '30',
    tooltip: 'Standard notice period in days',
  },
  {
    id: 'assigned_to',
    label: 'Assign To HR',
    field: 'assigned_to',
    type: 'select',
    required: false,
    section: 'tracking',
    placeholder: 'Select HR manager (optional)',
    tooltip: 'HR personnel responsible for this offboarding',
    options: [], // Will be populated from API
  },
  {
    id: 'notes',
    label: 'Additional Notes',
    field: 'notes',
    type: 'textarea',
    required: false,
    section: 'tracking',
    placeholder: 'Any additional information or special considerations...',
    tooltip: 'Internal notes about this offboarding process',
    rows: 3,
  },
]

/**
 * Form Sections Configuration
 */
const INITIATE_EXIT_FORM_SECTIONS = [
  {
    id: 'employee',
    label: 'Employee Information',
    icon: HeroIcons.UserIcon,
    description: 'Basic employee and position details',
  },
  {
    id: 'exit',
    label: 'Exit Details',
    icon: HeroIcons.ArrowRightOnRectangleIcon,
    description: 'Reason and timeline for departure',
  },
  {
    id: 'tracking',
    label: 'Process Tracking',
    icon: HeroIcons.ClipboardDocumentCheckIcon,
    description: 'Assignment and notes',
  },
]

/**
 * Offboarding Filter Configuration
 */
const OFFBOARDING_FILTERS = [
  {
    id: 'search',
    type: 'text',
    placeholder: 'Search by name, email, position...',
    field: 'search',
    icon: HeroIcons.MagnifyingGlassIcon,
    width: 'full',
  },
  {
    id: 'status',
    type: 'select',
    placeholder: 'All Statuses',
    field: 'status',
    options: Object.entries(OFFBOARDING_STATUS_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    width: 'md',
  },
  {
    id: 'branch',
    type: 'select',
    placeholder: 'All Branches',
    field: 'branch',
    options: Object.entries(BRANCH_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    width: 'md',
  },
  {
    id: 'exit_reason',
    type: 'select',
    placeholder: 'All Exit Reasons',
    field: 'exit_reason',
    options: Object.entries(EXIT_REASON_CONFIG).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
    width: 'md',
  },
]

// ── Offboarding List Tab ───────────────────────────────────────────────────
function OffboardingListTab({ initialFilter } = {}) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    branch: initialFilter?.branch || '',
    exit_reason: '',
    search: '',
  })
  // Client-side date-range filter set when arriving from an Overview KPI card ('upcoming' | 'overdue' | 'completed' | 'all')
  const [dateFilter, setDateFilter] = useState(initialFilter?.dateFilter || 'all')
  const [expandedRow, setExpandedRow] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [viewMode, setViewMode] = useState('table') // 'table' or 'cards'
  const [stats, setStats] = useState({ total: 0, urgent: 0, overdue: 0, completed: 0 })
  const [showInitiateModal, setShowInitiateModal] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [filters])

  const displayRecords = useMemo(() => {
    if (dateFilter === 'all') return records
    const now = new Date()
    return records.filter((r) => {
      if (dateFilter === 'upcoming') {
        return r.days_until_exit >= 0 && r.days_until_exit <= 30 && OFFBOARDING_ACTIVE_STATUSES.includes(r.status)
      }
      if (dateFilter === 'overdue') {
        return r.days_until_exit < 0 && OFFBOARDING_ACTIVE_STATUSES.includes(r.status)
      }
      if (dateFilter === 'completed') {
        if (r.status !== 'completed' || !r.actual_completion_date) return false
        const d = new Date(r.actual_completion_date)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, dateFilter])

  const loadRecords = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.branch) params.append('branch', filters.branch)
    if (filters.exit_reason) params.append('exit_reason', filters.exit_reason)
    if (filters.search) params.append('search', filters.search)

    apiClient
      .get(`${API_BASE}/offboarding/?${params}`)
      .then((res) => {
        // Handle both paginated response (res.data.results) and direct array (res.data)
        const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setRecords(data)
        
        // Calculate stats from records
        const total = data.length
        const urgent = data.filter(r => r.days_until_exit <= 7 && r.days_until_exit >= 0).length
        const overdue = data.filter(r => r.days_until_exit < 0).length
        const completed = data.filter(r => r.status === 'completed').length
        setStats({ total, urgent, overdue, completed })
      })
      .catch((err) => console.error('Failed to load offboarding records:', err))
      .finally(() => setLoading(false))
  }

  const handleEdit = (recordId, field, currentValue) => {
    setEditingField({ recordId, field })
    setEditValue(currentValue || '')
  }

  const handleSave = () => {
    if (!editingField) return
    
    setSaving(true)
    const { recordId, field } = editingField

    apiClient
      .patch(`${API_BASE}/offboarding/${recordId}/`, {
        [field]: editValue,
      })
      .then(() => {
        setAlert({ type: 'success', message: 'Field updated successfully' })
        loadRecords() // Reload to show updated data
        setEditingField(null)
        setTimeout(() => setAlert(null), 3000)
      })
      .catch((err) => {
        setAlert({ type: 'error', message: err.response?.data?.error || 'Failed to update field' })
        setTimeout(() => setAlert(null), 5000)
      })
      .finally(() => setSaving(false))
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditValue('')
  }

  const renderFieldValue = (record, field, label, type = 'text') => {
    const value = record[field]
    const isEmpty = !value || value === ''
    const isEditing = editingField?.recordId === record.id && editingField?.field === field

    // Non-editable fields (system fields)
    const nonEditableFields = ['id', 'user', 'created_by', 'assigned_to', 'created_at', 'updated_at', 'initiated_date', 'actual_completion_date', 'progress_percentage']
    const isEditable = !nonEditableFields.includes(field)

    if (isEditing && isEditable) {
      if (type === 'date') {
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save">
              <HeroIcons.CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} disabled={saving} className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors" title="Cancel">
              <HeroIcons.XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )
      } else if (type === 'textarea') {
        return (
          <div className="flex flex-col gap-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows="3"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                Save
              </button>
              <button onClick={handleCancel} disabled={saving} className="px-3 py-1 text-xs bg-slate-500 text-white rounded hover:bg-slate-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )
      } else {
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={handleSave} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save">
              <HeroIcons.CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} disabled={saving} className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors" title="Cancel">
              <HeroIcons.XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )
      }
    }

    if (isEmpty && isEditable) {
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-slate-400 italic text-xs">Empty</span>
          <button
            onClick={() => handleEdit(record.id, field, value)}
            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit"
          >
            <HeroIcons.PencilIcon className="w-3 h-3" />
          </button>
        </div>
      )
    }

    // Display value based on type
    if (type === 'date' && value) {
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-xs text-slate-700">{new Date(value).toLocaleDateString()}</span>
          {isEditable && (
            <button
              onClick={() => handleEdit(record.id, field, value)}
              className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
              title="Edit"
            >
              <HeroIcons.PencilIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className="text-xs text-slate-700">{value || '—'}</span>
        {isEditable && value && (
          <button
            onClick={() => handleEdit(record.id, field, value)}
            className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="Edit"
          >
            <HeroIcons.PencilIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Alert */}
      {alert && (
        <div className={`rounded-lg border p-3 flex items-center gap-2 ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <HeroIcons.CheckCircleIcon className="w-5 h-5" />
          ) : (
            <HeroIcons.ExclamationCircleIcon className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{alert.message}</span>
        </div>
      )}

      {/* Quick Stats Banner */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <HeroIcons.UserMinusIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold opacity-90">Offboarding Pipeline</h3>
              <p className="text-xs opacity-75">Active exit processes</p>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {OFFBOARDING_LIST_ACTIONS.filter(action => action.visible).map(action => {
              const Icon = action.icon
              const variantStyle = BUTTON_VARIANTS[action.variant][action.style]
              const sizeClass = BUTTON_SIZES[action.size]
              return (
                <button
                  key={action.id}
                  onClick={() => action.onClick(records, loadRecords, setShowInitiateModal)}
                  className={`${variantStyle} ${sizeClass} rounded-lg font-medium transition-all flex items-center gap-2`}
                  title={action.tooltip}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80 mt-1">Total Active</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats.urgent}
              {stats.urgent > 0 && <HeroIcons.ExclamationTriangleIcon className="w-4 h-4 animate-pulse" />}
            </div>
            <div className="text-xs opacity-80 mt-1">Leaving Soon (≤7 days)</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <div className="text-xs opacity-80 mt-1">Past Last Day</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.completed}</div>
            <div className="text-xs opacity-80 mt-1">Completed</div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Filters</span>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <HeroIcons.ListBulletIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card View"
              >
                <HeroIcons.Squares2X2Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {OFFBOARDING_FILTERS.map(filter => {
              if (filter.type === 'text') {
                const Icon = filter.icon
                return (
                  <div key={filter.id} className="relative">
                    {Icon && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Icon className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder={filter.placeholder}
                      value={filters[filter.field]}
                      onChange={(e) => setFilters({ ...filters, [filter.field]: e.target.value })}
                      className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500`}
                    />
                  </div>
                )
              } else if (filter.type === 'select') {
                return (
                  <select
                    key={filter.id}
                    value={filters[filter.field]}
                    onChange={(e) => setFilters({ ...filters, [filter.field]: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">{filter.placeholder}</option>
                    {filter.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )
              }
            })}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Spinner />
          <span className="ml-2 text-slate-500 mt-2">Loading offboarding records...</span>
        </div>
      ) : displayRecords.length === 0 ? (
        /* Enhanced Empty State */
        <div className="bg-gradient-to-br from-slate-50 via-white to-rose-50/30 rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-rose-100 to-pink-100 rounded-full flex items-center justify-center">
            <HeroIcons.UserMinusIcon className="w-10 h-10 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Offboarding Records Found</h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
            {filters.search || filters.status || filters.branch || filters.exit_reason || dateFilter !== 'all' ? (
              "No records match your current filters. Try adjusting your search criteria."
            ) : (
              "There are currently no active offboarding processes. Initiate an exit process to get started."
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowInitiateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <HeroIcons.UserMinusIcon className="w-5 h-5" />
              Initiate Exit Process
            </button>
            {(filters.search || filters.status || filters.branch || filters.exit_reason || dateFilter !== 'all') && (
              <button
                onClick={() => {
                  setFilters({ status: '', branch: '', exit_reason: '', search: '' })
                  setDateFilter('all')
                }}
                className="px-6 py-3 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-all flex items-center gap-2"
              >
                <HeroIcons.XMarkIcon className="w-5 h-5" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Card View */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayRecords.map((record) => {
            const statusCfg = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated
            const branchCfg = BRANCH_CONFIG[record.branch] || BRANCH_CONFIG.RAD
            const exitCfg = EXIT_REASON_CONFIG[record.exit_reason] || EXIT_REASON_CONFIG.other
            const daysUntil = record.days_until_exit
            const isUrgent = daysUntil <= 7 && daysUntil >= 0

            return (
              <div
                key={record.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-xl transition-all duration-200 overflow-hidden group"
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${isUrgent ? 'from-rose-600 to-pink-600' : 'from-rose-500 to-pink-500'} p-4 text-white`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-base">{record.employee_name || 'N/A'}</h3>
                      <p className="text-xs text-rose-100 mt-0.5">{record.employee_email || ''}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-xs font-medium backdrop-blur-sm">
                          <HeroIcons.BriefcaseIcon className="w-3 h-3 mr-1" />
                          {record.position || 'N/A'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusCfg.color} bg-white`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                      <HeroIcons.UserMinusIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Last Working Day */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HeroIcons.CalendarDaysIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">Last Working Day</span>
                      </div>
                      {isUrgent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                          <HeroIcons.ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                          URGENT
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {record.last_working_day ? new Date(record.last_working_day).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        }) : '—'}
                      </p>
                      {daysUntil !== undefined && (
                        <p className={`text-xs mt-0.5 ${isUrgent ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                          {daysUntil > 0 ? `${daysUntil} days remaining` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days past`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">Exit Process Progress</span>
                      <span className="text-xs font-bold text-slate-700">{record.progress_percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-pink-600 h-full transition-all duration-500"
                        style={{ width: `${record.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Branch</div>
                      <div className={`text-xs font-semibold mt-1 ${branchCfg.color}`}>{branchCfg.label}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Exit Reason</div>
                      <div className="text-xs text-slate-700 mt-1">{exitCfg.label}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Equipment</div>
                      <div className="text-xs text-slate-700 mt-1">{record.equipment_count || 0} items</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Checklist</div>
                      <div className="text-xs text-slate-700 mt-1">
                        {record.checklist_completed_count || 0} / {record.checklist_count || 0}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                    className="w-full mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
                  >
                    {expandedRow === record.id ? (
                      <>
                        <HeroIcons.ChevronUpIcon className="w-4 h-4" />
                        Hide Full Details
                      </>
                    ) : (
                      <>
                        <HeroIcons.EyeIcon className="w-4 h-4" />
                        View Full Details
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded Details (shown below card when expanded) */}
                {expandedRow === record.id && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Employee ID</span>
                          <div className="mt-1 text-xs text-slate-700">{record.employee_id || '—'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Department</span>
                          <div className="mt-1 text-xs text-slate-700">{record.department || '—'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notice Period</span>
                          <div className="mt-1 text-xs text-slate-700">{record.notice_period_days || '—'} days</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Manager</span>
                          <div className="mt-1 text-xs text-slate-700">{record.reporting_manager || '—'}</div>
                        </div>
                      </div>
                      {record.notes && (
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                          <div className="mt-1 text-xs text-slate-700 bg-white rounded p-2">{record.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Table View (existing table code) */
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Last Working Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Exit Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Progress</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRecords.map((record) => {
                  const statusCfg = OFFBOARDING_STATUS_CONFIG[record.status] || OFFBOARDING_STATUS_CONFIG.initiated
                  const branchCfg = BRANCH_CONFIG[record.branch] || BRANCH_CONFIG.RAD
                  const exitCfg = EXIT_REASON_CONFIG[record.exit_reason] || EXIT_REASON_CONFIG.other
                  const daysUntil = record.days_until_exit
                  const isUrgent = daysUntil <= 7 && daysUntil >= 0

                  return (
                    <>
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{record.employee_name}</p>
                            <p className="text-xs text-slate-500">{record.employee_email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.position}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${branchCfg.color}`}>{branchCfg.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-slate-700">{new Date(record.last_working_day).toLocaleDateString()}</p>
                            <p className={`text-xs ${isUrgent ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                              {daysUntil > 0 ? `in ${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                            {exitCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-rose-500 h-full transition-all"
                                style={{ width: `${record.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600">{record.progress_percentage}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                            className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-1 mx-auto"
                          >
                            {expandedRow === record.id ? (
                              <>
                                <HeroIcons.ChevronUpIcon className="w-4 h-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <HeroIcons.ChevronDownIcon className="w-4 h-4" />
                                Show All
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {expandedRow === record.id && (
                        <tr className="bg-slate-50/50">
                          <td colSpan="8" className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Employee Information */}
                              <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                  <HeroIcons.UserIcon className="w-4 h-4 text-rose-500" />
                                  Employee Information
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Employee ID</span>
                                    <div className="mt-1">{renderFieldValue(record, 'employee_id', 'Employee ID')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Department</span>
                                    <div className="mt-1">{renderFieldValue(record, 'department', 'Department')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Reporting Manager</span>
                                    <div className="mt-1">{renderFieldValue(record, 'reporting_manager', 'Reporting Manager')}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Exit Information */}
                              <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                  <HeroIcons.ArrowRightOnRectangleIcon className="w-4 h-4 text-rose-500" />
                                  Exit Information
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notice Period (Days)</span>
                                    <div className="mt-1">{renderFieldValue(record, 'notice_period_days', 'Notice Period')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Exit Reason Detail</span>
                                    <div className="mt-1">{renderFieldValue(record, 'exit_reason_detail', 'Exit Reason Detail', 'textarea')}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Target Completion</span>
                                    <div className="mt-1">{renderFieldValue(record, 'target_completion_date', 'Target Completion', 'date')}</div>
                                  </div>
                                  {record.actual_completion_date && (
                                    <div>
                                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Actual Completion</span>
                                      <div className="mt-1">
                                        <span className="text-xs text-slate-700">{new Date(record.actual_completion_date).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Tracking & Notes */}
                              <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                  <HeroIcons.DocumentTextIcon className="w-4 h-4 text-rose-500" />
                                  Tracking & Notes
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Equipment Count</span>
                                    <div className="mt-1">
                                      <span className="text-xs text-slate-700">{record.equipment_count || 0}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Documents Count</span>
                                    <div className="mt-1">
                                      <span className="text-xs text-slate-700">{record.documents_count || 0}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Checklist</span>
                                    <div className="mt-1">
                                      <span className="text-xs text-slate-700">
                                        {record.checklist_completed_count || 0} / {record.checklist_count || 0} completed
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                                    <div className="mt-1">{renderFieldValue(record, 'notes', 'Notes', 'textarea')}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Initiate Exit Modal */}
      {showInitiateModal && (
        <InitiateExitModal
          onClose={() => setShowInitiateModal(false)}
          onSuccess={() => {
            setShowInitiateModal(false)
            loadRecords() // Reload records to show new entry
            setAlert({ type: 'success', message: 'Offboarding process initiated successfully!' })
            setTimeout(() => setAlert(null), 5000)
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ── INITIATE EXIT MODAL COMPONENT ──────────────────────────────────────────
// Smart form-based modal for creating new offboarding records
// ═══════════════════════════════════════════════════════════════════════════

function InitiateExitModal({ onClose, onSuccess }) {
  // Form state
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Data state
  const [employees, setEmployees] = useState([])
  const [hrManagers, setHrManagers] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  
  // Initialize form with default values
  useEffect(() => {
    const defaults = {}
    INITIATE_EXIT_FORM_FIELDS.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.field] = field.defaultValue
      }
    })
    setFormData(defaults)
  }, [])
  
  // Load employees and HR managers
  // ✅ ENHANCED: Smart API calls with role filtering and minimal mode
  useEffect(() => {
    setLoading(true)
    Promise.all([
      // All active employees (minimal response for performance)
      apiClient.get('/users/employees/active_employees/', {
        params: { minimal: 'true' }
      }),
      // HR managers only (filtered by role)
      apiClient.get('/users/employees/active_employees/', {
        params: { role_filter: 'hr_manager', minimal: 'true' }
      }),
    ])
      .then(([empRes, hrRes]) => {
        setEmployees(empRes.data.results || [])
        setHrManagers(hrRes.data.results || [])
        console.log('✅ Loaded employees:', empRes.data.count, 'HR managers:', hrRes.data.count)
      })
      .catch((err) => {
        console.error('Failed to load employees:', err)
        alert('Failed to load employee data. Please refresh the page.')
      })
      .finally(() => setLoading(false))
  }, [])
  
  // Calculate target completion date (30 days after last working day)
  useEffect(() => {
    if (formData.last_working_day) {
      const lastDay = new Date(formData.last_working_day)
      const targetDate = new Date(lastDay)
      targetDate.setDate(lastDay.getDate() + 30)
      setFormData(prev => ({
        ...prev,
        target_completion_date: targetDate.toISOString().split('T')[0]
      }))
    }
  }, [formData.last_working_day])
  
  // Handle employee selection
  // ✅ ENHANCED: Smart field mapping from EmployeeMaster to offboarding fields
  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find(emp => emp.user_id === parseInt(employeeId))
    if (employee) {
      setSelectedEmployee(employee)
      
      // Build employee name from available fields
      const fullName = [employee.first_name, employee.last_name]
        .filter(Boolean)
        .join(' ') || employee.email.split('@')[0]
      
      setFormData(prev => ({
        ...prev,
        employee_id: employeeId,
        employee_name: fullName,
        employee_email: employee.email,
        user: employee.user_id,
        // Smart field mapping from EmployeeMaster → Offboarding fields
        position: employee.position || prev.position || '',
        department: employee.department || prev.department || '',
        reporting_manager: employee.reporting_manager || prev.reporting_manager || '',
        branch: employee.branch || prev.branch || 'RAD',
      }))
      setErrors(prev => ({ ...prev, employee_id: null }))
      setEmployeeSearch('')  // Clear search after selection
      
      console.log('✅ Selected employee:', fullName, '|', employee.position, '|', employee.department)
    }
  }
  
  // Handle field change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: null }))
  }
  
  // Validate form
  const validateForm = () => {
    const newErrors = {}
    
    INITIATE_EXIT_FORM_FIELDS.forEach(field => {
      if (field.required) {
        const value = formData[field.field]
        if (!value || (typeof value === 'string' && !value.trim())) {
          newErrors[field.field] = `${field.label} is required`
        }
      }
      
      // Run custom validation if provided
      if (field.validation && formData[field.field]) {
        const error = field.validation(formData[field.field])
        if (error) {
          newErrors[field.field] = error
        }
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setSubmitting(true)
    
    try {
      // Prepare payload
      const payload = {
        employee_name: formData.employee_name,
        employee_email: formData.employee_email,
        employee_id: formData.employee_id,
        user: formData.user,
        position: formData.position,
        department: formData.department,
        reporting_manager: formData.reporting_manager || '',
        branch: formData.branch || 'RAD',
        exit_reason: formData.exit_reason,
        exit_reason_detail: formData.exit_reason_detail || '',
        last_working_day: formData.last_working_day,
        notice_period_days: formData.notice_period_days || 30,
        target_completion_date: formData.target_completion_date || formData.last_working_day,
        assigned_to: formData.assigned_to || null,
        notes: formData.notes || '',
        status: 'initiated',
        progress_percentage: 0,
      }
      
      await apiClient.post(`${API_BASE}/offboarding/`, payload)
      
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Failed to create offboarding record:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to initiate offboarding process'
      setErrors({ submit: errorMsg })
    } finally {
      setSubmitting(false)
    }
  }
  
  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    if (!employeeSearch) return true
    const searchLower = employeeSearch.toLowerCase()
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
    const email = (emp.email || '').toLowerCase()
    return fullName.includes(searchLower) || email.includes(searchLower)
  })
  
  // Render form field based on type
  const renderField = (field) => {
    const value = formData[field.field] || ''
    const error = errors[field.field]
    
    const commonClasses = `w-full px-3 py-2 border ${error ? 'border-rose-500' : 'border-slate-300'} rounded-lg text-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-rose-500' : 'focus:ring-rose-500'}`
    
    switch (field.type) {
      case 'select-search':
        return (
          <div>
            <input
              type="text"
              placeholder={field.placeholder}
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className={commonClasses}
            />
            {employeeSearch && filteredEmployees.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-lg">
                {filteredEmployees.map(emp => (
                  <button
                    key={emp.user_id}
                    type="button"
                    onClick={() => {
                      handleEmployeeSelect(emp.user_id.toString())
                      setEmployeeSearch('')
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-slate-800">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="text-xs text-slate-500">{emp.email}</div>
                    {emp.position && (
                      <div className="text-xs text-slate-400">{emp.position}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedEmployee && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-900">
                      {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </div>
                    <div className="text-xs text-blue-700">{selectedEmployee.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(null)
                      setFormData(prev => {
                        const newData = { ...prev }
                        delete newData.employee_id
                        delete newData.employee_name
                        delete newData.employee_email
                        delete newData.user
                        return newData
                      })
                    }}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                    title="Clear selection"
                  >
                    <HeroIcons.XMarkIcon className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            className={commonClasses}
            required={field.required}
          >
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            className={commonClasses}
            required={field.required}
          />
        )
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            className={commonClasses}
            required={field.required}
            min={new Date().toISOString().split('T')[0]}
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className={commonClasses}
            required={field.required}
          />
        )
      
      default: // text
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.field, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
            required={field.required}
          />
        )
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <HeroIcons.UserMinusIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Initiate Exit Process</h2>
              <p className="text-xs text-rose-100">Start offboarding for a departing employee</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <HeroIcons.XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
              <span className="ml-2 text-slate-500">Loading...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
                  <HeroIcons.ExclamationCircleIcon className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-rose-800">Error</p>
                    <p className="text-sm text-rose-700 mt-1">{errors.submit}</p>
                  </div>
                </div>
              )}
              
              {/* Form Sections */}
              {INITIATE_EXIT_FORM_SECTIONS.map(section => {
                const fields = INITIATE_EXIT_FORM_FIELDS.filter(f => f.section === section.id)
                if (fields.length === 0) return null
                
                const SectionIcon = section.icon
                
                return (
                  <div key={section.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                        <SectionIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{section.label}</h3>
                        <p className="text-xs text-slate-500">{section.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map(field => (
                        <div
                          key={field.id}
                          className={field.type === 'textarea' || field.type === 'select-search' ? 'md:col-span-2' : ''}
                        >
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {field.label}
                            {field.required && <span className="text-rose-500 ml-1">*</span>}
                            {field.tooltip && (
                              <span className="ml-1 text-xs text-slate-400" title={field.tooltip}>
                                <HeroIcons.InformationCircleIcon className="w-4 h-4 inline" />
                              </span>
                            )}
                          </label>
                          {renderField(field)}
                          {errors[field.field] && (
                            <p className="mt-1 text-xs text-rose-600">{errors[field.field]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </form>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            <span className="text-rose-500">*</span> Required fields
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner className="w-4 h-4" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <HeroIcons.CheckIcon className="w-4 h-4" />
                  <span>Initiate Offboarding</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Create Employee Tab ────────────────────────────────────────────────────
function CreateEmployeeTab() {
  const [formData, setFormData] = useState({
    // Contact Information
    first_name: '',
    surname: '',
    preferred_given_name: '',
    manager_id: '',
    country: '',
    
    // Other Information
    mobile_phone: '',
    email: '',
    initials: '',
    employee_number: '',
    employee_code: '',
    account_name: '',
    employment_id: '',
    candidate_id: '',
    
    // Organization Information
    company: '',
    business_unit: '',
    division: '',
    business_area: '',
    office: '',
    job_title_finland: '',
    job_title_uae: '',
    
    // Flags
    protected_identity: false,
    is_test_person: false,
    not_signed: false,
    
    // Testing fields
    implementation_test: '',
    hrm_test: '',
    process_testing: '',
    
    // Onboarding
    joining_date: '',
    branch: 'RAD',
    notes: ''
  })
  
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  
  // Passport photo upload states
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  
  // Document upload states
  const [documents, setDocuments] = useState([])
  const [createdEmployeeId, setCreatedEmployeeId] = useState(null)
  
  // Soft-coded document types
  const DOCUMENT_TYPES = [
    { value: 'passport', label: 'Passport Copy' },
    { value: 'visa', label: 'Visa' },
    { value: 'emirates_id', label: 'Emirates ID' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'degree', label: 'Educational Certificates' },
    { value: 'certificate', label: 'Professional Certificate' },
    { value: 'experience', label: 'Experience Letters' },
    { value: 'bank_details', label: 'Bank Account Details' },
    { value: 'medical', label: 'Medical/Insurance Forms' },
    { value: 'vaccination', label: 'Vaccination Certificate' },
    { value: 'other', label: 'Other' },
  ]
  
  useEffect(() => {
    // Load managers list from active employees (EmployeeMaster)
    apiClient.get('/users/employees/active_employees/')
      .then((res) => {
        // Response includes results array with employee data
        const employees = res.data.results || []
        // All active employees can potentially be managers
        setManagers(employees)
      })
      .catch((err) => console.error('Failed to load managers:', err))
  }, [])
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }
  
  // Handle passport photo selection with preview
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid image file (JPG or PNG)')
        return
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        setError('Photo size must be less than 5MB')
        return
      }
      
      setPhoto(file)
      
      // Generate preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }
  
  // Remove selected photo
  const handleRemovePhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      // Use FormData for file upload support
      const submitData = new FormData()
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          submitData.append(key, formData[key])
        }
      })
      
      // Append passport photo if selected
      if (photo) {
        submitData.append('photo', photo)
      }
      
      const response = await apiClient.post(`${API_BASE}/onboarding/create_employee/`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setSuccess(true)
      setError(null)
      
      // Store created employee/onboarding record IDs for document uploads
      // Response includes: user_id, employee_master_id (UUID), onboarding_id, employee_number (auto-generated), email
      const onboardingRecordId = response.data.onboarding_id
      setCreatedEmployeeId(onboardingRecordId)
      
      // Upload documents if any
      if (documents.length > 0 && onboardingRecordId) {
        await uploadDocuments(onboardingRecordId)
      }
      
      // Reset form
      setFormData({
        first_name: '',
        surname: '',
        preferred_given_name: '',
        manager_id: '',
        country: '',
        mobile_phone: '',
        email: '',
        initials: '',
        employee_number: '',
        employee_code: '',
        account_name: '',
        employment_id: '',
        candidate_id: '',
        company: '',
        business_unit: '',
        division: '',
        business_area: '',
        office: '',
        job_title_finland: '',
        job_title_uae: '',
        protected_identity: false,
        is_test_person: false,
        not_signed: false,
        implementation_test: '',
        hrm_test: '',
        process_testing: '',
        joining_date: '',
        branch: 'RAD',
        notes: ''
      })
      setDocuments([])
      setPhoto(null)
      setPhotoPreview(null)
      
      // Show enhanced success message with role assignment and navigation info
      const successDetails = [
        `✅ Employee Created Successfully!`,
        ``,
        `📧 Email: ${response.data.email}`,
        `🔢 Employee Number: ${response.data.employee_number}`,
        `🆔 Employee Code: ${response.data.employee_code}`,
        `🏢 Branch: ${response.data.branch}`,
        response.data.reporting_manager ? `👤 Reports to: ${response.data.reporting_manager}` : '',
        `📋 Onboarding ID: ${response.data.onboarding_id}`,
        ``,
        `🎯 RBAC: ${SUCCESS_CONFIG.defaultRole} role automatically assigned`,
        `📍 Employee now visible in:`,
        ...SUCCESS_CONFIG.visibilityLocations.map(loc => `   • ${loc}`),
        ``,
        documents.length > 0 ? `📎 ${documents.length} document(s) uploaded` : '',
        ``,
        `💡 The employee will receive login credentials via email.`
      ].filter(Boolean).join('\n')
      
      alert(successDetails)
      
      // Reload the page to refresh the Overview tab
      setTimeout(() => {
        window.location.reload()
      }, SUCCESS_CONFIG.autoReloadDelay)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create employee')
      setSuccess(false)
    } finally {
      setLoading(false)
    }
  }
  
  const addDocument = () => {
    setDocuments([...documents, {
      id: Date.now(),
      document_type: 'emirates_id',
      document_name: '',
      file: null
    }])
  }
  
  const removeDocument = (id) => {
    setDocuments(documents.filter(doc => doc.id !== id))
  }
  
  const updateDocument = (id, field, value) => {
    setDocuments(documents.map(doc => 
      doc.id === id ? { ...doc, [field]: value } : doc
    ))
  }
  
  const uploadDocuments = async (onboardingRecordId) => {
    const uploadPromises = documents.map(async (doc) => {
      if (!doc.file) return
      
      const docFormData = new FormData()
      docFormData.append('file', doc.file)
      docFormData.append('document_type', doc.document_type)
      docFormData.append('document_name', doc.document_name || doc.file.name)
      docFormData.append('onboarding_record', onboardingRecordId)
      
      return apiClient.post(`${API_ENDPOINTS.documents}/`, docFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    })
    
    await Promise.all(uploadPromises)
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <HeroIcons.CheckCircleIcon className="w-5 h-5" />
            <span className="font-medium">Employee created successfully!</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-rose-700">
            <HeroIcons.ExclamationCircleIcon className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}
      
      {/* Contact Information */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl border border-blue-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
          <HeroIcons.UserIcon className="w-5 h-5 text-blue-600" />
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6">
          {/* Left Side - All Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                First Names <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Enter first names"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Surname <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="surname"
                value={formData.surname}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Enter surname"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Preferred Given Name
              </label>
              <input
                type="text"
                name="preferred_given_name"
                value={formData.preferred_given_name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Optional"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Manager
              </label>
              <select
                name="manager_id"
                value={formData.manager_id}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="">--Select Reporting Manager--</option>
                {managers.map(mgr => (
                  <option key={mgr.user_id} value={mgr.user_id}>
                    {mgr.first_name} {mgr.last_name} - {mgr.designation || 'Employee'} ({mgr.employee_number})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                👤 Select the direct manager this employee will report to
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Country
              </label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="">--Select Country--</option>
                <option value="UAE">United Arab Emirates</option>
                <option value="Finland">Finland</option>
                <option value="India">India</option>
                <option value="Sweden">Sweden</option>
              </select>
            </div>
          </div>
          
          {/* Right Side - Passport Photo */}
          <div className="flex flex-col items-center justify-center md:pl-6 md:border-l border-blue-200">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handlePhotoChange}
              className="hidden"
              id="passport-photo-upload"
            />
            <label
              htmlFor="passport-photo-upload"
              className="w-44 h-56 bg-white rounded-xl border-2 border-dashed border-blue-300 overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group relative"
              title="Click to upload passport photo"
            >
              {photoPreview ? (
                <div className="relative w-full h-full">
                  <img
                    src={photoPreview}
                    alt="Passport Photo"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all"></div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleRemovePhoto()
                    }}
                    className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-rose-700 hover:scale-110"
                    title="Remove photo"
                  >
                    <HeroIcons.XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 group-hover:text-blue-600 transition-all">
                  <div className="w-20 h-20 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center mb-3 transition-all">
                    <HeroIcons.CameraIcon className="w-10 h-10" />
                  </div>
                  <span className="text-sm font-medium">Click to upload</span>
                  <span className="text-xs text-slate-400 mt-1">Photo</span>
                </div>
              )}
            </label>
            <div className="mt-3 text-center">
              <p className="text-xs font-medium text-slate-600">Passport Size</p>
              <p className="text-xs text-slate-500">3.5 × 4.5 cm</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Other Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <HeroIcons.IdentificationIcon className="w-5 h-5 text-violet-600" />
          Other Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail Address (Rejlers) <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mobile Phone (Work)
            </label>
            <input
              type="text"
              name="mobile_phone"
              value={formData.mobile_phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Initials
            </label>
            <input
              type="text"
              name="initials"
              value={formData.initials}
              onChange={handleChange}
              maxLength={10}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Employee Number
              <span className="ml-2 text-xs text-green-600 font-normal">(✓ Auto-generated)</span>
            </label>
            <input
              type="text"
              name="employee_number"
              value={formData.employee_number}
              onChange={handleChange}
              placeholder="Leave empty for auto-generation (e.g., EMP20267890)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              📦 Leave empty - system will generate unique employee number
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Employee Code (Finance/Payroll)
              <span className="ml-2 text-xs text-amber-600 font-normal">(⚠️ Recommended)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="employee_code"
                value={formData.employee_code}
                onChange={handleChange}
                placeholder="e.g., EMP-2026-001 or REJAD-001"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  // Generate employee code based on email or name
                  const firstName = formData.first_name.substring(0, 3).toUpperCase()
                  const lastName = formData.surname.substring(0, 3).toUpperCase()
                  const year = new Date().getFullYear()
                  const random = Math.floor(Math.random() * 999) + 1
                  const code = `${firstName}${lastName}-${year}-${String(random).padStart(3, '0')}`
                  setFormData(prev => ({ ...prev, employee_code: code }))
                }}
                disabled={!formData.first_name || !formData.surname}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                title="Generate employee code from name"
              >
                <HeroIcons.SparklesIcon className="w-4 h-4" />
                Generate
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              🎯 Used for payroll, finance systems, and official documents
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Account Name
            </label>
            <input
              type="text"
              name="account_name"
              value={formData.account_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Employment ID (from HRM)
            </label>
            <input
              type="text"
              name="employment_id"
              value={formData.employment_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Candidate ID
            </label>
            <input
              type="text"
              name="candidate_id"
              value={formData.candidate_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      {/* Organization Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <HeroIcons.BuildingOfficeIcon className="w-5 h-5 text-emerald-600" />
          Organisation Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business Unit
            </label>
            <input
              type="text"
              name="business_unit"
              value={formData.business_unit}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Division
            </label>
            <input
              type="text"
              name="division"
              value={formData.division}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business Area
            </label>
            <input
              type="text"
              name="business_area"
              value={formData.business_area}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Office
            </label>
            <input
              type="text"
              name="office"
              value={formData.office}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Job Title (Finland)
            </label>
            <input
              type="text"
              name="job_title_finland"
              value={formData.job_title_finland}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Job Title (UAE)
            </label>
            <input
              type="text"
              name="job_title_uae"
              value={formData.job_title_uae}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      {/* Onboarding Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <HeroIcons.CalendarDaysIcon className="w-5 h-5 text-amber-600" />
          Onboarding Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Joining Date
            </label>
            <DatePicker
              name="joining_date"
              value={formData.joining_date}
              onChange={handleChange}
              placeholder="Select joining date"
              minDate={new Date('2020-01-01').toISOString().split('T')[0]}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Branch
            </label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="RAD">Rejlers Abu Dhabi</option>
              <option value="RIN">Rejlers India</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      {/* Probation Period */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <HeroIcons.ClockIcon className="w-5 h-5 text-indigo-600" />
          Probation Period
        </h3>
        
        {formData.joining_date ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-600 mb-1">Joining Date</div>
                <div className="text-lg font-semibold text-slate-800">
                  {new Date(formData.joining_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
              
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="text-xs font-medium text-indigo-600 mb-1">Probation End Date</div>
                <div className="text-lg font-semibold text-slate-800">
                  {calculateProbationEndDate(formData.joining_date) &&
                    new Date(calculateProbationEndDate(formData.joining_date)).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  ({PROBATION_PERIOD_MONTHS} months from joining)
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <HeroIcons.InformationCircleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Note:</strong> Employee is under probation for {PROBATION_PERIOD_MONTHS} months from the date of joining. 
                Performance will be reviewed before confirmation.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <HeroIcons.ClockIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Please set a joining date to view probation period</p>
            <p className="text-xs text-slate-400 mt-1">Probation period is automatically calculated as {PROBATION_PERIOD_MONTHS} months from joining date</p>
          </div>
        )}
      </div>
      
      {/* Document Upload Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <HeroIcons.DocumentTextIcon className="w-5 h-5 text-violet-600" />
            Upload Documents (Optional)
          </h3>
          <button
            type="button"
            onClick={addDocument}
            className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors flex items-center gap-1"
          >
            <HeroIcons.PlusIcon className="w-4 h-4" />
            Add Document
          </button>
        </div>
        
        {documents.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <HeroIcons.DocumentIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No documents added yet</p>
            <p className="text-xs text-slate-400 mt-1">You can add documents like Emirates ID, certificates, etc.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, index) => (
              <div key={doc.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Document #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDocument(doc.id)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Remove"
                  >
                    <HeroIcons.TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Document Type</label>
                    <select
                      value={doc.document_type}
                      onChange={(e) => updateDocument(doc.id, 'document_type', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Document Name</label>
                    <input
                      type="text"
                      value={doc.document_name}
                      onChange={(e) => updateDocument(doc.id, 'document_name', e.target.value)}
                      placeholder="e.g., Emirates ID - John Doe"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      File {!doc.file && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="file"
                      onChange={(e) => updateDocument(doc.id, 'file', e.target.files[0])}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
                {doc.file && (
                  <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                    <HeroIcons.CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                    <span>{doc.file.name} ({(doc.file.size / 1024).toFixed(2)} KB)</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          <HeroIcons.InformationCircleIcon className="w-4 h-4 inline mr-1" />
          Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB per file)
        </p>
      </div>
      
      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              <span>Creating Employee...</span>
            </>
          ) : (
            <>
              <HeroIcons.PlusCircleIcon className="w-5 h-5" />
              <span>Create Employee</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Document Management Section ────────────────────────────────────────────
function DocumentManagementSection({ employeeId, employeeEmail }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadData, setUploadData] = useState({
    document_type: 'offer_letter',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    notes: '',
    file: null,
  })
  const [alert, setAlert] = useState(null)

  // ✅ UNIFIED DOCUMENT SYSTEM: Fetch document types from ProfileDocument API (onboarding-filtered)
  // This ensures both Profile and Onboarding pages use the SAME database table (rbac.ProfileDocument)
  const [documentTypes, setDocumentTypes] = useState([])
  
  useEffect(() => {
    loadDocumentTypes()
    loadDocuments()
  }, [employeeId])
  
  const loadDocumentTypes = () => {
    apiClient
      .get('/rbac/profile-documents/document-types/onboarding/')
      .then((res) => {
        setDocumentTypes(res.data || [])
      })
      .catch((err) => console.error('Failed to load document types:', err))
  }

  const loadDocuments = () => {
    setLoading(true)
    // ✅ UNIFIED API: Fetch documents from ProfileDocument table
    // Filter by user_profile (linked via employee_id)
    apiClient
      .get(`/rbac/profile-documents/?user_profile__user=${employeeId}`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setDocuments(data)
      })
      .catch((err) => console.error('Failed to load documents:', err))
      .finally(() => setLoading(false))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploadData({ ...uploadData, file })
    }
  }

  const handleUpload = async () => {
    if (!uploadData.file) {
      setAlert({ type: 'error', message: 'Please select a file to upload' })
      setTimeout(() => setAlert(null), 3000)
      return
    }

    setUploading(true)

    try {
      // ✅ UNIFIED API: Upload to ProfileDocument table
      // Backend auto-assigns user_profile based on authenticated user
      const formData = new FormData()
      formData.append('document_file', uploadData.file)
      formData.append('document_type', uploadData.document_type)
      
      if (uploadData.document_number) formData.append('document_number', uploadData.document_number)
      if (uploadData.issue_date) formData.append('issue_date', uploadData.issue_date)
      if (uploadData.expiry_date) formData.append('expiry_date', uploadData.expiry_date)
      if (uploadData.issuing_authority) formData.append('issuing_authority', uploadData.issuing_authority)
      if (uploadData.notes) formData.append('notes', uploadData.notes)

      // Upload to ProfileDocument API (same table as user profile documents)
      await apiClient.post('/rbac/profile-documents/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setAlert({ type: 'success', message: 'Document uploaded successfully!' })
      setTimeout(() => setAlert(null), 3000)
      
      // Reset form and reload documents
      setUploadData({
        document_type: 'offer_letter',
        document_number: '',
        issue_date: '',
        expiry_date: '',
        issuing_authority: '',
        notes: '',
        file: null
      })
      setShowUploadForm(false)
      loadDocuments()
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || err.response?.data?.error || 'Failed to upload document' })
      setTimeout(() => setAlert(null), 5000)
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (document) => {
    try {
      // ✅ UNIFIED API: ProfileDocument stores files in S3, presigned URL in document_file_url
      if (document.document_file_url) {
        window.open(document.document_file_url, '_blank')
      } else {
        setAlert({ type: 'error', message: 'Document file not available' })
        setTimeout(() => setAlert(null), 3000)
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to download document' })
      setTimeout(() => setAlert(null), 3000)
    }
  }

  const handleDelete = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      // ✅ UNIFIED API: Delete from ProfileDocument table
      await apiClient.delete(`/rbac/profile-documents/${documentId}/`)
      setAlert({ type: 'success', message: 'Document deleted successfully' })
      setTimeout(() => setAlert(null), 3000)
      loadDocuments()
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to delete document' })
      setTimeout(() => setAlert(null), 3000)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <HeroIcons.DocumentTextIcon className="w-5 h-5 text-violet-500" />
          Document Management
        </h4>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
        >
          {showUploadForm ? (
            <>
              <HeroIcons.XMarkIcon className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <HeroIcons.PlusIcon className="w-4 h-4" />
              Upload Document
            </>
          )}
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`rounded-lg border p-2 mb-3 flex items-center gap-2 text-xs ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <HeroIcons.CheckCircleIcon className="w-4 h-4" />
          ) : (
            <HeroIcons.ExclamationCircleIcon className="w-4 h-4" />
          )}
          <span className="font-medium">{alert.message}</span>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Type</label>
              <select
                value={uploadData.document_type}
                onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {documentTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.icon} {type.label} {type.required_for_onboarding && '(Required)'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {documentTypes.find(t => t.code === uploadData.document_type)?.description}
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Number (Optional)</label>
              <input
                type="text"
                value={uploadData.document_number}
                onChange={(e) => setUploadData({ ...uploadData, document_number: e.target.value })}
                placeholder="e.g., Passport number, Contract number"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issue Date (Optional)</label>
                <input
                  type="date"
                  value={uploadData.issue_date}
                  onChange={(e) => setUploadData({ ...uploadData, issue_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={uploadData.expiry_date}
                  onChange={(e) => setUploadData({ ...uploadData, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Issuing Authority (Optional)</label>
              <input
                type="text"
                value={uploadData.issuing_authority}
                onChange={(e) => setUploadData({ ...uploadData, issuing_authority: e.target.value })}
                placeholder="e.g., UAE Government, Ministry of Labor"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes (Optional)</label>
              <textarea
                value={uploadData.notes}
                onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                placeholder="Additional notes or comments"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">File</label>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Accepted formats: {documentTypes.find(t => t.code === uploadData.document_type)?.allowed_formats?.join(', ').toUpperCase()} (Max {documentTypes.find(t => t.code === uploadData.document_type)?.max_file_size_mb}MB)
              </p>
            </div>
            
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Spinner />
                  Uploading...
                </>
              ) : (
                <>
                  <HeroIcons.CloudArrowUpIcon className="w-5 h-5" />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
          <span className="ml-2 text-sm text-slate-500">Loading documents...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <HeroIcons.DocumentIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const docType = documentTypes.find(t => t.code === doc.document_type) || { label: doc.document_type, icon: '📄', bg_color: 'bg-slate-100' }
            
            // Verification status badges
            const statusBadges = {
              pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-300' },
              verified: { label: 'Verified', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
              rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-700 border-rose-300' },
              expired: { label: 'Expired', className: 'bg-slate-100 text-slate-700 border-slate-300' },
            }
            const statusBadge = statusBadges[doc.verification_status] || statusBadges.pending
            
            return (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg ${docType.bg_color} flex items-center justify-center`}>
                    <span className="text-xl">{docType.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      {docType.label}
                      {doc.document_number && (
                        <span className="text-xs text-slate-500 font-normal">({doc.document_number})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      {doc.document_file_name && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{doc.document_file_name}</span>
                        </>
                      )}
                      {doc.expiry_date && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className={`text-xs ${doc.is_expired ? 'text-rose-600 font-medium' : doc.expires_soon ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                            Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.document_file_url && (
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <HeroIcons.ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <HeroIcons.TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── KPI Card Component ─────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs font-medium opacity-70">{label}</div>
        <Icon className="w-5 h-5 opacity-50" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}

// Enhanced KPI Card with more visual appeal and optional features
function EnhancedKPICard({ label, value, icon: Icon, bgColor, textColor, iconBg, subtitle, urgent = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${bgColor} hover:shadow-lg transition-all duration-300 cursor-pointer group`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className={`text-xs font-semibold ${textColor} opacity-80 uppercase tracking-wide`}>{label}</div>
          {subtitle && (
            <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${urgent ? 'animate-pulse' : ''} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>
      <div className={`text-3xl font-bold ${textColor} ${urgent ? 'text-4xl' : ''}`}>
        {value}
      </div>
      {urgent && value > 0 && (
        <div className="mt-2 text-[10px] font-medium text-rose-600 flex items-center gap-1">
          <HeroIcons.ExclamationTriangleIcon className="w-3 h-3" />
          Requires attention
        </div>
      )}
    </div>
  )
}
