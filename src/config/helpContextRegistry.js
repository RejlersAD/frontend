/**
 * Contextual Help registry.
 *
 * Route rules are intentionally centralized and ordered from most specific to
 * least specific. Help content must be scoped to the resolved module: the
 * drawer never falls back to articles belonging to another business area.
 */

const article = (id, title, summary, sections) => ({ id, title, summary, sections })

const context = ({ id, moduleCode, moduleLabel, featureLabel, summary, articles, landingSections = [] }) => ({
  id,
  moduleCode,
  moduleLabel,
  featureLabel,
  title: `${featureLabel} Help`,
  summary,
  articles,
  landingSections,
})

const workspaceContext = (id, moduleCode, moduleLabel, summary, guidance) => context({
  id,
  moduleCode,
  moduleLabel,
  featureLabel: moduleLabel,
  summary,
  articles: [article(`${id}.getting-started`, `Using ${moduleLabel}`, guidance, [
    { heading: 'Before you begin', body: guidance },
    { heading: 'Controlled workflow', steps: ['Confirm the correct project or business record.', 'Provide the latest authorised source information.', 'Review generated or calculated results.', 'Complete the configured approval and issue process.'] },
  ])],
})

const PROJECT_CONTROL_AREA_GUIDE = {
  heading: 'Project Control areas',
  table: {
    columns: ['Area', 'What it is', 'How it works'],
    rows: [
      ['Overview', 'Executive view of one selected project.', 'Combines project facts, progress, milestones, control budget, actual cost, forecast finish, CPI/SPI, risks, recent activity, and data-readiness warnings. It summarizes approved data; it should not be the primary data-entry screen.'],
      ['Portfolio Exceptions', 'Management view across every project the user can access.', 'Detects missing controls, overdue periods, reconciliation problems, unmapped actuals, stale snapshots, CPI/SPI breaches, forecast overruns, and overdue completion dates. Projects are ranked by severity, with an accountable owner and a link to the screen where the issue can be resolved.'],
      ['Plan & Baseline', 'Workspace for building the approved delivery plan.', 'Follows five stages: Setup → Collect Inputs → Build Plan → Validate & Approve → Publish Baseline. Users upload source documents, confirm requirements, build WBS, activities, logic, EDDR, and resources, validate the schedule, and publish an immutable baseline. Outputs can include Excel, CSV, Primavera XER, PowerPoint, narrative, and JSON.'],
      ['Controls & Periods', 'Governance layer controlling ownership, progress entry, actual hours, and reporting cut-offs.', 'Creates Control Accounts against approved WBS scope, assigns managers and earned-value methods, opens reporting periods, captures approved hours, reconciles Finance actuals, and locks each period into an immutable reporting snapshot.'],
      ['Cost & Commercial', 'High-level commercial position shared across Project Control, Procurement, and Finance.', 'Displays contract value, approved budget, PO commitments, verified actuals, supplier payments, unpaid approved costs, WBS commercial position, and an immutable commercial audit trail. It answers: “Where do we stand commercially?”'],
      ['Cost Detail', 'Operational cost-control workspace.', 'Creates WBS nodes and budget allocations, approves budgets, synchronizes Finance transactions, displays posted ledger entries, calculates remaining budget and utilisation, and shows forecast indicators such as EAC, CPI, and SPI. It answers: “What transactions and allocations produced the commercial position?”'],
      ['Estimates', 'Controlled history of expected project cost.', 'Imports BOQ Excel files as estimate versions such as Internal Estimate, Tender, Awarded, Baseline, or Revised. Draft versions can be approved or superseded. Variance is compared by WBS or discipline so users can see movement from estimate to award or current forecast.'],
      ['Documents', 'Project evidence repository.', 'Uploads and classifies BOQs, tenders, contracts, change orders, drawings, reports, minutes, specifications, and other files. Files are privately stored, listed with processing status and ownership, and accessed through secure download links.'],
    ],
  },
}

