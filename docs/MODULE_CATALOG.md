# Module Catalog and Navigation Contract

Version 0.2 · Status reviewed 12 November 2026 · User-supplied labels preserved · Ownership and behavior proposed

## Current implementation status (frontend inspection, 12 November 2026)

This catalog records intended scope. The status below describes frontend navigation/routes inspected in `src/components/Layout/Sidebar.jsx`, `src/App.jsx`, and `src/config/features.config.js`; it does not certify backend completeness, production enablement, authorization correctness, or business-policy approval. “Routed” means a visible destination has a route/component; validate behavior and server enforcement separately. Where the current UI combines or renames catalog pages, retain the catalog identifiers as the intended inventory and record the UI mapping here.

| Catalog area | Current status | Evidence / mapping |
|---|---|---|
| Workspace (3) | Routed | Executive overview `/executive`, Dashboard `/dashboard`, Approvals `/approvals`; profile, notifications, and My Requests are additional workspace destinations. |
| Engineering (7) | Partially routed; no one-to-one leaf page mapping | Sidebar builds disciplines dynamically from `engineeringStructure.config.js`; `App.jsx` contains many specialized engineering routes. The catalog’s seven discipline pages are not each represented by a single catalog-level landing route. |
| Shared tools (6) | Partially routed | CRS Documents, Multi-Revision, PFD to P&ID, Data Mining, Employee self-service, and My Requests have sidebar entries/routes. CRS meaning and self-service ownership remain policy questions. |
| Finances (3) | Routed, scope differs | Finance Dashboard `/finance`, Incoming Invoices, Outgoing Invoices are in navigation. Finance Dashboard is an invoice hub; no assertion of approved accounting/payment behavior. |
| Human Resources (6) | Routed with extra page and feature gate | HR module is enabled by default and can be disabled by `VITE_ENABLE_HR_MODULE`; disabled routes redirect to Dashboard. Sidebar has Dashboard, Employee, Payroll, Attendance, Leave, Onboarding/Offboarding, plus Talent Acquisition. Employee self-service is surfaced under Shared tools. |
| Sales (8) | Partially routed; labels/count drift | Sidebar has Overview, Opportunity, Proposal, Client, Framework, Forecast, Email Intake, Project Handover. Route definitions include `/sales`, `/sales/email-intake`, proposal preview, and `/sales/:area`; some areas therefore share a parameterized route. The sidebar numbering currently omits 5.7 for Email Intake and assigns 5.6 to Project Handover. |
| Project Control (2) | Routed as consolidated destinations | Portfolio `/projects`; Plan & Baseline `/projects?view=plan-baseline`. This is a two-destination global navigation model; project-level areas are contextual, per `project-control-product-model.md`. |
| Procurement (6) | Routed | Dashboard, Project Links, Vendors, Purchase Recommendations, Purchase Orders, and Receipts appear in sidebar and route definitions. |
| QHSE (4) | Routed | Project Quality, Project Quality Details, Quality Management, Occupational Health & Safety appear in sidebar; routes are rooted at `/qhse`. |
| Admin (6) | Routed with extra operational pages | Dashboard, Users, Roles & permissions, Wrench Integration, AI Champion, Enquiry Operations appear in sidebar/routes. Additional access requests, AI adoption, reports, replica and API key pages are present. |

Status summary: all nine groups have at least one represented destination; this does not mean all 51 leaf-page behaviors are complete. Detailed page status is not yet verified against API/backend implementation or end-to-end behavior. Current navigation/API access is module-aware in places, but the frontend route guards are not a substitute for server authorization.

## Navigation contract (current frontend)

