# Security and Permissions

Version 0.1 · Proposed application controls; production policy requires confirmation

## Authorization model

Authorize the combination of **actor + action + resource + business scope + record state + field sensitivity**. Roles are one input. Department membership alone is not permission to view every departmental record.

Example permission vocabulary: `project.view`, `project.plan.edit`, `project.baseline.approve`, `procurement.recommendation.submit`, `procurement.order.issue`, `finance.invoice.approve`, `hr.payroll.view`, `admin.access.grant`. Adapt names to the existing permission model.

Scope can be Own, Assigned, Department, Named Projects, Legal Entity, or Organization. Confirm which scopes exist; do not introduce a customer-tenancy model without D-02.

## Proposed role matrix

| Functional role | Typical access | Important boundary |
|---|---|---|
| Employee | Own permitted profile, services, requests, assigned work | No general payroll, HR, project, or finance browsing |
| Engineer | Assigned project/discipline work and source documents | Technical approval or issue requires an explicit grant |
| Discipline lead | Discipline work/review within assigned projects | Does not automatically approve budgets or other disciplines |
| Project manager | Assigned project coordination, scope, progress, handover | Payroll/private HR excluded; baseline approval and financial authority explicit |
| Project controller/planner | Authorized planning, progress, baseline proposals | Baseline approval only when separately assigned |
| Sales user/manager | Assigned client/opportunity/proposal/forecast records | Commercial approval and submission authority explicit |
| Procurement requester | Create/track own or assigned recommendations | No automatic order-issue or own-request approval authority |
| Buyer/procurement manager | Vendor, recommendation, order operations within scope | Approval limits, bank changes, receipt acceptance are separate permissions |
| Receiver/service acceptor | Acceptance for assigned orders/services | Cannot alter commercial order terms or approve unrelated invoices |
| Finance user/controller | Permitted invoices, allocations, reconciliations | Payment execution and posting authority separate; payroll access not implied |
| HR officer | Authorized employee/leave/attendance/lifecycle records | Salary, bank, medical, and other restricted fields require narrower access |
| Payroll officer/verifier | Payroll preparation/review within scope | Preparation and release separated when policy requires |
| QHSE officer | Assigned quality/safety records and actions | Sensitive health/incident details restricted separately |
| Executive | Approved aggregates and permitted drill-through | Executive title does not grant unrestricted personal-data access |
| Administrator | Identities, scoped grants, platform settings, integration operations | Platform administration does not imply business approval or unrestricted business content |
| Auditor | Time-bounded read access to authorized evidence | No mutation or hidden expansion into all records |
| AI champion | Usage, evaluation, adoption, authorized run metadata | Prompt/output content access follows source permissions |

These are functional examples, not a ready-to-import production role configuration. D-03 and D-04 resolve actual grants and approval authority.

## Required controls

1. Enforce authorization on every backend request and each sensitive field/action. Recheck on execution even when the UI previously showed the button.
2. Derive access context from the authenticated session and trusted grants; reject user-supplied scope that exceeds it.
3. Protect cross-record references from unauthorized linkage and cross-organization access.
4. Apply equivalent restrictions to search, dashboard aggregates, previews, downloads, exports, notifications, AI retrieval, and job results.
5. Time-limit and audit delegated authority where policy requires. Delegation cannot exceed the delegator's authority.
6. Prevent privilege escalation through self-editing, role assignment, mass assignment, or unrestricted configuration endpoints.
7. Apply the organization's session, MFA/SSO, provisioning, and deprovisioning policy; inspect the identity provider before choosing implementation details.
8. Keep secrets server-side, exclude them from repositories/logs, and use approved rotation and access mechanisms.

## Separation of duties

Proposed default: a requester cannot be the final approver of their own request, and payroll preparation is distinct from release authority. Actual exceptions must be explicit, scoped, versioned policy with audit evidence; never infer them from a user's administrator role.

Bank-detail changes, issued-order amendments, posted/issued invoice changes, role grants, baseline approval, and integration reconfiguration require action-specific permissions. They may need additional review under the organization's confirmed policy.

## Data classification and AI

Define classes such as Internal, Confidential Project/Commercial, Restricted Personal/Payroll, and Restricted Health as a proposed starting point. Confirm labels and handling in D-11.

AI access is limited by both source authorization and approved provider/data policy. Retrieval filters run before content reaches a model, and result access remains protected afterwards. Do not use document text as instructions to call tools, change permissions, or contact external people.

Record model/provider, purpose, sources/revisions, run status, and review disposition. Default operational logging to metadata; store prompts/outputs only where the retention/access policy permits. Never put sensitive content into general analytics events.

## Audit integrity

Record protected mutations, approvals, access grants, document issue, baseline changes, exports where policy requires, and integration actions. Keep audit history append-only through normal application permissions and protect its storage from ordinary administrators. Define privileged maintenance access separately; an append-only UI alone is not tamper protection.

Event metadata should identify actor/service, time, action, scope, object/revision, request/correlation ID, reason, and a privacy-aware change summary. Use durable evidence of business transitions, not only application debug logs.

## Verification matrix

For sensitive changes, cover: allowed own/assigned access; wrong project/department/entity; unauthorized field; expired delegation; self-approval rule; guessed record ID; export/search leakage; stale revision; deactivated identity; and job/file access after relevant permission changes. Select tests that match the changed risk rather than adding an unrelated exhaustive suite.
