# Sales shared mailbox status

`src/pages/Sales/EnterpriseSalesWorkspace.jsx` renders `SalesSharedMailboxStatus`
on `/sales` and `/finance/sales`. The existing Connect Outlook dialog still handles
personal delegated connections.

## Read contract

The panel uses the existing `salesService.getMailboxConnections()` list, including
pagination, without `mine:true`. It shows only application connections returned by
the backend: name, mailbox address, saved health status, last check, and email
intake enabled/disabled. Connected and intake-enabled are separate facts.

Refresh reloads this saved status using GET. It does not run a live Microsoft Graph
test, import messages, send emails, or edit the connection. No secret, application
ID, raw error payload, or message content is rendered.

The connection-list service suppresses shared detailed error dumps and generic
error toasts. The panel owns its safe inline failure and retry presentation.

Existing server access remains authoritative: authentication plus
`sales_email_intake.read`; authorized administrators see all connections and other
users see their own. A system-owned connection is not automatically visible to
every Sales user. The panel remounts on account identity changes and only renders
while authenticated.

## Recovery and presentation

Initial loading, empty, denied, untested/unknown, and request failures have explicit
states. A transient refresh failure retains the last complete list with an outdated
warning; access denial clears that list. Refresh can retry either failure. Late
responses after unmount are discarded. Pagination errors never expose a partial
list as a successful result; next-page links supply only a validated page parameter
to the existing service endpoint.

The panel follows the shared typography and white/bordered surface styles. Its
refresh control has a keyboard focus indicator and the accessible name
`Refresh mailbox status`. Long addresses wrap on narrow screens.

## Verification

```powershell
npm.cmd exec -- eslint src/pages/Sales/EnterpriseSalesWorkspace.jsx src/pages/Sales/SalesSharedMailboxStatus.jsx
npm.cmd exec -- playwright test tests/accessibility/sales-shared-mailbox-status.spec.js --config=playwright.config.js --workers=1
npm.cmd run build
```

Browser fixtures contain synthetic data and mocked API responses. They verify the
UI contract, not tenant permissions or live mailbox access. This feature has no
backend schema or permission changes and does not imply a production deployment.

The cross-repository brief is `../docs/features/sales-shared-mailbox-status.md`
relative to this frontend repository root; it remains outside this Git repository.
