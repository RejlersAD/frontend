# Sales mailbox email browsing

`/sales/email-intake` opens the shared mailbox directly. The visible view switch
was removed at the user's request; `?view=imported` retains
the existing local intake review, rejection, duplicate and conversion workflow.
Live mailbox messages are not represented as imported enquiries or given intake review
states. The overview's Shared mailbox status card was removed on 30 September
2026 at the user's request; Email Intake continues to browse the configured
mailbox through the existing scoped services.

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

The subsequent row-status request adds Incoming/Outgoing beside Read/Unread,
with matching badges in the selected header. Server `direction` values are
`incoming`, `outgoing`, `draft` and `unknown`; unsupported/missing values display
Direction unknown. Draft appears once and takes precedence. Direction is relative
to the configured shared mailbox, not sender-company affiliation; unresolved
aliases/hidden recipients are not guessed. Existing attachment indicators remain.

The user explicitly selected Next step as a shortcut to suggested actions. Its
button is a sibling of the row's open-email button, not a nested interactive
element. It loads the requested message through the existing guarded read, then
focuses the Suggested next step region; an already loaded selected message is
reused. Missing analysis focuses its unavailable notice, and empty suggestions
remain explicit. No suggestion count or pending/completed state is fabricated for
unopened rows. Stale responses and account/mailbox/filter/page changes cannot
restore prior content or move focus to another email's actions. Desktop navigation
scrolls the source pane; narrow layouts retain ordinary vertical navigation.
See workspace `docs/features/sales-email-row-status.md`.

The user-requested follow-up adds shared detected Title (Subject), Customer Name,
Submission Date, Due Date and Type of Request cards with source evidence. Detection
is local and conservative: absent/conflicting values stay unresolved, and email
received time does not replace a stated submission date. EOI/RFT and literal EIO
source codes, plus RFQ/RFP/ITT, are shown without reclassifying unrelated requests.

The subsequent conversation-analysis correction replaces the right Email details
heading with Email analysis, using `extracted_information.analysis` version 1.
It explains the selected message in the context of the available conversation,
shows key points, requested actions and separately labeled suggested next steps,
and lets users expand source excerpts for each supported claim. Original-request
fields can differ from the currently selected reply header. Complete/partial,
selected-only and saved-content coverage stay visible, including missing-original
and unread-attachment limitations. Useful transport metadata is collapsed under
Message details; imported source traceability and actions remain available.

The backend obtains the authorized conversation and parses it locally. The
frontend accepts only supported structured analysis and renders strings as React
text, never source HTML or executable instructions. Missing/malformed analysis has
an honest unavailable state. A bulletin purpose remains distinct from its RFT/RFQ
request type, and dates not stated in available text stay unresolved. Source review
now binds the available conversation; reload after a changed sibling message keeps
the user's form input. Existing panel scroll regions, responsive shell and access
checks remain in place. See the workspace
`docs/features/sales-email-conversation-analysis.md` for this correction's scope.

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

## Conversation-analysis verification, 28 September 2026

The correction passed all 76 browser cases in one run (331.71 seconds): 64
mailbox/detection/analysis/layout, 10 saved-status and two privacy cases. A separate
mobile screenshot capture passed its existing case again (11.4 seconds). Desktop
and mobile screenshots were inspected; source excerpts, scrolling, focus and
accessibility checks passed. Coverage includes varied organizations/request kinds,
reply versus original provenance, revised deadlines, partial/saved evidence,
untrusted text and input preservation when the conversation changes during review.

Changed-source/test ESLint passed. The final Node 20 container build passed in
169.61 seconds (Vite 2m 44s), with the existing bundle-size, mixed-import and
Browserslist warnings. All five affected production source hashes matched the
browser-tested snapshot after the build. Logs, timing, hashes and screenshots
are ignored local output under `artifacts/conversation-analysis/` and
`test-results-conversation-*`. This records local verification of the correction,
not a production deployment or a new Git push.

## Row-status verification, 28 September 2026

The Incoming/Outgoing and Next step follow-up passed all 85 browser cases in one
run (285.86 seconds), including nine new cases and the retained mailbox/status/
privacy checks. The nine focused cases also passed. Desktop and mobile screenshots
were inspected; badges wrap cleanly, Next step focuses the correct suggestions,
the desktop reading pane keeps its position, and narrow layouts bring the focused
section into view. Keyboard/axe, missing suggestions, late responses, account and
mailbox changes passed. Source/test lint and diff checks passed; four source/test
hashes remained unchanged through the run. Evidence is under
`artifacts/email-row-status/` and `test-results-email-row-final/` (ignored).

