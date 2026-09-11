# RADAI Enterprise Visual Language

This document defines the approved visual language for enterprise dashboards,
summary cards, and operational workspaces. New UI should reuse these semantics
instead of selecting colors decoratively.

## Core principles

- Use restrained color to communicate business meaning.
- Use soft directional gradients over predominantly white surfaces.
- Use a matching low-contrast border to define each card.
- Do not use colored top strips, drop shadows, or hover shadows on KPI cards.
- Keep typography, spacing, and corner radius consistent across modules.
- Never rely on color alone; retain explicit labels, values, and status text.
- Maintain equivalent contrast and meaning in dark mode.

## Semantic color system

| Color | Enterprise meaning | Typical use |
| --- | --- | --- |
| Blue | Information and scope | Project counts, general facts, current scope |
| Indigo | Governed control | Approved budgets, formal controls, contract values |
| Violet | Planning and commitments | Baselines, schedules, commitments, forecasts |
| Emerald | Verified or healthy | Approved, paid, reconciled, available, clear |
| Amber | Attention or pending | Open actions, actual cost review, incomplete controls |
| Orange | High priority | Action required in the current reporting cycle |
| Rose | Critical exposure | Critical exceptions, unpaid exposure, blocking issues |
| Slate | Neutral or unavailable | Draft, informational fallback, unavailable data |

## Approved card construction

Use a flat card with a subtle border and a low-opacity gradient. Example:

```jsx
<div className="rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/70 p-4">
  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Projects shown</p>
  <p className="mt-2 text-2xl font-semibold text-blue-800">11</p>
  <p className="mt-1 text-xs text-blue-700/80">11 accessible · 0 clear</p>
</div>
```

For a full-width workspace introduction, use a horizontal gradient:

```text
border border-amber-200
bg-gradient-to-r from-white via-white to-amber-50/60
```

Dark-mode equivalent:

```text
dark:border-amber-900
dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20
```

## Interaction rules

- Clickable cards must use a native `button` element.
- Use `aria-pressed` for persistent card filters.
- Use a visible focus ring or outline for keyboard users.
- Selected cards may use an indigo outline; selection must not be communicated
  through a shadow.
- Hover may adjust border or background color, but must not add elevation.
- Persist user-selected dashboard filters only when the preference is safe and
  non-sensitive.

## Dashboard hierarchy

1. Workspace introduction or status banner.
2. Semantic KPI or summary cards.
3. Search and filtering controls.
4. Operational tables, charts, or workflow panels.
5. Detailed audit and exception evidence.

Color intensity should increase with urgency. Normal information remains light;
critical states use stronger text and borders while keeping the card background
restrained.

## Current reference implementations

- `src/pages/Admin/AIAdoptionVisualLanguage.css` (shared adoption, workforce, outcomes and workflow cards)
- `src/pages/Projects/tabs/PortfolioExceptionsTab.jsx`
- `src/pages/Projects/tabs/ProjectDashboardTab.jsx`
- `src/pages/Projects/tabs/ControlsPeriodsTab.jsx`
- `src/pages/Projects/tabs/CommercialDashboardTab.jsx`
- `src/pages/Projects/tabs/CostDashboardTab.jsx`
- `src/pages/Projects/components/KpiCard.jsx`
