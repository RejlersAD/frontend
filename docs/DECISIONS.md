# Decision Register

Version 0.1 · Draft for adoption

## Status meanings

- **Confirmed input:** explicitly supplied in this conversation.
- **Proposed:** a recommendation in this pack, available for review.
- **Open:** evidence or a business decision is missing.
- **Adopted:** use only after the responsible person records the actual decision, date, and basis. Nothing below is labeled adopted yet.

## Confirmed inputs

| ID | Input | Source |
|---|---|---|
| C-01 | Nine module groups and 51 leaf pages | Current user module inventory |
| C-02 | Engineering consultancy context for Rejlers; RADAI as working project name | Supplied project conversation context |
| C-03 | Clear professional enterprise UI; efficiency, utility, consistency, and error reduction | Supplied project conversation context |
| C-04 | Project/Phase/Work Package/Task/Subtask structure, milestones, and deliverables | Supplied project conversation context |
| C-05 | Draft → Planned → Ready → In Progress → Review → Approved → Completed as a starting work flow | Supplied project conversation context; applicability still requires mapping |

Prior context is a design input, not evidence that a production feature or company policy already exists.

## Open decisions

| ID | Decision needed | Proposed owner | Why it matters / safe interim behavior |
|---|---|---|---|
| D-01 | Existing repository, stack, schema, API style, environments, and implemented features | Technical lead | Inspect first; preserve working systems; do not invent setup commands or deploy topology |
| D-02 | Organization/legal entities, project boundaries, tenancy, and cross-entity access | Product owner + security/data owner | Use explicit access scope; no assumption of unrestricted global data or multi-customer SaaS |
| D-03 | Production roles, scoped grants, privileged access, identity provider, and delegation | Access-control owner | Deny undefined sensitive access; role matrix is a proposal |
| D-04 | Approval authorities, thresholds, currency conversion, route types/quorum, substitutes, self-approval exceptions | Finance + Procurement + HR + PMO + business authorities | Unresolved route blocks submission/approval, not draft work; no hardcoded thresholds |
| D-05 | System of record and writable-field boundaries for HR, finance/accounting, Wrench, and project data | Domain and integration owners | Capture external mappings; do not write to an external system on guessed authority |
| D-06 | CRS meaning, record structure, review codes, and closure rules | Engineering/document control | Do not assume a comment-resolution schema until confirmed |
| D-07 | Wrench interface, authentication, environments, supported objects/actions, event/polling behavior | Wrench integration owner | Build only from the authorized contract; configuration UI can remain disabled/unconnected |
| D-08 | Enquiry Operations ownership and boundary with Email Intakes/Opportunity; Digitization vs Shared Tools | Product owner + Sales + Engineering | Proposed shared triage and reusable tools; avoid duplicate enquiry records or overlapping writable workflows |
| D-09 | Leave, attendance, payroll, employment lifecycle policies and payroll engine boundary | HR/payroll owner | No invented entitlements, overtime, salary formulas, or payment completion |
| D-10 | Time/effort, capacity, project cost, and revenue sources; progress method and financial metric definitions | PMO + Finance + HR | Attendance is not billable time; unavailable margin/utilization remains unavailable |
| D-11 | Data classification, AI providers/data eligibility, retention, export controls, and sensitive logging | Data/security owner | Restrict sensitive content; no guessed retention periods or provider approval |
| D-12 | Expected volumes, performance budgets, recovery objectives, monitoring and support | Operations + technical lead | Measure representative workloads; avoid invented SLAs |
| D-13 | Work calendars, timezone rules, baseline authority, dependency semantics, approved assumptions | PMO/planning authority | Keep generated schedules provisional until required inputs and decisions are accepted |
| D-14 | Existing design tokens, fonts, branding, density preferences, naming normalization | UX/product owner | Proposed tokens; preserve supplied navigation and existing unrelated UI |
| D-15 | First complete feature, priority, migration scope, adoption owners, success measures | Product owner + affected department | Suggested recommendation workflow only if dependencies exist; do not launch a broad rewrite |
| D-16 | Invoice matching/tolerances, non-PO expenses, service acceptance, numbering, tax/credit policy, financial posting/payment scope | Finance + Procurement | Capture/validate drafts; financial issue/post/pay effects require approved rules |
| D-17 | Framework meaning, commercial approval/submission, sales stage probabilities, handover acceptance checklist | Sales/commercial + PMO | Keep forecast basis explicit and client communications as distinct authorized actions |

## Proposed architecture/design decisions

| ID | Proposal | Adoption condition |
|---|---|---|
| P-01 | Preserve existing architecture; use explicit modules if a new foundation is needed | D-01 inspection and technical decision |
| P-02 | HR owns employees; Sales owns clients; Project Control owns projects; Procurement owns vendors | Confirm any external master-data authority in D-05 |
| P-03 | Shared approval service, domain-owned transitions, immutable submitted revisions | D-04 policies and existing implementation mapping |
| P-04 | Shared document/evidence model and controlled AI review | D-06 and D-11 plus technical feasibility |
| P-05 | Consistent enterprise page patterns and proposed design tokens | D-14 review against actual shared components |
| P-06 | Versioned planning basis, baselines, and explicit fact/assumption/calculation separation | D-13 and source-data inspection |

## Decision record template

```text
Decision ID and title:
Status:
Accountable owner:
Date:
Question and affected feature:
Evidence / approved policy / repository references:
Options considered:
Decision and reason:
Scope and effective date:
Compatibility and migration impact:
Required controls / verification:
Documents and contracts to update:
Supersedes / superseded by:
```

Resolve decisions just in time for the affected feature. An open payroll policy should not stop an unrelated read-only engineering list improvement. An open approval authority must stop that approval from becoming active with guessed rules.
