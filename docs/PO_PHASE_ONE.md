# PO phase-one presentation

The 28 September 2026 user decision makes Issued the final visible PO milestone:
Draft → Submitted → Approved → Issued. Send to Vendor retains the existing guarded
write of `status: "sent"`. It records issue; it does not transmit email.

The register and detail screen omit acknowledgement, receipt/invoice progress
and completion actions. Issued POs stay available for viewing/export but leave
My actions and the Orders to issue saved view. `purchaseOrderPhase.js` projects
existing sent/acknowledged/in_progress/partially_received/completed statuses to
Issued for PO presentation only. Raw record status, approved-content locks,
approval evidence and original documents remain intact.

Receipt/Finance modules and backend lifecycle services are retained for phase
two. This change has no backend migration or data repair. The workspace brief
`../docs/features/purchase-order-phase-one-issued.md` (relative to repository
root) records scope and verification; shared context is outside this Git repo.

Relevant checks: `node --test tests/procurement-register-model.test.js`, the
`purchase-orders`, `procurement-register-status-links`, `purchase-order-approval-guards`
and `purchase-order-completion-evidence` Playwright specs, changed-source ESLint
and `npm run build`. The completion-evidence suite now exercises issue to retain
its PDF freshness, failure and navigation protection cases.

Local verification on 28 September 2026: 22 model tests and 37 browser cases
passed, including desktop/mobile accessibility; production/PWA build passed on
Node 20.20.2. Scoped ESLint has zero errors and the existing 10 form warnings.
No backend changes, migration or deployment were performed.
