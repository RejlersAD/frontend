# Receiving basis recovery

## Active Goods/Full defaults and direct recording

28 September 2026 follow-up: Delivery information now owns the missing-basis
Goods/Services choice, with Goods and Full selected by default. Separate source
drafts survive type switches. Existing canonical service orders display Services
and retain their currency/value basis. Full copies real available balances only
for a fresh canonical basis or explicit click; refreshes preserve entered input.

Record receipt is enabled for server-authorized source recovery and validates
required delivery/source fields. Full records through the existing basis POST,
verified summary GET and Pending receipt POST, using returned line IDs and PO
freshness. The busy guard spans both commands. Each command retains its own
retry UUID; a failed receipt retry does not resave an established basis. A changed
saved-versus-refreshed version or line identity stops recording and requires
refresh. Partial/Rejected first establishes missing source lines, then requires
actual received values and the exception reason. No backend/schema changes.

Implementation: `AIReceiptCreator.jsx`, `ReceiptDeliveryInformation.jsx`, and
`ReceiptReceivingBasisEditor.jsx`. All 95 focused browser cases passed on the
first run with retries disabled (19 new cases and 76 receipt/handoff regressions),
along with 34 Node cases and scoped ESLint. The browser screenshot verifies active
Goods/Full and Record receipt; failure cases cover denied/stale access, preserved
input, exact retry keys, command sequencing and duplicate-click prevention.
The Node 20 production build passed in 2m41s with 111 PWA precache entries. All
three changed application source hashes matched after verification. Existing
bundle-size and Browserslist notices remain. Local evidence is retained under
`.codex-temp/receipt-defaults-20260928/` in `verification.json`,
`browser-results.json`, build/unit/lint logs and source-hash records.

28 September 2026. Uploaded purchase orders without structured receiving lines
can use the compact **Set receiving basis** editor in the existing receipt form.
The server must return both `needs_basis_review` and `can_review_basis`; the
receipt handoff queue uses the same capability to make its action available.

Users explicitly review goods descriptions, units and ordered quantities, or a
single service scope, PO currency and confirmed net value excluding VAT. No
quantity or amount is inferred from a PO total. Goods and service entry retain
separate drafts when switching the choice. Existing structured bases remain
read-only, and receipt creation retains its delivery-field and balance checks.

`POST /procurement/orders/{id}/receiving-basis/` sends `basis`, `lines`, the exact
`expected_updated_at` and a UUID `operation_key`. Each line contains only
`description`, `uom` and `ordered` decimal text. This audited receiving record is
separate from commercial PO fields. The backend retains approval, issued-state,
access, no-existing-receipt and freshness guards; completed POs use reconciliation.

After saving, the form reloads authoritative receiving balances and uses the
returned line identities in the existing Pending receipt command. Delivery
details survive this update. Failures retain basis input; retries of an unchanged
command reuse its operation key. Stale or unverified acknowledged saves require
an explicit balance refresh before continuing. Sidebar, delivery-panel reference
layout and post-save navigation remain unchanged.

Implementation: `ReceiptReceivingBasisEditor.jsx`, `receiptReceivingBasis.js`,
`AIReceiptCreator.jsx`, `goodsReceipts.service.js`, `PurchaseOrderHandoff.jsx` and
the creator capability check in `ReceiptManagement.jsx`.

Focused synthetic coverage is in `tests/receipt-receiving-basis.test.js` and
`tests/accessibility/receipt-receiving-basis.spec.js`; the latter also captures
before/after recovery and narrow-screen screenshots. No live receipt is created
by these browser fixtures.

## Release verification — 28 September 2026

All 224 distinct browser cases across 19 procurement specs passed against the
isolated fixture server on port 5188, with automatic retries disabled. This is
combined evidence from four runs: 25 passes before increasing worker count,
68 additional passes before increasing it again, 128 passes in the final broad
run, and three targeted passes. Earlier completed cases were excluded from
resumed runs; the combined report verifies unique case identities.

Test fixtures and selectors were updated for current delivery labels, approval
tab navigation, approved read-only commercial context, authenticated original
PDF previews and distinct loading/success status regions. Permission, stale-data,
write-count and exact PDF/Word byte assertions remain in place. Two corrected
status selectors passed on targeted rerun. The unchanged mobile accessibility
case also passed serially in 8.9 seconds after an auxiliary axe page evaluation
timed out under four workers; its assertions and 60-second timeout were retained.
These suite corrections required no application changes.

Changed-test ESLint and scoped `git diff --check` passed. The release coordinator
verified 67 Node test cases and the Node 20 production build (2m50s, 111 PWA
precache entries), with application source hashes unchanged during verification.
Local evidence is retained under
`.codex-temp/release-procurement-20260928/`: `release-verification.json`, the
four browser logs and final/rerun JSON reports. Build, source-hash, Node and
application lint evidence is under
`../.codex-temp/receipt-basis-release-20260928/`. These ignored artifacts are
local verification records, not deployment or production migration evidence.

## Safe receipt error messages — 28 September 2026 follow-up

The PO selector and receipt form now use the existing `handoffError` export
through `src/components/Procurement/handoffError.js`. Server failures display
a concise retry message. HTML, encoded markup, tracebacks, diagnostic fields and
oversized text are rejected rather than stripped or partially displayed. Error
traversal and output are bounded; concise field validation, local verification
instructions and the existing access/stale messages remain available.

`PurchaseOrderHandoff.jsx` retains the public helper export for its existing
consumers. `goodsReceipts.service.js` uses the established `suppressErrorToast`
option only for available-order lookup, receiving balances, receiving-basis
save and receipt creation/reconciliation. Their inline messages now own error
presentation. `AIReceiptCreator.jsx` also suppresses error toasts for its optional
PO-detail lookup, which already retains known queue metadata on failure. The
global Axios interceptor is unchanged. Search, delivery fields, basis drafts,
receipt quantities, stale refresh and operation-key retry behavior are retained.

Follow-up checks passed 10 Node cases (seven new error cases plus three existing
basis validators), changed-file ESLint and 76 distinct browser cases: eight new
safe-error cases and 68 existing receipt/handoff cases rechecked. These 76 are
follow-up coverage, not 76 additional cases to add to the earlier 224. The first
run passed 70; six targeted reruns passed after correcting four new accessible
test locators and one existing 502-message expectation, and rerunning an
unchanged layout case whose fixture HTML fetch timed out during Vite warmup.
Assertions and timeouts were retained, with automatic retries disabled.

The final Node 20 production build passed on aligned commit
`1f7f77580ede19bf82ddd4dd6b436705aeb0752e` plus this patch (2m27s, 111 PWA
precache entries). The earlier build was deliberately stopped before alignment
and is not release evidence. SHA-256 checks confirmed all four changed
application files remained unchanged through alignment and final verification.
Evidence is under `.codex-temp/receipt-safe-errors-20260928/`, including
`browser-verification.json`, both browser reports/logs, `unit.log`, lint logs,
`build-final.log` and `source-hashes-final.json`. The isolated fixture server was
stopped after verification; no live receipt was created by these checks.