The final Node 20 container build passed in 161.73 seconds (Vite 2m 36s), with
existing Browserslist, mixed-import and bundle-size warnings. Evidence:
`artifacts/email-row-status/build-final.log` and `build-timing.json`. The local
frontend serves the updated controls and the backend live list returns actual
direction values. No schema migration or production deployment was performed.

## Customer matching for review, 28 September 2026

Saved and live email details display the server's versioned `customer_match`
suggestion, canonical client metadata and literal source evidence. Exact name
matches require review; ambiguous, absent, conflicting, denied and unavailable
results remain distinct. Unsupported or malformed projections display unavailable.
Client status, verification and proposal permission are informational; opportunity
creation retains its existing server validation.

The shared opportunity form keeps Client blank initially. `Use this client`
changes only that field and is available only for a candidate in the complete
authorized client options. Manual selection stays available. Both views load all
client pages on opening the form; a partial or failed directory is not published.
Saved email loading no longer depends on client-directory access. The existing
saved new-client option requires explicit `can_create_client: true`, a valid
server `no_match` result and successful complete client loading. It is never a
default and does not establish that the company is absent from other scopes.

Review inputs survive retries and source refresh. A current client-access denial
redacts candidate metadata in the form and displayed source. Source/list responses
started before that denial cannot restore it, including after directory recovery.
Transient provider errors remain separate from denied access. Existing session,
selection, source-token and explicit confirmation boundaries remain in place.

Final scoped browser verification passed all 30 selected cases in 165.90 seconds:
13 new customer-matching cases plus 17 retained classification, conversion and
layout checks. Coverage includes the 501st client, duplicate matches, explicit
selection, no-match and denied states, malformed evidence, delayed permission
responses, retained inputs, hostile text, keyboard/axe and narrow layouts.
Desktop and mobile screenshots were inspected. Scoped source/test ESLint and
diff checks passed. Fixtures use synthetic content and block external requests;
no real client or opportunity was created by these checks. Logs, timing, source
hashes and screenshots are local ignored artifacts under
`artifacts/email-customer-matching/` and `test-results-email-customer-final/`.

The final Node 20.20.2 container production build passed in 157.75 seconds
(Vite 2m 32s), including PWA generation. Existing Browserslist, mixed-import and
bundle-size warnings remain. All seven affected source/test hashes matched the
browser-tested snapshot after the build. This records local verification only;
no deployment, Git push or mailbox write was performed for this frontend task.

## Selected email and original request, 28 September 2026

Live and saved rows show the server's thread role separately from mailbox
direction and business classification. The selected header names that role; a
new message is not automatically called the original request. Missing or invalid
role metadata stays unknown. Opening rows and using Next step retain the existing
request, focus and stale-response guards, with no per-row detail prefetch.

The existing analysis pane now includes a conversation timeline when the server
provides thread identities. Each source keeps its subject, sender, date and
literal evidence, plus explicit selected, first-incoming-available and original
request markers where supported by unique source references and matching flags.
Quoted content is visibly distinguished from a separately retrieved mailbox
message. The earliest available incoming message may already be a reply; absent
or contradictory references do not establish an original or complete history.
Legacy analysis continues to use its existing source disclosure.

Saved coverage can now include multiple authorized saved messages and their
quotes. It still does not claim that live mailbox history was retrieved. Source
refresh preserves reviewed client and opportunity values, and existing client
access redaction and pane-local scrolling remain in place.

Scoped browser verification passed nine new thread-identification cases in
71.85 seconds and 34 retained cases in 223.05 seconds, covering 43 distinct cases
across two successful runs. The retained checks include client denial and delayed
responses, manual input preservation, reviewed conversion, existing analysis,
keyboard/axe, Next step and desktop/mobile containment. An initial focused run
found an incorrect test locator ancestry; the corrected helper passed without a
product change. Desktop and mobile timeline screenshots were inspected. The
fixtures contain synthetic content and block external requests.

Source/test ESLint passed. Local logs, timing, hashes and screenshots are ignored
artifacts under `artifacts/email-thread-identification/` and
`test-results-email-thread-*`. This verification does not claim a mailbox write,
production deployment or Git push.

The final Node 20.20.2 container production build passed in 165.81 seconds
(Vite 2m 41s), including PWA generation. Existing Browserslist, mixed-import and
bundle-size warnings remain. All five affected source/test hashes matched the
browser-tested snapshot after the build; scoped diff checks passed.

## Detection reference, version 2 — 28 September 2026

The later Customer Name display correction below supersedes this section's
original domain-as-name presentation; the recorded verification remains historical.

