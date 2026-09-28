# Receiving basis recovery

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
