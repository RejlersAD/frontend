# HR-UI-22 — Onboarding reference design

Authorized by the user on 22 October 2026 for `/hr/onboarding`.
Match the supplied reference in the main content only: heading, tabs, filter bar,
four metrics, workflow table, selected workflow checklist, attention tasks and
team workload. Preserve Sidebar, shared header/footer, routes, API contracts,
canonical employee identity, and existing creation/detail/deletion flows.

Use existing onboarding/offboarding loaders and dashboard calculations. Display
actual records and task completion; do not seed reference names or counts.
Workflow review continues to the existing case UI. Template inspection is
read-only because this dashboard has no authorized template mutation API.
Acceptance: desktop/mobile geometry, filtering, selection, pagination, review,
loading/error/empty states, focused lint, data regressions and production build.

Implemented in `LifecycleWorkspace.jsx` and its page-scoped stylesheet, composed
by the existing `OnboardingOffboarding` overview. Existing case review, creation,
register actions (including permission-gated deletion), and focus refresh remain
available. Team ownership comes from the existing dashboard builders.

Validation: 22 existing onboarding/offboarding data tests passed. New browser
checks exercise search, pagination, selected checklist, review, register access,
start workflow, template inspection, empty/error/retry states and 1457/1024/390px
layouts without page overflow or browser errors. Scoped ESLint has no errors;
the new component has no warnings. Existing parent-file warnings remain.
Sidebar/shared-shell SHA-256 hashes match the pre-task working files, including
the user's pre-existing edits. Local Vite serves the new workspace module (200).
Synthetic-data screenshots and check results: `artifacts/onboarding-reference/`.

Initial verification in the development container compiled the application but
hit the Workbox size limit. Subsequent aligned release verification explicitly
used NODE_ENV=production and passed Vite/PWA generation with a 15.6 MB bundle.
The shared cache limit was not increased. See HR_RELEASE_20261022.md.
