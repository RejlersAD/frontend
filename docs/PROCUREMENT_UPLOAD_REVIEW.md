# PR, PO and vendor upload review

## Saved approvers and multiple project references

The subsequent saved-page follow-up projects the retained Additional Approver,
Level labels and Special notes into the saved PR ribbon and history editor.
Cards wrap so all approvers remain visible. `recommendationDisplayApprovals`
is presentation-only; approval commands continue to use the saved live workflow.
Richa is displayed at Level 0, using an active canonical identity where available;
an absent source decision is shown as Not recorded. Existing real decisions and
signatures are preserved. Native form defaults recognize the canonical email and
known name variants without assigning another employee when Richa is unavailable.

Project Number accepts comma-separated values in upload and the native form.
Values are trimmed/deduplicated and retained as explicit references; custom Add
Project creates one reference per supplied code and keeps existing linked IDs.
The native payload uses `project` and `project_details`; read-only
`project_numbers` is omitted. Existing-PDF attachment review exposes this one
editable reference field separately from protected commercial cards and sends
`reviewed_project_references` with the preview timestamp only when changed.
Save success requires the returned project_numbers to match the submitted list;
re-preview restores saved references. Errors retain the file and edits.

Unknown/number-only approver names can be corrected with their Level and a
required Special note. Upload sends role-specific `approver_notes` in its source
review and only permits unknown-name exceptions to signed-off read-only names.
Saved history uses the original row snapshot/document digest/freshness token
through `source-approvals`; Additional changes use `source-review` with the
expected review snapshot. Neither path infers a signature from a name or Level.
Known completed source names remain protected. The workspace feature brief is
`docs/features/purchase-recommendation-project-approval-review.md`.

Follow-up verification on 25 September: 51 Node tests, 27 distinct browser cases
and two affected visual reruns passed. Changed-source lint passed with one
existing form hook warning. The final production build passed, including PWA
generation. The [browser ledger](../../artifacts/procurement-saved-approvers-projects-20260925/browser-verification.md)
records commands, final file hashes, desktop/mobile screenshots and the isolated
fixture limits. Backend validation is documented in
`backend/docs/PR_SOURCE_APPROVAL_REVIEW.md` (207 distinct functional cases).

## Original upload presentation

The shared upload dialog follows the user-supplied purchase recommendation
review reference: blue header/progress strip, source PDF beside grouped review
fields, pale blue section headings, navy text and a fixed action footer. Styling
is local to `.procurement-import-review`; the sidebar, application shell and
global typography are unchanged. Narrow screens stack the PDF and form.

`PurchaseRequisitionPdfImport.jsx` remains the PR-only, PO-only and paired
import entry point. The source panel uses the existing PDF renderer, page/zoom
controls, original blob URLs, keyboard document tabs and original-file download.
Viewer readiness reflects the renderer's actual completion/error callbacks.

PR fields retain their existing API keys, required/conflict messages and money
review behavior. Price breakdown supports adding and removing reviewed lines,
retaining at least one existing row; server-side total/currency checks remain
authoritative. Approval inputs retain the four supported source-signature roles
and expose the explicitly requested optional Additional review row.
PO approval evidence and vendor review remain separate from PR signatures.
When attaching to a known PR, its number is visible before choosing a PDF;
the existing server binding and identity checks remain unchanged.

PR upload, PR attachment and new PO upload use this same dialog. A retained PO
document's preview/editor is a separate existing branch. Selecting a PDF shows
the source; **Extract PDF data** in the review pane and **Preview OCR** in the
footer invoke the same explicit extraction request. Its loading state explains
where the captured fields will appear.

For an existing PR, the full information, financial, description, price-line
and identity cards now remain visible as read-only values from
`preview.extracted_data`. Missing fields show `Not detected`. The normal PR
review starts with the information/financial cards: the repeated heading,
attachment/info banners and differences table were removed at the user's
request. Source selection remains available in the footer and brings its
chooser into view with keyboard focus. Actual identity
errors and their saving guards remain. Attachment review has no commercial
or price-line mutation controls; attaching still sends empty `manual_overrides`
with the bound expected number and `attach_only`.

