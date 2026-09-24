# Workspace UI verification

Run from the frontend repository with the package's supported Node 20 and npm 10:

```sh
npm ci
npx playwright install chromium
node --test scripts/check-sidebar-navigation.mjs scripts/check-approval-queue.mjs scripts/check-enquiry-operations.mjs scripts/check-work-hub-presentation.mjs
node --test scripts/check-ui-css-imports.mjs
node scripts/check-sidebar-ui.mjs
node scripts/check-executive-ui.mjs
node scripts/check-approvals-ui.mjs
node scripts/check-enquiries-ui.mjs
node scripts/check-my-work-hub-ui.mjs
node scripts/check-my-work-hub-ui.mjs --recent-only
node --test scripts/check-incoming-invoice-register.mjs
node scripts/check-incoming-invoices-ui.mjs
node --test scripts/check-finance-command-presentation.mjs
node scripts/check-finance-command-center-ui.mjs
node --test scripts/check-outgoing-invoice-presentation.mjs
node scripts/check-outgoing-invoices-ui.mjs
node --test scripts/check-goods-receipt-presentation.mjs scripts/check-receipt-quantities.mjs
node scripts/check-goods-receipts-ui.mjs
```

These browser checks render the real components and shell with synthetic fixtures. They intercept requests; Approvals, Enquiries, Incoming Invoices, Outgoing Invoices and Goods Receipts permit only explicitly expected fixture mutations, and the other suites refuse writes. No live account, API server or historical artifact directory is needed. Run suites sequentially to keep browser memory use bounded. `check-executive-ui.mjs` runs all six tabs; its imported `check-*-performance.mjs`, portfolio, commercial and risk modules are not separate CLI entry points.

The launcher uses Playwright Chromium, with installed Chrome as a local fallback. `PW_CHANNEL=chrome` explicitly selects Chrome. Screenshots and reports go under the sibling `artifacts` directory. Set `UI_CHECK_ARTIFACTS_ROOT` to use a separate output directory, for example a release or CI artifact location.

Useful bounded commands:

```sh
node scripts/check-executive-ui.mjs --visuals-only
node scripts/check-executive-ui.mjs --visuals-only --tabs=overview,risk
node scripts/check-executive-ui.mjs --financial-only
node scripts/check-executive-ui.mjs --portfolio-only
node scripts/check-executive-ui.mjs --commercial-only
node scripts/check-executive-ui.mjs --workforce-only
node scripts/check-executive-ui.mjs --risk-only
node scripts/check-approvals-ui.mjs --workflows-only
node scripts/check-approvals-ui.mjs --visuals-only
node scripts/check-enquiries-ui.mjs --visuals-only
node scripts/check-my-work-hub-ui.mjs --sources-only
node scripts/check-my-work-hub-ui.mjs --recent-only --view-capture
node scripts/check-incoming-invoices-ui.mjs --visuals-only
node scripts/check-incoming-invoices-ui.mjs --workflows-only
node scripts/check-finance-command-center-ui.mjs --visuals-only
node scripts/check-finance-command-center-ui.mjs --workflows-only
node scripts/check-outgoing-invoices-ui.mjs --visuals-only
node scripts/check-outgoing-invoices-ui.mjs --workflows-only
node scripts/check-outgoing-invoices-ui.mjs --sources-only
node scripts/check-outgoing-invoices-ui.mjs --visuals-only --viewport=390
node scripts/check-goods-receipts-ui.mjs --creator-access-only
```

The fixture harnesses expand relative CSS imports before Tailwind, including the shared table typography layer; stylesheet imports never depend on an unmocked web server. Unsupported or missing imports fail explicitly. Executive `--visuals-only` checks all six current tabs at desktop, tablet and mobile sizes, including dark mode, table typography, keyboard controls and accessibility, without historical snapshots or repeated business workflows. Use the optional `--tabs` list to narrow that visual pass.

Approvals defaults to the current compact layout; `--compact` remains accepted for existing commands. `--legacy-layout` is only for reviewing an older implementation with its historical snapshots.

Incoming Invoices checks the real register, review panel and existing PDF import dialog. Its only allowed POSTs are explicitly expected synthetic OCR preview and reviewed-import responses; it never contacts a live service or decides an invoice. Default checks include source pagination, queue/filter counts, stale detail responses, selected CSV exports, zero/missing amounts, responsive layout, light/dark accessibility and unchanged shell hashes. Optional historical snapshots live under `artifacts/incoming-invoices`; normal checks need none.

