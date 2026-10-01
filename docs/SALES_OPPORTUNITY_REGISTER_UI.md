# Opportunity Register and document workspace

Local screenshot implementation, 1 October 2026. This supersedes the former
summary-first layout and narrow detail panel. The shared sidebar/header are
unchanged. This frontend requires the corresponding Sales workspace backend;
missing or unavailable endpoints render a visible recovery state.

## Current behavior

- A compact register occupies approximately 42% of the page beside a 58% selected
  record panel. The default view includes all scoped opportunities; My
  opportunities uses the authenticated canonical owner, and Due soon uses the
  existing seven-day active-stage rule. Small screens stack the panels.
- The default columns are VF code, opportunity/client, due date and status.
  Filters and table settings exposes existing status/decision/service/owner/date
  filters, saved views, columns, density and export. More opens the existing
  currency-separated summary and attention checks. Pagination and exports use
  the complete permission-scoped register, never a partial API page.
- Keep canonical Q- codes, real statuses, server creator/time, registration and
  existing lifecycle commands. The screenshot's sample data and VF-2026 codes
  are not application defaults. Existing fixed-height rows and legible scoped
  typography remain; overflow stays inside the table.
- The detail panel opens on Workspace and retains Overview and Activity.
  Overview includes expandable full commercial details/proposals. Edit details,
  More actions and the row's View action preserve the established editor and full
  record. Edit fields disable while saving; errors retain the submitted draft.
- Double-clicking an opportunity, clicking the Workspace tab or opening a category
  enters the full document explorer in the existing route. Deep links use
  `?record={id}&workspace=1&folder=proposal`; folder is optional. The mounted
  register retains filters, search, selection, page and columns when Back to
  register is used. Overview/Activity and editing/lifecycle actions remain
  available. Back remains usable when record loading fails or is denied.
- Workspace shows Correspondence, Tender, Proposal, Internal, Submitted and
  Award. Readiness, permissions, SharePoint links and direct item counts come
  from the server. Unknown counts are dashes, including unconfigured/failed
  states. Counts are items, which may include subfolders; no synthetic zeroes.
- Workspace reads never initiate creation. Saved registration queues configured
  provisioning on the backend. Existing records can request Create workspace or
  Retry setup when the server permits it. Pending/creating statuses poll while
  the Workspace tab is active. Unconfigured storage needs administrator setup.
- The full explorer has a six-category navigation tree, uploaded-file table and
  selected-document Details/Versions pane. Search, type filters and sorting apply
  to loaded items; further API pages load explicitly. Counts include nested
  folders. Nested browsing and folder administration open in SharePoint.
- The 1 October fidelity correction scopes the reference's Roboto typography,
  navy text, purple actions, 260px folder navigation, 300px details pane and
  66px document rows to the full explorer. The existing application sidebar,
  header and their dimensions are unchanged. The details placeholder and table
  headers remain visible before storage is connected. At smaller widths the
  panes adapt without hiding the six standard categories.
- All six categories remain selectable when the selected storage is unconfigured,
  pending or failed; this only changes the local selection. File API calls require
  that storage to be ready. The upload control remains prominent and opens the
  file/category form; its submit uses the chosen provider's actual availability
  and RADAI permission. A selected file is retained while the
  workspace stays mounted, including dialog close/reopen and failed retries.
- New folder opens an explicit SharePoint handoff dialog using the verified
  selected-category URL. Without a ready connection it explains why folder
  creation is unavailable. It never claims a folder was created in RADAI.
- The user's subsequent request permits attachments without SharePoint access.
  When the backend advertises `radai_storage`, browsing and upload default to
  **RADAI files** and do not depend on SharePoint readiness. **Document storage**
  switches between RADAI and existing SharePoint files, with separate counts and
  honest availability. The upload form explicitly selects **Save to**; its file,
  category, provider and UUID remain attached to the retry. Changing any selected
  payload component assigns a new UUID. There is no automatic copying or sync.
- RADAI file metadata, initial revision `1`, actual uploader/time and private
  downloads use the existing scoped API routes. Local files never acquire a
  SharePoint link; **Attached** means persisted file storage and conveys no
  business review or approval. The six RADAI categories are fixed in this slice;
  New folder explains the SharePoint handoff when RADAI files are selected.
