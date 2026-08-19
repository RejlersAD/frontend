/**
 * Persona-driven dashboard configuration.
 *
 * Every persona defines:
 *   - hero_accent   : gradient class applied behind the welcome hero
 *   - quick_actions : soft-coded list of shortcut buttons (label + icon + route + accent)
 *   - widgets       : ordered list of widget keys the dashboard should render
 *   - metrics       : optional persona-specific KPI overrides
 *
 * Widget keys are resolved by PersonalDashboard.jsx to a React component.
 * Add a new persona → drop a new entry here; add a new widget → register
 * it in the WIDGET_REGISTRY inside PersonalDashboard.jsx. No code branching required.
 */

// ─── Thresholds (soft-coded, used by health colouring) ─────────────────────
export const HEALTH_THRESHOLDS = {
  cpi_green:    0.95,
  cpi_amber:    0.85,
  spi_green:    0.95,
  spi_amber:    0.85,
  budget_amber: 85,   // percent
  budget_red:   100,  // percent
  progress_gap_amber: -5,   // schedule progress vs elapsed (%)
  progress_gap_red:   -15,
  milestone_urgent_days: 7,
  milestone_soon_days:   21,
  task_overdue_flash_days: 3,
}

// ─── Colour tokens for the health traffic light ────────────────────────────
export const HEALTH_TOKENS = {
  green: { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-400/50', label: 'On track'  },
  amber: { chip: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500',   ring: 'ring-amber-400/50',   label: 'At risk'   },
  red:   { chip: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-500',     ring: 'ring-red-400/50',     label: 'Critical'  },
  grey:  { chip: 'bg-slate-100 text-slate-600 border-slate-200',       dot: 'bg-slate-400',   ring: 'ring-slate-300/50',   label: 'Not scored'},
}

// ─── Severity tokens for change events ─────────────────────────────────────
export const SEVERITY_TOKENS = {
  low:      { chip: 'bg-slate-100 text-slate-700',   bar: 'bg-slate-400'    },
  medium:   { chip: 'bg-blue-100 text-blue-700',     bar: 'bg-blue-500'     },
  high:     { chip: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500'   },
  critical: { chip: 'bg-red-100 text-red-700',       bar: 'bg-red-500'      },
}

// ─── Priority tokens for tasks ─────────────────────────────────────────────
export const PRIORITY_TOKENS = {
  low:      { chip: 'bg-slate-100 text-slate-600' },
  medium:   { chip: 'bg-blue-100 text-blue-700'   },
  high:     { chip: 'bg-orange-100 text-orange-700' },
  critical: { chip: 'bg-red-100 text-red-700'     },
  urgent:   { chip: 'bg-red-100 text-red-700'     },
}

// ─── Persona registry ──────────────────────────────────────────────────────
export const PERSONA_REGISTRY = {
  project_control: {
    label:        'Project Control',
    tagline:      'Portfolio health, EVM, milestones & change control at a glance.',
    hero_accent:  'from-indigo-600 via-blue-600 to-cyan-500',
    api_bundle:   '/dashboard/personal/project-control/',
    // Persona-specific KPI builder — receives the API bundle (portfolio/projects/tasks)
    // and returns up to 4 tiles for the WelcomeHero. Overrides generic backend kpis.
    // Returning [] or null falls back to backend kpis.
    kpi_builder: (bundle) => {
      const p = bundle?.portfolio || {}
      const tasks = bundle?.my_tasks || []
      const overdueTasks = tasks.filter(t => t.is_overdue).length
      const cpi = p.avg_cpi
      const cpiTone = cpi == null
        ? 'grey'
        : cpi >= HEALTH_THRESHOLDS.cpi_green ? 'green'
        : cpi >= HEALTH_THRESHOLDS.cpi_amber ? 'amber' : 'red'
      const budgetPct = p.budget_utilisation ?? 0
      const budgetTone = budgetPct >= HEALTH_THRESHOLDS.budget_red ? 'red'
        : budgetPct >= HEALTH_THRESHOLDS.budget_amber ? 'amber' : 'green'
      const atRiskTone = (p.at_risk_count ?? 0) === 0 ? 'green'
        : (p.at_risk_count ?? 0) <= 2 ? 'amber' : 'red'
      return [
        {
          key: 'pc_active_projects',
          label: 'Active Projects',
          value: p.active_count ?? 0,
          sub: `${p.project_count ?? 0} in portfolio`,
          tone: 'blue',
          emoji: '🏗️',
        },
        {
          key: 'pc_at_risk',
          label: 'At Risk',
          value: p.at_risk_count ?? 0,
          sub: `${p.overdue_count ?? 0} overdue`,
          tone: atRiskTone,
          emoji: '⚠️',
        },
        {
          key: 'pc_budget_used',
          label: 'Budget Used',
          value: `${Math.round(budgetPct)}%`,
          sub: `of $${Math.round((p.total_budget ?? 0) / 1000).toLocaleString()}k`,
          tone: budgetTone,
          emoji: '💰',
        },
        {
          key: 'pc_cpi',
          label: 'Avg CPI',
          value: cpi != null ? cpi.toFixed(2) : '—',
          sub: overdueTasks > 0 ? `${overdueTasks} tasks overdue` : 'cost performance',
          tone: cpiTone,
          emoji: '📊',
        },
      ]
    },
    quick_actions: [
      { key: 'new_project',      icon: '🏗️', label: 'New Project',       route: '/designiq/projects',           accent: 'from-indigo-500 to-blue-600'  },
      { key: 'log_snapshot',     icon: '📊', label: 'Log Cost Snapshot', route: '/project-control/snapshots',   accent: 'from-emerald-500 to-teal-600' },
      { key: 'upload_change',    icon: '🔄', label: 'Log Change',        route: '/project-control/changes',     accent: 'from-orange-500 to-rose-600'  },
      { key: 'view_milestones',  icon: '🎯', label: 'Milestones',        route: '/designiq/projects',           accent: 'from-fuchsia-500 to-pink-600' },
      { key: 'evm_report',       icon: '📈', label: 'EVM Report',        route: '/project-control/reports',     accent: 'from-cyan-500 to-sky-600'     },
      { key: 'ai_insights',      icon: '🤖', label: 'AI Insights',       route: '/dashboard',                   accent: 'from-purple-500 to-indigo-600' },
    ],
    widgets: [
      'welcome_hero',
      'ai_insights',
      'project_portfolio',
      'evm_health',
      'milestones_timeline',
      'my_tasks',
      'recent_changes',
      'notifications',
    ],
  },

  default: {
    label:        'My Dashboard',
    tagline:      '',
    hero_accent:  'from-slate-700 via-slate-600 to-slate-500',
    api_bundle:   null,
    quick_actions: [],
    widgets: [
      'welcome_hero',
      'ai_insights',
      'my_modules',
      'activity_feed',
      'notifications',
      'pending_actions',
      'usage_stats',
    ],
  },
}

// Fallback lookup — never throws for unknown persona keys
export function getPersona(code) {
  return PERSONA_REGISTRY[code] || PERSONA_REGISTRY.default
}
