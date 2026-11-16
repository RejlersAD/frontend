# Project Brief

Version 0.1 · Draft for adoption

## Purpose

RADAI is a unified operational platform for Rejlers' engineering consultancy work. Its intended purpose is to replace fragmented manual handoffs with controlled digital workflows connecting Engineering, Shared Tools, Finances, HR, Sales, Project Control, Procurement, QHSE, and Administration.

The product should help a person answer: **What requires my attention, what can I do next, and what evidence supports this record?**

## Users and decisions

| User group | Primary need |
|---|---|
| Executive leadership | Understand performance, risks, commitments, and decisions requiring attention |
| Department managers | See team workload, exceptions, approvals, and discipline delivery |
| Engineers and discipline leads | Work on assigned technical deliverables, reviews, comments, and revisions |
| Project managers and controllers | Maintain scope, planning basis, baselines, milestones, progress, and exceptions |
| Sales teams | Manage enquiries, opportunities, proposals, clients, frameworks, forecasts, and handovers |
| Procurement teams | Manage vendors, purchase recommendations, orders, and acceptance evidence |
| Finance teams | Control incoming/outgoing invoices, allocations, approval, and reconciled payment status |
| HR and payroll teams | Maintain employment records, attendance, leave, lifecycle changes, and payroll processes |
| QHSE teams | Manage quality plans, findings, corrective actions, safety records, and closure evidence |
| Employees | Access their own services, requests, decisions, and permitted personal records |
| Administrators and AI champions | Manage identities, permissions, integrations, usage, configuration, and operational exceptions |

These are functional personas, not a final list of production roles. A person can hold multiple roles with different scopes.

## Product outcomes

- Shorter request and approval turnaround, measured from recorded events.
- Fewer incomplete submissions and repeated manual data entries.
- Clear ownership of every actionable record and handoff.
- Traceable engineering revisions, planning assumptions, approvals, and changes.
- Reliable departmental and executive reporting from operational records.
- Consistent enterprise UI that supports efficient daily work.

Baseline values and target improvements must be measured and agreed. This pack supplies no invented performance targets.

## Boundaries

Included: the supplied navigation inventory, shared identity and access, canonical records, document control, workflow, audit, reporting definitions, and controlled integrations.

Not presumed: a complete ERP, statutory payroll engine, general ledger, bank payment execution, autonomous engineering certification, automatic external correspondence, replacement of Wrench, or a multi-customer SaaS tenancy model. Each requires a separate decision or scoped requirement.

The platform may hold invoice and payroll workflow records while another approved system remains authoritative for accounting or payment execution. Decide this explicitly per record type.

## Operating principles

1. One owner per business record; many modules may reference it.
2. Every approved or posted artifact has a stable revision and history.
3. Permissions depend on role and business scope, including sensitive fields.
4. Missing data appears as missing, never as a fabricated value or misleading zero.
5. Automation acts within explicit rules and records its effects.
6. AI output includes provenance and review state; model confidence is not approval.
7. Dashboards expose action and evidence, with defined period, currency, and freshness.
8. Navigation labels do not determine storage ownership or security boundaries.

## What is known and unknown

Known: all supplied module labels; the engineering consultancy context; preference for clear professional enterprise UI; a project structure involving phases, work packages, tasks, subtasks, milestones, and deliverables.

Unknown: actual stack and deployment, current schema, organization/legal-entity boundaries, production role names, approval authority, policy calculations, systems of record, integration permissions, and operational targets. Track these in `DECISIONS.md`; inspect the repository before adopting implementation details.
