# Notification Center

The September 2026 page update follows the supplied Notification Center visual
reference: four summary cards, a compact date-grouped inbox, category and sort
controls, search, and a notification details panel. Sidebar, Header, Layout,
global styles and routing are unchanged. Desktop panels keep pagination and
detail actions visible; narrow screens retain scrollable details and inbox.

## Data and actions

- Counters come from the current recipient's complete loaded inbox. Urgent
  retains the existing HIGH/URGENT/CRITICAL filter; Approvals describes the
  notification category, not actionable business approval assignments.
- The client follows validated server page numbers and checks the returned
  count before replacing the inbox. Failed or incomplete refreshes retain the
  last complete snapshot. Account changes clear recipient state and invalidate
  stale refresh and mutation responses.
- Selecting a row uses its list payload without marking it read. Explicit
  read/read-all, dismissal and source navigation reuse existing APIs. Failed
  writes retain the current data and filters. Opening a source retains the
  existing mark-read behavior and canonical PO/PR preview routes.
- Related updates share a canonical source identity. Similar titles or a
  generic destination page do not establish a relationship.
- PO/PR previews retain existing domain authorization and freshness checks.
  This change adds no backend contract, schema or approval authority.

## Verification

Use the Node 20 version required by package.json. The three browser suites use
synthetic intercepted API responses and perform no live notification writes.

```powershell
# Terminal 1: isolated fixture server, without a backend proxy
node node_modules/vite/bin/vite.js --config tests/vite.notification-center.config.js

# Terminal 2: current release checks
$env:PW_BASE_URL = 'http://127.0.0.1:5218'
node node_modules/@playwright/test/cli.js test tests/accessibility/notification-center.spec.js tests/accessibility/notification-drawer.spec.js tests/accessibility/notification-preview.spec.js --config=playwright.config.js --workers=1
node node_modules/eslint/bin/eslint.js src/pages/NotificationPanel.jsx src/utils/notificationCenter.js tests/accessibility/notification-center.spec.js tests/fixtures/notification-center.jsx tests/vite.notification-center.config.js
npm.cmd run build
```

The suites cover 36 scenarios across inbox actions, filters, pagination, partial
refresh recovery, account isolation, keyboard/focus behavior, responsive layout,
the existing notification drawer and PO/PR previews. The visual check includes
the actual application shell at desktop and mobile sizes, with the protected
shell files verified unchanged. Release PR validation records the final results.