- Authenticated navigation is rendered by `src/components/Layout/Sidebar.jsx`; `src/config/navigation.config.js` describes public navigation and is not the source of truth for the authenticated module tree.
- The authenticated tree currently exposes Executive overview, Dashboard, Approvals, then Engineering, Shared tools (labeled CRS in code), Finance, HR, Sales, Project Control, Procurement, QHSE, and Admin. The present visible order differs from the catalog’s numbered sequence because Finance and HR precede Sales/Project Control/Procurement/QHSE/Admin.
- Module/role checks and enabled flags filter sidebar items. HR additionally has a global `enableHRModule` flag. Some routes use `ModuleProtectedRoute`, some use `ProtectedRoute`, and some use inline module/feature conditions; inspect each route before changing access behavior.
- Route paths are implementation details, not catalog IDs. Preserve existing paths and redirects unless a separately authorized navigation decision changes them.
- Catalog-to-sidebar label differences, extra destinations, and consolidated destinations are status facts above, not approval to rename or remove pages. Resolve naming/numbering drift through the applicable product decision (including D-14) before altering the established labels.
- Responsive sidebar/drawer, active-item selection, and route-level loading/error/access states are implemented in components, but this document’s source inspection did not verify them interactively.

There are **51 leaf pages**: three workspace pages and 48 pages within nine module groups. Numbers below are the supplied navigation identifiers, not database IDs or route requirements. Preserve them during context establishment. Any naming change is a separate UX decision.

Every page needs: a purpose, accountable domain, authorized audience, primary records/actions, scope, filters, loading/empty/error/denied states, and traceable history for protected changes.

## Workspace — 3 pages

| Page | Accountable owner / audience | Main behavior and boundaries |
|---|---|---|
| Executive overview | Executive reporting owner; authorized leaders | Portfolio and business exceptions using defined metrics; show freshness and drill-through; do not imply unrestricted payroll or client-data access |
| Dashboard | Workspace product owner; each authenticated user | Role-relevant daily work, assignments, approaching dates, and exceptions; personal/task focus distinct from executive reporting |
| Approvals | Workflow platform owner; assigned approvers/delegates | A shared inbox over departmental approval assignments; inspect exact revision, approve/return/reject where permitted; source domain owns the record |

## 1. Engineering — 7 pages

All disciplines share project identity, the deliverable register, document versions, review assignments, and project scope. Discipline-specific fields should extend the shared model without creating separate employee/project/document masters. The technical artifacts listed below are illustrative and become scope only when project evidence requires them.

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 1.1 | Process | Process discipline lead | Process tasks, deliverables, technical reviews, and document references; PFD/P&ID-related work only where in scope |
| 1.2 | Piping | Piping discipline lead | Assigned piping deliverables, models/drawings, comments, review state, and dependencies on other disciplines |
| 1.3 | Instrument | Instrumentation discipline lead | Instrument-related deliverables, registers, specifications, and reviews required by the project |
| 1.4 | Electrical | Electrical discipline lead | Electrical design deliverables, calculations, reviews, and coordination references |
| 1.5 | Civil | Civil/structural discipline lead | Civil and structural deliverables, calculations, inspections where relevant, and review evidence |
| 1.6 | Mechanicals | Mechanical discipline lead | Mechanical equipment or design deliverables, specifications, and technical review; display name preserved pending naming decision |
| 1.7 | Digitization | Digitization lead | Assigned digitization/model/data deliverables and validation tasks; invokes Shared Tools where appropriate; exact service boundary requires confirmation |

## 2. Shared tools — 6 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 2.1 | CRS Documents | Document-control owner; authorized reviewers | Controlled CRS records, source documents, revisions, review participants, and resolution history; confirm the meaning of CRS before defining its schema |
| 2.2 | Multi-Revision | Document-control/tool owner | Compare identified document versions, display change evidence, record review disposition, and retain comparison-run identity |
| 2.3 | PFD to P&ID | Process technical owner + tool owner | Generate reviewable conversion proposals with source links, assumptions, gaps, and engineer validation; output is not automatically an issued design |
| 2.4 | Data Mining | Data/tool owner; source-authorized users | Extract/search structured evidence with source locations, schema validation, conflict handling, and controlled export |
| 2.5 | Employee self-service | HR owns employee records; other departments own their request types | Own profile fields, permitted employment documents, and approved service forms; edits use field-specific authority |
| 2.6 | My Requests | Workspace/workflow owner | A unified list of the user's departmental requests and their current states; links to canonical records rather than storing a second request lifecycle |

