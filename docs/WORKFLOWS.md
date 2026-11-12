# Business Workflows

Version 0.1 · Proposed states and guards; confirm company policy before activation

## A shared engine does not imply one shared status list

Separate business lifecycle, approval state, document revision state, job state, and payment state. A purchase order can be issued, partially received, and partially invoiced at the same time. One status field cannot accurately represent all three dimensions.

Every transition specifies: source state, action, destination state, authorized actor/scope, guard conditions, required evidence, transaction effects, audit event, and retry/concurrency behavior. State labels below are proposals, not inferred existing enums.

## 1. Common approval contract

Proposed approval lifecycle: Draft → Submitted → In Review → Approved / Rejected / Returned. Returned creates a revision opportunity and a new submission. Cancelled/Withdrawn are explicit actions with policy-defined availability.

| Action | Actor | Preconditions | Effect |
|---|---|---|---|
| Save draft | Authorized creator/editor | Own or assigned record; field authority | Save editable content without claiming submission completeness |
| Submit | Authorized submitter | Complete valid revision, valid scope, resolvable approval policy/route | Freeze submitted revision, resolve route version and assignees, create instance/assignments, audit |
| Approve step | Current eligible approver/delegate | Pending assignment; current revision/version; authority and separation-of-duties checks | Record decision; advance route or approve the business revision atomically |
| Return | Eligible reviewer | Reason present; route allows return | Close or resolve the current review round as defined; notify owner; preserve history |
| Reject | Eligible decision maker | Reason and rejection authority | Record final decision for the submission; resubmission behavior depends on domain policy |
| Resubmit | Authorized editor/submitter | Corrected new revision; fresh completeness/route evaluation | Start a new review instance referencing the new revision |
| Withdraw/cancel | Authorized requester or authority | Allowed state; downstream effects checked | Record reason, resolve active assignments, retain history and external consequences |

Sequential/parallel steps, quorum, thresholds, currency basis, substitutes, escalation, self-approval, and timeout behavior belong to versioned policy. **No matching route is a blocking configuration error, never automatic approval.** Absence of an approver does not grant the requester approval rights.

Approvals in progress retain their resolved route. A policy change applies to new submissions unless a separately authorized, audited migration reassigns existing cases. Reminders do not approve anything.

## 2. Sales enquiry to project handover

Proposed enquiry states: New → Triaged → Assigned → Qualified / Closed. Opportunity states: Draft → Qualified → Proposal → Negotiation → Won / Lost / On Hold. These are separate objects; an enquiry can close after linkage while the opportunity remains active.

Proposal revision states: Draft → Internal Review → Approved for Submission → Submitted → Accepted / Declined / Superseded. Sending externally is a distinct authorized action, with recipient, document revision, and submission evidence.

Handover states: Draft → Submitted → PM Review → Accepted / Returned. Acceptance requires the agreed handover checklist, authoritative award/contract evidence or an explicitly authorized alternative basis, project owner, scope boundaries, dates, deliverables, commitments, and unresolved risks. Unknowns remain visible.

Acceptance creates or links a single project using a stable handover identity; retry does not create another project. Opportunity Won does not itself authorize every downstream cost, order, or invoice. Framework validity and commercial applicability must be checked when a framework is referenced. Forecasts are dated snapshots, not lifecycle transitions or realized revenue.

## 3. Engineering deliverable control

Proposed revision states: Draft → Internal Review → Approved for Issue → Issued → Superseded. Client review status, where required, is a separate dimension: Pending / Accepted / Accepted with Comments / Revise and Resubmit, using the actual contract's codes.

- Authors edit drafts; reviewers decide only for assigned disciplines/projects and revisions.
- A returned review requires correction and a new reviewable revision or round.
- Issue requires the configured technical approval and document-control checks.
- A new issue preserves prior files, decisions, transmittal evidence, and comments.
- Client acceptance cannot be inferred from internal approval or an elapsed number of days unless an approved contract rule explicitly allows it.
- Cross-discipline dependencies and technical holds remain visible; the UI must not silently bypass them.

CRS resolution, if CRS is confirmed to mean a comment-resolution workflow, links each comment to an exact source revision, response, owner, evidence, and authorized closure. Do not implement this interpretation until D-06 is resolved.

## 4. Project execution and baseline control

The supplied work-item flow is a starting point: Draft → Planned → Ready → In Progress → Review → Approved → Completed. Apply it to appropriate work items after mapping existing states. It is not a universal invoice, payroll, purchase order, or whole-project lifecycle.

| Transition | Proposed guard |
|---|---|
| Draft → Planned | Scope/work owner and planning inputs recorded; gaps explicitly tracked |
| Planned → Ready | Required predecessors, authorized inputs, resources/assignments, and holds checked |
| Ready → In Progress | Authorized assignee starts work; actual start recorded |
| In Progress → Review | Required outputs and completion evidence submitted |
| Review → Approved | Required reviewer approves exact outputs; rejected/returned work re-enters execution under policy |
| Approved → Completed | Required closure conditions satisfied; actual finish recorded |

Track blocked/on-hold conditions separately where that best preserves lifecycle meaning. Reopen, cancel, skip-review, and rollback transitions require explicit rules and authority; do not add them implicitly.

Baseline lifecycle: Draft Plan → Validated → Submitted for Baseline → Approved Baseline → Superseded. Validation checks source basis, known conflicts, accepted assumptions, activity mapping, dependencies/cycles, calendars, durations, constraints, and approved scope.

