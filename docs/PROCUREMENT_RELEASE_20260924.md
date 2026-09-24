# Procurement and Finance release verification — 24 September 2026

Release source: `development`, aligned with `main` at `d409114`. Application
verification used `a27dfbde27768a8e6b964a4a3dc2892aba37a604`; subsequent changes
to this report and the UI-check guide are documentation only.

## Behavior

- Goods Receipts exposes server-selected orders awaiting receipt and a separate
  reconciliation queue for completed orders with missing evidence. Entry records
  Pending receipts with the actual receipt date, quantities/value and reference.
- Explicit Confirm delivery and Delete receipt actions respect server capabilities,
  preserve input on failure, and surface stale or denied actions. Confirming
  delivery does not assert technical inspection results.
- Finance shows orders awaiting a supplier invoice, opens the existing import
  with the selected PO, supports searchable/paginated selection and displays
  confirmed PO links. Import requires the supplier's actual document.
- The compact PO narrative editor defaults to 12 pt. Heading and introduction
  visibility are explicit; new introductions start hidden and blank content does
  not create a scope page. Preview and downloads use the backend document rules.
- Save draft and Save changes keep the editor on its current section. Saved
  baselines, attachments, recovery and edits made during a request are preserved.
  Explicit close or successful existing send completion ends the editing session.

## Checks performed

| Check | Result |
| --- | --- |
| Node 20.20.2 production/PWA build from an isolated checkout | Passed; 112 precache entries |
| Relevant Node unit tests | 115 passed |
| Receipt and Finance handoff browser scenarios | 39 passed |
| PO save-session scenarios against the isolated production bundle | 7 passed |
| ESLint across 41 changed JS/JSX files | Zero errors; 10 existing PurchaseOrderForm warnings |
| All 47 release paths compared with the verified source | Equivalent after line-ending normalization |

Browser tests use synthetic API fixtures and do not send a real PO, confirm a
live receipt or import an actual invoice. Final checks include input retention,
stale/denied/failure handling, receipt retry recovery, responsive receipt actions
and repeated PO saves without duplicate attachments. Build notices concerning
bundle size, Browserslist and existing dynamic imports remain.

Commands and local logs are recorded in the workspace
`.codex-temp/release-procurement-20260924/FRONTEND-VERIFICATION.md` and its companion
log files. See [UI checks](../scripts/README-ui-checks.md) for the maintained test
entry points. This is scoped release validation, not a whole-repository lint pass.

## Coordinated rollout

Deploy with the matching backend after procurement migrations `0045` and `0046`
have applied. Receipt commands rely on the matching freshness/retry contracts;
the frontend build alone does not certify a target database or deployment.
Confirm the deployed receipt queues, supplier-invoice import and saved PO editor
using an authorized account before operational handover.

PDF/Word content and structure have backend regression coverage. Native Word
pagination across installed fonts and Word versions remains unverified; editable
Word body pages can reflow. No production deployment or merge into `main` is
performed by this verification record.
