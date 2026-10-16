# Sales lifecycle frontend release verification — 1 October 2026

Status: all planned frontend release gates pass. This document records the merged frontend
checks; it does not authorize a main merge or claim production deployment.

## Scope and context

Validated development after the release owner synchronized origin/development
and merged current origin/main at `f330ae2d`. Final source and fixture corrections
were committed by the release owner as `50e1e7a098a716554ba2dd87d38d8766c8cf2793`;
the build and final checks use those unchanged files. The release includes canonical
shared records, bid/proposal preparation, opportunity and proposal registers,
document upload/classification/version/preview, client/framework/forecast
workspaces, and mailbox behavior. Current main's engineering additions are
included in the production build.

Consulted the workspace/frontend AGENTS, README, PROJECT_BRIEF, gap report,
DECISIONS, CONTRIBUTING and the applicable shared feature briefs, API/security
contracts and existing fixtures. Preserved the current two-tab Opportunity
detail rail and direct document explorer; the removed intermediate folder
overview is not a required browser journey.

Release corrections are limited to Node 24 CI alignment, the missing large-file
proxy route for explicit document revisions, and obsolete/ambiguous browser
fixture assumptions. No authentication, business eligibility or approval rule
is weakened to satisfy a test.

## Reproducible checks

Logs and isolated browser/build outputs are under
`artifacts/sales-lifecycle-release-20261001/` (ignored verification artifacts).
Dependency installation, Node tests, lint and production build use Docker
Node 24.21.0 / npm 11.19.0. Browser orchestration uses installed Windows
Node 22.20.0 and Chrome; this satisfies the package's Node >=22 engine.

- Clean dependency installation and complete tree: isolated
  `docker compose run --rm --no-deps --name radai_frontend_release_validation frontend_local sh -lc 'node --version && npm --version && npm ci --no-audit --no-fund && npm ls --all > artifacts/sales-lifecycle-release-20261001/dependency-tree.log 2>&1 && node --test tests/*.test.js tests/*.test.mjs > artifacts/sales-lifecycle-release-20261001/node-tests.log 2>&1'`.
  **Passed**, including all **510 Node tests**, no skipped or failed tests.
  See `dependencies.log`, `dependency-tree.log`, `node-tests.log`.
  The browser host's 715 installed package versions also match the committed
  lockfile, with zero mismatches (`host-locked-versions.log`).
- Changed-source lint: `docker compose exec -T frontend_local node artifacts/sales-lifecycle-release-20261001/run-lint.mjs`.
  **Passed** on the final 101 source/test and 16 configuration files, no errors;
  59 warnings. This includes the release owner's final workspace spec and shared
  navigation fixture. See `lint-summary-final.log`. `git diff --check` also passes.
