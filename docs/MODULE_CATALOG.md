# Module Catalog and Navigation Contract

Version 0.3 · Consolidated status reviewed 12 November 2026

This is the single page-level catalog and current authenticated sidebar contract. Each catalog page appears once; the same row combines its intended purpose, ownership/behavior, and current sidebar mapping. Page scope and ownership are proposed requirements; sidebar status/path reflects frontend configuration inspected in `src/components/Layout/Sidebar.jsx`, `src/App.jsx`, `src/config/engineeringStructure.config.js`, and `src/config/features.config.js`. A sidebar entry does not certify backend completeness, production enablement, server authorization, or approved business policy.

## Navigation contract

- Authenticated navigation is rendered by `src/components/Layout/Sidebar.jsx`. `src/config/navigation.config.js` describes public navigation, not the authenticated module tree.
- The sidebar order is Executive overview, Dashboard, Approvals, Engineering, Shared tools (labeled CRS), Finance, HR, Sales, Project Control, Procurement, QHSE, and Admin. Role/module grants and feature/capability checks filter entries.
- Paths below are configured sidebar destinations, not catalog IDs. Preserve existing paths and redirects unless an authorized navigation decision changes them.
- “Available” means configured without an additional feature/admin gate for a user with applicable access. “Conditional” means a module grant, feature flag, administrative capability, or deployment setting can hide it. Engineering subsections are available while individual tools vary.
- Route guards vary; frontend filtering does not replace server-side authorization. Current status is source inspection, not interactive or backend verification.
- Sidebar label/count drift is recorded in the affected rows; it is not approval to rename pages. Resolve naming changes through the applicable product decision, including D-14.

## Workspace — 3 pages

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| W.1 | Executive overview | Summarizes portfolio performance and material business exceptions for authorized leaders, with metric freshness and permitted drill-through. | Executive reporting owner; authorized leaders | Portfolio and business exceptions using defined metrics; show freshness and drill-through; do not imply unrestricted payroll or client-data access | Conditional | Executive overview — `/executive` (`executive_dashboard`) |
| W.2 | Dashboard | Provides each authenticated user with role-relevant daily work, assignments, upcoming dates, and exceptions. | Workspace product owner; each authenticated user | Role-relevant daily work, assignments, approaching dates, and exceptions; personal/task focus distinct from executive reporting | Available | Dashboard — `/dashboard` |
| W.3 | Approvals | Collects workflow tasks assigned to the current approver and supports permitted review decisions against the source record revision. | Workflow platform owner; assigned approvers/delegates | A shared inbox over departmental approval assignments; inspect exact revision, approve/return/reject where permitted; source domain owns the record | Available | Approvals — `/approvals` |

## 1. Engineering pages

Engineering uses discipline subsections and tool links rather than seven direct discipline landing links. Tools vary by module access and `enabled` flags. Legend Manager is an additional Engineering subsection; Valve Standards is reached inside Smart Plant 3D.

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 1.1 | Process | Coordinates process discipline deliverables, technical reviews, and project-linked process engineering tools. | Process discipline lead | Process tasks, deliverables, technical reviews, and document references; PFD/P&ID-related work only where in scope | Available, tools vary | Process subsection; PFD & P&ID Checker (`/engineering/process/pid-verification`), HMB Consolidator, Line List, Equipment List. PFD QC and Datasheets are hidden (`enabled: false`). |
| 1.2 | Piping | Coordinates piping discipline deliverables, models, drawings, specifications, reviews, and cross-discipline dependencies. | Piping discipline lead | Assigned piping deliverables, models/drawings, comments, review state, and dependencies on other disciplines | Available, tools vary | Piping subsection; Critical Line List and Valve MTO. Datasheets hidden (`enabled: false`). |
| 1.3 | Instrument | Coordinates instrumentation registers, deliverables, specifications, and project-required technical reviews. | Instrumentation discipline lead | Instrument-related deliverables, registers, specifications, and reviews required by the project | Available, tools vary | Instrument subsection; Instrument Index and IO List. Datasheets hidden (`enabled: false`). |
| 1.4 | Electrical | Coordinates electrical design deliverables, calculations, reviews, and discipline interfaces. | Electrical discipline lead | Electrical design deliverables, calculations, reviews, and coordination references | Available, tools vary | Electrical subsection; SLD and Check List. Datasheets hidden (`enabled: false`). |
| 1.5 | Civil | Coordinates civil and structural deliverables, calculations, relevant inspections, and review evidence. | Civil/structural discipline lead | Civil and structural deliverables, calculations, inspections where relevant, and review evidence | Available | Civil subsection; Datasheets (`/engineering/civil/datasheet`). |
| 1.6 | Mechanicals | Coordinates mechanical equipment/design deliverables, specifications, and technical reviews. | Mechanical discipline lead | Mechanical equipment or design deliverables, specifications, and technical review; display name preserved pending naming decision | Available | Mechanical subsection (sidebar label is “Mechanical”); Datasheets (`/engineering/mechanical/datasheet`). |
| 1.7 | Digitization | Coordinates digitization, model/data deliverables, and validation tasks; exact service boundary remains open. | Digitization lead | Assigned digitization/model/data deliverables and validation tasks; invokes Shared Tools where appropriate; exact service boundary requires confirmation | Available, tools vary | Digitization subsection; Smart Plant 3D. Datasheets omitted by a false config toggle; SPF-NON-TEF is hidden in production. |

