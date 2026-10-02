# Forecast reference workspace

Bounded frontend implementation verified on 1 October 2026.

## Scope and retained behaviour

`/sales/forecasts` adopts a scoped SalesForecastWorkspace in the main content.
The compact toolbar, five tabs, four measures, outlook/performance/input-review
tables and right-hand planning controls follow the user-supplied reference.
Sidebar, Header, their dimensions, styles, routes and responsive behaviour remain
unchanged. Reuse existing typography/components without a new UI dependency or
global-style change.

SalesLifecycleArea retains forecast generation, full-record details, editing and
the existing independent Approve snapshot action. Save draft opens its retained
editor; existing review states use Edit snapshot and approved/superseded records
remain locked. Failed writes retain user input. The Forecast controls picker
retains access to all saved snapshots and `?record=<UUID>` selection. Complete
bounded pagination and actual period/date ordering support this collection.
Compare presents same-period saved snapshots by date/ID, not `model_version`
as an invented forecast revision.

## Source semantics

- Scenario selection reads stored predicted_revenue, best_case and worst_case;
  it never changes source data or invents scenario probabilities.
- The model has no currency or client dimension. Do not infer AED, convert
  money, claim a client-filtered forecast or combine mixed-currency data.
- `forecast_by_stage` and `forecast_by_service` are recorded weighted pipeline
  breakdowns. Service filtering applies only to its Awards breakdown. Multiple
  service tags overlap, so their values are not additive phased-revenue totals.
- `category_totals` and `demand_by_discipline` are optional generic JSON. Retain
  known recorded categories/discipline hours without inventing monthly phasing.
  The current generator leaves both empty. `top_deals_considered` is a maximum
  of five generator objects, or older stored string codes; it is not complete
  source coverage.
- No API field establishes secured monthly revenue, capacity/gap, margin,
  targets or the screenshot's example input queue. Missing measures use an
  unavailable state. Missing-measure review rows explain evidence gaps and do
  not introduce an approval blocker or unsupported opportunity identity.
- The generator's existing historical-average/weighted-pipeline calculation is
  not delivery-phased or recognized revenue. `model_version` is its algorithm
  identifier. Dates and approved status belong to actual saved snapshots.
- Review shows actual snapshot status and recorded approver/time. Do not insert
  Sales director, Finance or Operations as assigned/pending approvers.

## Existing API behaviour

The current services list/read/PATCH `/api/v1/sales/forecasts/`, generate through
POST `generate_forecast/` with `{period, historical_months}`, and approve through
POST `{id}/approve/`. Generation rejects missing opportunity estimated/weighted
amounts or currency with `forecast_inputs_incomplete`. The response includes
missing field names/count, not a complete individual opportunity review list.

The existing editor preserves forecast period, predicted/best/worst values and
draft/owner_review/management_review status choices. Approved/superseded PATCH
returns HTTP 409. Approve requires a configured business route and independent
approver; it supersedes earlier approved snapshots for the same period. Preserve
these guards and display actual errors. Export and Submit for approval remain
unavailable because no corresponding endpoint exists; no browser export fallback
or new approval submission is introduced.

Existing backend limitations remain: no optimistic freshness token for PATCH,
no generator currency partition, no complete retained source snapshot, no monthly
delivery/capacity contract, and no exposed three-step review route. This UI change
does not claim to close them. Backend, schema, data, dependencies and deployment
remain outside scope.

## Verification

Verified on 1 October 2026:

- Scoped ESLint passed for the workspace, helper, SalesLifecycleArea and Layout;
  `git diff --check` passed.
- `node --test tests/sales-forecast-workspace.test.js`: 10 passed.
- Playwright using `playwright.sales-forecast.config.js`: 14 cases passed in the
  full run plus one added date/order/baseline case passed separately. The 15
  distinct cases cover desktop screenshot/Axe, 1024/768/390px widths, pagination,
  deep links, selection/comparison/tabs, zero/missing values, loading/empty/errors,
  denied/late detail responses, retained failed-edit input, generation retry,
  approval denial/retry and locked snapshots. Final CSS-only desktop screenshot
  and Axe rerun passed.
- `npm.cmd run build` passed, including PWA generation and final CSS spacing.
  Existing Browserslist, mixed static/dynamic import and large-chunk warnings
  remain.
- No Git diff in Sidebar.jsx, Header.jsx, layout.config.js, useSidebarLayout.js
  or index.css. No backend/schema change or live business write was performed.

Evidence is in `artifacts/sales-forecast/`; the final desktop screenshot is
`final-reference/sales-forecast-reference-s-413b1-unchanged-application-shell/forecast-reference-1586.png`.
Approval timestamps use Asia/Dubai while snapshot dates stay date-only. Mixed
month/quarter periods sort chronologically and the current snapshot cannot be
its own comparison baseline. API fixtures are synthetic and never runtime
defaults. The retained shell and unavailable metrics differ from the illustration;
whole-screen pixel identity is not claimed.

Shared requirement and evidence record:
`../docs/features/sales-forecast-reference-workspace.md` from the repository root.