const PROJECT_CONTROL_CONTEXTS = {
  general: context({
    id: 'project-control.general', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Project Control',
    summary: 'Plan, measure, forecast, and govern authorised project delivery.',
    landingSections: [PROJECT_CONTROL_AREA_GUIDE],
    articles: [article('project-control-workflow', 'Project Control workflow', 'Understand how the controlled workspaces connect.', [
      { heading: 'Typical lifecycle', steps: ['Establish project scope and source documents.', 'Prepare estimates and the delivery plan.', 'Approve schedule and cost baselines.', 'Collect period progress and actuals.', 'Reconcile and lock the reporting period.', 'Review performance and resolve portfolio exceptions.'] },
    ])],
  }),
  'project-dashboard': context({
    id: 'project-control.overview', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Overview',
    summary: 'Understand the selected project’s schedule, cost, progress, exceptions, and data readiness.',
    landingSections: [PROJECT_CONTROL_AREA_GUIDE],
    articles: [
      article('overview-purpose', 'Understanding the project overview', 'How the project summary is assembled.', [
        { heading: 'What it shows', body: 'The overview combines approved project facts, milestones, progress, cost, forecast, and readiness indicators. It is a decision screen rather than the primary data-entry workspace.' },
        { heading: 'Where to make corrections', body: 'Use the action links on warnings and readiness items to open the responsible Project Control workspace.' },
      ]),
      article('overview-indicators', 'Reading CPI, SPI, and progress', 'Interpret the main performance indicators.', [
        { heading: 'CPI and SPI', body: 'Values below 1.00 indicate performance below the approved cost or schedule plan. These indicators should come from the latest governed reporting snapshot.' },
        { heading: 'Data date', body: 'The data date is the reporting cut-off used for progress, actuals, and forecast calculations.' },
      ]),
    ],
  }),
  'portfolio-exceptions': context({
    id: 'project-control.portfolio-exceptions', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Portfolio Exceptions',
    summary: 'Prioritize governed exceptions across the projects you are authorised to access.',
    landingSections: [{
      heading: 'Portfolio Exceptions',
      table: {
        columns: PROJECT_CONTROL_AREA_GUIDE.table.columns,
        rows: [PROJECT_CONTROL_AREA_GUIDE.table.rows[1]],
      },
    }],
    articles: [
      article('exceptions-priority', 'How projects are prioritised', 'Understand exception ranking and severity.', [
        { heading: 'Ranking', body: 'Projects are ranked by their highest active exception. Critical issues require immediate action; high issues should be handled in the current reporting cycle.' },
        { heading: 'Accountability', body: 'Each exception identifies an accountable owner and the target workspace where it can be resolved.' },
      ]),
      article('exceptions-resolve', 'Resolving an exception', 'Move from the portfolio alert to corrective action.', [
        { heading: 'Procedure', steps: ['Expand the project exception row.', 'Review the exception detail and accountable owner.', 'Choose Open action or Resolve top issue.', 'Correct the source data in the target workspace.', 'Refresh the dashboard to confirm clearance.'] },
      ]),
    ],
  }),
  'plan-baseline': context({
    id: 'project-control.plan-baseline', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Plan & Baseline',
    summary: 'Prepare, validate, approve, and publish the controlled project delivery plan.',
    articles: [
      article('plan-workflow', 'Plan and baseline workflow', 'Follow the five controlled planning stages.', [
        { heading: 'Workflow', steps: ['Setup: create the planning record and upload sources.', 'Collect Inputs: confirm extracted requirements and assumptions.', 'Build Plan: develop WBS, activities, logic, deliverables, and resources.', 'Validate & Approve: resolve quality and scheduling exceptions.', 'Publish Baseline: approve and release controlled outputs.'] },
        { heading: 'Baseline rule', body: 'An approved baseline is an immutable reference. Later corrections must create a controlled revision instead of overwriting the approved plan.' },
      ]),
      article('plan-inputs', 'Preparing trustworthy inputs', 'What to review before generating a plan.', [
        { heading: 'Recommended sources', body: 'Provide the scope of work and, where available, WBS, MDR or EDDR, schedule requirements, milestones, calendars, and resource assumptions.' },
        { heading: 'Approval gate', body: 'Review and approve the Schedule Basis and generation assumptions before producing the controlled schedule.' },
      ]),
      article('plan-outputs', 'Planning outputs and exports', 'Understand the controlled deliverables.', [
        { heading: 'Available outputs', body: 'The workspace can produce WBS, activities and logic, EDDR, manhours, schedule narrative, presentation, spreadsheets, Primavera XER, and audit-ready export records.' },
      ]),
    ],
  }),
  'controls-periods': context({
    id: 'project-control.controls-periods', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Controls & Periods',
    summary: 'Govern Control Accounts, approved hours, reconciliation, reporting periods, and immutable snapshots.',
    articles: [
      article('control-accounts', 'Control Account lifecycle', 'Assign accountable ownership to approved WBS scope.', [
        { heading: 'Lifecycle', body: 'Control Accounts move from Draft to Submitted, Active, and Closed. Activation requires approved WBS budget and independent approval.' },
        { heading: 'Active accounts', body: 'Approved hours and controlled actuals can only be posted against an active Control Account.' },
      ]),
      article('reporting-periods', 'Closing a reporting period', 'Reconcile, submit, and lock an official reporting cycle.', [
        { heading: 'Procedure', steps: ['Enter and independently approve project hours.', 'Reconcile approved labour and verified Finance actuals.', 'Resolve every blocking reconciliation exception.', 'Submit the period to freeze data entry.', 'Independently lock the period to seal the reporting snapshot.'] },
        { heading: 'Reopening', body: 'A locked period requires authorised approval and a recorded reason to reopen. Relocking creates a new snapshot version and preserves previous history.' },
      ]),
    ],
  }),
  'commercial-dashboard': context({
    id: 'project-control.cost-commercial', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Cost & Commercial',
    summary: 'Review the cross-system commercial position from Project Control, Procurement, and Finance.',
    articles: [
      article('commercial-position', 'Understanding the commercial position', 'Read contract, commitment, actual, and payment values.', [
        { heading: 'Key values', body: 'Contract value, approved budget, PO commitments, verified actuals, supplier payments, and approved unpaid amounts are presented from governed source records.' },
        { heading: 'Audit trail', body: 'Commercial events are append-only. Duplicate source deliveries are ignored so repeated integrations do not double count values.' },
      ]),
    ],
  }),
  'cost-dashboard': context({
    id: 'project-control.cost-detail', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Cost Detail',
    summary: 'Maintain WBS budgets, review posted cost ledger entries, and understand cost forecasts.',
    articles: [
      article('cost-baseline', 'Establishing the cost baseline', 'Create and approve controlled WBS budget allocations.', [
        { heading: 'Procedure', steps: ['Create or select the controlled WBS node.', 'Create a budget allocation with its source reference.', 'Submit the allocation for review.', 'Approve it through the authorised independent control.', 'Confirm the approved value appears in the project KPIs.'] },
      ]),
      article('cost-forecast', 'Reading cost forecasts', 'Understand remaining budget and EAC.', [
        { heading: 'Definitions', body: 'Actual cost comes from posted ledger entries. Commitments represent approved obligations. Estimate at Completion is the current forecast of final project cost.' },
      ]),
    ],
  }),
  estimates: context({
    id: 'project-control.estimates', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Estimates',
    summary: 'Import, approve, compare, and retain controlled estimate and BOQ versions.',
    articles: [
      article('estimate-import', 'Importing an estimate', 'Create a controlled estimate version from a BOQ workbook.', [
        { heading: 'Procedure', steps: ['Choose the estimate kind.', 'Upload the BOQ Excel workbook.', 'Review imported and skipped row totals.', 'Check WBS or discipline variance.', 'Approve the version when review is complete.'] },
        { heading: 'Version control', body: 'Do not replace approved history. Create a revised version and supersede the previous estimate when assumptions change.' },
      ]),
    ],
  }),
  documents: context({
    id: 'project-control.documents', moduleCode: 'project_control', moduleLabel: 'Project Control', featureLabel: 'Documents',
    summary: 'Store and retrieve project-control source files and supporting evidence.',
    articles: [
      article('project-documents', 'Managing project documents', 'Classify, upload, download, and govern supporting files.', [
        { heading: 'Classification', body: 'Choose the correct kind, such as BOQ, tender, contract, change order, drawing, progress report, minutes, or specification.' },
        { heading: 'Data handling', body: 'Files are stored privately. Confirm retention and approval obligations before deleting project evidence.' },
      ]),
    ],
  }),
}

