# Conceptual Data Model

Version 0.1 · Proposed logical entities; actual migrations remain authoritative

## Modeling rules

- Separate stable identity from versioned content and workflow state.
- Every domain record belongs to an explicit organization/legal-entity scope where applicable. Project access does not automatically grant all departmental data access.
- Reuse foreign keys/references to canonical employees, clients, projects, vendors, and document versions.
- Use precise decimal quantities and money, with currency and unit. Do not sum unlike currencies without a recorded conversion basis.
- Record timestamps in a consistent stored timezone and render locally. Keep business dates, employment effective dates, and pay periods as dates when time-of-day is not meaningful.
- Keep revision history for controlled records. Deactivation, cancellation, reversal, and supersession are distinct from deletion.
- Validate ownership and organization consistency on every relationship, including attachments and external mappings.

## Entity groups

| Owner | Proposed entities | Important relationships |
|---|---|---|
| Organization/access | Organization, LegalEntity if needed, Department, User, EmployeeUserLink, Role, Permission, RoleGrant, ProjectMembership, Delegation | A user may have many scoped grants; an employee is not the same entity as a login |
| HR | Employee, EmploymentAssignment, RestrictedEmployeeData, AttendanceEntry, AttendanceCorrection, LeaveRequest, LeaveLedgerEntry, LifecycleCase, LifecycleTask, PayrollPeriod, PayrollRun, PayrollLine | Effective-dated employment; employee-to-user link optional; payroll records separately protected |
| Sales | Client, ClientContact, Opportunity, Proposal, ProposalRevision, Framework, FrameworkRevision, ForecastSnapshot, ForecastLine, EmailIntake, Handover, HandoverRevision | An opportunity belongs to a client; multiple proposal revisions; accepted handover maps to one canonical project |
| Project Control | Project, Phase, WorkPackage, Task, Subtask, Milestone, ScheduleActivity, Dependency, WorkCalendar, PlanningBasis, Baseline, BaselineActivity, ProgressUpdate, ChangeRequest | Baseline freezes an approved schedule and its basis; progress references the measured activity and baseline context |
| Engineering | Discipline, Deliverable, DeliverableRevision, ReviewAssignment, ReviewDecision, DeliverableWorkLink | Project-owned deliverable with discipline and controlled revision; many-to-many links to work items |
| Documents/tools | Document, DocumentVersion, DocumentLink, ReviewComment, CommentResponse, ComparisonRun, ExtractionRun, ExtractedFact, SourceLocator, Assumption, ReviewDisposition | Tool output references exact source versions; facts may have multiple supporting or conflicting locators |
| Procurement | Vendor, VendorQualification, PurchaseRecommendation, RecommendationRevision, RecommendationLine, PurchaseOrder, PurchaseOrderRevision, OrderLine, ProcurementAllocation, Receipt, ReceiptLine, ReceiptReversal | Line-level traceability from recommendation to order to receipt/acceptance; project allocation can span lines |
| Finance | IncomingInvoice, OutgoingInvoice, InvoiceRevision, InvoiceLine, InvoiceAllocation, InvoiceMatch, CreditRecord, SettlementReference | Supplier/client reference, document revision, allocation, and payment linkage; external accounting identifiers where applicable |
| QHSE | QualityPlan, Inspection, AuditCase, Finding, Nonconformance, CorrectiveAction, Hazard, Incident, ClosureVerification | Project links optional by type; actions have owners, dates, evidence, and independent verification where required |
| Intake operations | Enquiry, EnquiryAssignment, RoutingDecision | Email intake can link to one canonical enquiry and opportunity; exact owner/schema deferred to D-08 |
| Shared workflow | WorkflowDefinition, WorkflowDefinitionVersion, WorkflowInstance, ApprovalStep, ApprovalAssignment, ApprovalDecision | Instance references business object and immutable revision plus the resolved route version |
| Platform | AuditEvent, OutboxEvent, InboxEvent, Notification, Job, AIExecution, AIUsageEvent, IntegrationConnection, ExternalObjectMap, SyncRun | Stable operation/event IDs permit tracing and deduplication |

These names illustrate responsibilities. Do not generate production tables mechanically from this list; reconcile each concept with existing schema and feature scope first.

## Project and schedule relationships