Finance Command Center checks the real `/finance` page with a read-only aggregate fixture. It covers original-currency selection, incomplete/restricted sources, genuine zero balances, ageing, report dialogs, PDF download, refresh errors and responsive light/dark accessibility. It also guards the shell and completed incoming-invoice components. Historical guards allow only the new dashboard service method; normal checks work without saved snapshots.

Outgoing Invoices checks the real register, collection review, create form and existing Excel import. It intercepts list, summary and detail reads; only explicitly queued synthetic create/import responses allow POSTs. Checks cover server queues and filters, pagination, original-currency and missing balances, CSV export, stale details, source failures and responsive accessibility. The shell, Incoming Invoices and Finance Command Center sources remain guarded. Historical snapshots under `artifacts/outgoing-invoices` are optional.

Goods Receipts checks the real register, review panel, receipt creator and existing detail/print workflows. It covers server queues/filters, export completeness, genuine zero and unknown quantities, separate units, stale responses, source errors and access gates. Only explicitly expected synthetic create and accept requests may write inside the fixture. Shell and prior invoice/finance sources remain guarded. Use `--visuals-only`, `--workflows-only`, `--sources-only` or `--visuals-only --viewport=390` for bounded runs.

Goods Receipts `--creator-access-only` verifies that a user with create permission but no approval permission records a pending receipt for both passing and failing findings, preserving the entered partial quantities. It uses two explicitly expected fixture POSTs and never calls a live API.

Historical redesign guards are opt-in with `--snapshot-guards`. `--baseline`, `--recent-baseline`, `--kpi-color-baseline`, and Executive `--overview-polish*` / `--tabs-polish*` modes also require the corresponding local immutable snapshots. Missing snapshots produce an actionable error, and existing hashes/pixels are never silently replaced with current output. Snapshot source paths are relocated to the current checkout. Normal commands still run functional, source-state, permission, responsive, accessibility, dialog and export checks; Executive additionally checks that sidebar source hashes stay unchanged during its run. Geometry uses the current configured sidebar width.

`check-table-typography-ui.mjs` is a local visual comparison, not a portable functional suite. It requires the immutable pre-change `artifacts/table-typography/source-before/src` copy and `source-before-sha256.json` manifest (`RelativePath` and SHA-256 `Hash` entries). It never regenerates that snapshot. `--before` renders the saved source; `--after` renders current source with read-only fixtures. Use `--routes=goods,approvals,enquiries,workhub,finance,incoming,outgoing,executive,reusable` to limit work, `--tabs=overview,financial,portfolio,commercial,workforce,risk` for Executive tabs, and optional `--widths=1440,390`. Saved cases are retained during bounded reruns. `node scripts/check-table-typography-ui.mjs --report --assert` checks the combined typography, padding, card, overflow, accessibility, print and source reports without launching a browser; row-height differences remain explicit in `comparison.json`. The reusable fixture also verifies Tailwind action weights, direct primary cells and white headings on dark fills.

Fixtures contain synthetic users, `.test` email addresses, placeholder identifiers and fabricated records explicitly used for testing. The existing `*-live.mjs`, `check-shell-photo-sync.mjs` and several older audit scripts have separate local account/backend requirements; do not include every `check-*.mjs` indiscriminately in a unit-test glob.

### Purchase order save sessions

Ordinary native PO Save draft and Save changes keep the editor open on its
current section. Tests that need the register or a fresh editing session must
click Close purchase order explicitly after waiting for the successful save.
Successful explicit vendor sending retains completion navigation; failure keeps
the editor and input. Saving alone does not send the order or request approval.

Run `node --test tests/purchase-order-save-state.test.js` for acknowledgment,
in-flight edit and attachment cases. Run `npm exec -- playwright test
tests/accessibility/purchase-order-save-stay.spec.js --config=playwright.config.js
--workers=1` for full-application save/refresh/close/send journeys using synthetic
API fixtures. Use the existing introduction, narrative, draft-recovery and
canonical-export specs when those areas are affected. These checks do not send
a real PO, certify backend migrations or establish cross-session concurrency.
