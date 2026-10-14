# Proposal register and selected workspace

Implemented locally on 1 October 2026. The canonical records remain Sales Quotes;
the existing `SalesLifecycleArea` controller continues to own creation, editing,
governed proposal approval and recorded client submission.

The subsequent [Go-to-Proposal and AI content flow](SALES_PROPOSAL_START_UI.md)
also lists eligible Go opportunities awaiting their first Quote as typed
Proposal preparation rows. The new candidate API replaces the client-list join;
AI writing is available in create and existing editable proposal content.
Derived opportunity rows never acquire Quote revisions or approval actions.

## Scope and presentation

`/sales/proposals` now has an approximately equal-width register and persistent
selected-proposal panel. The page uses scoped Roboto, navy text, purple actions,
white panels and pale borders. The exact route uses the existing viewport shell
classification to remove redundant main padding and footer. Sidebar, Header,
sidebar dimensions, navigation, global CSS and existing responsive shell behavior
are unchanged. At widths of 1000px or below the content panels stack and the main
area scrolls. Tables scroll within their panels on narrow screens.
At intermediate desktop widths, tab bars scroll inside their panel and fact labels
stack above their values so the existing sidebar can retain its full width.

The register provides status tabs, VF/proposal/client search, prepared-by Owner,
Client and opportunity-deadline filters, sorting, pagination and optional columns.
Rows per page and Refresh remain available in Columns. Selecting a row preserves
its `record` query parameter and loads the existing detail endpoint with a request
sequence guard. Edit and Full record reuse the existing drawer; closing it retains
the selected workspace. Returning from PDF preview restores the selected proposal.

## Canonical data and commands

- Load all bounded page-number responses in stable `-created_at,-id` order before
  publishing totals. Reject duplicate identities, changed totals and incomplete
  responses rather than presenting a partial register as complete.
- VF code, submission deadline and service line come from the linked Deal's
  additive list fields or `deal_details` in the detail response. `valid_until` is
  proposal validity, not the submission deadline. Date-only values retain their
  calendar date.
- Owner is Quote `prepared_by`, independent of opportunity ownership. An assigned
  user with an unavailable name is not labelled Unassigned.
- Quote `version` supplies the register revision, including revision zero. PDF
  review revisions and immutable attachment versions are displayed separately.
- Approved status requires recorded `approved_at`; a deleted approver identity
  does not invalidate that timestamp. Later legacy statuses cannot manufacture
  an approval checkmark. Recorded zero-valued estimates remain recorded values.
- Summary, Documents, Approvals and Submission show stored detail, actual internal
  feedback, approval history and submitted evidence. The completeness checklist
  does not invent review roles, approval stages, assignments or company limits.
  Existing server commands remain authoritative. Submission requires the existing
  ready-to-submit action and recorded approval.
- Export posts the current filtered IDs in visible sort order to the guarded
  `quotes/export/` endpoint and downloads the server CSV. Views over the endpoint's
  10,000-record limit ask the user to narrow filters. Denials remain visible and
  never fall back to a browser-generated export.

## Documents and access

The selected panel requests the existing Quote review projection and the linked
opportunity's private RADAI Proposal-folder files. The current review PDF is
explicitly labelled as bound to the proposal. Other files are opportunity
attachments. Internal comment counts convey no business approval. Missing review
metadata and denied file lists are unavailable, not fabricated empty successes.

The existing PDF selector/upload-and-bind dialog, preview/commenting page and
opportunity document workspace remain reachable. PDF revision history links to
the existing revision chooser; it does not claim a query parameter opens a
specific revision. Private downloads retain server authorization. Load-more
denial clears prior file metadata/cursor; selected-record changes fence late
document responses. Download permission failures revalidate document metadata.

No production records, sample documents, approvals, SharePoint connections or
storage configuration were created for this visual change. The existing preview
implementation and its uncommitted work are preserved. No release push or merge
is part of this task.

## Verification

- Scoped source ESLint passes with no warnings. Every new Lucide icon was checked
  against the installed package exports.
- All 49 Node checks pass: 10 register cases and 39 existing proposal-review and
  opportunity helper regressions. They cover complete-page loading, duplicate/
  incomplete responses, source deadline and owner identity, recorded approval,
  revision zero, zero estimate, combined filters and stable numeric sorting.
- The production Vite/PWA build on final responsive source exits 0: 1m 56s,
  117 precache entries, 30001.08 KiB. Existing chunk-size, Browserslist and mixed
  static/dynamic import warnings remain; no new dependency was added.
- SHA-256 comparison confirms all 12 protected shell/navigation/style files are
  unchanged, including Sidebar, Header, layout configuration and sidebar hooks.
- All 16 distinct register browser scenarios plus one existing PDF-preview return
  regression pass across the final runs. Coverage includes complete pagination,
  filters/sorting/columns, late and denied details, retained create/edit/approval/
  submission input, guarded sorted export, actual document/version links,
  denied metadata, empty states and unchanged sidebar behavior.
- Real-shell screenshots cover 1920, 1586, 1366, 1024 and 390px. The final 1586px
  reference passes scoped Axe, balanced panel geometry, 16px primary/14px ordinary
  row typography, full VF-code visibility and complete checklist/notice fit.
  The 1024px regression verifies that all workspace tabs, Submission and Upload
  files remain actionable and that fact-label glyphs do not overlap their values.
  Final 390px verification confirms usable stacked content without page overflow.

Logs: `artifacts/sales-proposal-register-node.log`,
`sales-proposal-register-browser-final.log`, `sales-proposal-register-flows-final.log`,
`sales-proposal-register-targeted-final.log`, `sales-proposal-register-responsive-final.log`,
`sales-proposal-register-preview-regression.log`, `sales-proposal-register-test-lint.log`
and `sales-proposal-register-responsive-build.log`
under `artifacts/`. Early required-field/textarea test selectors were corrected;
the material 1024px clipping failure was fixed and reverified on final source.
The final reference screenshot is under `artifacts/proposal-register/responsive-final/` in the
`sales-proposal-register-re-4136c-balanced-selected-workspace` case directory.
Browser data is isolated fixture data and does not prove production SharePoint
connectivity or modify live business records.