| Parent | Child/link | Rule |
|---|---|---|
| Project | Phase | A phase belongs to one project |
| Phase | WorkPackage | A work package belongs to one phase |
| WorkPackage | Task | A task belongs to one work package |
| Task | Subtask | A subtask belongs to one task; unrestricted recursive nesting is not presumed |
| Project or Phase | Milestone | Has a target/actual date and completion evidence; schedule duration is zero when modeled as a milestone |
| Project | Deliverable | A deliverable has its own revision/review lifecycle and links to one or more work items |
| Task/Subtask/Milestone | ScheduleActivity | Mapping must be explicit; a task split into multiple activities cannot have effort/progress counted twice |
| ScheduleActivity | Dependency | Predecessor, successor, relationship type, lag and unit, rationale/source, approval state |
| Baseline | BaselineActivity | Frozen planned dates, durations, relationships, calendars, and relevant planning inputs |

Schedule dependencies must not contain cycles. Parent rollups and leaf progress require one documented weighting method. Completing all tasks does not automatically prove deliverable acceptance, financial closure, or quality closure.

## Common metadata

For mutable business records, include identifiers, scope, owner, created/updated timestamps and actors, a concurrency version, and applicable business status. Versioned content additionally records revision identity, preceding revision, author, effective date, and review/approval state.

For source evidence, include document version, locator type and coordinates where relevant, source text/value, normalized value/unit, extraction method/model version, run ID, confidence if available, and human disposition. Confidence is neither proof nor approval.

For approvals, include source revision, route version, resolved approvers, assignment validity, decision actor, delegation reference, decision/reason, timestamp, and idempotent command identity.

## Integrity constraints


- Canonical record references must exist and belong to compatible scopes.
- A workflow cannot approve an editable revision that differs from the submitted snapshot.
- A person cannot create duplicate active approval decisions for the same assignment.
- An accepted handover must not create multiple projects on retry.
- Receipt quantities and service values use line-level units/currency and documented tolerances; over-receipt requires explicit policy and authority.
- Invoice duplicate detection uses documented supplier/legal-entity/reference criteria and exception handling, not an unconditional global invoice-number uniqueness rule.
- Client and vendor duplicate review must allow legitimate related legal entities; fuzzy matching proposes candidates rather than merging automatically.
- Payroll run versions and locked periods protect released results; corrections reference the original and an authorized adjustment path.
- External identifiers are namespaced by connection/source system and record type.
- Idempotency keys are scoped to authenticated context and operation; the same key with a changed payload is a conflict.
- Source versions and approved baselines cannot be overwritten in place.

## Deletion and retention

Use record-specific rules. Business cancellation does not erase evidence. Retention periods, allowed deletion, archival, and legal holds must come from confirmed policy. Record the decision before implementing scheduled purges. Avoid promising that every record is retained forever or that every record can be hard-deleted.

## RADAI Intelligence AI-project persistence (corrected architecture, 13 November 2026)

`AIWorkspaceConversation.workspace` is nullable for owner-only general chat. A null workspace means no project instructions, project knowledge retrieval, or enterprise-project access; private current-conversation attachments can still produce citations. Project conversations retain their existing workspace foreign key and scoped authorization. Migration `core.0021` changes only that field's nullability. Migration `core.0022` adds private conversation attachments and message references; `core.0023` persists deterministic extracted pages and truncation state on each attachment. Files stay bound to one owner and conversation, with a SHA-256 for download and retrieval integrity checks.

`AIWorkspace` has its own owner, visibility, folder and optional `core.Project` link. `AIWorkspaceMember` grants editor/viewer roles without conveying canonical project permissions. `AIWorkspaceInstructions` is versioned and audited. `AIWorkspaceDocument` stores private files outside `MEDIA_ROOT`, exact file hash, version, extracted page/sheet text and processing state. `AIWorkspaceConversation` is owner-private by default; `AIWorkspaceConversationShare` grants named current members read access, and `AIWorkspaceMessage` records model, citations, instruction version, request identity and token usage. Existing canonical-project Intelligence models remain intact for legacy records; no mappings are inferred.

## RADAI Intelligence project-owned persistence (legacy B2-B3)

`ProjectAIInstructions` is a one-to-one extension of canonical `core.Project`, with seven text preferences, a version, update actor, timestamps, and `rbac.AuditLog` changes. `ProjectKnowledgeSource` links a canonical project to exactly one existing Project Control file or exact live CRS revision; database constraints prevent duplicate project/source links. It stores deterministic extraction locations and text, a file SHA-256, processing state, and link actor. Its approval label is derived from the live CRS chain/revision/document state and never grants approval itself. `IntelligenceConversation` belongs to one canonical project and user and archives without deleting messages. `IntelligenceMessage` records role, timestamp, model/provider metadata, instruction version, exact retrieved source references, and a per-conversation request UUID. A partial unique constraint on conversation, request UUID, and role prevents duplicate stored turns. No AI credentials or Microsoft tokens are stored in these models.
