# Shared mailbox setup in Email Intake

Implementation contract, 29 September 2026. This runbook describes the bounded
administrator setup form; it does not certify deployment or production activation.

## Access and prerequisites

Open `/sales/email-intake` with the current authenticated RADAI account. The form
uses the established administrator check: an active `admin`, `super_admin` or
`ict_admin` role, or the existing superuser path. Effective
`sales_email_intake` action grants are also required; the profile must belong to
the current account. A staff flag alone does not qualify.

| Form action | Effective intake grants |
| --- | --- |
| Add shared mailbox | `read`, `create` |
| Reopen Mailbox setup and test | `read` |
| Edit saved setup details | `read`, `update` |
| Enable or pause automatic sync | `read`, `create`, `update` |

The server independently enforces current authority and mailbox visibility.
Application registration/correction requires administration. The existing test
and sync APIs retain their owner/administrator visibility rules and respective
action checks; this UI adds no grants or ownership transfer.

An operator needs the intended mailbox address and Microsoft Entra Directory
(tenant) ID and Application (client) ID. The application credential belongs in
the backend's `RADAI_SALES_GRAPH_CLIENT_SECRET` environment variable. The form
has no secret field and cannot configure Microsoft access or deployment services.
All new fields start blank; no local mailbox or account is copied automatically.

## Operator steps

1. Click **Add shared mailbox**. Enter a connection name, mailbox address,
   Directory (tenant) ID and Application (client) ID, then choose **Save mailbox**.
   Saving records the current actor, with sync disabled and health untested. It
   makes no Microsoft request and imports no emails.
2. Choose **Test connection**. A successful result confirms current Microsoft
   Inbox access for the reviewed mailbox. Failure leaves the saved connection
   available for correction or another explicit test. A missing credential
   warning requires server configuration, followed by another test.
3. If automatic capture is intended, choose **Enable automatic sync** after a
   successful test. This includes accessible existing and new incoming emails;
   initial import can take time. Enabling records authorization for background
   work. Queued or running status does not mean import has completed.
4. Choose **Done** to reload the mailbox list and select the saved connection.
   Use **Mailbox setup** on the selected mailbox to review current status, test
   again or pause sync. Pausing retains saved emails and progress.

Automatic sync also requires the existing server feature setting, broker, worker
and scheduler configuration. A successful Graph test alone does not establish
that those services are operating. Verify actual sync progress separately.

## Recovery and privacy

- Validation and duplicate errors retain entered values. Application addresses
  are trimmed/lowercased and checked against existing addresses without regard
  to case. **Check saved mailbox** can recover a visible connection with the same
  address, tenant and client; it never substitutes a different application.
- If a save response is lost or cannot be confirmed, the form freezes the
  attempted values and disables saving. Use **Check saved mailbox** before an
  explicit retry. No matching saved record permits correction/retry; a matching
  record opens its saved setup without a second registration.
- **Edit details** is available before saved email or sync history protects the
  identity. The server repeats identity validation while holding its connection
  lock, so capture or sync history created since opening the form still wins.
- A test response for another mailbox is not accepted as verification. Sync
  changes carry the reviewed address, tenant and client as `expected_identity`.
  The server compares them under the connection lock. A 409 conflict clears
  verification; close and reopen setup to review the current details.
- A denied request stops further writes in that dialog. Restore access and
  reload before continuing. Account changes/unmounts discard late UI results.
- Secret values are never entered here. Setup errors use safe inline messages;
  these requests suppress the shared interceptor's detailed payload logging and
  duplicate toasts. Test failures and retained `last_error` values have safe API
  projections. This does not erase historical server diagnostics.

## Release and activation boundary

Deploy the matching backend before this frontend: older backends reject the new
optional `expected_identity` sync field. The new backend still accepts existing
boolean-only sync clients, which do not receive the additional reviewed-identity
comparison. This feature adds no schema or migration and does not itself enable
a mailbox, change credentials or start background services. Reverting the UI does
not remove a saved connection or pause an already enabled sync; use the guarded
pause action when operationally required.

Production activation remains unverified by this implementation. The user
reported deploying the server credential; an authorized production save,
successful connection test and observed sync progress still need live evidence.
No merge into `main` follows without an explicit user instruction.

## Local verification, 29 September 2026

The isolated release worktree passed 35 distinct setup browser cases and 133
retained mailbox/status/privacy cases, including guarded access, correction,
lost-save recovery, safe errors, account races, reviewed-identity conflicts,
protected history, keyboard focus and narrow-screen accessibility. Initial cold
Vite navigation timeouts passed on settled-cache reruns; no assertions remain
failing. Desktop/mobile screenshots were visually inspected, and scoped ESLint
and whitespace checks passed.

The production/PWA build passed on Node 20.20.2 and npm 10.8.2 using a disposable,
network-disabled Linux snapshot of the final source. Existing bundle-size and
Browserslist-age warnings remain. Evidence is under the ignored
`artifacts/shared-mailbox-setup/` directory: `verification-summary.json`,
`retained-results-tail.log`, `edit-history-results.log`, and
`final-node20-build.log`. Browser APIs used synthetic fixtures; these results do
not establish production credentials, Microsoft access or running capture.

Source: `src/pages/Sales/SalesSharedMailboxSetup.jsx`,
`useSalesMailboxSetupAccess.js`, `SalesSharedMailboxMessages.jsx`, and
`src/services/sales.service.js`. Backend contracts are maintained in that
repository's `docs/SALES_MAILBOX_BROWSING.md` and `docs/SALES_MAILBOX_SYNC.md`.
The scoped browser fixture is
`tests/accessibility/sales-shared-mailbox-setup.spec.js`; actual check outcomes
and production evidence are recorded separately from these operator steps.
