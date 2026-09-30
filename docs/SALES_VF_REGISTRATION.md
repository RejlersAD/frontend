# VF opportunity registration

The Opportunity register, Sales overview and live/saved email conversion use the
same registration form. Basic fields are opportunity type, title, canonical
client, open date, submission deadline when known and owner. The server assigns
the VF code, initial governed stage, creator and creation timestamp on save.
There is no speculative next-number preview and existing historical codes remain
visible. The backend sequence starts new registrations at Q-102101.

`GET /api/v1/sales/deals/registration-options/` supplies scoped active owners,
`default_owner` and supported opportunity type labels. Failed or denied options
block saving and provide a retry without clearing entered values. Manual saves
send a fresh `registration_request_id` UUID per opened form, retained through
failed saves and retries; duplicate clicks are blocked while the request runs.
Email saves retain their existing source token, classification confirmation,
client-resolution and source-bound retry contracts.

Open date defaults to the source email's received date in Asia/Dubai, or the
current business date for manual entry. The original email timestamp remains
visible. Proposal deadline stays date-only; exact deadline time/timezone and
other action deadlines remain in the existing source evidence. An unavailable
source date is left for authoritative server handling rather than invented.
An EOI due date is not automatically entered as a proposal deadline; users can
enter a reviewed submission date without changing the retained EOI evidence.

Commercial details are optional at registration. Missing amount and expected
award date are sent as null, currency and scope as blank. Supported extracted
facts still prefill the commercial disclosure and remain editable. Amount,
currency, scope, summary and award date can be completed in the existing record
editor before qualification. Existing governed lifecycle commands remain in
place; `lead` is presented as Open, without collapsing Award pending, No Bid or
Cancelled into a different outcome.

The register displays both VF code and title, client, open date, submission
deadline, stage, owner and value. The detail drawer includes type, owner, creator
and creation time. Missing estimates display Not provided. Overview totals state
Incomplete when any included value is missing; mixed or missing currencies do
not produce a combined money total. A supplied zero remains zero, and malformed
currency values remain readable without breaking the page. The existing sidebar
and application shell remain unchanged.

No document folders, external storage provisioning, automatic client approval,
autonomous opportunity creation or new status-edit authority are included.

Release the matching backend first and apply Sales migration
`0011_vf_opportunity_registration` before enabling this frontend. The frontend
requires the registration-options route, nullable registration commercial
fields, server-owned VF allocation and retry protection. These changes have not
been released to production as part of this implementation.

Focused fixture verification is configured in `playwright.sales-vf.config.js`.
It covers minimal live/saved/manual registration, ownership options denial,
failed-save retention and retry identity, editable later commercial details,
plus retained client/evidence and opportunity-history behavior. Fixtures make
no real mailbox, provider or business-record writes.

Verification on 30 September 2026 (Node 20):

- Combined email prefill, history and registration browser run: 45 passed.
- Final targeted registration browser run: 10 passed after strengthening the
  sourced EOI deadline guard and making shared form buttons readable when opened
  directly from the register or overview, without loading email-page CSS.
  Coverage includes manual register and overview creation, both email paths,
  rejected owner correction, denied options, retained retries, later commercial
  edits and EOI dates under both EOI and Tender review classifications.
- Date/deadline/money helper regressions: 4 passed; changed-source ESLint and
  `git diff --check` passed.
- Final production Vite/PWA build passed (1 minute 44 seconds). Existing bundle
  size, mixed-import and outdated Browserslist data warnings remain.
- Registration form screenshot was inspected at
  `artifacts/vf-registration/results/sales-vf-registration-mini-407ef-fabricated-commercial-facts/vf-registration-form.png`.

Commands: `node node_modules/@playwright/test/cli.js test --config=playwright.sales-vf.config.js`,
`node --test tests/sales-opportunity-registration.test.js`, and
`node node_modules/vite/bin/vite.js build`. Verification logs remain under
`artifacts/vf-registration-*.log`; they contain synthetic fixtures only.