const SALES_AREA_GUIDE = {
  columns: ['Area', 'What it is', 'How it works'],
  rows: [
    ['Overview', 'Sales and proposals decision dashboard.', 'Combines weighted pipeline, proposals due, expected wins, governed exceptions, upcoming deadlines, proposal status, and handover signals from the authoritative lifecycle records.'],
    ['Opportunity', 'Qualification and pursuit-decision workspace.', 'Captures the lead, client, framework, scope, disciplines, value, hours, owner, actions, dates, risk assessment, and governed bid/no-bid decision before proposal effort begins.'],
    ['Proposal', 'Controlled technical and commercial offer.', 'Inherits the qualified opportunity, develops scope and estimates, obtains segregated approval, preserves versions and evidence, and locks the submitted revision against editing.'],
    ['Client', 'Shared commercial identity and relationship record.', 'Maintains verified legal identity, contacts, ownership, sectors, activity, risks, frameworks, opportunities, proposals, projects, and permission for new commercial work.'],
    ['Framework', 'Agreement governing recurring client services.', 'Controls validity, eligible scope, rate versions, call-off procedure, terms, ceiling, committed and invoiced values, amendments, expiry warnings, and approval.'],
    ['Forecast', 'Governed forward commercial outlook.', 'Builds pipeline, weighted pipeline, commit, best case, backlog, actual revenue, hours, and capacity views from source records; approved monthly snapshots remain immutable.'],
    ['Project Handover', 'Formal transfer from won work into delivery.', 'Verifies the contract against the proposal, completes the critical checklist, records commercial differences, requires Project Manager acceptance, then creates the traceable Project Control record.'],
  ],
}

