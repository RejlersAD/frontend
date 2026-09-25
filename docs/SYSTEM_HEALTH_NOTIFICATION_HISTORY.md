# System Health notification history

System Health's **Notification Logs History** tab lists retained notification
events for existing authorized administrators. Search by recipient or
notification ID, filter by channel/outcome and the existing time range, and
page through the results. Details are read-only and do not mark a notification
read or send another message.

The table includes separate **Delivery Status** and **Read Status** columns.
Event remains in details rather than as a table column. Delivery describes the
recorded transport attempt; lifecycle events are Not applicable. Read Status
shows the notification's current RADAI read flag, including archived records.
Transport acceptance does not establish recipient delivery or external opens.
Missing/unsupported statuses display Unknown.

The frontend uses `GET /api/v1/rbac/analytics/notification-history/` with existing
System Health access rules. The backend returns safe metadata and four additive
status fields: `delivery_status`, `delivery_status_label`, `read_status` and
`read_status_label`. No schema migration or new permission grant is required.
Raw notification content/provider payloads are not displayed. Existing logging
gaps and deletion cascades mean this is not an immutable delivery archive.

Changing accounts clears old rows/details, denied reads clear previous results,
and stale requests cannot overwrite newer filters or accounts. Refresh failures
preserve visible results and filters with a retry action.

Use Node 20 to run `scripts/check-notification-history.mjs`,
`scripts/check-admin-console.mjs`, scoped ESLint and the production build.
Browser fixtures block live requests and reject writes. See
`scripts/README-ui-checks.md` for commands and boundaries.

## Release verification - 25 September 2026

The release is aligned with latest `main`, including the Notification Center
loading fix from PR #164. All five related local inbox files match that
upstream change; the new release delta is limited to history and its docs/tests.

The aligned candidate passed 15 notification-history browser cases, the existing
Admin console regression, 15 inbox unit tests and scoped ESLint (zero errors;
12 existing prop-type warnings across the dashboard/history component).
Fixtures sent no notifications and performed no live API writes.

The Node 20 production/PWA build passed, including 112 precache entries.
Existing large-chunk and stale Browserslist data warnings remain. No backend
migration is introduced; backend verification is recorded in its companion PR.