## 3. Finances — 3 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 3.1 | Finance Dashboard | Finance controller | Approved definitions of receivables, payables, due items, disputed invoices, and reconciled payment positions; currency and as-of date always visible |
| 3.2 | Incoming Invoices | Accounts payable | Capture supplier invoices, deduplicate, allocate, validate/match where applicable, route approval, track posting and settlement references |
| 3.3 | Outgoing Invoices | Accounts receivable | Draft client invoices from authorized billing basis, review/issue through an approved process, track credits/disputes and settlement references |

Payment execution, statutory tax logic, accounting posting authority, and the accounting system of record are unresolved decisions. Invoice capture alone must not mark a payment complete or recognize revenue.

## 4. Human Resources — 6 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 4.0 | Dashboard | HR manager | Workforce, pending lifecycle actions, leave, attendance exceptions, and restricted HR measures |
| 4.1 | Employee | HR records owner | Canonical employment profiles, effective-dated department/manager assignments, permitted documents, and status history |
| 4.2 | Payroll Management | Payroll officer + authorized verifier | Controlled pay periods, validated inputs, review, approval, release/export, reconciliation; calculation rules must come from approved configuration |
| 4.3 | Attendance Management | HR/time administrator | Attendance records, corrections, exceptions, and approval; attendance is not automatically a billable timesheet |
| 4.4 | Leave Management | HR policy owner + scoped line managers | Leave requests, balance checks under approved policy, decisions, cancellations, and effective balance changes |
| 4.5 | Onboarding / Offboarding | HR lifecycle owner | Employment-linked checklists with IT/manager tasks, joiner/leaver milestones, access provisioning/revocation, and completion evidence |

## 5. Sales — 8 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 5.0 | Overview | Sales manager | Pipeline, upcoming decisions, proposal deadlines, and handover exceptions using defined stage and forecast rules |
| 5.1 | Opportunity | Opportunity owner | Qualification, scope, client, value/currency, stage, risks, expected dates, and reasoned win/loss disposition |
| 5.2 | Proposal | Proposal manager | Versioned technical/commercial submissions, costing evidence if available, internal review, approved submission, and client outcome |
| 5.3 | Client | Sales/client master-data owner | Canonical client organization, contacts, account ownership, duplicate review, and references to opportunities/projects |
| 5.4 | Framework | Commercial/framework owner | Versioned agreement references, parties, effective dates, commercial constraints, and linked opportunities/projects; confirm exact framework meaning |
| 5.5 | Forecast | Sales forecasting owner | Dated snapshots of opportunity-based forecasts with currency, stage/probability basis, overrides, and reasons; not recognized revenue |
| 5.6 | Email Intakes | Sales intake owner | Deduplicated intake messages, attachments, provenance, classification, owner assignment, and links to enquiry/opportunity; outbound email requires a separately defined action |
| 5.7 | Project Handover | Sales prepares; project manager accepts | Review awarded scope, contract references, deliverables, dates, exclusions, commitments, and open risks; acceptance links/creates one project idempotently |

## 6. Project Control — 2 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 6.1 | Portfolio | PMO/project controller; scoped PMs | Canonical project portfolio, accountable PM, phase/status, baseline-linked progress, milestones, risks, and permitted financial indicators |
| 6.2 | Plan & Baseline | Project manager + planner + designated baseline authority | Controlled scope/evidence, WBS, schedule logic, calendars, milestones, approved baseline versions, progress, changes, and variance |

The project hierarchy is Project → Phase → Work Package → Task → Subtask, with phase/project milestones and project-owned deliverables linked to relevant work. A schedule's activity model must explicitly map to this hierarchy.