## 2. Shared tools pages

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 2.1 | CRS Documents | Manages controlled CRS records, source documents, revisions, review participants, and resolution history; CRS meaning requires confirmation. | Document-control owner; authorized reviewers | Controlled CRS records, source documents, revisions, review participants, and resolution history; confirm the meaning of CRS before defining its schema | Conditional | CRS Documents — `/crs/documents` (`crs_documents`) |
| 2.2 | Multi-Revision | Compares identified document revisions, presents change evidence, and retains review disposition and comparison identity. | Document-control/tool owner | Compare identified document versions, display change evidence, record review disposition, and retain comparison-run identity | Conditional | Multi-Revision — `/crs/multiple-revision` (`crs_documents`) |
| 2.3 | PFD to P&ID | Creates reviewable PFD-to-P&ID conversion proposals with source links, assumptions, gaps, and engineer validation. | Process technical owner + tool owner | Generate reviewable conversion proposals with source links, assumptions, gaps, and engineer validation; output is not automatically an issued design | Conditional | PFD to P&ID — `/pfd/upload` (`pfd_to_pid`) |
| 2.4 | Data Mining | Extracts or searches source-authorized structured evidence with provenance, validation, conflict handling, and controlled export. | Data/tool owner; source-authorized users | Extract/search structured evidence with source locations, schema validation, conflict handling, and controlled export | Conditional | Data Mining — `/data-mining` (`data_mining`) |
| 2.5 | Employee self-service | Lets employees access permitted profile fields, employment documents, and approved self-service forms under field-specific authority. | HR owns employee records; other departments own their request types | Own profile fields, permitted employment documents, and approved service forms; edits use field-specific authority | Conditional | Employee self-service — `/hr/Employeprofile` (`hr_self_service`); under the Shared tools/CRS group. |
| 2.6 | My Requests | Shows a user their cross-department requests and current states by linking to canonical records. | Workspace/workflow owner | A unified list of the user's departmental requests and their current states; links to canonical records rather than storing a second request lifecycle | Available | My Requests — `/my-enquiries`; current description is enquiry-focused. |

## 3. Finances pages

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 3.1 | Finance Dashboard | Presents approved receivable/payable and due-item measures with currency, as-of date, and data freshness. | Finance controller | Approved definitions of receivables, payables, due items, disputed invoices, and reconciled payment positions; currency and as-of date always visible | Conditional | Finance Dashboard — `/finance` (`finance`) |
| 3.2 | Incoming Invoices | Captures supplier invoices, supports deduplication and allocation, and tracks validation, approval, posting, and settlement references. | Accounts payable | Capture supplier invoices, deduplicate, allocate, validate/match where applicable, route approval, track posting and settlement references | Conditional | Incoming Invoices — `/finance/incoming-invoices` (`finance`) |
| 3.3 | Outgoing Invoices | Prepares client invoices from authorized billing bases and tracks review, issue, credits, disputes, and settlement references. | Accounts receivable | Draft client invoices from authorized billing basis, review/issue through an approved process, track credits/disputes and settlement references | Conditional | Outgoing Invoices — `/finance/outgoing-invoices` (`finance`) |

## 4. Human Resources pages

