# Sales mailbox email browsing

`/sales/email-intake` opens the shared mailbox directly. The visible view switch
was removed at the user's request; `?view=imported` retains
the existing local intake review, rejection, duplicate and conversion workflow.
Live mailbox messages are not represented as imported enquiries or given intake review
states. The overview's separate Shared mailbox status card still reads saved
connection status only.

## Data and access

The browser lists authorized application connections through the existing Sales
service. The selected connection is passed by ID to the scoped backend endpoints:

- `GET /sales/mailbox-connections/{id}/messages/?cursor=...`
- `GET /sales/mailbox-connections/{id}/message/?message_id=...`

The server resolves the connection with existing administrator/owner access and
`sales_email_intake.read`. All mail covers messages beyond Inbox, including Sent,
Drafts and Deleted Items where Microsoft returns them. Next/Previous uses opaque
server cursors; displayed counts describe the page, not an inferred mailbox total.
Refresh returns to the newest page. Application intake can remain disabled while
these read-only requests run.

The browser never calls Microsoft directly or receives a Graph access token.
Message text and semantic body nodes are rendered through `SalesEmailBody` using
fixed React elements and explicit safe props. The additive `body_content` array
preserves paragraphs, lists, quotations, actual tables and validated links;
`body_text` remains the fallback. No raw HTML is injected. There is no email HTML execution, remote-image
loading, automatic marking as read, import, attachment download, send or AI action.
Browsed messages remain in component memory; the API sends private/no-store responses and
existing Vite PWA configuration does not runtime-cache API data.

Mailbox connection/message reads and both live/imported opportunity conversion
requests opt out of the shared API interceptor's detailed error logging and generic
error toasts. The screens retain their inline recovery; failed requests do not dump
email content, reviewed commercial fields, signed cursors or source tokens into
the browser console. This is a scoped request configuration, not a global change
to API logging or authentication recovery.

## UI contract and checks

The user-supplied reference establishes a compact header-first layout, toolbar,
approximately 350px scrollable message list and roomy preview. Workflow actions
and status counts stay attached to real imported records. Live page filters/search
are explicitly page-scoped. Both views use the shared readable body component;
imported plain text preserves its available spacing without invented tables.
Wide email tables scroll inside the preview, and the body uses existing typography.

The subsequent annotated layout request removes the redundant mailbox heading,
visible page-summary labels and detected-information heading/subtitle. All five
detected fields and source evidence remain. On desktop, the workspace fits the
existing shell content height: toolbar/message header stay visible while the
message list, middle reading content and right details pane scroll independently.
The details column is 340px where space permits and 360px on wide workspaces.
Narrow layouts preserve natural vertical navigation and local table overflow.
The CSS query container is inside the card so fixed opportunity dialogs remain
outside its containing block. No shared shell/global styles or backend changes.

## Detected information and opportunity review

The user-requested follow-up adds shared detected Title (Subject), Customer Name,
Submission Date, Due Date and Type of Request cards with source evidence. Detection
is local and conservative: absent/conflicting values stay unresolved, and email
received time does not replace a stated submission date. EOI/RFT and literal EIO
source codes are shown without reclassifying unrelated requests.

The server's explicit `can_create_opportunity` capability exposes Create opportunity.
The live form loads accessible canonical clients and requires explicit selection.
All nine requested fields are editable; missing amount/award date needs user entry.
Opening or editing the form makes no business write. Confirming sends reviewed
fields plus the server's signed `source_token` to the connection's conversion
command. The opportunity and source audit are saved together without importing
the email into the module-wide intake queue.

Validation and transient failures retain edits. Changed/expired source review
requires explicitly reloading email evidence, retaining the user's form values,
and reviewing before retry. An already-converted source is a separate conflict;
identical retries return the existing opportunity. Deduplication is scoped to the
configured connection. No mailbox modification or external email is sent.

Account and mailbox changes clear prior content. Late page/detail responses cannot
restore a previous selection. Loading, empty, denied, expired-cursor and upstream
failures have distinct recovery states. Saved health status and Inbox counters are
not evidence that a live page request succeeded.

