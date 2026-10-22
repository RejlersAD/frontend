# HR-UI-23 — Employee directory reference design

User-authorized 22 October 2026 for `/hr/employees`. Recreate the supplied
main-content design: six KPI cards, directory/organization/timesheet tabs,
search/filter/column controls, compact eight-row directory, pagination, and
an adjacent selected-employee details panel. Sidebar, shared shell, routes,
canonical employee records, API contracts and existing edit permissions remain
unchanged. Reuse configured KPI formulas, filters, normalized data and profile
actions. Preserve legacy cards/hierarchy views and biometric search.

Details use existing record fields and an on-demand rich user read. Unknown
fields remain unknown. Existing profile editor is the write surface; no new
notes, document, account or probation policy is introduced. Export downloads
the currently filtered directory. Import/add link to the existing admin flow.

Acceptance: responsive geometry, real selection, search/filter/columns,
pagination/export, detail loading/errors, retained full profile actions,
focused lint and regression/browser checks. Capture protected file hashes.

Implemented as a scoped directory presentation over the existing HREmployees
state/actions. Directory defaults to eight employees in name order and retains
Employee ID sorting. Detailed editing, documents, access and other profile tabs
continue through the existing permission-controlled drawer. Card/hierarchy views
remain available under Columns. Detail notes are read-only; Edit profile opens
the established editor rather than adding an unsupported notes write API.

Verification: browser checks passed for pagination, search, selection, profile
actions, filtered CSV, department filtering, columns, close/reopen details,
organization/timesheet slots, create destination, detail failure/retry and empty
states. Screenshots at 1530/1024/390px show no page overflow. Existing 12 KPI
filter checks and five Employee ID sorting tests passed. The new component has
zero lint errors/warnings; the parent retains existing warnings. The full page
and its local dependency graph bundle successfully with esbuild; Vite serves the
new module (HTTP 200). Protected Sidebar/Header/Layout/config file hashes match
the task baseline. Evidence: `artifacts/employees-reference/`.

Full production/PWA packaging was not repeated: the immediately preceding page
task compiled the application but failed Workbox packaging because the shared
22.2 MB bundle exceeds its 2 MiB precache limit. Shared build configuration is
outside this main-content request.