Critical-path and float calculations require a specified algorithm and calendar/constraint semantics. Label forecasts built with incomplete inputs as provisional. Retain the inputs and calculation version so results are reproducible.

Changes use Change Request → Impact Review → Decision → New Baseline if approved and required. Preserve the previous baseline. Progress updates do not rewrite original planned dates. Baseline approval authority is separate from general project edit access.

## 5. Procurement to invoice linkage

Recommendation: Draft → Submitted → In Review → Approved / Returned / Rejected. Conversion state is separate: Not Ordered / Partially Ordered / Fully Ordered, calculated from authorized line allocations.

Purchase order: Draft → Review → Approved for Issue → Issued → Closed / Cancelled. Changes to issued terms follow a versioned amendment route. Receipt state (None / Partial / Complete) and invoicing state remain separate.

Receipt/service acceptance: Draft → Submitted → Accepted / Rejected, or a simpler authorized posting route if confirmed policy allows it. Accepted records link to exact order lines, quantities or service values, evidence, and the accepting actor. Corrections use reversals/adjustments with reasons.

| Boundary | Required checks |
|---|---|
| Recommendation submission | Valid project/allocation, justification, lines, quantities/units, currency/cost basis where required, attachments by policy, route resolution |
| Recommendation → order | Approved revision, remaining authorized line allocation, permitted vendor, project scope, and buyer authority |
| Order issue | Approved exact commercial revision, intended recipient/channel, valid authority, and issue evidence |
| Receipt posting | Issued/receivable order, line balances, acceptance authority, evidence, and tolerance policy |
| Incoming invoice validation | Supplier identity, reference/date, currency/totals, allocation, duplicate checks, and order/receipt or service evidence where applicable |
| Cancellation/closure | Remaining commitments, receipts, invoices, reversals, and external-system consequences assessed |

Not every invoice is PO-backed and not every purchase is a physical good. Confirm alternative expense/non-PO authorization and service-acceptance rules instead of forcing false receipts.

## 6. Finance invoice workflows

Incoming invoice: Captured → Validation → Approval Review → Approved → Exported/Posted where integration confirms it. Disputed, Returned, Rejected, and Cancelled are controlled branches. The external accounting system may own posting state; an export attempt is not proof of posting.

Outgoing invoice: Draft → Review → Approved for Issue → Issued. Issue requires an authorized billing basis and the correct legal entity/client; tax and numbering rules come from approved configuration or the finance system. Credit/cancellation/amendment paths preserve the original record.

Payment state is derived from reconciled settlement evidence: Unpaid / Partially Paid / Paid, with disputes and credits modeled separately as needed. Approval is not payment. A due date passing is not payment. A user clicking Export is not payment.

## 7. HR workflows

Employee lifecycle uses effective-dated employment and account provisioning. Employment status and login status are separate. Offboarding must include required access revocation and record ownership handover; checklist completion alone does not prove access removal.

Leave: Draft → Submitted → Review → Approved / Returned / Rejected → Cancelled where permitted. Validate type, dates, overlap, balance, policy applicability, and approval scope. Use atomic ledger effects/reservations to prevent concurrent requests exceeding availability. Whether submission reserves balance is an explicit policy decision.

Attendance correction: Submitted → Review → Approved / Rejected. Preserve the original entry and correction history. Attendance cannot be silently turned into overtime pay, billable time, or productivity scores.

Payroll: Open Period → Input Validation → Calculation/Import → Review → Approved → Released/Exported → Reconciled/Locked. Only approved rules or an authoritative external system supply payroll amounts. Freeze reviewed inputs; restrict salary/bank fields; separate preparation and final authorization as policy requires. Releasing an export does not prove that employees were paid.

Onboarding/offboarding cases contain assigned HR, manager, IT, and other authorized tasks with dependencies, deadlines, evidence, and exceptions. Lifecycle automation must respect effective dates and identity-system results.

## 8. QHSE workflows

Finding/nonconformance: Open → Assessed → Action Assigned → Action Implemented → Verification → Closed. Returned verification reopens the action with a reason. Closure requires evidence and the configured verification authority; completing a task is not automatically verified closure.

Incident: Reported → Triaged → Investigating → Actions Assigned → Verification → Closed, with restricted details and approved classifications. Urgent real-world reporting/response obligations remain governed by the organization's procedures; the application records and routes the work.

Project Quality Details shows the same canonical quality records selected from Project Quality. Corporate quality procedures have their own controlled document revisions and effective dates.

## 9. Tool jobs and AI output

Job states: Queued → Running → Succeeded / Failed / Cancelled. Review state is separate: Unreviewed → Accepted / Corrected / Rejected. A successful model response is not an accepted business result.

Multi-Revision retains the source pair and comparison settings. PFD-to-P&ID output includes limitations and engineering review. Data Mining retains source locators and conflicts. Re-running a job creates a new run linked to its predecessors; it never silently overwrites accepted evidence.

## 10. Admin and integration operations

Access grants require scope, effective period where applicable, authorized grantor, and audit evidence. Privilege escalation cannot be achieved by editing one's own profile. Deactivation invalidates access through the established identity/session model.

Integration runs record Queued/Running/Succeeded/Partially Failed/Failed with per-object outcomes. Retries operate on identified failed items and preserve deduplication. Enquiry Operations routing keeps source evidence and an audit trail; its exact authority relative to Sales remains D-08.