const salesContext = (key, rowIndex) => context({
  id: `sales.${key}`,
  moduleCode: 'sales',
  moduleLabel: 'Sales',
  featureLabel: SALES_AREA_GUIDE.rows[rowIndex][0],
  summary: SALES_AREA_GUIDE.rows[rowIndex][1],
  landingSections: [{
    heading: SALES_AREA_GUIDE.rows[rowIndex][0],
    table: { columns: SALES_AREA_GUIDE.columns, rows: [SALES_AREA_GUIDE.rows[rowIndex]] },
  }],
  articles: [article(`sales-${key}`, SALES_AREA_GUIDE.rows[rowIndex][0], SALES_AREA_GUIDE.rows[rowIndex][1], [
    { heading: 'Controlled workflow', body: SALES_AREA_GUIDE.rows[rowIndex][2] },
  ])],
})

const SALES_CONTEXTS = {
  opportunities: salesContext('opportunity', 1),
  proposals: salesContext('proposal', 2),
  clients: salesContext('client', 3),
  frameworks: salesContext('framework', 4),
  forecasts: salesContext('forecast', 5),
  'project-handovers': salesContext('project-handover', 6),
}

const MODULE_CONTEXTS = {
  application: context({
    id: 'application.general', moduleCode: 'application', moduleLabel: 'RADAI', featureLabel: 'Application',
    summary: 'Get help for navigation, your account, access, and common application controls.',
    articles: [article('application-navigation', 'Navigating RADAI', 'Use the application shell and your authorised modules.', [
      { heading: 'Navigation', body: 'Use the sidebar to browse modules and Global Search to open an authorised workspace directly. Help content changes automatically with your current location.' },
    ])],
  }),
  dashboard: context({
    id: 'application.dashboard', moduleCode: 'dashboard', moduleLabel: 'RADAI', featureLabel: 'Dashboard',
    summary: 'Navigate your authorised workspaces, approvals, notifications, and recent activity.',
    articles: [article('dashboard-start', 'Using your dashboard', 'Find and open the work assigned to you.', [
      { heading: 'Quick start', body: 'Use Global Search to open an authorised workspace. Dashboard cards and notifications surface items that need your attention.' },
    ])],
  }),
  hr: context({
    id: 'hr.overview', moduleCode: 'hr_management', moduleLabel: 'HR', featureLabel: 'HR',
    summary: 'Use employee, leave, payroll, timesheet, onboarding, and HR administration workflows.',
    articles: [article('hr-controls', 'Working with HR records', 'Handle employee information through authorised HR workflows.', [
      { heading: 'Privacy', body: 'Access and update personal information only for an authorised business purpose. Use the applicable approval workflow rather than sharing records outside the system.' },
      { heading: 'Common tasks', steps: ['Choose the relevant HR workspace.', 'Search for the employee or transaction.', 'Review required fields and supporting evidence.', 'Submit the record through the configured approval flow.'] },
    ])],
  }),
  finance: context({
    id: 'finance.overview', moduleCode: 'finance', moduleLabel: 'Finance', featureLabel: 'Finance',
    summary: 'Manage authorised financial records, verification, allocation, and reporting workflows.',
    articles: [article('finance-governance', 'Finance data governance', 'Work with verified financial source records.', [
      { heading: 'Control principle', body: 'Verify source references, currency, accounting date, project, and WBS allocation before posting or approving a financial record.' },
    ])],
  }),
  procurement: context({
    id: 'procurement.overview', moduleCode: 'procurement', moduleLabel: 'Procurement', featureLabel: 'Procurement',
    summary: 'Manage requisitions, vendors, purchase orders, receipts, and procurement projects.',
    articles: [article('procurement-flow', 'Procurement workflow', 'Move a requirement through controlled purchasing and receipt.', [
      { heading: 'Typical flow', steps: ['Create and justify the requisition.', 'Complete the required review and approval.', 'Issue the purchase order.', 'Record and inspect the receipt.', 'Provide verified evidence for Finance processing.'] },
    ])],
  }),
  qhse: context({
    id: 'qhse.overview', moduleCode: 'qhse', moduleLabel: 'QHSE', featureLabel: 'QHSE',
    summary: 'Manage quality, health, safety, and environmental evidence and actions.',
    articles: [article('qhse-records', 'Managing QHSE records', 'Create auditable observations, actions, and evidence.', [
      { heading: 'Good record keeping', body: 'Use factual descriptions, identify ownership and due dates, attach appropriate evidence, and close actions only after verification.' },
    ])],
  }),
  engineering: context({
    id: 'engineering.overview', moduleCode: 'engineering', moduleLabel: 'Engineering', featureLabel: 'Engineering',
    summary: 'Use discipline-specific engineering analysis, datasheet, and verification workspaces.',
    articles: [article('engineering-workflow', 'Engineering workspace guidance', 'Maintain traceable engineering inputs and outputs.', [
      { heading: 'Control principle', body: 'Confirm the project, document revision, engineering discipline, and source files before processing. Review generated results before issuing them as controlled deliverables.' },
    ])],
  }),
  sales: context({
    id: 'sales.overview', moduleCode: 'sales', moduleLabel: 'Sales', featureLabel: 'Sales',
    summary: 'Manage authorised opportunities, commercial inputs, and sales records.',
    landingSections: [{ heading: 'Sales lifecycle', table: SALES_AREA_GUIDE }],
    articles: [article('sales-records', 'Managing sales records', 'Keep opportunity and commercial information current.', [
      { heading: 'Data quality', body: 'Maintain the customer, opportunity owner, value, stage, next action, and expected decision date so reporting remains reliable.' },
    ])],
  }),
  admin: context({
    id: 'administration.overview', moduleCode: 'admin_dashboard', moduleLabel: 'Administration', featureLabel: 'Administration',
    summary: 'Administer users, roles, access, integrations, and platform controls.',
    articles: [article('admin-access', 'Administering access safely', 'Apply least-privilege and auditable access controls.', [
      { heading: 'Control principle', body: 'Grant only the modules and roles required for the user’s current responsibilities. Review privileged changes and preserve the audit trail.' },
    ])],
  }),
  crs: workspaceContext('crs.documents', 'crs_documents', 'CRS Documents', 'Process and track controlled comment-resolution documents.', 'Confirm the project, document number, revision, and source file before starting a CRS workflow.'),
  dataMining: workspaceContext('data-mining.overview', 'data_mining', 'Data Mining', 'Find and process authorised engineering document data.', 'Use the correct Wrench project and document revision, then review extracted data before adding it to a project.'),
  designIq: workspaceContext('designiq.overview', 'designiq', 'DesignIQ', 'Create and review AI-assisted engineering design outputs.', 'Confirm design inputs, project criteria, and source revisions before generating or accepting results.'),
  pfd: workspaceContext('pfd-conversion.overview', 'pfd_to_pid', 'PFD Conversion', 'Analyse and convert authorised process-flow documents.', 'Use controlled source drawings and review every generated engineering output before issue.'),
  pid: workspaceContext('pid-analysis.overview', 'pid_analysis', 'P&ID Analysis', 'Verify and analyse controlled P&ID documents.', 'Confirm drawing identity and revision, configure the required checks, and review findings before exporting a report.'),
  support: workspaceContext('support.overview', 'support', 'Support', 'Find platform guidance and request assistance.', 'Describe the affected workspace, action, and error without including unnecessary confidential information.'),
}