## 7. Procurement — 6 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 7.1 | Dashboard | Procurement manager | Recommendation/order queues, overdue acceptance, supplier exceptions, and approved commitment measures |
| 7.2 | Project Links | Procurement coordinator | Link procurement records to canonical projects and permitted cost/work-package allocations; does not create a duplicate project registry |
| 7.3 | Vendors | Procurement vendor-data owner | Canonical supplier profile, qualification/status, evidence, duplicate review, and approved changes to restricted fields |
| 7.4 | Purchase Recommendations | Requester + procurement reviewer + delegated approvers | Versioned justification and lines, project allocation, attachments, completeness checks, review, decision, and conversion references |
| 7.5 | Purchase Orders | Buyer + authorized PO approver | Orders against an approved basis, commercial lines, review, controlled issue/amendments, remaining quantities/values, and closure |
| 7.6 | Receipts | Authorized receiver or service acceptor | Partial/full goods receipts or service acceptance, rejection/returns/reversals, evidence, and references used for invoice validation |

## 8. QHSE — 4 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 8.1 | Project Quality | Project quality lead | Project-scoped quality overview, plans, inspections, findings, and due actions |
| 8.2 | Project Quality Details | Project quality lead/assigned action owner | Detail workspace for a selected project's quality records, evidence, owners, verification, and closure; no duplicate project-quality database |
| 8.3 | Quality Management | Corporate quality owner | Controlled quality procedures, audits, nonconformances, corrective actions, and cross-project quality measures |
| 8.4 | Occupational Health & Safety | HSE owner | Hazards, incidents, observations, assigned actions, investigations, and restricted sensitive information; emergency response is outside this software workflow |

## 9. Admin — 6 pages

| ID | Page | Owner | Main behavior and boundary |
|---|---|---|---|
| 9.1 | Dashboard | Platform operations administrator | Service/integration health, failed jobs, provisioning exceptions, and operational actions; no automatic financial/HR access |
| 9.2 | Users | Identity administrator | Account lifecycle, employee linkage where applicable, invitations/provisioning, deactivation, sessions, and audit history |
| 9.3 | Roles & permissions | Access-control administrator | Versioned role definitions, scoped assignments, permissions, effective dates, delegation, and privilege-change review |
| 9.4 | Wrench Integration | Integration owner | Approved connection configuration, external-ID mapping, synchronization status, reconciliation, and controlled retries; integration contract is unconfirmed |
| 9.5 | AI Champion | AI platform/product owner | Actual AI execution counts, model/provider usage, known/estimated costs, failures, evaluation, adoption, and accepted outcomes; page views tracked separately |
| 9.6 | Enquiry Operations | Proposed intake operations owner; confirm in D-08 | Shared enquiry triage/routing and operational exceptions; proposed separation from Sales' opportunity qualification; final responsibility boundary must be resolved |

## Canonical ownership summary

| Record | Proposed owner | Other consumers |
|---|---|---|
| User identity and role grants | Admin | Every module |
| Employment record | HR | Self-service, project assignments, approvals, resource views |
| Client and opportunity | Sales | Projects, outgoing invoices, proposals |
| Project / approved baseline | Project Control | Engineering, Procurement, Finance, QHSE, Sales |
| Vendor / recommendation / PO / receipt | Procurement | Finance, projects, approvers |
| Invoice and settlement reference | Finance, subject to ERP boundary | Projects, Procurement, executive reporting |
| Technical deliverable | Engineering within project governance | Project Control, document tools, QHSE |
| Document version and source locator | Shared document-control service | All authorized domains |
| Quality/safety record | QHSE | Project teams and permitted managers |
| Approval assignment and decision envelope | Shared workflow service | Source domain remains owner of the business transition |
| AI job/run and usage event | Shared AI service | Tool UIs, AI Champion, source-authorized reviewers |

Ownership means controlled write responsibility and accountability. It does not mean all records owned by a domain are visible to everyone in that department.
