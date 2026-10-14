# Sales Proposal Preview and Commenting

Implemented and verified locally, 1 October 2026. Production activation is not
established by this work.

`/sales/proposals/:proposalId/preview` is a Sales-protected page entered through
the proposal register or its record drawer. Back to proposals reopens the actual
selected Quote. Existing commercial editing, approval and client-submission
commands remain in that register. The separate Planning Proposal Studio is not
part of this feature.

## Presentation and scope

The page uses the existing self-hosted Roboto font with 14px content, navy text,
purple actions, a compact identity/PDF toolbar, actual Pages/Outline navigator,
PDF canvas and internal review panel. Desktop content fills the current shared
shell; narrow widths stack the document and review panel. The only shared Layout
change classifies this exact preview route as a viewport workspace. Sidebar,
Header, layout configuration, global styles and shared PDF renderers are unchanged.

PDF.js uses the existing lazy worker loader. Actual document bytes determine
pages, thumbnails, outline and selectable text. Saved normalized text anchors and
comment pins point into the selected immutable review revision. Screenshot sample
documents, users, revision counts and comments are not runtime defaults.

Open/Resolved/All display server-provided root-thread counts. Replies remain
within their root thread. Required change is a reviewer-selected feedback label;
Submit review records `request_changes` or `reviewed`. Neither action approves the
commercial proposal or records client submission. Historical revisions are
read-only. No assignment or attachment authority is inferred from the reference.

## Data and input recovery

The backend contract is `backend/docs/SALES_PROPOSAL_REVIEW.md` in the separate
backend repository. The frontend uses the Quote-bound review projection and
explicit document/comments/resolve/submit commands. Server capabilities control
all mutations, with handler checks in addition to disabled controls. Document
preview/download requires the existing read/export authorization. Bytes are
retrieved through authenticated scoped endpoints and placed in temporary Blob
URLs; URLs are revoked and stale fetches cancelled on revision changes.

Select PDF binds an existing private RADAI attachment from the same opportunity's
Proposal folder. Upload a PDF uses the existing guarded private file upload, then
binds the verified attachment identity as a document revision. The File and upload
request identity survive binding failures while the page remains open. Legacy
`pdf_file_path`, arbitrary URLs, SharePoint fallback and sibling Quote records are
not alternative sources.

Comments, replies and review selections retain local drafts per document. Failed
or uncertain commands retain their complete original payload and UUID for
idempotent replay. An explicit refresh after a stale 409 replaces the stale
command identity while preserving input; revision changes fence late reads.
Successful writes and subsequent reload failures have separate messages. No
draft persistence across browser refresh is claimed.

Permission denials trigger a read-only capability refresh; a revoked review read
clears displayed PDF/comment evidence while retaining drafts for permitted
recovery. Field validation for PDFs, anchors and comments presents bounded plain
server reasons, without displaying HTML, private provider payloads or unknown
response fields.

## Rollout and verification

The accompanying backend contract and Sales migration `0014_proposal_review`
must be applied before this page can function. Private file storage must remain
durable across application restarts. This implementation does not authorize a
push, PR, main merge, production deployment or external communication.

Verification on 1 October 2026:

- 16 distinct browser scenarios passed across scoped runs. The final 15-case run
  passed 14; its remaining failure exposed duplicate Retry controls in the denied
  state. After consolidating that error state, all four targeted cases passed:
  the 1586px reference/Axe/Reply-composer case, real register entry/back navigation,
  revoked-access evidence clearing with draft recovery, and mobile 390px actions.
  Those reruns include overlap; this is not a claim of one uninterrupted 16-case
  run. Earlier cases also verify actual text selection, outline/thumbnails/zoom,
  historical revisions, stale and uncertain command retries, reply/resolve/review
  persistence, denied commands, PDF failure recovery, protected download, upload
  plus retained binding retry, and late PDF responses after revision changes.
- The actual Layout/Header/Sidebar and eagerly loaded application CSS were used.
  Inspected 1586px reference and 1366/390px responsive captures have no document
  overflow. The desktop WCAG A/AA check passed. Toolbar controls align over the
  PDF; the initial 90% view shows the complete fixture page, with a compact pinned
  reply composer and full-width Submit review action. The existing sidebar is
  unchanged; screenshot documents/actors/comments remain isolated fixture data.
- All 39 Node tests passed: 13 PDF/review helper checks and 26 existing opportunity
  register/workspace/registration helper checks. They cover anchor normalization,
  raster bounds, safe outlines, response identity, strict Boolean capabilities,
  pagination, and readable bounded validation errors.
- Changed source/helper-test ESLint completed with exit code 0. The existing
  eight App.jsx warnings remain; new feature files have no lint errors/warnings.
  Fixture/config/browser-spec lint was verified separately with exit code 0.
- The final frozen-source Vite/PWA build passed with exit code 0 on Node 22.20.0,
  generating 117 precache entries. It includes the field-validation and denied
  recovery corrections. Existing Browserslist freshness, chunk-size and mixed
  static/dynamic-import warnings remain.
- Sales migration `0014_proposal_review` was applied and verified locally by the
  backend workstream, with no pending migrations/model drift and existing Quote
  and upload counts preserved. The shared feature brief records backend checks.
  Browser API fixtures do not establish real production storage writes.

Evidence logs: `artifacts/sales-proposal-preview-final-browser.log`,
`artifacts/sales-proposal-preview-targeted-browser.log`,
`artifacts/sales-proposal-preview-node.log`,
`artifacts/sales-proposal-preview-lint.log`, and
`artifacts/sales-proposal-preview-final-build.log`.
The reviewed desktop capture is
`artifacts/proposal-preview/results/sales-proposal-preview-ref-c42f4--existing-application-shell/proposal-review-reference-1586.png`.

Commands: `node --test tests/sales-proposal-review.test.js
tests/sales-proposal-pdf-helpers.test.js tests/sales-opportunity-workspace.test.js
tests/sales-opportunity-register.test.js tests/sales-opportunity-registration.test.js`;
`node node_modules/@playwright/test/cli.js test --config=playwright.sales-proposal.config.js`;
`node node_modules/vite/bin/vite.js build`. Browser reruns use spec/grep selection.
