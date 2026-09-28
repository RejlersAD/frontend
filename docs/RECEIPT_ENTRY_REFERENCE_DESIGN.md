# Record goods receipt form

28 September 2026. Local reference update; not deployed.

## Delivery panel correction

The requested follow-up uses eight delivery fields in four rows. Canonical receipt
basis and the authenticated recorder remain read-only. Delivery location, supplier
reference, condition, declared status and exception reason are saved through the
new additive backend delivery-information contract. Full copies available balances;
Partial preserves entered quantities; Rejected records proposed rejected quantities.
Partial/rejected declarations require an exception reason. Creation remains Pending
and existing confirmation/inspection authority is unchanged.

Saved delivery declarations appear in the existing receipt review, full details and
print output when present. `Condition (delivery)` and `Delivery status (declared)`
remain distinct from technical inspection and the actual receipt lifecycle. Empty
historical metadata adds no rows; malformed nonstring display values are omitted.
This follow-up requires backend migration 0047. Verification passed 94 backend
cases, 24 Node cases and all 57 browser scenarios, followed by five final checks
after correcting calendar icon spacing. Those final checks cover desktop/mobile
reference geometry and all five saved declarations in review, details and print.
Scoped ESLint passed; sidebar/header/layout/global-style hashes are unchanged.
The owned fixture server on port 5187 was stopped.

Migration 0047 is applied to the verified local development PostgreSQL database:
529/529 known migrations applied, zero pending. The five fields exist in schema
and serializer, existing receipt count and permission/grant snapshots are unchanged,
and the gracefully reloaded local backend passes health/access checks. This does
not imply a remote deployment. Backend evidence at workspace root:
`.codex-temp/receipt-delivery-local-verification.json`.

Final Node 20 production/PWA build passed (exit 0, 111 precache entries). Seven
changed application files match their pre-build hashes. Existing Browserslist age
and large-bundle warnings remain. Build log at workspace root:
`.codex-temp/receipt-delivery-reference-20260928/build.log`.

Primary code locations: `src/pages/Procurement/ReceiptDeliveryInformation.jsx`
(eight-field panel), `AIReceiptCreator.jsx` (identity, declarations and save),
`AIReceiptCreator.css` (reference styling), `receiptHandoff.js` and
`receiptEntryPresentation.js` (exact rejection-aware balances). Saved display is
in `src/components/Procurement/GoodsReceiptReview.jsx` and
`src/pages/Procurement/ReceiptManagement.jsx`. Backend implementation lives in
`apps/procurement/models.py`, `serializers.py`, `services/receiving.py` and
`migrations/0047_receipt_delivery_information.py` in the separate backend repo.

Frontend logs: `.codex-temp/receipt-delivery-reference-20260928/`; final screenshots:
`test-results-receipt-delivery-reference-final-20260928/`. These checks are separate
from the earlier presentation-only evidence below.

## Earlier presentation update

`AIReceiptCreator.jsx` and its scoped CSS apply the supplied three-column receipt
reference within the existing main content area. The sidebar and global header
retain their existing implementations. On narrow screens the panels stack and PO
details remain available in a disclosure.

The existing five-field entry, Pending creation, operation UUID, exact PO version,
error/stale retention and separate recorder confirmation remain unchanged. Actual
PO details populate the left panel; receiving-summary data controls eligibility
and canonical line balances. Copy remaining quantities/value and live review use
`receiptEntryPresentation.js`, with decimal-string totals separated by unit and
service currency. No draft, evidence upload or inspection authority is added.

Cross-repository adopted context and scope:
`docs/features/receipt-entry-reference-design.md` from the workspace root.
No backend schema change or migration is required.

Verification: 19 Node tests, 48 distinct browser scenarios (21 final cases,
retries disabled), scoped ESLint and five unchanged shell/global-style hashes.
Final desktop axe check found no serious or critical violations. Desktop and 390px screenshots
were inspected. Browser logs: `.codex-temp/receipt-entry-reference-20260928/`;
screenshots: `test-results-receipt-entry-reference-final-20260928/`. These tests
use synthetic API fixtures; no live receipt was created or confirmed.

Final Node 20 production/PWA build passed, with 111 precache entries. Existing
Browserslist age and large-bundle warnings remain. The three changed application
files match the source hashes captured before the build. Build log at workspace
root: `.codex-temp/receipt-entry-reference-20260928-build.log`.
