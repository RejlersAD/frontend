# Sales bid and proposal preparation

Implemented locally for the user-authorized lifecycle order 2. Scope follows
`../docs/features/bid-proposal-preparation.md` in the parent workspace, the
existing Sales proposal register/preview briefs, and adopted design, ownership,
permission and workflow context. No Sidebar or App route change is needed.

## User flow and ownership

Open Sales > Proposals, select a proposal, then open **Preparation**.

- The opportunity's recorded bid decision and RFP workspace remain Sales-owned.
  Create a Planning workspace from its known facts or choose an eligible existing
  workspace. When the opportunity has no recorded duration, creation requires an
  explicit draft planning duration assumption. This does not create an execution
  project or an approved schedule.
- Choose an exact technical revision in that workspace and preview its solution,
  schedule/generation basis, deliverables, recorded effort, frozen resource
  requirements, current allocations and nonfinancial risk assessments.
- Compare the proposed values with the current Quote fields. No checkbox is
  selected automatically. Only supported, explicitly selected fields are applied:
  scope, deliverables, assumptions, exclusions, disciplines, estimated hours and
  risks. Missing effort has no selectable import. Price, cost, currency, tax,
  discount and approval remain in their existing governed forms.
- Save a review reason with the selection. The server creates one immutable
  preparation revision with the atomic field update. The register and current
  Quote refresh without discarding the active Preparation view.
- History distinguishes unchanged, changed and inaccessible sources. The bounded
  history explicitly reports when only the latest records are shown.

Technical revision links use `/proposal-workspace/:projectId?proposalId=:id`.
The Studio chooses that exact accessible revision, reading its scoped detail
when it is outside the initial list page; a missing ID displays an
unavailable state instead of silently choosing the latest one. Ordinary Studio
navigation preserves its existing selection behavior. A Sales-origin link has
an optional return button. Canonical Sales client/opportunity references are
read-only for bound technical proposals. Technical creation relies on server
defaults for client identity.

Schedule/resource/risk links open the existing Planning workspace. Its route
does not support selecting a schedule version from a URL; exact version identity
is shown in preparation evidence. Existing technical review/approval/issue
authority, commercial approval and PDF feedback remain distinct.

## API and failure behavior

`src/services/proposalPreparation.service.js` uses the established API client
with `/sales/deals/:id/bid-preparation/`, `bid-preparation-candidates/` and
`/sales/quotes/:id/preparation/`, `preparation-sources/`,
`preparation-preview/`, `prepare/`. Candidate search and pagination are scoped
by the server; the UI never resolves identity from names.

The UI honors server capabilities and immutable-source availability. Validation,
permission and stale errors retain field choices, candidate selection and reason.
Refresh is explicit and obtains a new token while retaining the review input.
Failed source reads remove the applicable preview. A command with an uncertain
transport/server result freezes its inputs and retries the exact UUID and
payload. This pending command is held only in memory while the selected review
remains open; after navigation/reload, refresh captured history before a new
submission. Read requests are aborted where supported; request generations and
component ownership suppress late responses. Switching ordinary tabs retains
an unfinished Preparation review; switching proposal resets its scope.

## Verification commands

From `frontend`:

```powershell
node --test tests/sales-proposal-register.test.js tests/sales-proposal-review.test.js tests/sales-proposal-pdf-helpers.test.js
npm.cmd exec -- playwright test --config=playwright.proposal-preparation.config.js
npm.cmd exec -- playwright test --config=playwright.sales-proposal-register.config.js
npm.cmd exec -- eslint src/pages/Sales/SalesProposalPreparation.jsx src/pages/Sales/SalesProposalWorkspace.jsx src/pages/Sales/SalesProposalRegister.jsx src/services/proposalPreparation.service.js src/services/planningIntelligence.service.js src/pages/Sales/SalesLifecycleArea.jsx src/pages/ProposalWorkspacePage.jsx src/components/planning/FinalProposalStudio.jsx
```

From the workspace root (isolated output avoids concurrent shared `dist` work):

```powershell
docker compose exec -T frontend_local npm run build -- --outDir artifacts/proposal-preparation-build
```

The real-shell Playwright fixture contains synthetic scoped API responses only;
it does not write fixture records to a database. Tests cover selective imports,
unknown effort, create/attach, missing-duration input, stale/denied/validation
retention, uncertain replay, record switching, exact technical revision links,
responsive layout and Axe checks. Final check results are recorded below after
completion. Backend authority, migration and transaction checks are reported by
the backend implementation separately.

## Final local verification — 1 October 2026

- New preparation browser suite: **11 distinct cases passed**. After the final
  precision, tab wrapping and exact-detail lookup adjustments, the relevant
  **3 cases passed again**; these are a subset of the same 11, not additional
  distinct cases. The Studio check covers an older revision outside the first
  list page, an unavailable requested revision, and unchanged default selection.
- Retained proposal register browser suite: **16 distinct cases passed**,
  including approval/submission, PDF-version separation, input retention,
  permission denial and responsive behavior at 1920/1586/1366/1024/390px.
- Existing register/review/PDF helper checks: **23 passed**.
- Desktop and mobile WCAG A/AA Axe checks passed. Screenshots were visually
  inspected and copied outside the test runner's disposable results directory:
  `artifacts/proposal-preparation/desktop.png`, `comparison.png`, `mobile.png`.
- Scoped ESLint: **0 errors**, with 32 existing child-component PropTypes
  warnings in `FinalProposalStudio.jsx`. Changed tracked files passed
  `git diff --check`; Git reports existing Windows line-ending normalization
  notices.
- Final isolated Docker Node 24 production build: **exit 0**, 16,138 modules,
  Vite 5m15s (total command 5m36.6s), PWA 117 entries / 37,505.60 KiB.
  Raw log: `artifacts/proposal-preparation-build-final.log`; output:
  `artifacts/proposal-preparation-build/`. Verified its referenced
  `index-Cye_VvxB.js` includes four-decimal duration controls and exact-revision
  detail lookup, and `sw.js` exists. Existing Browserslist, mixed dynamic/static
  import and chunk-size warnings remain.

These checks establish the local frontend implementation. They do not claim
production deployment, automatic external RFP copying, a new approval policy or
completion of later lifecycle roadmap orders.