Version 2 detected information labels Customer Name as the evidenced customer
domain and Submission Date as the original incoming email's sent calendar date.
The server supplies source-backed status and reason; unavailable or conflicting
evidence is not replaced with the current reply, received time, portal domain or
today's date. Legacy payloads retain their previous presentation.

The existing middle pane includes compact deadline review and opportunity
suggestions, plus disclosures for sourced organizations, contacts, projects and
categorical field confidence. Unsupported versions, statuses, confidence levels
or source references stay unavailable. Evidence and entity text render literally;
the UI does not crawl portals or load quoted content as executable markup.
Opportunity signals are review proposals and never grant creation authority.

Canonical customer matching continues to use explicit organization evidence.
For version 2, a match naming only the displayed domain is rejected by the UI,
including the saved view's existing guarded Add new client choice. Client
selection remains explicit. The opportunity form still uses proposal deadline
fields, independently of the original email sent date, and preserves typed
client, decimal, date and scope values across source refresh and failures.

Verification covered 47 distinct browser cases across the local runs. Eight new
cases passed in 71.17 seconds. The retained run passed 40 of 41 cases in
310.05 seconds; its remaining five-scenario test timed out while repeatedly
reloading the development page. That test now uses the actual saved-view Refresh
and an awaited response, with no reduced assertions. It and the two affected
live/saved/mobile cases passed in the final three-case run (34.01 seconds), also
verifying the final `contact` entity contract. This is evidence across runs,
not a claim of one uninterrupted 47-case run.

The four changed source/test files pass ESLint. Desktop and mobile screenshots
were visually reviewed; existing thread markers, client permission races, form
input retention, Next step and contained scrolling remain covered. Synthetic
fixtures block external requests. Logs, timing, hashes and screenshots are local
ignored artifacts under `artifacts/email-intelligence/` and
`test-results-email-intelligence-*`. No email or business-record write, Git push
or production deployment was performed by frontend verification.

The final Node 20.20.2 container production build passed in 163.56 seconds
(Vite 2m 37s), including PWA generation. Existing Browserslist, mixed-import and
bundle-size warnings remain. All four final source/test hashes matched the
browser-tested snapshot after the build; scoped diff checks passed.

## Value-only customer and sent-date cards — 28 September 2026

Superseded by the simple visible labels in the follow-up below.

The follow-up presentation request removes visible labels and helper/status
paragraphs from the customer-domain and original-email sent-date cards. Keep their
field names available to assistive technology and retain the displayed values or
honest unavailable/not-detected fallbacks. Verification status and reasons remain
in the existing collapsed Source evidence disclosure, including when those
reasons are the only available evidence.

This adjustment changes neither the version 2 field meanings nor canonical
organization matching, proposal deadlines, source authorization or reviewed form
values. Other detected fields and controls retain their labels. Verification for
this presentation follow-up is recorded separately from the preceding feature
runs; those results do not by themselves verify the later visual change.

## Customer Name display and simple labels — 28 September 2026

All five detected field names are visible: Title (Subject), Customer Name,
Submission Date, Due Date and Type of Request. Customer Name uses the server's
`intelligence.customer_name` review status and `customer_name` value. It never
falls back to `customer_domain`, formats a domain locally or substitutes the
canonical organization field. A missing or unverified name stays unresolved.
Legacy responses continue to use their supplied customer_name.

The customer domain and its reasons remain in the collapsed Source evidence
disclosure, alongside customer-name and original-sent-date evidence. The cards
retain only their simple labels and values; explanatory paragraphs stay collapsed.
A standalone domain entity is not duplicated in Detected entities. Field
confidence correctly identifies customer_name as Customer name. Server-derived
display names remain review proposals and do not establish canonical client
identity or trigger client creation.

Submission Date keeps its original genuine sent-date meaning. Request-type
classification, source permissions, canonical matching, explicit opportunity
creation and reviewed form values are unchanged by this frontend correction.

Focused verification passed all 11 selected browser cases in 58.43 seconds,
including live/saved labels, supplied customer name, no domain fallback, collapsed
evidence, RFQ presentation, legacy/unknown values, preserved form inputs and
mobile keyboard/axe checks. Desktop and mobile screenshots were visually reviewed.
ESLint and scoped diff checks passed for the changed files; three source/test
hashes remained unchanged through the run. Evidence is local ignored output under
`artifacts/email-customer-name-display/` and
`test-results-email-customer-name-display/`. No backend files or live data were
changed, and no commit or push was performed. No new build is claimed by these
focused checks.
