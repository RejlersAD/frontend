# EXEC-ACCESS-01 — Executive tab permissions

## EXEC-ACCESS-02 - assignment repair, 27 October 2026

All six tabs appear in the role/user editors and simple assignment screen. A tab
grant includes Executive page entry with matching backend code; source/record
restrictions and explicit Executive read denies still apply. Read denial is
explained before a conflicting assignment. Backend rbac.0070 adds the Commercial,
Workforce and Risk actions. Existing snapshots, audit and self-edit protection
remain. Nine browser checks passed, including each tab assigned individually and
blocked-read feedback. This supersedes the older separate read prerequisite below.


## Local runtime repair — 23 October 2026

Older reports missing allowed_tabs now show Executive update required and remain
hidden. Three contract unit tests and an actual-page browser test verify this
specific error and retain existing permission/network error distinctions.

The missing local backend migration was applied and Gunicorn workers reloaded.
Authenticated direct and frontend-proxied report checks both return HTTP 200
with all six tabs for the user's unchanged Super Administrator membership.
Local activation is now verified; the earlier pending-activation notes below
describe the original implementation stage. No production deployment occurred.

## Assignment layout repair — 23 October 2026

The screenshot's clipped search came from placing both a label and input inside
the shared fixed-height ra-search. The assignment panel now owns its search
control, compact scrollable user rows, selected identity, checkbox cards, centered
empty state and Assign footer. Container queries accommodate the existing sidebar
and narrow content; no shared shell or permission behavior changes.

The browser fixture includes the real roles-access/workspace wrappers. All 11
browser cases passed. Responsive geometry checks cover 1440, 1024, 768 and 390px,
with the existing sidebar space reserved on desktop/tablet. JS/JSX lint passes
without warnings or errors. No backend change or deployment was performed.

## Simple assignment follow-up — 23 October 2026

The user requested a direct Select Executive tab access -> Assign workflow.
Roles & Access Management now has an Executive tab access tab: choose/search a
user, tick Overview/Financial performance/Project portfolio, then click Assign.
Selected tabs receive an explicit allow; unselected tabs receive an explicit
deny. Only these three individual decisions change; role assignments and other
permissions remain intact. The existing Executive/module/source prerequisites
still apply. Existing advanced role/user editors remain available.

The panel reuses the existing snapshot-protected individual permission API.
The audit reason records the chosen tab names automatically; there is no extra
reason form or confirmation dialog. Existing self-edit and administrator checks
remain. Stale conflicts keep the selection and require reloading the user.

Follow-up checks: 9 browser cases plus the separately added self-edit lock case
passed (10 total). Lint has no errors; existing RoleManagement warnings remain.
This simplification is local; deployment and migration/role prerequisites from
the original change remain pending.

Existing Roles & Access Management keeps its layout and reviewed save workflow.
The role Permissions tab now includes Executive tab access with independent
Overview, Financial performance and Project portfolio checkboxes.

The existing individual permission editor offers Inherit from roles, Allow and
Deny for the same tabs. Use role permissions resets their overrides too. Existing
reason, snapshot, audit and self-edit protections remain authoritative.

Executive application access and View, plus existing source/record permissions,
remain necessary. Overview independently authorizes its department summaries.

Executive uses server-evaluated allowed_tabs. Navigation and keyboard focus
include permitted tabs only; denied/default URLs select the first permitted tab.
Focus, visibility, access-change events and a 60-second interval refresh decisions.
Exports use the filtered report. Missing allowed_tabs fails closed; deploy the
matching backend and apply rbac.0065_executive_tab_permissions before assigning
new role/user grants. New definitions do not automatically grant ordinary users.

Browser checks use synthetic API fixtures and an isolated local fixture server:

    node node_modules/@playwright/test/cli.js test --config=playwright.executive-access.config.js

No live grants or deployment were performed.

All 7 browser tests passed using actual components bundled by esbuild and served
locally without a backend proxy. This covers role review retaining existing
application/read grants, individual Allow/Deny/Inherit, restoring role defaults,
revocation/deep links and the existing Finance/Portfolio reporting regressions.
Lint has no errors (existing RoleAccessEditor prop-type warnings remain).
Full Vite production build is blocked by the incomplete local
@mui/icons-material dependency, imported by the unrelated CRSChainDetail page.