HR navigation is gated by `FEATURE_FLAGS.enableHRModule` (`VITE_ENABLE_HR_MODULE=false` disables it; enabled by default in inspected config), then filtered by module access.

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 4.0 | Dashboard | Shows workforce and HR operational activity, including lifecycle actions, leave, attendance exceptions, and restricted measures. | HR manager | Workforce, pending lifecycle actions, leave, attendance exceptions, and restricted HR measures | Conditional | Dashboard — `/hr` (`hr_management`) |
| 4.1 | Employee | Maintains canonical employee profiles, effective-dated assignments, permitted documents, and employment status history. | HR records owner | Canonical employment profiles, effective-dated department/manager assignments, permitted documents, and status history | Conditional | Employee — `/hr/employees` (`hr_management`) |
| 4.2 | Payroll Management | Manages controlled pay periods, validated inputs, review, approval, release/export, and reconciliation under approved calculation rules. | Payroll officer + authorized verifier | Controlled pay periods, validated inputs, review, approval, release/export, reconciliation; calculation rules must come from approved configuration | Conditional | Payroll Management — `/hr/payroll` (`payroll`) |
| 4.3 | Attendance Management | Manages attendance records, corrections, exceptions, and approvals; attendance is not automatically billable time. | HR/time administrator | Attendance records, corrections, exceptions, and approval; attendance is not automatically a billable timesheet | Conditional | Attendance Management — `/hr/attendance` (`payroll`) |
| 4.4 | Leave Management | Manages leave requests, balances under approved policy, decisions, cancellations, and effective balance changes. | HR policy owner + scoped line managers | Leave requests, balance checks under approved policy, decisions, cancellations, and effective balance changes | Conditional | Leave Management — `/hr/leave` (`payroll`) |
| 4.5 | Onboarding / Offboarding | Coordinates employment-linked onboarding/offboarding checklists, milestones, access tasks, and completion evidence. | HR lifecycle owner | Employment-linked checklists with IT/manager tasks, joiner/leaver milestones, access provisioning/revocation, and completion evidence | Conditional | Onboarding / Offboarding — `/hr/onboarding` (`hr_onboarding`) |

## 5. Sales pages

Sales entries are module-filtered. The sidebar labels Email Intake without the 5.7 numbering and labels Project Handover 5.6; catalog IDs are preserved below.

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 5.0 | Overview | Summarizes pipeline, upcoming decisions, proposal deadlines, and handover exceptions using defined sales rules. | Sales manager | Pipeline, upcoming decisions, proposal deadlines, and handover exceptions using defined stage and forecast rules | Conditional | Overview — `/sales` (`sales`) |
| 5.1 | Opportunity | Tracks opportunity qualification, scope, client, value/currency, stage, risks, dates, and win/loss rationale. | Opportunity owner | Qualification, scope, client, value/currency, stage, risks, expected dates, and reasoned win/loss disposition | Conditional | Opportunity — `/sales/opportunities` (`sales`) |
| 5.2 | Proposal | Controls versioned technical/commercial proposals, costing evidence, internal review, submission approval, and outcomes. | Proposal manager | Versioned technical/commercial submissions, costing evidence if available, internal review, approved submission, and client outcome | Conditional | Proposal — `/sales/proposals` (`sales`) |
| 5.3 | Client | Maintains canonical client organizations and contacts, account ownership, duplicate review, and related records. | Sales/client master-data owner | Canonical client organization, contacts, account ownership, duplicate review, and references to opportunities/projects | Conditional | Client — `/sales/clients` (`sales`) |
| 5.4 | Framework | Tracks framework agreement references, parties, effective dates, commercial constraints, and linked work; exact meaning needs confirmation. | Commercial/framework owner | Versioned agreement references, parties, effective dates, commercial constraints, and linked opportunities/projects; confirm exact framework meaning | Conditional | Framework — `/sales/frameworks` (`sales`) |
| 5.5 | Forecast | Maintains dated opportunity-based forecast snapshots with currency, stage/probability basis, overrides, and rationale; not recognized revenue. | Sales forecasting owner | Dated snapshots of opportunity-based forecasts with currency, stage/probability basis, overrides, and reasons; not recognized revenue | Conditional | Forecast — `/sales/forecasts` (`sales`) |
| 5.6 | Email Intakes | Captures deduplicated inbound messages and attachments with provenance, classification, assignment, and enquiry/opportunity links. | Sales intake owner | Deduplicated intake messages, attachments, provenance, classification, owner assignment, and links to enquiry/opportunity; outbound email requires a separately defined action | Conditional; label/count drift | Sidebar says “Email Intake” and routes to `/sales/email-intake` (`sales_email_intake`); catalog currently numbers it 5.6. |
| 5.7 | Project Handover | Reviews awarded scope, contract references, deliverables, dates, exclusions, commitments, and risks before project acceptance. | Sales prepares; project manager accepts | Review awarded scope, contract references, deliverables, dates, exclusions, commitments, and open risks; acceptance links/creates one project idempotently | Conditional; label/count drift | Sidebar says “Project Handover” and routes to `/sales/project-handovers` (`sales`); sidebar currently labels it 5.6. |