const PROJECT_VIEW_ALIASES = {
  overview: 'project-dashboard',
  'project-dashboard': 'project-dashboard',
  'portfolio-exceptions': 'portfolio-exceptions',
  'plan-baseline': 'plan-baseline',
  'controls-periods': 'controls-periods',
  'commercial-dashboard': 'commercial-dashboard',
  'cost-dashboard': 'cost-dashboard',
  estimates: 'estimates',
  documents: 'documents',
}

export const HELP_ROUTE_RULES = [
  { id: 'planning-packages', test: path => path.startsWith('/planning-packages'), resolve: () => PROJECT_CONTROL_CONTEXTS['plan-baseline'] },
  { id: 'planning-workspace', test: path => path.startsWith('/planning-workspace/') || path.startsWith('/proposal-workspace/'), resolve: () => PROJECT_CONTROL_CONTEXTS['plan-baseline'] },
  {
    id: 'project-control',
    test: path => path === '/projects' || path.startsWith('/projects/'),
    resolve: searchParams => {
      const requestedView = searchParams.get('view')
      if (!requestedView) return PROJECT_CONTROL_CONTEXTS['project-dashboard']
      return PROJECT_CONTROL_CONTEXTS[PROJECT_VIEW_ALIASES[requestedView]] || PROJECT_CONTROL_CONTEXTS.general
    },
  },
  { id: 'hr', test: path => path.startsWith('/hr/') || path === '/hr', resolve: () => MODULE_CONTEXTS.hr },
  {
    id: 'sales',
    test: path => path.startsWith('/sales') || path.startsWith('/finance/sales'),
    resolve: (_searchParams, path) => SALES_CONTEXTS[path.split('/')[2]] || MODULE_CONTEXTS.sales,
  },
  { id: 'finance', test: path => path.startsWith('/finance/') || path === '/finance', resolve: () => MODULE_CONTEXTS.finance },
  { id: 'procurement', test: path => path.startsWith('/procurement/') || path === '/procurement', resolve: () => MODULE_CONTEXTS.procurement },
  { id: 'qhse', test: path => path.startsWith('/qhse/') || path === '/qhse', resolve: () => MODULE_CONTEXTS.qhse },
  { id: 'engineering', test: path => path.startsWith('/engineering/'), resolve: () => MODULE_CONTEXTS.engineering },
  { id: 'pid-analysis', test: path => path.startsWith('/pid/'), resolve: () => MODULE_CONTEXTS.pid },
  { id: 'pfd-conversion', test: path => path.startsWith('/pfd/'), resolve: () => MODULE_CONTEXTS.pfd },
  { id: 'crs-documents', test: path => path.startsWith('/crs/'), resolve: () => MODULE_CONTEXTS.crs },
  { id: 'data-mining', test: path => path.startsWith('/data-mining'), resolve: () => MODULE_CONTEXTS.dataMining },
  { id: 'designiq', test: path => path.startsWith('/designiq'), resolve: () => MODULE_CONTEXTS.designIq },
  { id: 'administration', test: path => path.startsWith('/admin'), resolve: () => MODULE_CONTEXTS.admin },
  { id: 'support', test: path => path === '/support' || path === '/documentation', resolve: () => MODULE_CONTEXTS.support },
  { id: 'dashboard', test: path => path === '/dashboard' || path === '/approvals' || path === '/notifications', resolve: () => MODULE_CONTEXTS.dashboard },
]

export function resolveHelpContext(pathname, search = '') {
  const path = `/${String(pathname || '').replace(/^\/+|\/+$/g, '')}`.toLowerCase()
  const searchParams = search instanceof URLSearchParams ? search : new URLSearchParams(search)
  const rule = HELP_ROUTE_RULES.find(item => item.test(path))
  return rule?.resolve(searchParams, path) || MODULE_CONTEXTS.application
}

export { MODULE_CONTEXTS, PROJECT_CONTROL_CONTEXTS }