- Version IDs and SharePoint publication status come from source metadata;
  publication is not review/approval. Missing metadata displays unavailable.
  Created by and Modified by retain their actual meaning; no owner or reviewer
  is invented. Version history is paginated and includes a Current label only
  when the backend verifies it. Download uses the authenticated backend attachment
  route, requires read/export and is limited to 50 MiB. Open document uses the
  verified SharePoint link and SharePoint's own access controls.
- Upload files opens a real single-file upload form with a category choice and
  the backend size limit (at most 10 MiB in this release). On failure the File, category and request UUID remain
  available for retry. Changed file/category receives a new UUID. Successful
  uploads refresh workspace and current folder metadata.
- A record change remounts the workspace; request fencing prevents an obsolete
  file/status response from showing under another opportunity. Foreground
  reloads and denied responses hide old file links. A ready response is rejected
  unless all six canonical folder links and the root are valid HTTPS SharePoint
  links. Client controls supplement backend authorization.

## Contract

The existing sales.service client calls:

- GET /sales/deals/{id}/workspace/
- POST /sales/deals/{id}/workspace/setup/
- GET /sales/deals/{id}/workspace/folders/{folder_key}/files/?cursor=...&storage=radai
- POST /sales/deals/{id}/workspace/folders/{folder_key}/upload/ (multipart file
  and upload_request_id, with storage=radai for private RADAI attachments).
- GET /sales/deals/{id}/workspace/folders/{folder_key}/files/{file_id}/
- GET /sales/deals/{id}/workspace/folders/{folder_key}/files/{file_id}/versions/?cursor=...
- GET /sales/deals/{id}/workspace/folders/{folder_key}/files/{file_id}/download/

Detail/versions/download responses are fenced by selected record, category and
file. Denied refresh/pagination/download clears stale data/actions; transient
errors remain retryable. A pending upload retains its File and UUID. Navigating
away before a download finishes does not trigger an obsolete browser download.
Downloads use the authenticated response's current filename, including RFC 5987
Unicode names when a file was renamed after selection. Invalid/path-bearing
header names fail visibly; an absent header falls back to the selected name.

The optional `radai_storage` projection supplies its own readiness, upload
permission, six category counts and upload size limit. A backend without this
field retains the previous SharePoint-only UI contract. Omitting the storage
parameter keeps the existing SharePoint operations. Local IDs use the backend's
`radai-` prefix; detail, revision and download routes retain their existing shape.

The API base is supplied by api.service. No credentials, destination paths or
Graph tokens enter the browser. A separate network drive remains unresolved;
this implementation does not simulate a second destination or synchronization.
Folder names and uploads confer no proposal/award approval.

## Rollout boundary

Deploy the backend contract and apply Sales migrations
`0012_opportunity_workspace` and `0013_private_opportunity_attachments` before
relying on private RADAI attachments. SharePoint integration remains disabled by
default; its missing configuration presents administrator setup only when
SharePoint files are selected. RADAI attachment storage has separate readiness
and permissions and requires no SharePoint account. Application migration,
private storage activation, SharePoint configuration and live remote write
verification are separate from frontend build completion.

## Verification

Frontend checks use isolated synthetic API fixtures; they create no live
opportunities or SharePoint files. Node helpers validate URLs, malformed/foreign
workspace responses, unknown counts, permissions and field errors. Browser tests
cover readiness/configuration, permission denial/recovery, listing pagination,
upload retry identity/input retention, obsolete requests, pending-save input
protection, and responsive/accessibility behavior. Existing register, VF
registration, email prefill and history regressions are run separately.

The original component fixture includes the real page/controller/styles but
omits the application sidebar/header. Those older previews were insufficient to
verify the full application's global CSS cascade. The fidelity follow-up adds a
fixture with the actual Layout/Header/Sidebar and application CSS; its previews
and computed controls verify the real 250px sidebar without altering it.
Production build and lint results are recorded in the workspace feature brief.
No production activation is established by these checks.

Initial split-workspace verification on 1 October 2026 with Node 22.20.0:

- 22 Node helper tests passed.
- 14 workspace, 19 register, 10 VF registration, 8 history and 28 email-prefill
  browser scenarios passed (79 distinct cases, including targeted reruns after
  updating fixtures for the new default tab/record access and Redux context).
- 390/1366/1920px screenshots were inspected. The laptop sidebar-width case and
  desktop WCAG A/AA scans passed without document overflow or violations.
- Changed-source/test ESLint and Git whitespace checks passed.
- Final Vite/PWA production build passed. Existing Browserslist freshness,
  large-chunk and mixed dynamic/static import warnings remain.

Commands: `node --test tests/sales-opportunity-workspace.test.js
tests/sales-opportunity-register.test.js tests/sales-opportunity-registration.test.js`;
Playwright configs `playwright.sales-workspace.config.js`,
`playwright.sales-register.config.js`, and `playwright.sales-vf.config.js`;
`node node_modules/vite/bin/vite.js build` (the manifest build command).

Full document explorer follow-up verification on 1 October 2026:

- 20 Node register/workspace/filename helper tests passed; scoped source/test
  ESLint and Git whitespace checks passed.
- 17 distinct document explorer scenarios passed. The initial complete 16-case
  run passed after contrast corrections; the later Unicode filename case and
  affected download/denial cases passed in the final targeted run.
- All 51 existing workspace/register/VF/history cases passed across a 49-case
  regression result and two corrected fixture reruns. The two initial failures
  still clicked the hidden compact-table View action; the final fixtures use
  the visible More > Open full record action. The final targeted run passed all
  seven cases, including the filename change and those two regressions.
- 390/1366/1920px explorer previews were inspected, including desktop widths
  reserving 227px for the unchanged sidebar. Desktop WCAG A/AA scan passed.
- Final Vite/PWA production build after the response-filename correction passed
  on Node 22.20.0, with established large-chunk, mixed-import and Browserslist
  freshness warnings. Log: `artifacts/sales-documents-build.log`.

Follow-up browser command: `node node_modules/@playwright/test/cli.js test
--config=playwright.sales-documents.config.js`. This config includes document,
workspace, register, VF and history suites; filenames or `--grep` select scoped
reruns. Synthetic previews remain in `artifacts/opportunity-documents/results`;
regression and final-targeted artifacts are separate subdirectories.

Reference fidelity and private RADAI attachments verification on 1 October 2026:

- 87 distinct browser scenarios passed across scoped runs: 19 new fidelity and
  RADAI attachment cases plus 68 existing document/workspace/register/VF/history
  cases. Fixture selectors and upload-success wording were corrected in targeted
  reruns; these are distinct-case counts, not a claim of one uninterrupted run.
- 26 Node tests, changed-source/test ESLint and Git whitespace checks passed.
- The new visual fixture loads the actual Layout, Header, Sidebar and eagerly
  imported application CSS. Verified 390/1024/1366/1586/1920px states include
  visible folder/upload controls, a stable three-pane desktop scaffold, 14px
  content typography, and no document-level horizontal overflow. Desktop WCAG
  A/AA checks passed after correcting timestamp/PDF-icon contrast. The sidebar,
  header, layout configuration and global stylesheet sources were unchanged.
- Local attachment fixtures verify upload and subsequent listing/detail/download
  with SharePoint unconfigured; RADAI permission denial; file/provider/UUID retry
  retention; unavailable storage; and obsolete responses after provider changes.
  These tests use isolated synthetic authentication/API responses. They do not
  prove live private storage writes, production grants or SharePoint activation.
- Final Vite/PWA production build completed with exit code 0 on Node 22.20.0.
  Log: `artifacts/sales-opportunity-fidelity-final-build.log`. Existing
  Browserslist freshness, large-chunk and mixed-import warnings remain.

Run the added browser coverage using
`node node_modules/@playwright/test/cli.js test --config=playwright.sales-fidelity.config.js`.
The reviewed selected-file preview is
`artifacts/opportunity-fidelity/radai-selected/sales-opportunity-radai-fi-69993--SharePoint-is-unconfigured/radai-files-without-sharepoint-1586.png`.
The `corrective` artifact directory retains the ready/unconfigured real-shell
desktop and mobile previews. Backend migration/runtime evidence belongs to the
shared feature brief and backend private-attachment contract.