## 6. Project Control pages

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 6.1 | Portfolio | Shows authorized canonical projects, accountable managers, phase/status, baseline-linked progress, milestones, risks, and permitted indicators. | PMO/project controller; scoped PMs | Canonical project portfolio, accountable PM, phase/status, baseline-linked progress, milestones, risks, and permitted financial indicators | Conditional | Portfolio — `/projects` (`project_control`) |
| 6.2 | Plan & Baseline | Develops and governs project scope, WBS, schedule logic, calendars, milestones, baselines, progress, changes, and variance. | Project manager + planner + designated baseline authority | Controlled scope/evidence, WBS, schedule logic, calendars, milestones, approved baseline versions, progress, changes, and variance | Conditional | Plan & Baseline — `/projects?view=plan-baseline` (`planning_package`) |

## 7. Procurement pages

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 7.1 | Dashboard | Summarizes recommendation/order queues, overdue acceptance, supplier exceptions, and approved commitment measures. | Procurement manager | Recommendation/order queues, overdue acceptance, supplier exceptions, and approved commitment measures | Conditional | Dashboard — `/procurement` (`procurement`) |
| 7.2 | Project Links | Connects procurement records to canonical projects and permitted cost/work-package allocations. | Procurement coordinator | Link procurement records to canonical projects and permitted cost/work-package allocations; does not create a duplicate project registry | Conditional | Project Links — `/procurement/projects/reconciliation` (`procurement`) |
| 7.3 | Vendors | Maintains canonical vendor profiles, qualification/status, evidence, duplicate review, and governed restricted-field changes. | Procurement vendor-data owner | Canonical supplier profile, qualification/status, evidence, duplicate review, and approved changes to restricted fields | Conditional | Vendors — `/procurement/vendors` (`procurement_vendors`) |
| 7.4 | Purchase Recommendations | Manages versioned purchase recommendations, justification, lines, project allocation, evidence, review, decision, and conversion references. | Requester + procurement reviewer + delegated approvers | Versioned justification and lines, project allocation, attachments, completeness checks, review, decision, and conversion references | Conditional | Purchase Recommendations — `/procurement/requisitions` (`procurement_requisitions`) |
| 7.5 | Purchase Orders | Manages purchase orders against approved bases, including commercial lines, issue/amendments, balances, and closure. | Buyer + authorized PO approver | Orders against an approved basis, commercial lines, review, controlled issue/amendments, remaining quantities/values, and closure | Conditional | Purchase Orders — `/procurement/orders` (`procurement_orders`) |
| 7.6 | Receipts | Records partial/full goods receipts or service acceptance, rejection/returns/reversals, evidence, and invoice-validation references. | Authorized receiver or service acceptor | Partial/full goods receipts or service acceptance, rejection/returns/reversals, evidence, and references used for invoice validation | Conditional | Receipts — `/procurement/receipts` (`procurement_receipts`) |

## 8. QHSE pages

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 8.1 | Project Quality | Shows project-scoped quality plans, inspections, findings, and due actions. | Project quality lead | Project-scoped quality overview, plans, inspections, findings, and due actions | Conditional | Project Quality — `/qhse/general` (`qhse`) |
| 8.2 | Project Quality Details | Manages selected-project quality records, evidence, owners, verification, and closure. | Project quality lead/assigned action owner | Detail workspace for a selected project's quality records, evidence, owners, verification, and closure; no duplicate project-quality database | Conditional | Project Quality Details — `/qhse/general/detailed` (`qhse_detailed`) |
| 8.3 | Quality Management | Governs quality procedures, audits, nonconformances, corrective actions, and cross-project measures. | Corporate quality owner | Controlled quality procedures, audits, nonconformances, corrective actions, and cross-project quality measures | Conditional | Quality Management — `/qhse/general/quality` (`qhse_quality`) |
| 8.4 | Occupational Health & Safety | Tracks hazards, incidents, observations, investigations, and corrective actions while restricting sensitive information. | HSE owner | Hazards, incidents, observations, assigned actions, investigations, and restricted sensitive information; emergency response is outside this software workflow | Conditional | Occupational Health & Safety — `/qhse/general/health-safety` (`qhse_health_safety`) |