The synthetic browser fixture mounts the actual Email Intake wrapper. It verifies
paging and details, selection/session races, safe text rendering, recovery and the
retained Imported enquiries view, plus keyboard and narrow-screen behavior. The
original browsing fixture blocks writes and direct external mailbox calls. The
conversion cases explicitly allow only their synthetic conversion POST, asserting
that no write occurs before form confirmation.

```powershell
npm.cmd exec -- playwright test tests/accessibility/sales-shared-mailbox-messages.spec.js tests/accessibility/sales-shared-mailbox-status.spec.js tests/accessibility/sales-mailbox-privacy.spec.js --config=playwright.config.js --workers=1
npm.cmd exec -- eslint src/pages/Sales/SalesEmailIntake.jsx src/pages/Sales/SalesSharedMailboxMessages.jsx src/pages/Sales/SalesEmailBody.jsx src/pages/Sales/SalesEmailDetectedInformation.jsx src/pages/Sales/SalesEmailOpportunityForm.jsx src/services/sales.service.js
npm.cmd run build
```

Backend contract/tests are documented in `backend/docs/SALES_MAILBOX_BROWSING.md`
relative to the workspace root. The cross-repository brief is
`docs/features/sales-shared-mailbox-messages.md` at that root. Local checks do not
constitute production deployment or approval for broader automation.

Verified locally on 28 September 2026: 27 mailbox-message browser cases and a
targeted wide-layout check passed, with no axe violations or narrow-screen page
overflow. Scoped ESLint and the Node 20 container build passed. The live detail
endpoint returned structured content successfully; imported text-only records
retain the limits of their saved source.

The subsequent detection/opportunity follow-up passed the full 48-case mailbox
browser suite, scoped source/test lint and final Node 20 build (3m 20s). Desktop
and mobile opportunity-form screenshots were inspected; focus/axe checks passed
without horizontal overflow. Backend functional, observed PostgreSQL retry and
read-only live verification are recorded in the workspace
`docs/features/sales-email-opportunity-detection.md` brief.

The contained-panel layout follow-up passed all 53 browser cases, including five
cases in the actual shell for desktop pane scrolling, imported direct access,
mobile reachability and short-desktop dialog bounds. Scoped lint and the Node 20
production build passed (2m 42s). See the workspace
`docs/features/sales-email-contained-layout.md` for scope and verification.

## Release verification, 28 September 2026

Development was fast-forwarded to the fetched development/main revision d757119,
preserving the incoming HR updates without conflicts. The release contains only
the Sales workspace, mailbox/status components, services, fixtures and runbooks.

Release review added request-specific quiet error handling to the connection list,
message list/detail and live/imported conversion calls. These screens retain their
own inline recovery while preventing the shared API interceptor from dumping
commercial fields, cursors, source-review tokens and full request objects into
console logs or duplicate toasts. No global interceptor behavior changed.

All 65 distinct browser cases were verified across the release runs: 53 mailbox,
10 saved-status and two new privacy cases. The first combined run passed 62 cases
and had one navigation timeout during concurrent build/source reload activity
(8.3 minutes). On settled source, 17 focused cases passed (1.1 minutes), including
that timeout case, the two privacy cases, and affected denial/error/retry flows.
The new privacy fixture exercises the real service and Axios interceptors with
synthetic HTTP/network failures, console capture and a real toast container with
positive controls. This evidence does not claim a single uninterrupted 65-case run.

Logs and source hashes are ignored local output under
`artifacts/release-mailbox-20260928/`. The changed-file scan found no environment
credential matches or generated artifacts in release files. Final lint passed for
all 14 changed JS/JSX files (4.27 seconds). The final Node 20 container build passed
with Vite completing in 2m 22s and total build/PWA time 147.72 seconds. Existing
Browserslist, mixed-import and large-chunk warnings remain nonblocking. All 19
source/test file hashes matched the recorded snapshot after the build; diff
checks passed. No source changed between final verification and staging.

Deploy the companion backend before this frontend. Production needs its own
authorized mailbox connection, server-side secret and effective Sales permissions.
The frontend carries no Microsoft credential. This release does not change
schema, send mail, enable automatic intake or authorize a production deployment.
