# Workspace UI verification

Run from the frontend repository with the package's supported Node 20 and npm 10:

```sh
npm ci
npx playwright install chromium
node --test scripts/check-sidebar-navigation.mjs scripts/check-approval-queue.mjs scripts/check-enquiry-operations.mjs scripts/check-work-hub-presentation.mjs
node scripts/check-sidebar-ui.mjs
node scripts/check-executive-ui.mjs
node scripts/check-approvals-ui.mjs
node scripts/check-enquiries-ui.mjs
node scripts/check-my-work-hub-ui.mjs
node scripts/check-my-work-hub-ui.mjs --recent-only
```

These browser checks render the real components and shell with synthetic fixtures. They intercept requests; Approvals and Enquiries permit only explicitly expected fixture mutations, and the other suites refuse writes. No live account, API server or historical artifact directory is needed. Run suites sequentially to keep browser memory use bounded. `check-executive-ui.mjs` runs all six tabs; its imported `check-*-performance.mjs`, portfolio, commercial and risk modules are not separate CLI entry points.

The launcher uses Playwright Chromium, with installed Chrome as a local fallback. `PW_CHANNEL=chrome` explicitly selects Chrome. Screenshots and reports go under the sibling `artifacts` directory. Set `UI_CHECK_ARTIFACTS_ROOT` to use a separate output directory, for example a release or CI artifact location.

Useful bounded commands:

```sh
node scripts/check-executive-ui.mjs --financial-only
node scripts/check-executive-ui.mjs --portfolio-only
node scripts/check-executive-ui.mjs --commercial-only
node scripts/check-executive-ui.mjs --workforce-only
node scripts/check-executive-ui.mjs --risk-only
node scripts/check-approvals-ui.mjs --workflows-only
node scripts/check-enquiries-ui.mjs --visuals-only
node scripts/check-my-work-hub-ui.mjs --sources-only
node scripts/check-my-work-hub-ui.mjs --recent-only --view-capture
```

Approvals defaults to the current compact layout; `--compact` remains accepted for existing commands. `--legacy-layout` is only for reviewing an older implementation with its historical snapshots.

Historical redesign guards are opt-in with `--snapshot-guards`. `--baseline`, `--recent-baseline`, `--kpi-color-baseline`, and Executive `--overview-polish*` / `--tabs-polish*` modes also require the corresponding local immutable snapshots. Missing snapshots produce an actionable error, and existing hashes/pixels are never silently replaced with current output. Snapshot source paths are relocated to the current checkout. Normal commands still run functional, source-state, permission, responsive, accessibility, dialog and export checks; Executive additionally checks that sidebar source hashes stay unchanged during its run. Geometry uses the current configured sidebar width.

Fixtures contain synthetic users, `.test` email addresses, placeholder identifiers and fabricated records explicitly used for testing. The existing `*-live.mjs`, `check-shell-photo-sync.mjs` and several older audit scripts have separate local account/backend requirements; do not include every `check-*.mjs` indiscriminately in a unit-test glob.