## 9. Admin pages

Admin group requires recognized administrative capability. Pages 9.7 and 9.8 are additionally shown only when `canManageReplica(user)` or `canManageAIKeys(user)` permits them.

| Catalog ID | Page | Description | Owner / audience | Main behavior and boundary | Sidebar availability | Sidebar label / destination |
|---|---|---|---|---|---|---|
| 9.1 | Dashboard | Shows service/integration health, failed jobs, provisioning exceptions, and operational actions without granting unrelated financial/HR access. | Platform operations administrator | Service/integration health, failed jobs, provisioning exceptions, and operational actions; no automatic financial/HR access | Conditional (admin) | Dashboard — `/admin/dashboard` (`admin_dashboard`) |
| 9.2 | Users | Manages account lifecycle, employee linkage, invitations/provisioning, deactivation, sessions, and audit history. | Identity administrator | Account lifecycle, employee linkage where applicable, invitations/provisioning, deactivation, sessions, and audit history | Conditional (admin) | Users — `/admin/users` (`user_mgmt`) |
| 9.3 | Roles & permissions | Manages versioned roles, scoped grants, permissions, effective dates, delegation, and privilege-change review. | Access-control administrator | Versioned role definitions, scoped assignments, permissions, effective dates, delegation, and privilege-change review | Conditional (admin) | Roles & permissions — `/admin/roles` (`role_access_mgmt`) |
| 9.4 | Wrench Integration | Configures approved Wrench connections and mappings, monitors sync/reconciliation, and supports controlled retries. | Integration owner | Approved connection configuration, external-ID mapping, synchronization status, reconciliation, and controlled retries; integration contract is unconfirmed | Conditional (admin) | Wrench Integration — `/admin/wrench` (`wrench_integration`) |
| 9.5 | AI Champion | Reports AI execution, usage/cost estimates, failures, evaluations, adoption, and accepted outcomes; page views are separate. | AI platform/product owner | Actual AI execution counts, model/provider usage, known/estimated costs, failures, evaluation, adoption, and accepted outcomes; page views tracked separately | Conditional (admin) | AI Champion — `/admin/ai-champion` (`ai_champion`) |
| 9.6 | Enquiry Operations | Triages and routes shared enquiries and operational exceptions; ownership boundary with Sales remains to be confirmed. | Proposed intake operations owner; confirm in D-08 | Shared enquiry triage/routing and operational exceptions; proposed separation from Sales' opportunity qualification; final responsibility boundary must be resolved | Conditional (admin) | Enquiry Operations — `/admin/enquiries` (`enquiry_management`) |
| 9.7 | File Server Replica | Configures authorized file-server connections and project-folder replication, and monitors synchronization status. | File replication / platform operations owner | Manage approved server connections and project-folder synchronization with access checks, status visibility, and controlled recovery actions. | Conditional (admin capability) | File Server Replica — `/admin/file-server-replica`; rendered when `canManageReplica(user)` allows it. |
| 9.8 | AI API Keys | Manages central AI provider credentials and connection tests under restricted administrator access. | AI platform security owner | Store and rotate provider credentials securely, test configured connections, and restrict secret visibility and operations to authorized administrators. | Conditional (admin capability) | AI API Keys — `/admin/ai-api-keys`; rendered when `canManageAIKeys(user)` allows it. |

## Module notes

- **Shared tools:** CRS meaning remains unconfirmed. Employee self-service is listed under the Shared tools/CRS sidebar group. My Requests currently has an enquiry-focused description in the sidebar. The intended six pages are retained as catalog scope.
- **Finance:** Payment execution, statutory tax logic, accounting posting authority, and accounting system of record remain unresolved. Invoice capture alone must not mark payment complete or recognize revenue.
- **Project Control:** Global navigation exposes Portfolio and Plan & Baseline. Project-level areas are contextual, per `project-control-product-model.md`. Project hierarchy is Project → Phase → Work Package → Task → Subtask; schedule activities must map to this hierarchy.
- **QHSE:** Environmental and Energy entries are disabled and absent from the sidebar. QHSE configuration contains other destinations (Dashboard, Technical QHSE, Project QHSE) not represented as catalog sidebar leaves.
- **Admin extras:** Other operational routes exist outside the catalog, including access requests, AI adoption, reports, and replica support.


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
