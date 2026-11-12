# API and Event Contracts

Version 0.1 · Illustrative patterns; reconcile with actual API conventions

## Contract policy

Use the project's existing API style and validation mechanisms. Define executable request/response schemas before wiring a new UI. The examples here show behavior, not a mandate to rename routes or add a new API framework.

Every contract states: authenticated actor, required permission, record/field scope, request shape, validation rules, response shape, errors, concurrency, idempotency, side effects, and audit behavior.

## Representative command endpoints

| Illustrative operation | Purpose | Key controls |
|---|---|---|
| `GET /api/v1/purchase-recommendations` | List permitted records | Server scope, allowed filters/sorts, bounded pagination |
| `POST /api/v1/purchase-recommendations` | Create draft | Field authority, canonical references, idempotency |
| `PATCH /api/v1/purchase-recommendations/{id}` | Edit draft | Editable revision, allowed fields, expected version |
| `POST /api/v1/purchase-recommendations/{id}/submit` | Submit current draft | Required fields, policy resolution, revision lock, expected version |
| `POST /api/v1/approval-assignments/{id}/decisions` | Approve, return, or reject | Assigned actor/delegation, exact revision, reason when needed, concurrency |
| `POST /api/v1/handovers/{id}/accept` | Accept project handover | PM authority, checklist/evidence, idempotent project linkage |
| `POST /api/v1/projects/{id}/baselines` | Request baseline creation | Planning validation and baseline authority; approval may be a separate command |
| `POST /api/v1/document-jobs` | Start authorized tool job | Source access, provider/data policy, limits, deduplication policy |
| `GET /api/v1/jobs/{id}` | Read job progress/result links | Job and source authorization; safe errors |

Do not allow a generic patch such as `{"status":"Approved"}` to bypass an approval command.

## Submission example

Illustrative request:

```http
POST /api/v1/purchase-recommendations/{id}/submit
Content-Type: application/json
Idempotency-Key: <client-generated-unique-key>
If-Match: "7"

{"revisionId":"<current-draft-revision-id>"}
```

Illustrative successful response:

```json
{
  "data": {
    "id": "<recommendation-id>",
    "revisionId": "<submitted-revision-id>",
    "status": "Submitted",
    "version": 8,
    "workflowInstanceId": "<workflow-instance-id>",
    "allowedActions": ["view", "viewHistory"]
  },
  "meta": {"requestId": "<request-id>"}
}
```

The server resolves the actor, organization, approval route, totals, and allowed actions. Client-provided values cannot elevate authority. `allowedActions` helps the UI; the server must recheck the action at execution.

## Errors

| HTTP behavior, where applicable | Stable code examples | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed request or unsupported parameter |
| 401 | `UNAUTHENTICATED` | No valid authentication |
| 403, or safe 404 under established disclosure policy | `ACCESS_DENIED`, `NOT_FOUND` | Unauthorized action or undisclosed/missing record |
| 409 | `INVALID_TRANSITION`, `IDEMPOTENCY_CONFLICT`, `APPROVAL_ROUTE_UNRESOLVED` | Business or retry conflict |
| 412 when `If-Match` is used | `VERSION_CONFLICT` | Resource changed since it was read |
| 422 | `VALIDATION_FAILED` | Field/business validation failed |
| 429 | `RATE_LIMITED` | Caller must reduce/retry according to returned policy |
| 5xx | `OPERATION_FAILED`, `DEPENDENCY_UNAVAILABLE` | Operational failure; no fabricated success |

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Correct the highlighted fields before submitting.",
    "fieldErrors": [{"path":"lines[0].quantity","message":"Enter a quantity greater than zero."}],
    "requestId": "<request-id>"
  }
}
```

Map these semantics into existing conventions. Avoid returning database errors, secrets, hidden record names, or stack traces to users.

## Lists, files, and long-running work

- Choose the existing cursor or page-based pagination approach. Define stable ordering with a unique tie-breaker, limit caps, count semantics, and supported filters.
- Scope aggregate totals and exports identically to list results. Do not leak hidden record counts.
- Downloads and previews require authorization at access time. Temporary file links must follow existing expiry and revocation strategy; do not put confidential content in public URLs.
- File metadata includes classification, size, content type, checksum, linked record, and immutable version. Validate uploaded type/content under the approved file-handling policy.
- Long-running jobs return an accepted job reference, not a fake completed result. Expose state, progress meaning, failure code, retry eligibility, and authorized result links.
- Job cancellation does not imply rollback of already committed business effects. Define this explicitly per job.

## Domain events

Illustrative event envelope:

```json
{
  "eventId": "<unique-event-id>",
  "eventType": "procurement.recommendation.submitted.v1",
  "occurredAt": "<UTC timestamp>",
  "organizationId": "<organization-id>",
  "aggregateId": "<recommendation-id>",
  "aggregateVersion": 8,
  "actorId": "<user-or-service-id>",
  "correlationId": "<request-or-operation-id>",
  "data": {"revisionId":"<revision-id>","workflowInstanceId":"<instance-id>"}
}
```

Use durable delivery and consumer deduplication. Do not promise exactly-once transport. Consumers tolerate retries and reject or reconcile stale ordering where relevant. Minimize event payloads, especially payroll, health, personal, commercial, and document content.

## Contract verification

For changed contracts, verify the successful request, validation failure, wrong scope, stale version, repeated request, and relevant downstream failure. External adapter tests use the actual published/authorized contract or recorded approved fixtures; fabricated endpoint assumptions are not integration evidence.
