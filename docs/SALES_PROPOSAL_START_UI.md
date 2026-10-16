# Go-to-Proposal preparation and AI content

Scope follows the shared `docs/features/sales-proposal-start-ai.md` brief.
The existing 5.2 register now includes visible Go opportunities awaiting their
first Quote. These typed Deal rows show **Proposal preparation**, known client,
owner and deadline, plus Prepare proposal or the server's blocked reason.
They have no invented proposal number, revision or commercial values. Selecting
them never requests Quote detail, approval, submission, review or export. Export
includes only saved Quotes; an explicit creation replaces the pending row.
Actual Quotes retain their statuses and multiple explicit revisions.

Both readiness and the create selector use the paginated
`GET /sales/quotes/preparation-opportunities/` endpoint. The register requests
`pending_only=true`; the selector requests false, including opportunities with
existing proposals. Bounded page loading checks identities and totals and never
follows server-provided URLs. A readiness failure remains visible beside saved
Quotes. Selector loading, empty, denied and retry states retain authored input.
Active/Prospect eligibility and access come from the server; no client-list join
or client-status change occurs. The first selection can supply currency while
untouched; later selections preserve the user's currency.

Create and the existing saved-proposal editor share compact Write/Rewrite with
AI controls for scope, deliverables, assumptions and exclusions. Preparation
offers Edit proposal content while its technical imports and history remain
separate. Each suggestion fills one editable field and offers Undo. Only explicit
Create/Save persists content. The AI routes are
`POST deals/:id/proposal-draft-field/` and `POST quotes/:id/draft-field/`.

Requests contain the target field/text and bounded current narrative strings.
Saved structured entries are projected using only their allowlisted narrative
keys; rates, costs and arbitrary nested metadata are not serialized to AI.
Unchanged text fields are omitted from PATCH against the edit session's captured
baseline, preserving structured evidence even if a preparation refresh finishes
while editing. Explicit list edits become one trimmed item per line.

Manual or sibling edits, opportunity/record changes, saving and dialog close
invalidate pending output. Response checks require the same source IDs, field
and draft/rewrite mode. Failures retain text; AI performs no business save and
cannot change pricing, approval or submission authority.

## Verification

The focused real-shell browser suite is
`tests/accessibility/sales-proposal-start-ai.spec.js`; run from `frontend` with:

```powershell
npm.cmd exec -- playwright test --config=playwright.sales-proposal-start.config.js --timeout=180000 --output artifacts/sales-proposal-start/verified
node --test tests/sales-proposal-draft.test.js tests/sales-proposal-register.test.js tests/sales-proposal-review.test.js tests/sales-proposal-pdf-helpers.test.js
```

All 14 new browser cases and 26 helper checks passed. The initial smoke's first
navigation exceeded its 90-second cold fixture startup budget; its other two
functional cases passed. The final run used the 180-second startup allowance
above and passed all 14 in 3.2 minutes. No product fix was needed for startup.
The new suite covers paginated Prospect selection, pending entry replacement,
typed-row/export safety, readiness/selector errors, each AI field and Undo,
403/409/503 recovery, wrong-source/manual/sibling/selection/close/save races,
structured evidence preservation and explicit writes.

Scoped source/test/config ESLint and whitespace checks passed. Desktop and
mobile WCAG A/AA Axe scans and document overflow checks passed. All three
screenshots were visually inspected under
`artifacts/sales-proposal-start/verified/sales-proposal-start-ai-re-80cc9-t-desktop-and-mobile-widths/`:
`preparation-register-desktop.png`, `proposal-content-desktop.png` and
`proposal-content-mobile.png`. The final production/PWA build passed in the
canonical Node 24 Docker container (4m12s), recorded in
`artifacts/proposal-start-ai-build.log`; established build warnings remain.

All 16 distinct retained register browser cases also passed: 15 in the full run
and the creation case in a targeted rerun after its broad Deliverables label
selector was updated to target the textarea rather than the new AI button.
No application fix was needed for that test locator. These checks retain
creation/editing, approval/submission evidence, documents/PDF return navigation,
denied/late responses, exports, filters and 1024/1366/1920/390px behavior.

```powershell
npm.cmd exec -- playwright test --config=playwright.sales-proposal-register.config.js --output artifacts/sales-proposal-start/retained-register
npm.cmd exec -- playwright test --config=playwright.sales-proposal-register.config.js --grep "draft creation inherits" --output artifacts/sales-proposal-start/retained-create-retry
```

The targeted rerun log is `artifacts/sales-proposal-start/retained-create-retry.log`.
The original locator failure remains in the separate full-run artifact directory.
Fixtures are synthetic API responses; these checks do not save live
opportunities or call a live AI provider.
