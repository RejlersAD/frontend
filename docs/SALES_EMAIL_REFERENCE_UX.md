# Email Intake reference design and AI actions

Email Intake follows the latest September 2026 reference: a compact toolbar,
purple AI actions, lavender selection, sender avatars and separate inbox,
reader and AI insights cards. The large title, breadcrumb, subtitle and AI badge
have been removed; a small Email Intake heading shares the filter/action row.
Changes are scoped to Email Intake; the existing
sidebar, navigation, shared header and footer are unchanged. Original email
content is safely rendered, rather than replaced with an illustrative preview.

The reader has Email, Thread, Attachments and Extracted details tabs.
Thread shows the available analyzed conversation; it does not promise complete
mailbox history. Attachments reports availability and directs users to the
original email; it does not fabricate file contents or download links. Desktop
body/evidence scroll independently and AI content is contained in the right
panel. Summary, Evidence and Ask AI tabs preserve the current question and
editable reply when switching views. Review actions remain reachable. Long
subjects use two lines with a Full subject control; expanded subjects scroll
within a bounded area. Narrow screens stack the cards.

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
- **Assistant errors** use an allowlisted backend reason to distinguish missing
  configuration, provider authentication/access, limits, timeout, mailbox reload
  and source-evidence failures. Only static messages are rendered; raw server or
  provider diagnostics are never shown. Unknown reasons use a safe fallback,
  and older timeout/citation error codes remain supported. Question and draft
  input survive recoverable failures. Configuration presence does not establish
  provider authentication or successful production review.
- **AI suggestions** filters validated reviews available on the current page.
  No page badge claims provider activation. Read filtering and authorized
  mailbox administration remain available in their menus.
- **Reply** opens Ask AI and focuses the draft action. It does not call the
  provider until Draft reply is explicitly selected, or send/persist email.
- **Message details** in the reader header exposes source status and, for saved
  enquiries, the existing review/duplicate/reject actions. The Received summary
  uses the actual received timestamp, distinct from the sent timestamp.
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

The diagnostic follow-up passed all 30 assistant/batch browser cases on
29 September 2026, including configuration/authentication/rate-limit/mailbox
messages, legacy timeout/citation codes, hostile/unknown reasons, retained input
and successful retry. Scoped ESLint and whitespace checks passed. These use the
isolated synthetic browser fixture and do not establish production AI success.
Evidence: `artifacts/email-assistant-diagnostics/browser.log`; the release PR
records the production build and remote deployment checks.

The latest compact layout passed 235 distinct browser cases on 29 September
2026: 39 focused assistant/reference/compact cases and 196 retained mailbox,
agreement, AI review, automatic selection, opportunity-prefill and workspace
cases. Rechecks corrected superseded geometry/label/hidden-tab test selectors;
application source remained unchanged. Scoped application/test/config lint,
whitespace checks and the Node 20 production/PWA build passed (2m 8s). Desktop,
laptop and mobile previews were inspected and sidebar geometry remained
unchanged. Evidence: `artifacts/email-compact/verification-summary.json`,
`artifacts/email-compact/build.log`, `artifacts/email-compact/previews/` and
the `artifacts/email-compact-*.log` files. These checks validate the application
source; release and deployment status are recorded separately in the release PR.

Use Node 20 and the isolated fixture server, which has no backend proxy:

```text
node node_modules/@playwright/test/cli.js test tests/accessibility/sales-email-assistant.spec.js tests/accessibility/sales-email-reference-ux.spec.js tests/accessibility/sales-email-compact-insights.spec.js --config=playwright.email-compact.config.js --workers=1
npm run build
```

The new cases cover real mounted UI requests, source changes, cancellation,
access loss, failures, editable drafts, desktop/mobile layout, keyboard use,
accessibility and unchanged sidebar files. Retained email, setup and opportunity
suites verify existing workflows. All browser API responses are synthetic; they
do not constitute live mailbox or production verification. Final results are
recorded in the workspace feature brief and delivery summary.

The previous large-header implementation verification on 29 September 2026
passed 270 distinct browser cases:
23 assistant/batch, eight reference-layout/source cases and 239 retained
mailbox/setup/opportunity cases. The retained run passed 237 immediately; the
summary-group selector correction and a development hot-reload interruption
passed targeted rechecks on stable source. All changed JS/JSX/MJS files passed
scoped lint, and the Node 20 production/PWA build passed. Existing Browserslist,
mixed-import and large-bundle warnings remain. Final desktop/mobile previews
were inspected and sidebar file hashes/bounds remained unchanged. The backend
passed 146 cases and a separate real Anthropic synthetic deadline check. No
production deployment is included.
