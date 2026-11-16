# Example Feature Brief — Purchase Recommendation Submission and Review

Status: Proposed example; not a statement of approved Rejlers procurement policy

## Outcome

A permitted requester can save a recommendation, correct submission errors, submit a fixed revision, and follow its decision through My Requests. An eligible approver can review that exact revision through Approvals and record a decision within their authority.

## Scope

Included: 7.4 Purchase Recommendations; its entries in 2.6 My Requests and Workspace Approvals; the existing project/vendor references, workflow, and audit services.

Protected: sidebar/navigation, unrelated pages and adjacent panels, purchase-order issue, receipt processing, invoice processing, and external email. Preserve the existing form fields unless an approved validation requirement explicitly requires a change.

## Grounding and prerequisites

- Inspect the existing recommendation schema, form, API, project membership checks, workflow, and permission model.
- Confirm D-03 role grants, D-04 approval route/authority, and the applicable recommendation requirements from D-16.
- If approval configuration is unresolved, implement draft handling and validation safely; show a specific configuration error at submission. Do not activate guessed approval rules.
- This example supplies no monetary limit, approver name, tax rate, mandatory vendor selection, or quotation count.

## Proposed data behavior

Use a canonical project reference, existing justification fields, existing line description/quantity/unit/cost fields, currency where monetary values are used, and policy-required evidence. Validate requiredness from confirmed policy. Vendor nomination is required only if the actual process requires it.

Drafts can be incomplete but must reject invalid representations. The server recalculates applicable totals using the approved formula and precision rules. Draft edits use a version check. Submission freezes the exact revision and resolves a versioned route. Audit and workflow creation occur atomically with submission.

## Actions

| Action | Actor | Guard | Result |
|---|---|---|---|
| Save draft | Authorized requester/editor in project scope | Allowed fields, valid representations, current version | Editable saved draft |
| Submit | Authorized submitter | Required data valid; route and eligible assignees resolved; current version | Submitted revision and active review instance |
| Review | Current eligible approver | Source scope and assignment remain valid | Exact submitted content and supporting evidence displayed |
| Approve | Eligible approver/delegate | Pending step, authority, separation of duties, current version | Recorded step decision; final approval only when route completion rules are met |
| Return | Eligible reviewer | Reason entered and route allows return | Return recorded; owner can create a corrected revision |
| Reject | Eligible decision maker | Reason and authority | Submission rejected with retained evidence/history |
| Resubmit | Authorized requester/editor | New valid revision and route evaluation | New review round without erasing prior decisions |

## UI behavior

Use the existing shared controls. Keep Save Draft secondary and Submit primary for an editable draft. After submission, show status, submitted revision, next reviewer information allowed by policy, and history. Disable edits to the submitted content through both UI and API.

Use a concise approval workflow table: Step, Reviewer/Role, Status, Decision Time, Comment. On validation failure, preserve all input and focus the first invalid field. On stale data, explain the conflict and offer refresh/compare. Avoid adding a redundant “review before submission” panel to this example.

## Acceptance criteria

| ID | Given / when | Then |
|---|---|---|
| PR-01 | An authorized requester saves a valid but incomplete draft | Draft persists; no approval instance or submission event is created |
| PR-02 | Required fields fail submission validation | Field errors are returned; entered data remains; no submission occurs |
| PR-03 | Valid submission has a resolvable approved route | One submitted revision, one workflow instance, and linked audit/outbox events persist |
| PR-04 | Submission route is missing or has no eligible approver | Submission is blocked with a clear configuration error; no automatic approval |
| PR-05 | The same submit request is retried with the same key and payload | The original result is returned without another workflow instance |
| PR-06 | A stale draft version is submitted | Conflict is returned without overwriting newer content |
| PR-07 | A user guesses a record ID outside their scope | View/edit/submit/download are denied without exposing restricted content |
| PR-08 | A requester attempts self-approval where policy forbids it | Decision is denied, including through a direct API call |
| PR-09 | Two decision requests race for one approval assignment | One valid terminal decision wins; the other returns the defined conflict/result |
| PR-10 | A reviewer returns the submission with a reason | History remains intact and correction/resubmission creates a new review round |
| PR-11 | Notification delivery fails after a successful decision | The decision remains committed; failed delivery is recoverable and observable |
| PR-12 | User opens My Requests or Approvals | Status and available actions reflect the same canonical record and revision |
| PR-13 | Required audit persistence fails during submission/decision | The protected transition is not partially committed |

## Verification

Run inspected repository gates plus focused domain/API tests for the criteria above. Inspect draft, submitted, returned, denied, validation-error, and stale-version UI states on appropriate viewport sizes. Test policy routing with approved configuration or clearly labeled test fixtures; fixtures are not production authority.

Done means this workflow is verified within its agreed scope, with any unresolved production policy clearly identified. It does not mean purchase ordering or financial settlement has been implemented.