- Build: `docker compose exec -T frontend_local npm run build -- --outDir artifacts/sales-lifecycle-release-20261001/dist`.
  **Passed**, including PWA generation (119 precache entries). Vite completed
  in 18 minutes 17 seconds under concurrent host load; final process exit 0.
  Existing outdated Browserslist/large-bundle warnings remain. See `build.log`.
  After the local dependency volume was refreshed, the final command uses
  `--outDir artifacts/sales-lifecycle-release-20261001/dist-clean` and captures
  Docker's native exit code immediately in PowerShell (`$buildNativeExit =
  $LASTEXITCODE`, followed by logging and `exit $buildNativeExit`). **Passed**:
  16,157 modules, 3 minutes 39 seconds, 119 PWA precache entries, explicit native
  exit 0 in `build-clean-native.log`. The earlier clean run generated the same
  complete output but its shell wrapper did not preserve an unambiguous exit;
  this final invocation supersedes that reporting ambiguity.
- CI workflow YAML parses and its setup-node version is 24; see
  `workflow-yaml.log` (`check-workflow.mjs` in the artifact directory).
- Proxy integration: `node artifacts/sales-lifecycle-release-20261001/verify-nginx.mjs`.
  **Passed** for static and substituted configurations, including `nginx -t`.
  Eight real isolated HTTP probes send 2 MiB bodies: initial upload, explicit
  version upload and download reach a synthetic upstream in each configuration;
  an unrelated API request continues to receive 413. See `nginx.log`.

The proxy correction covers
`/sales/deals/{id}/workspace/folders/{folder}/files/{file_id}/versions/upload/`
with the existing scoped body and transfer settings. Server authorization and
configured application limits remain authoritative. Finite deployment transfer
windows and browser Blob memory constraints remain unchanged.

## Browser gates

Each group uses synthetic scoped API fixtures, actual components/shell and real
synthetic PDF/Office bytes where applicable. No production/business records,
mail or attachments are created. Failure artifacts are retained; successful
targeted reruns are reported separately rather than counted twice.

| Group | Command/config under artifact directory | Result |
| --- | --- | --- |
| Proposals, preparation, clients, frameworks, forecasts | `playwright-proposals.config.mjs` | **104 distinct passed**: 102 initial, plus two corrected targeted cases; `proposals-browser.log`, `preparation-retry.log`, `preparation-settled.log` |
| Document controls and PDF/Office previews | `playwright-office.config.mjs` | **49 passed**, 14.1 minutes; `office-browser.log`, `office-documents.json` |
| Mailbox search, selection, setup, status, privacy | `playwright-mailbox.config.mjs`, `playwright-mailbox-remaining.config.mjs` | **197 distinct passed**: 124 initial, 70 remaining, three corrected targeted cases; logs below |
| Shared records and project portfolio | `playwright-projects.config.mjs` | **23 passed**, 6.5 minutes; `projects-browser.log`, `projects.json` |
| Opportunity register, documents, RADAI, fidelity, VF registration, history and bid AI | `playwright-opportunities.config.mjs` | **86 passed**, 9.3 minutes; `opportunities-browser.log`, `opportunities.json` |
| Opportunity workspace upload queue | Release-owner workspace checks | **21 distinct passed**: initial 5, final 15, targeted 1; `workspace.log`, `workspace-final.log`, `workspace-destination-settled.log` |

Configs are invoked with
`node node_modules/@playwright/test/cli.js test --config=artifacts/sales-lifecycle-release-20261001/<config>`;
the first proposal/document invocations used the equivalent
`npm exec -- playwright test --config=...`.

The complete browser scope is **480 distinct cases**. Retries do not increase
that total. The original mailbox run stopped at its configured four-failure
limit, leaving 69 cases unrun; this was not a worker crash or a global timeout.
The remaining invocation covers those 69 plus two corrected cases. Final targeted
mailbox evidence is `mailbox-auth-retry.log`, `mailbox-review-retry.log` and
`mailbox-optional-settled.log`; all other remaining cases are in
`mailbox-remaining.log`. Superseded failure traces remain available.

The first proposal invocation timed out during cold fixture navigation before
an application assertion. Its next warm cases passed. A retained preparation
test also used an unscoped Preparation tab selector, now ambiguous with the
new register filter; it now targets the selected proposal workspace. The mapping
case also waits for its real command response before checking saved UI state.
Both cases passed targeted reruns (`preparation-retry.log` for the late response,
`preparation-settled.log` for mapping). Loading/saving assertions initially
exceeded the default 5-second allowance under contention; the final mapping
invocation keeps the same assertions with a 15-second wait budget. An old
mailbox 401 case is updated to verify the
existing interceptor's session clearing and login redirect, rather than waiting
for a mailbox alert after navigation; the targeted check passed in
`mailbox-auth-retry.log`. A source-review test now recognizes that optional
commercial fields do not block approved minimal VF registration after choosing
a canonical client/name; it still proves source review never automatically saves.
The mailbox review helper now chooses the required Opportunity type when the
source did not supply one, and exact command assertions include the current
owner/open-date/type contract. The absent-commercial-facts case keeps the
original blank-field assertions and verifies that explicit registration sends
null amount/award/deadline and an empty scope, rather than fabricated values.

The workspace suite follows the current direct explorer and six-folder
navigation. Removed intermediate-overview folder-tag journeys are not presented
as passing tests of unreachable UI. Upload destination, retained file, retry,
completed-item and access guards remain covered. Shared fixture navigation waits
for DOM content and then checks application readiness explicitly.

Inspected the release mobile PDF and desktop Word captures in the
`office-documents/` output. Controls stay contained and usable, and hostile Word
fixture links/scripts remain passive text. Office Axe uses the established
scriptless-frame method: parent dialog scan without recursive frame injection,
then an independent scan of the actual sanitized frame content.

## Local service recovery

The long-running local Vite process timed out on root HTML requests during
release load while still proxying backend requests. Only `frontend_local` was
restarted; isolated browser servers and backend services were preserved. Its
predev check detected an old dependency-lock fingerprint and completed `npm ci`
before starting Vite. Root HTTP 200 and Docker healthy status were subsequently
observed. The final production build uses this refreshed dependency volume and
a separate `dist-clean` output. Post-build root HTTP 200 with native exit 0 is
recorded in `frontend-health-verified.log`, alongside Docker health. The backend
health route also returned 200 through the Vite proxy. No Vite application or
health-threshold change was needed. See `frontend-recovery.log`,
`frontend-health-postbuild.log`, `frontend-health-verified.log` and
`build-clean-native.log`.

## Release boundary

Backend migrations/tests, final remote synchronization, commits, push, main-base
PR and GitHub mergeability are owned by the release coordinator and are recorded
separately. Frontend validation is complete; no frontend gate remains failing.
