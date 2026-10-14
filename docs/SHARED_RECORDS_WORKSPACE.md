# Shared client, project and employee records

Order 1 of the lifecycle integration roadmap, 1 October 2026. The workspace
context and feature brief are in `../docs/features/shared-record-identity.md`
relative to this repository root.

## User entry points

- Project Portfolio → **Shared records**, or `/projects?view=shared-records`.
- Create project → optional existing Client selection.
- Project → Controls & Periods → Enter project hours → optional Employee selection.

The review queue selects one source at a time, starting with Project clients.
The server supplies accessible source choices, pagination and search. The
Unlinked / needs review filter includes unresolved records; Linked and All
statuses support inspection. Existing app routes, Sidebar and Sales screens are
unchanged.

The selected review displays retained source labels separately from shared
connections. Candidate results require explicit selection. No similarity match
creates or updates data. Generic crew/role resources do not require a named
employee. Record actions follow `can_link` and server warnings; target choices
remain subject to current source, project and organization permissions.

## API contract

All routes use the existing authenticated API client and are relative to
`/api/v1/projects/`:

- GET `shared-records/`: source_type, status, search, page.
- GET `shared-records/{source_type}/{id}/`: original values, current links,
  target kinds, source state, action eligibility and freshness token.
- GET `shared-records/{source_type}/{id}/candidates/`: kind and search; returns
  minimal `{id, code, label}` choices and `has_more`.
- POST `shared-records/{source_type}/{id}/link/`: request UUID, expected token,
  reason (maximum 1,000 characters), selected target IDs. Returns record/replayed.
- GET `shared-record-targets/`: kind/search and project_id for employee choices.

The existing project create request includes `client_id` only when an existing
client is explicitly chosen. Existing project client links are reviewed through
the reconciliation command. Hour creation includes `employee` when chosen and
omits employee text fields so the server supplies current canonical labels.
Original text-entry paths remain available for unresolved source information.

## Failure and retry behavior

Queue/detail/lookup requests abort when their scope changes. Selection does not
follow a late response from another record. Validation and access failures retain
the reviewer’s choices and reason. A stale response disables saving until an
explicit refresh; refresh preserves input and loads a new freshness token.

An uncertain network/server result preserves the request UUID and exact payload
for retry. Editing is disabled until the request is confirmed or the user
refreshes the record. Successful linking refreshes the queue and shows the
server’s returned record. This in-memory retry identity does not survive leaving
the selected record or reloading the application.

## Verification

Run from the frontend repository:

```powershell
npm.cmd exec -- playwright test tests/accessibility/shared-records.spec.js --config=playwright.config.js --workers=1
npm.cmd exec -- eslint src/services/sharedRecords.service.js src/pages/Projects/SharedRecordsWorkspace.jsx src/pages/Projects/components/SharedRecordTargetSelector.jsx src/pages/Projects/ProjectsPage.jsx src/pages/Projects/ProjectPortfolio.jsx src/pages/Projects/components/ProjectFormModal.jsx src/pages/Projects/tabs/ControlsPeriodsTab.jsx
npm.cmd run build
```

When other workspace work may touch the default output directory, the same build
can use isolated output. From the workspace root:

```powershell
docker compose exec -T frontend_local npm run build -- --outDir artifacts/shared-records-build
```

The synthetic browser fixture exercises the actual Projects workspace and API
payloads without modifying application data. It covers reviewed linking,
ambiguity, denial, stale refresh, identical replay, paging/search, late responses,
desktop accessibility/mobile overflow, canonical project creation and employee
hour entry with retained input after validation failure. Scoped lint reports the
existing ProjectFormModal prop-type warnings. Build warnings about browser data,
mixed dynamic/static imports and existing bundle size are unrelated to this slice.
Final execution results are recorded in the cross-repository feature brief.

Verified locally on 1 October 2026: all 10 distinct new browser cases and two
existing portfolio entry/create-cancel regressions passed. Final read-only,
stale/replay and accessibility cases were rerun after fixture/wording alignment.
Scoped lint passed with zero errors and 17 pre-existing ProjectFormModal
prop-type warnings. The isolated Docker Node 24 build exited successfully,
transformed 16,135 modules and generated a service worker with 117 precache
entries. The generated bundle contains the final read-only wording. An earlier
default-output build encountered missing generated files during PWA generation;
the isolated output verified the final result without relying on shared `dist/`.
Desktop and mobile screenshots are in `artifacts/shared-records/`.
