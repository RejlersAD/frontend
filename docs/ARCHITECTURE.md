# System Architecture

Version 0.1 · Proposed target boundaries, subject to repository inspection

## Architecture decision

Preserve the current production stack and working architecture unless inspection identifies a concrete problem. If no architecture exists, start with a **modular application with explicit domain boundaries**, a transactional relational store, controlled file storage, and durable background jobs. Separate deployment services only when scale, isolation, or operational ownership justifies them.

This proposal does not select a frontend framework, database product, cloud provider, queue product, or AI provider. Record those choices from the actual repository in D-01.

## Logical layers

| Layer | Responsibility | Must not do |
|---|---|---|
| UI and navigation | Display authorized views, collect input, show validation and allowed actions | Decide final authorization, calculate authoritative balances, or issue approvals locally |
| API / application commands | Authenticate, authorize scope, validate contracts, coordinate transactions | Trust organization IDs or role claims supplied in request bodies |
| Domain modules | Apply ownership, invariants, workflow transitions, and calculations | Modify another domain's records through undocumented table writes |
| Persistence | Enforce keys, relationships, valid representations, concurrency, and durability | Depend only on frontend validation for integrity |
| Shared platform services | Identity context, documents, approvals, audit, jobs, notifications, search, reporting infrastructure | Invent domain policy or bypass source-record permissions |
| Integration adapters | Translate external contracts, map identities, reconcile, retry safely | Make an unverified external payload authoritative for all fields |

## Domain boundaries

Domains correspond to business ownership, not one service per sidebar item. Engineering disciplines share common entities. Shared Tools orchestrates platform capabilities. Workspace pages are views over existing domain records. Admin operates platform configuration and access without inheriting all business permissions.

Prefer explicit module interfaces, such as `submitRecommendation`, `acceptHandover`, or `recordReceipt`, over generic cross-domain writes. Reporting can read authorized projections; it must not become a second writable operational database.

## Shared services

- **Identity and scope:** authenticated user, organization/legal entity, role grants, department/project memberships, delegation, and effective dates.
- **Workflow:** versioned route definitions, instances, step assignments, decisions, reminders, and delegation evidence. The source domain validates whether a transition is legal.
- **Document control:** file metadata, classification, immutable versions, checksums, source locations, access evaluation, and linked records.
- **Audit:** durable business events with actor or service identity, time, object/revision, command/correlation ID, reason, and appropriate before/after detail.
- **Jobs:** durable work states, bounded retries, cancellation, progress, error classification, and explicit business-effect idempotency.
- **Notifications:** messages derived from committed events; delivery failures do not erase an approval or reverse a completed domain action.
- **Search:** permission-aware indexing and retrieval; sensitive snippets require the same entitlement as the underlying content.
- **Reporting:** named metric definitions, read models, refresh tracking, and row-level access inherited from source rules.
- **AI execution:** approved provider access, source filtering, prompt/model versions, output validation, evaluation, usage capture, and human review linkage.

## Business command sequence

For a consequential command such as recommendation approval:

1. Authenticate and resolve server-trusted access scope.
2. Load the exact business and workflow revisions; authorize the action and fields.
3. Validate the current state, approval authority, separation of duties, and preconditions.
4. In one transaction, record the decision and required source-state change, audit event, and outbox event; apply an optimistic version check.
5. Commit and return the authoritative state. A repeated idempotency key with the same payload returns the recorded result; a conflicting reuse is rejected.
6. Process notifications and reporting updates from the outbox with consumer deduplication and visible failure handling.

If the existing architecture spans databases/services, document a recoverable orchestration protocol and intermediate states. Do not claim cross-service atomicity that the implementation cannot provide. Audit-critical transitions must not silently succeed without durable audit evidence.

## Integration ownership

Create a field-level authority map for each integration: record type, identifier, source system, writable fields, direction, conflict rule, version/update semantics, and reconciliation owner. Store credentials on the server in the existing approved secret-management mechanism.

For Wrench, confirm the supported interface, authentication, entitlement, event or polling model, environment, object mappings, attachment behavior, and rate limits before building. Do not invent endpoint names or assume all records can be written.

Inbound events require authenticity checks where supported, replay protection/deduplication, schema validation, and a durable inbox. Outbound events require a durable outbox, bounded retry, reconciliation, and a visible failed state. Authentication failures are not fixed by endless retries.

Email ingestion stores source message identifiers and preserves attachments/evidence. It does not authorize automatic replies, external submissions, or distribution of confidential documents.

## Document and planning intelligence

The pipeline is: immutable source version → extraction run → evidence-linked facts → conflict/gap review → proposed work structure and schedule inputs → planner/discipline review → approved planning basis → deterministic schedule calculation → approved baseline.

Keep three distinct representations:

| Representation | Meaning | Required metadata |
|---|---|---|
| Source fact | A claim extracted from an identified source | Version, page/section/table/region locator, extracted text/value, unit, method, validation/review status |
| Planning assumption | A proposed value or relationship not established by source evidence | Reason, owner, impact, review state, accepted/rejected decision |
| Derived result | A reproducible calculation from identified inputs | Algorithm/version, input revision IDs, calendar, parameters, result timestamp |

Do not infer mandatory deliverables solely from a typical industry template. A template can suggest review candidates. Missing dates, effort, dependencies, disciplines, calendars, or approval durations remain gaps or labeled assumptions until accepted.

Document text and model outputs cannot change system instructions, grant tool access, reveal secrets, or publish approved records. AI calls use only data authorized for the user/job and approved for the selected provider.

## Operations

Use correlation IDs across API, workflow, jobs, and integrations. Log event metadata and redacted errors. Track job backlog, failure/retry rates, integration freshness, and authorization failures without leaking restricted content.

Maintain environment separation and controlled migrations. Define backup/restore evidence, monitoring ownership, and recovery objectives before production expansion. These operational choices belong in D-12.
