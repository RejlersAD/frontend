# Attendance workspace

The `/hr/attendance` workspace uses compact filters, summary strips and responsive
tables. It opens the Monthly matrix and offers Overview, Daily, Yearly and Reports.
The separate Monthly totals tab and the large title/action header are removed.
Export, refresh and permitted upload actions remain inside the relevant toolbar.
Shared navigation and server permissions remain authoritative.

## Existing service contracts

- Corrections: `getAttendanceOverrides(year, month, params)` collects the complete
  DRF page-number response before returning an array. Failed, changed or incomplete
  pages withhold correction-dependent matrix totals and expose retry.
- Overview approvals: `getPendingLeaveApprovals()` calls the existing authenticated
  `/payroll/leave-requests/pending-for-me/` action and validates `{count, results}`.
  Review links open the existing leave workflow; the dashboard makes no decisions.
- Source status uses the existing timesheet health endpoint and safe availability,
  event and upload fields. These timestamps are not synchronization heartbeats.
- Daily/monthly/yearly export formats are unchanged. Exports retain their server
  scope; the toolbar states when they include more records than the visible filters.

## Data and interaction boundaries

Overview counts returned attendance records, preserving separate employee sessions.
Check-ins require a first punch; late counts use the source flag. Attention shows
one condition per record, prioritizing an explicit open shift, a late flag and then
positive recorded overtime. Department check-in share means check-ins divided by
returned records, not scheduled-workforce attendance. The seven-day chart plots
record counts with gaps for unavailable dates. Branch mappings use each day's year.

Attendance filters scope attendance records, departments and trend. Approved leave
retains all permitted employees for the selected date; active corrections retain
the selected attendance month; pending leave retains the current user's queue
across dates. These broader scopes are labeled. Expected daily hours and variance
are unavailable without a scheduled roster. Source hours exclude HR corrections.

Daily retains existing classifications, record-based summary, sortable columns,
local pagination and density controls. Missing open-shift evidence stays unknown.
Permitted hours upload retains its selected file and original period on failure.

Yearly retains the configured monthly workday basis and existing display thresholds.
Missing uploads, failed reads and future months remain distinct from recorded zero.
Full-year rates require twelve recorded monthly cells; this does not certify import
completeness or employment eligibility. Annual leave values join by employee code.
Recorded overtime remains unapproved and partial subtotals are labeled.

All views ignore obsolete responses and expose loading, missing, denied, failure
and retry states. Correction input and failed upload files remain available for
retry. No new payroll policy, approval rules, schema or backend commands are added.

## Verification

Run in this frontend repository with the manifest-supported Node 20 environment:

```text
node --test tests/attendance-overrides.test.js tests/overview-attendance.test.js tests/yearly-attendance.test.js
node scripts/check-attendance-reference.mjs
npm run build
```

The browser harness exercises the actual Attendance component and shared shell,
the actual correction pagination and pending-leave service wrappers, and isolated
synthetic responses. It blocks unexpected network requests and performs no live
attendance writes or approvals. It includes the five-tab navigation, desktop and
mobile geometry, filters, pagination, export/upload retries, stale responses,
permissions, missing values and cross-year branch mappings. It emits evidence to
`../artifacts/attendance-reference-20260930/` by default; those local artifacts are
not required runtime assets. `UI_CHECK_ARTIFACTS_ROOT` can override their location.

The implementation verification on 30 September 2026 passed 42 focused model/service
tests, 41 browser groups, scoped lint and the Node 20 Vite/PWA build. Release
alignment must rerun relevant checks on the integrated source. Existing project
Browserslist, mixed-import and bundle-size warnings are separate from this feature.
No production migration or deployment is certified by these frontend checks.