The approval list and date stay visible for signed-off PDFs. Four supported
signer slots show captured names, source role labels, signature status and
remarks. Roles absent from an available source-row list read `Not on document`;
duplicate mapped source rows retain their individual names and evidence. Their
actual signature flags take precedence over a canonical summary, so one signed
row cannot hide verification for an unsigned duplicate. Names from documents
marked signed off remain read-only, with their name/signature overrides omitted
from saving. Incomplete evidence keeps the explicit verification controls.
Approval progress follows actual source rows when available, matching the server
rule, and retains the four-role fallback for older responses. Captured approval
dates remain visible/editable; unreadable dates stay blank with the existing
review message. Raw captured date text is evidence, never a guessed date.

The PO-specific reference follow-up groups **Order information** and
**Commercial terms** side by side, followed by compact **Vendor details** and
**Approval evidence**. The selected PO preview is titled **Source PO**.
Required progress uses existing field checks. Signature and stamp evidence
remain separate manual choices; the approver title remains editable. Vendor
lookup, recommendation linking and VAT handling use their existing contracts.
The saved-document editor is outside this visual update.

The final actions read **Upload PR**, **Save PO**, or **Upload PR and PO**;
existing-record evidence still uses **Attach signed PDF**. These invoke the
same reviewed-import commands and acknowledgment checks. No draft-save endpoint
exists for this import; the status therefore says **Review in progress**, and
there is no simulated saved draft.

The **Level** column stores a display label for each canonical signer (20
characters). **Additional** records an optional source name (200 characters),
level label and explicit **Verify** checkbox using existing employee suggestions.
Changing its name resets verification; **Clear** removes the annotation. This
row does not add a live approval stage or complete missing canonical signatures.
Signed-off source names stay read-only; the new review annotations stay editable.

On changed annotations, the PR import sends normalized `source_approval_review`
and the preview's `expected_source_approval_review` snapshot. Unchanged annotations
are omitted. The server returns the saved review separately from OCR detection;
the UI checks that acknowledgment before displaying success. A failed, stale or
unacknowledged save retains the reviewed fields and original snapshot for retry.
Selecting different documents resets local annotations; same-source preview can
restore the server's saved review. Source identity, empty attachment commercial
overrides and independent PO signature/stamp values remain unchanged. See
`backend/docs/PR_SOURCE_APPROVAL_REVIEW.md` in the workspace for validation,
digest binding, protected storage and retry behavior.

Import, validation, denial and network errors retain source files and reviewed
input. The dialog supports contained keyboard focus and Escape/cancel/close;
mutating actions remain disabled while their request is pending.

The centered-window follow-up constrains the body portal and its backdrop to the
visible `#application-content > main.main-content` rectangle. It starts at 1160px
or the available width with gutters. A transparent pointer shield preserves
modal background blocking while leaving the sidebar/header/footer visible.
Both outer edge handles resize around the
center; arrows move the focused edge (Shift doubles the step), Home minimizes
and End maximizes within the main area. Narrow screens fit the area and hide
handles when no resize range remains. ResizeObserver and viewport events track
the existing shell without changing Sidebar/Layout. Scoped container queries
adapt the form to its window width. Resizing preserves source PDF selection,
OCR state, review edits and the existing save/attachment payloads.
Handles occupy the external gutters so they do not cover form scrollbars.
Processing and removal of a focused handle retain focus inside the dialog;
the backdrop remains disabled while a request is pending.

The resize follow-up passed 36 distinct browser cases on the final source
(35 combined regression cases and one focused pending-save case). Tests cover
main/sidebar bounds, both pointer edges, keyboard width limits, initial/mobile/
busy focus, form scrollbars, PDF/edit retention, PR/PO/paired/attachment behavior
and scoped accessibility. Early focus failures are retained in the execution
ledger alongside their passing corrections. Targeted ESLint and test syntax/
whitespace checks passed. Evidence is under workspace
`artifacts/procurement-upload-resize-20260925`.
The final working-frontend production/PWA build passed (exit 0;
`production-build-final.log`). The isolated browser checkout matches all 15
validated source/test/fixture hashes. Sidebar, Layout and global index styles
remain unchanged. Existing bundle/browser-data warnings remain; no backend
migration, live import or deployment was performed.

