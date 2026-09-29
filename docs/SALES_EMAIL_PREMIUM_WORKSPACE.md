# Email Intake review workspace

Email Intake now uses compact inbox rows, a default Email reader with an Extracted
details tab, and a concise review pane with expandable evidence. The existing
sidebar and application shell remain unchanged. Administrator mailbox setup from
main remains available. Desktop panels scroll independently; smaller screens
retain readable stacked content and controls.

The visible breadcrumb, page heading and introductory panel are removed. An
accessible page heading remains available to screen readers. Opening the live
inbox, changing mailbox/page, refreshing, or changing search/read filters loads
the first visible email automatically. A manual selection remains until another
selection or list action; ordinary renders do not force it back to the top.
Selecting the already loaded/pending row reuses its request, and automatic
selection does not move keyboard focus. Only the explicit Next step action moves
focus to review. Failed previews retain explicit Retry; denied or missing sources
clear the panes without automatic retry loops. Empty filters leave no selected
email. Saved enquiry filters likewise select a visible row; View original clears
filters to keep a loaded referenced record reachable. If that original is outside
the loaded records, keep the current email and show an unavailable notice instead
of selecting an unrelated row. All reads retain existing permissions and do not
mark mail read or confirm classifications.

## Classification confirmation

Before opening the opportunity form, explicitly confirm a supported email type.
Changing the email, type, or refreshed source resets confirmation. A returned
source also invalidates confirmation acquired while that refresh was pending.
Opportunity form values remain intact on validation errors and stale-source
recovery. Pending saved-review commands disable classification controls; returned
record updates require reconfirmation and keep in-form recovery available.
Promotional / event and System notification are manual non-opportunity
choices, not added automatic classifier rules.

The live and saved conversion commands send `classification_code` and strict
`classification_confirmed: true` together with the existing reviewed fields.
The backend records the classification and actual actor/time in its existing
atomic opportunity audit. The first Confirm classification action is local to
the current review; it is not a separate saved workflow decision. Canonical client
choice, source freshness, capability checks and guarded retry behavior remain.

Deploy with the backend classification-confirmation release. Older conversion
clients receive safe validation errors from the new backend; the new client needs
the backend's accepted confirmation fields. This feature adds no migration,
mailbox modification, automatic opportunity creation or provider AI call.

## Verification

Use the package's Node 20 runtime. The isolated browser configuration uses
synthetic API fixtures and does not proxy requests to a real backend:

```text
node node_modules/@playwright/test/cli.js test tests/accessibility/sales-email-auto-open.spec.js tests/accessibility/sales-email-premium-workspace.spec.js tests/accessibility/sales-shared-mailbox-messages.spec.js tests/accessibility/sales-mailbox-privacy.spec.js tests/accessibility/sales-shared-mailbox-setup.spec.js --config=playwright.email-auto-open.config.js --workers=1
npm run build
```

Coverage includes classification gates, both conversion paths, denied actions,
stale/repeated requests, preserved input, literal source evidence, desktop/mobile
layout and the retained mailbox setup flows. Release validation results are
recorded in the pull request; earlier workspace checks are not a substitute for
testing the combined release against current main.

The compact-entry/automatic-preview follow-up passed 179 distinct browser cases
on Node 20: 14 automatic-loading cases, 15 premium review cases, two privacy
cases, 113 retained mailbox cases and 35 setup cases. Final scoped source/test
lint and the production/PWA build passed. The browser checks use isolated
synthetic responses, not live mailbox writes. Existing Browserslist, mixed-import
and large-chunk build warnings remain. No backend or API contract changed.
