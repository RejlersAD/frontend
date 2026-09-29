# Email Intake reference design and AI actions

Email Intake follows the September 2026 reference: a visible title, purple AI
actions, lavender selection, sender avatars and three separate inbox, reader,
and Context & evidence cards. Changes are scoped to Email Intake; the existing
sidebar, navigation, shared header and footer are unchanged. Original email
content is safely rendered, rather than replaced with an illustrative preview.

The reader has Email preview, Thread, Attachments and Extracted details tabs.
Thread shows the available analyzed conversation; it does not promise complete
mailbox history. Attachments reports availability and directs users to the
original email; it does not fabricate file contents or download links. Desktop
body/evidence scroll independently while Ask RADAI and review actions remain
reachable. Narrow screens stack the cards.

## Working controls

- **Analyze unread** explicitly reviews incoming, unread, non-draft messages on
  the loaded page, at most 50, through sequential authorized message-detail
  requests. Progress distinguishes validated AI results from other outcomes.
  Stop, page changes and mailbox changes discard late responses. It does not
  mark messages read or schedule a durable mailbox-wide job.
- **Ask RADAI** calls the selected live or saved email's review-assistant
  endpoint. Questions, requirements and deadline checks return source-backed
  passages. Draft reply produces an editable neutral template with those
  passages and placeholders for the user's decisions. Copying a draft does not
  send mail or save an Outlook draft. Errors retain input; source changes and
  access loss clear old answers.
- **AI suggestions** filters validated reviews available on the current page.
  **Powered by AI** appears only when the selected email has a validated review;
  the fallback badge does not certify provider activation. Read filtering and
  authorized mailbox administration remain available in their menus.
- **Create opportunity** retains classification confirmation, source freshness,
  canonical client resolution, permissions and the existing reviewed form.
  Missing commercial facts stay unresolved. Context distinguishes agreement
  return dates from proposal deadlines and does not infer an open tender status.

## Backend dependency

Deploy the corresponding backend before this frontend. It adds read-authorized
`POST /api/v1/sales/mailbox-connections/{id}/review-assistant/` and
`POST /api/v1/sales/email-intakes/{id}/review-assistant/`. Requests contain only
`action`, `question` and, for live email, `message_id`. Existing server-side email
AI provider settings are reused; no key belongs in frontend configuration.
Unavailable configuration or unverifiable provider output produces an explicit
error. No persistence schema change is introduced.

## Verification

Use Node 20 and the isolated fixture server, which has no backend proxy:

```text
node node_modules/@playwright/test/cli.js test tests/accessibility/sales-email-assistant.spec.js tests/accessibility/sales-email-reference-ux.spec.js --config=playwright.email-reference.config.js --workers=1
npm run build
```

The new cases cover real mounted UI requests, source changes, cancellation,
access loss, failures, editable drafts, desktop/mobile layout, keyboard use,
accessibility and unchanged sidebar files. Retained email, setup and opportunity
suites verify existing workflows. All browser API responses are synthetic; they
do not constitute live mailbox or production verification. Final results are
recorded in the workspace feature brief and delivery summary.

Final local verification on 29 September 2026 passed 270 distinct browser cases:
23 assistant/batch, eight reference-layout/source cases and 239 retained
mailbox/setup/opportunity cases. The retained run passed 237 immediately; the
summary-group selector correction and a development hot-reload interruption
passed targeted rechecks on stable source. All changed JS/JSX/MJS files passed
scoped lint, and the Node 20 production/PWA build passed. Existing Browserslist,
mixed-import and large-bundle warnings remain. Final desktop/mobile previews
were inspected and sidebar file hashes/bounds remained unchanged. The backend
passed 146 cases and a separate real Anthropic synthetic deadline check. No
production deployment is included.
