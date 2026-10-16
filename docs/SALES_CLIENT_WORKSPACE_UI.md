# Client register and selected workspace

Implemented and verified locally on 1 October 2026. Canonical
records remain Sales Clients. The existing SalesLifecycleArea controller owns
client registration, full-record details and editing.

## Main-content scope

`/sales/clients` uses SalesClientRegister and SalesClientWorkspace with scoped
Roboto, navy text, purple actions, pale borders and white surfaces. The desktop
register/workspace proportion is approximately 47/53, with 75px register rows and
panel scrolling. Narrow screens stack the content panels. The exact route joins
the existing viewport main-content classification in Layout. Sidebar, Header,
their dimensions, navigation and responsive behaviour remain outside this change.

The register supplies real status counts, identity/domain search, Country and
optional Owner/Industry filters, sorting, pagination and configurable columns.
Former remains a separate status when present. Verification and active opportunity
counts remain accessible through Columns, together with page size and Refresh.
Selecting a row loads its existing detail endpoint and retains `?record=<UUID>`.
Edit and Full record reuse the existing drawer; closing it retains selection.
After a successful edit, reload detail to restore its relationship projections.

## Data and commands

- `salesClientRegister.js` follows bounded page numbers through the existing
  services, checks IDs/counts and rejects incomplete responses before publishing
  complete totals. It does not fetch response-provided external URLs.
- Company information uses stored Client identity/contact/location fields and
  its account manager. Client has no currency field, so Currency displays a
  dash. Screenshot sample clients/counts are not runtime defaults.
- Contacts use the selected Client detail. Opportunities, proposals, frameworks
  and activity use the existing client-filtered services, independently showing
  loading, empty, error and denied states. Responses are checked against the
  selected Client ID and fenced when selection changes. Opportunity deadlines
  use `submission_due_date`; framework validity uses its stored expiry date.
- Contact creation uses the existing contact API and shared SalesActionDialog.
  Activity creation sends the current actor for existing serializer validation;
  the server sets the saved actor and supplies the default activity timestamp.
  Its form uses supported subject/type/outcome/follow-up fields, not unsupported
  description or next_steps fields.
  Failed writes retain entered values. Successful writes are distinguished from
  subsequent refresh failures to avoid presenting a successful POST as retryable.
- New opportunity opens the existing SalesOpportunityRegistrationDialog. It
  retains reviewed Client selection and the existing registration command.
- Existing Client creation/edit fields and commercial eligibility behaviour are
  preserved. No new approval, verified identity, status policy or grant follows
  from a UI action or from the reference screenshot.
- Export is disabled because no guarded Client export API exists. No browser
  export fallback or simulated successful export is provided.

## Existing access limitations

Client/contact actions use `sales_clients`; opportunity/activity actions use
`sales_opportunities`. Proposals and frameworks retain their separate route
permissions. Related-read failures do not fall back to unguarded embedded activity
metadata, and unavailable counts are not represented as zero.

The existing Contact and SalesActivity endpoints do not provide equivalent
server-side Client visibility validation to ClientViewSet. Binding these UI
operations to the current loaded Client does not close that backend gap. This
change introduces no backend code, schema, migration, production data operation,
new dependency or deployment.

## Verification

Passed scoped ESLint, Git whitespace checks and the final production/PWA build
(`artifacts/client-build-final.log`). Existing bundle-size, mixed-import and
Browserslist warnings remain. All 16 distinct Client browser cases passed across
completed runs using `npm.cmd exec -- playwright test
--config=playwright.sales-client.config.js`; coverage includes filters/pagination,
linked records, late/denied reads, retained create/edit/contact/activity inputs,
saved results and existing opportunity registration. The desktop test includes
Axe and unclipped fixture names; responsive cases cover 1024, 768 and 390px.
The actual Layout/Header/Sidebar and global styles are exercised with synthetic
API fixtures, without live data writes.

Also passed 22 adjacent checks with `node --test
tests/sales-opportunity-register.test.js tests/sales-proposal-register.test.js`.
Sidebar, Header, layout configuration, sidebar layout hook and index.css have no
diff. The exact Client route alone adopts the existing viewport main-content
behaviour. Existing unrelated Proposal changes remain preserved.

Final screenshot:
`artifacts/sales-client/reference-final/sales-client-reference-lay-a98b5-unchanged-application-shell/client-reference-1586.png`.
See `artifacts/sales-client/{results,reference-final,forms-final,activity-final,opportunity-final}`
for completed test evidence. Earlier fixture/selector failures and a test-server
shutdown were corrected/superseded by targeted passing runs. The initial code
contrast failure was fixed before final Axe verification. The unchanged shell's
250px sidebar and 56px header differ from the illustration; this is not a claim
of whole-screen pixel identity. No backend migration or deployment was needed or
performed. Shared requirements and final evidence are recorded in workspace
`docs/features/sales-client-reference-workspace.md`.
