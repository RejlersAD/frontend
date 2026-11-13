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

## RADAI Intelligence AI projects (corrected architecture, 13 November 2026)

The corrected product brief makes an AI project independent of `core.Project`. The authenticated `/api/v1/ai-workspaces/` API allows any active employee to create a private AI project. An optional `enterprise_project_id` may be set only when the owner currently has canonical project membership and `project_control.read`; that link does not grant enterprise document access to AI project members. All AI project operations recheck owner/member access on the server. Owner manages membership and project metadata; owner/editor edits instructions and knowledge; viewers read shared knowledge and create private conversations. Conversation sharing is explicit and read only for a named current project member.

| Path under `/api/v1/ai-workspaces/` | Methods | Contract |
| --- | --- | --- |
| `/` and `{id}/` | GET, POST; GET, PATCH, DELETE | List accessible projects, create, inspect, rename/update or archive. Optional folder and enterprise link. |
| `{id}/members/`, `{id}/members/{user_id}/` | GET, POST; DELETE | Owner adds or removes an active employee as editor/viewer. Revocation immediately blocks project, files and chats. |
| `{id}/instructions/`, `{id}/activity/` | GET, PUT; GET | Versioned seven-field instructions with expected-version conflict and audit history. |
| `{id}/knowledge/`, `{id}/knowledge/{document_id}/`, `{id}/knowledge/{document_id}/download/` | GET, POST; GET, DELETE; GET | Upload up to 12 MB of PDF, DOCX, XLSX, CSV or TXT into private storage; extract text, hash bytes, preview, archive and authorized download. Uploads are unverified references. |
| `{id}/conversations/`, `{id}/conversations/{conversation_id}/` | GET, POST; GET, PATCH, DELETE | Owner-private history, search, resume, rename and archive. Explicitly shared conversations are readable by current named members. |
| `{id}/conversations/{conversation_id}/share/`, `{id}/conversations/{conversation_id}/send/` | POST, DELETE; POST | Owner shares/unshares with a current member. Chat uses server-side instructions and permission-filtered, hash-checked excerpts, saves citations and usage, and accepts an idempotent UUID request ID. Requires an enabled local model route; no synthetic answer is returned. |
| `general/conversations/{conversation_id}/attachments/` and `{id}/conversations/{conversation_id}/attachments/` | POST | Owner uploads a private conversation file after creating the conversation. PDF, DOCX, XLSX, CSV and TXT text is extracted on upload; the response includes file hash and extracted page count. A text document with no extractable text returns 400. Project conversation uploads require an unshared owner conversation and current project access. |
| Corresponding `attachments/{attachment_id}/download/` | GET | Owner-only original download from the exact conversation after hash verification. Attachment IDs supplied to `send/` must belong to that conversation and owner. Private attachments cannot be shared with project members. |

Local Ollama chat uses the existing AI Model Hub provider `ollama` and task route `radai-intelligence-chat` with `data_policy=onprem`. `GET /api/v1/ai-workspaces/models/` lists only enabled, route-eligible local models to authenticated users. Conversation send accepts the selected `model` and `provider: "ollama"`; cloud-provider requests are rejected before a model call. The development command `manage.py configure_ollama_intelligence --model qwen3:8b --endpoint http://localhost:11434/v1` verifies the installed model and configures the existing Hub records. The endpoint must resolve to loopback except for the guarded local-development Docker host address below. Local model usage is recorded with provider `local` and zero cloud cost.

General chat uses `/api/v1/ai-workspaces/general/conversations/` and its `{id}/` and `{id}/send/` paths. These authenticated conversations have no AI project association, are owner-only, and cannot retrieve project instructions or knowledge. Current-conversation private attachments may supply hash-checked page/sheet excerpts and citations. A follow-up message without new attachment IDs reuses attachment references from earlier user messages in that conversation, subject to the same owner and conversation checks. Broad requests select representative pages and mark partial coverage when the full extracted document was not supplied. The same local Model Hub selection, idempotent send, usage record, and audit trail apply. Within the local development Docker backend only, the configuration command may use `http://host.docker.internal:11434/v1` to reach the host Ollama installation; production and nonlocal addresses remain rejected.

The older `/api/v1/projects/{project_id}/ai-*` endpoints remain for legacy canonical-project records and existing engineering integrations; they are not the corrected AI project workflow.

## RADAI Intelligence project workspace (legacy canonical-project B2-B3 implementation)

The authorized implementation brief is the RADAI Intelligence master implementation plan, phases B2-B6. All paths below are under `/api/v1/projects/{project_id}/`; the canonical `core.Project` must be active and accessible to the caller. Project instructions and knowledge require `project_control.read`; edits also require project write membership and `project_control.update`. Conversations additionally require `pid_analysis.read` to create and send. CRS knowledge requires `crs_documents.read`, `pid_analysis.read`, and an existing exact P&ID engineering evidence link to that project and revision.

| Path | Methods | Contract |
| --- | --- | --- |
| `ai-instructions/` | GET, PUT | Seven project preference fields; PUT requires `expected_version`, uses optimistic versioning, and writes an audit event. |
| `ai-activity/` | GET | Last 20 project instruction audit events. |
| `ai-knowledge/` | GET, POST | Page-based list (`q`, `page`, 20 per page); link exactly one existing same-project `project_document_id` or authorized `crs_revision_id`. Upload files first through existing Project Control document API. |
| `ai-knowledge/{source_id}/` | GET, DELETE | Preview extracted text or unlink source. Source access and stored SHA-256 are rechecked. The underlying controlled document is not deleted. |
| `ai-knowledge/{source_id}/process/` | POST | Authorized retry for failed or review-needed deterministic processing. |
| `ai-compare/` | POST | Compare two ready, linked CRS revisions in the same chain with `left_source_id` and `right_source_id`; returns bounded embedded-text diff and exact source identities. |
| `ai-conversations/` | GET, POST | Owner-only list/search (`q`, `page`, 20 per page) or create a project conversation. |
| `ai-conversations/{id}/` | GET, PATCH, DELETE | Resume with messages, rename with `title`, or archive while retaining history. |
| `ai-conversations/{id}/send/` | POST | Send `question` and optional UUID `request_id`; uses server-side instructions, permission-filtered excerpts, and persisted history. A retry with the same UUID and question replays the saved answer; changed content returns 409. Provider keys are never persisted. |

Knowledge formats are PDF, DOCX, XLSX, CSV, and TXT up to 12 MB. Processing states are `pending`, `processing`, `ready`, `failed`, and `needs_review`; truncated or image-only content needs review. Uploaded files are `unverified` until a controlled workflow establishes approval. Sources returned with a chat answer are source excerpts considered by retrieval, not a claim that the model proved every sentence. Microsoft 365 project connections remain unavailable pending approved delegated tenant consent; Sales mailbox/SharePoint credentials do not authorize this workspace.

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
