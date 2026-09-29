# Email opportunity prefill

Implementation contract, 29 September 2026. Applies to live shared-mailbox and
saved email intake. The existing review panel, classification confirmation and
Create opportunity dialog are retained; reading an email creates no records.

## Opportunity record history

The 29 September readability correction renders saved email facts and lifecycle
events in `SalesOpportunityHistory`, inside the existing record drawer. Business
values use 14px text and responsive label/value rows; source quotes expand under
Source evidence. Actor, time, reason and stage changes remain visible. Internal
identifiers, hashes, provider metadata and nested JSON are omitted from this
business view. The stored audit payload, creation APIs and lifecycle commands
are unchanged; old records need no reprocessing. Source strings render as text.
AI notice labels require retained classification evidence. View/edit footer
buttons have separate identities so clicking Edit cannot become a Save click.
Eight synthetic history browser cases, scoped lint, whitespace checks and the
Node 20 production/PWA build passed. Desktop and 360px screenshots were inspected;
no live records were written and no deployment was performed.
Verification is recorded in the workspace
[feature brief](../../docs/features/sales-opportunity-history-readability.md).

## Reviewed fields

Agreement replies can now display separate WO/correspondence references and an
Action deadline in the existing review/extracted details. The typed agreement
return date does not prefill Proposal deadline, and a WO/correspondence identifier
does not become a tender reference. Existing independently evidenced proposal
fields retain priority. Ambiguous or invalid action evidence remains unresolved;
quoted requests and reported replies do not prove current outstanding work or
completion. Manual form edits remain preserved across source reloads.

| Existing control | Extracted information |
| --- | --- |
| Client | Validated `customer_match` and complete authorized client directory |
| Client reference | `tender_reference` |
| Estimated value | `estimated_value` as a decimal string |
| Currency | `currency` |
| Expected award date | `expected_award_date` |
| Proposal deadline | `deadline_date` or `due_date` |
| Scope type | Supported `scope_type` enum |
| Scope summary | `scope_summary` |

Validated AI reviews keep absent business facts blank. Expected award and
proposal deadline are separate date-only fields; a deadline is not an award
date. Existing commercial-field requirements still apply. The OQ reminder alone
does not supply an estimated value, currency or expected award date.

Existing currency choices remain available. An additional three-uppercase-letter
currency such as OMR is offered when its evidence references valid unique message
or quoted source records. Every offered currency remains available for the
mounted dialog so a source refresh cannot silently change a reviewed selection.

## Client selection and creation

The directory loader publishes only complete authorized results. A supported
`exact_name_v1` unique source-backed `matched` candidate present in that directory
prefills Client. A supported `no_match` with an explicit organization name and
`can_create_client: true` prefills the existing Add new client option. Conflicting,
ambiguous, domain-only, malformed, inaccessible and unsupported matches do not
select a client. This supersedes the earlier manual-only client selection rule.

Automatic selection initializes the field once. Manual overrides and an explicit
blank choice survive latency, failed saves and source reloads. If a refreshed
source changes the proposed missing customer's name, the old proposal becomes
unresolved and the current name is available through the same Client selector.
Losing current create authority removes the new-client option. Other entered
fields are retained in either case.

Both conversion commands receive either a canonical `client` UUID or the minimal
`new_client: {company_name}` plus the reviewed `source_token`, classification
confirmation and opportunity fields. No separate Client API write occurs.
The server revalidates source evidence, current permissions and customer identity;
it reuses an accessible canonical record or atomically creates the missing client
and opportunity. A source-derived display name does not establish verified legal
identity. The frontend supplies no invented industry, legal identity or contact
details.

`email_customer_conflict` and `email_tender_already_exists` responses preserve the
form and allow correction through existing controls. They do not force a source
reload. Expired or stale source reviews require explicit reload and classification
confirmation while retaining edited opportunity fields.

## Verification

Synthetic browser coverage is in
`tests/accessibility/sales-email-opportunity-prefill.spec.js`, with retained AI
review, premium workspace and customer matching regression suites. It exercises
the complete field mapping, explicit save payloads, live/saved reuse and missing
client requests, directory pagination, permissions, ambiguous/invalid evidence,
customer conflicts, source changes and manual input retention. Backend tests are
responsible for actual database creation, transaction rollback and concurrency.
No real client or opportunity is created by the browser fixtures.

Verified on 29 September 2026: 77 distinct browser cases passed (28 prefill,
11 AI review, 15 premium workspace and 23 retained matching/conversion cases).
Scoped ESLint, `git diff --check` and the Node 20 production/PWA build passed.
The build retains the existing Browserslist, mixed-import and chunk-size warnings.

## Release verification - 29 September 2026

The release branch was assembled from `main` at `994306b`, retaining its automatic
first-email selection, pending-request reuse, compact heading, imported filters
and original-email navigation. This release preserves main's existing mailbox
setup behavior; the separate server-managed mailbox registration/removal branch
is not included. No package dependencies, deployment configuration or CSS changed.

The earlier 77-case result above records the original local autofill slice.
The combined release passed **204 distinct browser cases**: 15 agreement,
11 AI review, 14 automatic-opening, 28 autofill, 8 history, 15 premium workspace
and 113 shared-mailbox cases. The first run passed 72 cases; all four remaining
cases then passed together with 128 retained cases in the final run (132 passed,
exit 0). One initial failure was cold Vite page startup. The other three required
fixture alignment: Refresh reloads the selected email, and saved examples use
saved-record identifiers rather than opaque Graph message IDs. Existing imported
original-unavailable and search/status assertions were preserved. No application
behavior was weakened to make these tests pass.

All 20 changed JavaScript/JSX source, test and fixture files passed scoped ESLint.
The Node 20 production build exited 0 (Vite 3m 37s; 111 PWA precache entries).
The Windows Python wrapper subsequently failed while printing a Unicode log
glyph; the successful build exit and complete generated output were retained.
Existing Browserslist, mixed-import and chunk-size warnings remain. Desktop and
mobile agreement/history screenshots were inspected. Git whitespace checks
passed. Browser fixtures made no live mailbox or business-record writes.

Local evidence is under `artifacts/email-ai-release/`: `browser-features.log`,
`browser-retained.log`, `lint.log` and `build.log`; final browser results are in
`test-results-email-ai-retained/`. These checks establish release-source
verification, not production deployment or provider activation.
