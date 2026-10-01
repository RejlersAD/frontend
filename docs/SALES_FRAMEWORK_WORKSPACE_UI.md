# Framework agreement reference workspace

Bounded frontend implementation verified on 1 October 2026.

## Scope

`/sales/frameworks` receives the supplied compact Framework agreements main
content: register/search/status filters and the selected agreement's Overview,
Rates, Eligibility, Call-offs, Documents and Activity tabs. Scoped styling
matches navy text, purple actions, pale borders and compact white panels inside
the existing application shell. Sidebar/Header styling, routes, dimensions and
responsive behaviour remain unchanged.

Preserve canonical FrameworkAgreement data, complete bounded list pagination,
all actual statuses and `?record=<UUID>` selection. Reuse existing registration,
edit, full-record and independently confirmed Activate framework dialogs.
Expired/Closed edit locks and failed-write input retention remain. Open agreement
opens full record details. Edit agreement is an existing PATCH, not a revision
or amendment command. A successful activation followed by denied/failed detail
refresh hides stale content/actions and offers a read retry without duplicating
the successful command.

## Source semantics and limits

- Display recorded currency with ceiling, committed, invoiced and remaining
  amounts. `remaining_value` means ceiling minus committed, with no reservations
  deduction. Label it Remaining rather than Available to commit. Missing
  ceilings/reservations/limits remain unavailable; zero stays zero. No tax basis
  is inferred.
- `is_eligible` covers Active status and inclusive effective dates only. Render
  saved included_services, disciplines, geographic_coverage and compliance
  requirements as recorded scope, without claiming full call-off authorization.
- `rate_cards` and `amendments` are unvalidated JSON lists. The inspected writer
  records rate version, effective_from and status metadata only. No invented
  hourly roles/amounts, approved-version precedence or framework revision number.
- No call-off/reservation model or issue endpoint exists. Call-offs shows a
  clear unavailable state; New call-off is disabled. Linked opportunities are
  never relabelled as issued call-offs.
- `signed_document` is plain stored text, without a protected content resolver.
  Show the reference without constructing or opening a URL. Open agreement
  means the existing agreement record, not a document download.
- Documents retains stored amendment evidence. Activity uses actual timestamps
  and explicitly identifies missing approval, without invented transitions or a
  claimed immutable audit trail.
- Export remains disabled because there is no guarded framework export route.
  The illustration's sample clients, values, roles, revision, rate rows and
  call-offs are never production defaults.

## Existing API and permissions

Use `sales.service.js` for list/detail/create/PATCH at `/api/v1/sales/frameworks/`
and POST `{id}/activate/`. Preserve existing payloads and errors. Create defaults
to Draft, with current user as owner where absent. The existing edit fields are
title, renewal_action_date, ceiling_value, committed_value, invoiced_value,
payment_terms and signed_document. Serializer validation rejects reversed dates
and committed value greater than the specified ceiling.

Activate is a distinct approval action with configured business route,
independent non-owner actor, nonempty signed reference and valid effective dates.
It records actual approver/time. Client/opportunity qualification retains its
existing matching-client/active-date checks. No new authority, workflow state,
reservation formula or call-off eligibility policy is introduced.

Existing gaps include no PATCH freshness token, no complete backend revision or
immutability protection, generic writable status, unvalidated rate/amendment
JSON and no call-off/file/export contracts. This UI change does not close those
gaps or certify server concurrency, file access or financial authorization.

## Verification

Verified on 1 October 2026:

- Scoped ESLint passed for SalesFrameworkRegister.jsx,
  SalesFrameworkWorkspace.jsx, salesFrameworkRegister.js,
  SalesLifecycleArea.jsx and Layout.jsx. `git diff --check` passed.
- `node --test tests/sales-framework-register.test.js`: 10 passed.
- `npm.cmd exec -- playwright test --config=playwright.sales-framework.config.js`:
  15 passed, covering the real shell, desktop screenshot/Axe,
  1024/768/390px widths, complete pagination, filters/sorting/columns, tabs,
  deep links, loading/empty/errors, denied/late detail, preserved failed-write
  input, retained creation/activation, status access and expired/closed locks.
  After successful activation with a denied detail refresh, retry reads only
  and does not duplicate activation.
- Final CSS-only desktop screenshot/Axe rerun passed. Desktop and responsive
  screenshots were inspected within the retained shell.
- `npm.cmd run build` passed, including PWA generation. The emitted stylesheet
  contains final workspace spacing. Existing Browserslist, mixed static/dynamic
  import and large-chunk warnings remain.
- Sidebar.jsx, Header.jsx, layout.config.js, useSidebarLayout.js and index.css
  have no Git diff.

Evidence is under `artifacts/sales-framework/`;
the final desktop image is
`final-reference/sales-framework-reference--8a177--inside-the-unchanged-shell/framework-reference-1586.png`.
Fixtures are test-only.
No backend/schema change, live data write, migration or deployment was performed.
The preserved shell and unavailable source fields mean whole-screen pixel
identity is not claimed.

Shared scope/evidence record: `../docs/features/sales-framework-reference-workspace.md`
from the repository root.