Verification uses synthetic API fixtures in the existing PDF-import, paired
import, PO unified-upload, signed-attachment and PDF-preview specs, plus
`tests/accessibility/procurement-upload-reference.spec.js` for responsive
geometry, keyboard access, reviewed lines and scoped accessibility. No live
OCR, database mutation, migration, deployment or external message is part of
this frontend change. The shared context brief is at
`docs/features/procurement-upload-reference-design.md` under the workspace
root; workspace context is not automatically versioned by this repository.

Verified on 25 September 2026: 61 distinct browser cases passed, including the
scoped desktop accessibility scan and final bound-attachment checks. Targeted
ESLint, test syntax/whitespace checks and the final production/PWA build passed.
Concurrent unrelated planning edits interrupted the initial run; remaining
browser checks used an isolated checkout with matching task sources. The native
PR draft-price case passed unchanged on focused retry. The workspace artifact
folder `artifacts/procurement-upload-reference-20260925` contains the detailed
execution ledger, build log and desktop/mobile previews.

The PO follow-up adds `tests/accessibility/procurement-po-upload-reference.spec.js`
for PO desktop geometry/accessibility and mobile error/input retention.
All 40 follow-up browser cases passed: two new PO cases and 38 existing register,
PR-originating PO, paired import and reference-layout regressions. The final
desktop approval section fits above the footer, the scoped WCAG scan passes,
and required progress reflects the server's six required PO fields. Final
changed-source ESLint and production/PWA build passed. Browser verification
used an isolated checkout with matching source/test hashes; the build ran in
the working frontend. Evidence and screenshots are under workspace
`artifacts/procurement-po-upload-reference-20260925`.

The OCR visibility correction passed 26 browser cases: the comprehensive
converted-PR case and 25 attachment, PDF-import, paired-import and prior layout
cases. It verifies all 17 mapped OCR fields and two price lines, differing
source/saved values, read-only attachment data, preserved saved fields and
unchanged attach-only payloads. New-PR edits, identity protection, approval-date
correction, error retention, mobile/keyboard and scoped accessibility checks
also passed. Changed-source ESLint, whitespace/test syntax and the working
frontend production/PWA build passed. The isolated browser checkout matches
the tested source/test hashes. Logs and the attachment screenshot are under
`artifacts/procurement-pr-ocr-review-20260925`; no live OCR or deployment was run.

The signer-visibility/panel-cleanup follow-up passed 34 distinct browser cases
across combined runs. Final approval/extraction checks cover signed-off lists,
captured/unreadable dates, absent roles, duplicate source names, source-row
signature precedence, explicit confirmations and rejected-save retention.
21 unchanged layout/paired/PDF cases passed before the final one-line source-row
precedence correction; the affected approval/extraction suites were then rerun.
Test-only selector, canonical-name expectation and minimal-PDF issues were
corrected and passed focused reruns. The execution ledger preserves those
outcomes rather than describing a single uninterrupted passing run.

Final source/style hashes match the isolated checkout. Targeted ESLint,
test syntax/whitespace checks and the final working-frontend production/PWA
build passed. Logs, hashes, the ledger and rendered-source screenshots are under
`artifacts/procurement-pr-approval-review-20260925` in the workspace; the final
build log is `production-build-final.log`. Verification uses synthetic fixtures;
no backend migration, live OCR/import, sidebar change or deployment was made.

The Additional Approver/Level follow-up passed all 40 distinct scoped browser
cases on the final application source: 39 in the combined run and all four
extraction cases after a test-only prefix locator was made exact. The six new
cases verify persistence/reopen, clearing, signature reset, validation and failed
save retention, response acknowledgment/retry, paired evidence independence and
responsive/accessible controls. The ledger retains the initial fixture status
expectation and locator failures with their successful reruns.

Final targeted ESLint, test syntax/whitespace checks and the working frontend
production/PWA build passed. Existing build-size/browser-data warnings remain.
The corresponding backend passed 125 distinct functional tests; no schema or
migration changed. Browser verification used matching isolated sources and
synthetic APIs, with no live import. The workspace artifact folder is
`artifacts/procurement-upload-additional-approver-20260925`; it contains both run
logs, final desktop/mobile previews, source hashes and the production build log.
