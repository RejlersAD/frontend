# HR release verification — 22 October 2026

This release aligns the HR work with origin/development through a normal merge
without conflicts. Incoming Critical Line List, 3D equipment and design-token
changes are retained. HR scope includes recruitment and candidate forms,
CV/pre-onboarding, leave overrides, probation dates, onboarding/offboarding and
employee directory workspaces, and the reviewed employee register import.
Feature scope is recorded in the HR documents in this directory and the paired
backend feature briefs. The requested reference redesigns affect main content;
the user's pre-existing shared-shell and sidebar changes are retained.

The employee import updates matched employees and creates unmatched employees
with explicitly selected organization/role mappings. Existing access settings
are preserved, and conflicting identities are reported instead of duplicated.
No source register, employee correction report, credentials or database backup
is included in Git.

## Release fixes

The dependency bootstrap now verifies both Vite's launcher and entry point
before accepting the lockfile stamp. An interrupted dependency installation
therefore triggers repair on startup. The Careers synchronization control is
available inside Open positions; browser coverage uses the current metric
filters and verifies persistence after a page reload.

## Validation

- 31 frontend helper tests passed, including login recovery, employee dates,
  employee ID sorting and onboarding/offboarding dashboard data.
- All 12 HR KPI filter/count checks passed.
- Employee import, employee directory and lifecycle component browser checks
  passed, including responsive layouts and interaction/error states.
- All 32 focused HR Playwright tests passed, including onboarding, public
  candidate forms, Talent Acquisition and Careers synchronization.
- Scoped ESLint completed without errors; existing warnings remain.
- The paired backend passed 93 HR/recruitment/import/approval regressions.
- Another 15 backend employee-profile synchronization tests passed with the
  existing signal-enabled config.settings_console_test registry. Earlier
  failures used registries that disable the HR signals these tests exercise.

Run the helper tests with Node's `--experimental-vm-modules` option. The focused
HR Playwright suite uses `playwright.hr-enhancements.config.js`, a running Vite
server at PW_BASE_URL (default http://localhost:5173), and installed Chrome.
Its API fixtures isolate writes and outbound email.

Production builds require NODE_ENV=production. The earlier development-mode
build exceeded Workbox's cache limit; the aligned production build generated
the application and PWA successfully without raising that limit. Existing
large-chunk and Browserslist warnings remain. Dependencies follow the merged
lockfile; npm audit findings were not automatically rewritten during release.

## Migrations

The paired backend's local PostgreSQL database was backed up before applying
incoming critical_line_list migrations 0001 and 0002. Final checks found zero
pending migrations and no model drift. Introspection verified 115 managed
tables across the checked HR, payroll, RBAC and Critical Line List domains with
no missing tables or model columns. This verifies the local database only;
remote deployment must run its normal migration process.

Private evidence remains outside both repositories in the workspace's
artifacts/release-hr-20261022 directory. Backend PR:
https://github.com/RejlersAD/backend/pull/251. Neither PR merges to main as part
of this preparation.
