/**
 * Contextual Help registry.
 *
 * Route rules are intentionally centralized and ordered from most specific to
 * least specific. Help content must be scoped to the resolved module: the
 * drawer never falls back to articles belonging to another business area.
 */

import { adoptionKnowledge } from '../pages/Admin/aiAdoptionKnowledge'

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
    ['Opportunity', 'Qualification and pursuit-decision workspace.', 'Captures the lead, client, framework, scope, disciplines, value, hours, owner, actions, dates, risk assessment, and governed Go/No-Go decision before proposal effort begins.'],
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

const HMB_STREAM_CONSOLIDATOR_CONTEXT = {
  ...context({
    id: 'engineering.hmb-stream-table-consolidator',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Engineering',
    summary: 'Compare HYSYS stream-table workbooks locally, with an explicit option to save and reopen the generated comparison.',
    articles: [
      article('hmb-consolidator-workflow', 'Consolidator workflow', 'Import, review, compare, and export HYSYS stream-table workbooks.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/HMBConsolidator_Workflow.png', alt: 'HMB Stream Table Consolidator Workflow — Add case workbooks, review extracted values, compare cases, export Excel, save and reopen' } },
        { heading: '1. Add case workbooks', steps: ['Add one XLSX, XLSM, XLS, or CSV workbook per operating case.', 'The browser detects classic, transposed, and supported multi-sheet HYSYS layouts.', 'Source workbooks and extracted values remain in this browser session.'] },
        { heading: '2. Review extracted values', steps: ['Select a case from the case panel.', 'Include or exclude streams using the column checkboxes.', 'Select an extracted value to record a reviewed manual override; overrides are visibly flagged.'] },
        { heading: '3. Compare cases', steps: ['Open Comparison to align streams by case-insensitive name.', 'Filter by stream or property and optionally show only differing rows.', 'Amber rows identify cross-case variation; missing properties remain explicitly blank.', 'Max Liquid, Max Gas and Max Water are complete copies of the governing case column per stream — the case with the highest Light Liquid Act Flow, Std Ideal Gas Vol Flow and Heavy Liquid Flow respectively.'] },
        { heading: '4. Export', steps: ['Choose whether to include the summary sheet, variation formatting, and override formatting.', 'Download the generated XLSX workbook before closing or resetting the session.', 'Review the workbook before using it as an engineering deliverable.'] },
        { heading: '5. Save and reopen', steps: ['Choose Save project workbook to store only the generated comparison in RADAI private storage.', 'Open Saved project workbook and select Open workbook to rebuild an editable Review session.', 'Reopening restores values from the saved comparison; excluded source-only values and prior override flags are not recreated.'] },
      ]),
      article('hmb-consolidator-values', 'Extracted values', 'What is read from each workbook and how review works.', [
        { heading: 'What is extracted', steps: ['Every stream column in the HYSYS stream table becomes a stream in the Review view.', 'All properties found in the table (temperature, pressure, flows, composition, etc.) are listed with their units.', 'Properties are matched by name across streams; a property absent from a stream stays explicitly blank.'] },
        { heading: 'Review view', steps: ['Select a case from the case panel to inspect its extracted values.', 'Tick or untick stream columns to include or exclude them from the comparison.', 'Select any value to record a reviewed manual override — overridden cells are visibly flagged.'] },
      ]),
      article('hmb-consolidator-best-practices', 'Best practices', 'Get a reliable comparison every time.', [
        { heading: 'Recommendations', steps: ['Add all operating cases together — the comparison aligns streams across every loaded case.', 'Check the detected sheet and case name after each import before trusting the values.', 'Exclude utility or placeholder streams in Review so the comparison stays focused.', 'Use overrides for corrections, then confirm the comparison before exporting.', 'Download the XLSX before closing or resetting the session — unsaved browser sessions cannot be recovered after a refresh.'] },
      ]),
      article('hmb-consolidator-faq', 'FAQ', 'Common questions about the consolidator.', [
        { heading: 'Questions', steps: ['Which files can I import? One XLSX, XLSM, XLS, or CSV workbook per operating case; PDF case files are not supported.', 'Are my workbooks uploaded to a server? No — source workbooks and extracted values remain in this browser session unless you explicitly choose Save project workbook.', 'What does an amber row mean? The property value differs between cases — a cross-case variation to review.', 'What if a stream or property is missing in one case? It remains explicitly blank in the comparison rather than being invented.', 'Can I reopen a saved comparison? Yes — Saved project workbook rebuilds an editable Review session; excluded source-only values and prior override flags are not recreated.'] },
      ]),
      article('hmb-consolidator-formats', 'File formats', 'Supported inputs and outputs.', [
        { heading: 'Supported formats', steps: ['XLSX / XLSM — excellent; native HYSYS export workbooks.', 'XLS — good; legacy Excel workbooks are detected.', 'CSV — good; single-sheet exports from HYSYS or Excel.', 'PDF — unsupported for case data; export the stream table to Excel or CSV first.'] },
        { heading: 'Outputs', steps: ['Comparison workbook (XLSX) with optional summary sheet, variation formatting, and override formatting.', 'Saved project workbook stored in RADAI private storage for reopening later.'] },
      ]),
      article('hmb-consolidator-troubleshooting', 'Formats and troubleshooting', 'Check supported files, missing values, and archive prerequisites.', [
        { heading: 'Supported files', steps: ['Import XLSX, XLSM, XLS, or CSV case workbooks; PDF case files are not supported here.', 'Export and save the generated comparison as an XLSX workbook.'] },
        { heading: 'Missing streams or values', steps: ['Review the detected sheet and case name after each import.', 'Check whether streams were excluded in Review; unqualified property values remain blank instead of being invented.', 'Correct an extracted value with a reviewed override and confirm the comparison before exporting.'] },
        { heading: 'Save or reopen is unavailable', steps: ['Select or create a project and retry Save project workbook.', 'Only explicitly saved comparisons appear in Saved project workbook; unsaved browser sessions cannot be recovered after a refresh.', 'If saving or opening fails, leave the browser session in place and retry or contact your administrator.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'hmb-consolidator-workflow',
}

const EQUIPMENT_LIST_CONTEXT = {
  ...context({
    id: 'engineering.equipment-list',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Equipment List',
    summary: 'Upload P&ID drawings, extract the equipment register with AI, review and export it to Excel.',
    articles: [
      article('equipment-list-workflow', 'Verification workflow', 'The same Upload → AI Analysis → Quality Output journey as P&ID Verification V1.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/EquipmentList_Workflow.png', alt: 'Equipment List Workflow — Upload P&ID, AI Extraction, Equipment Register Output' } },
        { heading: '1. Select a project', steps: ['Pick an existing project from the workspace, or create a new one.', 'Each project keeps its own extraction history and activity trail.', 'Projects are shared across tools — the same project works in Line List and HMB Extractor.'] },
        { heading: '2. Upload P&ID(s)', steps: ['Drag & drop one or more P&ID PDFs into the upload zone.', 'Vector PDFs give the fastest, most accurate extraction; scans work too (≥ 300 DPI).', 'Equipment registers (PDF) are also accepted as a source.'] },
        { heading: '3. AI extraction runs', steps: ['The engine detects equipment tags (V-, P-, E-, T-, C- …) and their data blocks.', 'Operating & design conditions, MOC, insulation, dimensions and motor ratings are parsed.', 'Dense drawings take longer — progress polling keeps you updated; the tab can be left open.'] },
        { heading: '4. Review & add manual rows', steps: ['Sort by any column, filter by text, and select rows for partial export.', 'Add manual observations for equipment the OCR missed — they merge into the register.', 'The KPI summary shows extraction coverage (tags, MOC, dimensions, motor ratings).'] },
        { heading: '5. Export to Excel', steps: ['Export All downloads the complete register; Export Selected downloads only ticked rows.', 'Column widths are pre-set for readability in Excel.', 'Re-run after drawing revisions — each extraction is a fresh snapshot.'] },
      ]),
      article('equipment-list-fields', 'Extraction fields', 'The 18-field OCR + rule-engine output captured per equipment item.', [
        { heading: 'Core fields', steps: ['Equipment Tag No. — tag parsed from equipment bubbles/tables (V-101, P-301A …).', 'Description — equipment description from register or title block proximity.', 'Design Flowrate / Duty — design flow or duty value with units.', 'Operating Pressure — normal operating pressure (PSIG).', 'Operating Temperature — normal operating temperature (°F).', 'Design Pressure Range — min/max design pressure envelope.', 'Design Temp Range — min/max design temperature envelope.', 'MOC — material of construction (CS, SS316, …).', 'P&ID Reference — source drawing number for traceability.'] },
        { heading: 'Additional fields', steps: ['Insulation — insulation class / thickness where shown.', 'Dimensions — length/height and diameter/width in mm.', 'Motor Rating — driver power in kW for rotating equipment.'] },
      ]),
      article('equipment-list-best-practices', 'Best practices', 'Get the cleanest register from every run.', [
        { heading: 'Recommendations', steps: ['Vector PDFs first — CAD-exported PDFs carry embedded text, so OCR is skipped where possible.', 'Batch related sheets — upload all P&IDs of a unit together; the register consolidates tags across drawings.', 'Review the KPI summary — low MOC or dimension coverage usually means the source register area was not scanned.', 'Use manual rows for gaps — add the handful of items OCR missed instead of re-running the whole drawing.', 'Configure a legend — a managed legend improves tag classification and description resolution across runs.', 'Pair with P&ID Verification — a clean P&ID yields a cleaner register.'] },
      ]),
      article('equipment-list-faq', 'FAQ', 'Common questions about equipment extraction.', [
        { heading: 'Questions', steps: ['Which equipment types are detected? Vessels, pumps, heat exchangers, tanks, columns, compressors and more — anything with a standard equipment tag pattern.', 'Can I upload multiple P&IDs at once? Yes — batch upload is supported and each file merges into one register.', 'Does it work on scanned P&IDs? Yes — OCR handles raster input; use ≥ 300 DPI, upright, unskewed scans.', 'What if a tag is missed? Add it via the manual observation form — manual rows merge into the register and export like extracted rows.', 'Is my drawing sent to an external AI? No — OCR and parsing run server-side inside your RAD AI deployment.', 'Can I export only part of the register? Yes — tick rows and use Export Selected.'] },
      ]),
      article('equipment-list-formats', 'File formats', 'Supported inputs and expected extraction quality.', [
        { heading: 'Supported formats', steps: ['PDF (vector) — excellent; embedded text gives near-perfect extraction.', 'PDF (scanned) — good; raster PDF via OCR, use ≥ 300 DPI.', 'PNG/JPG/TIFF — good; accepted via OCR, avoid heavy compression around thin lines.', 'DWG/DXF — unsupported; export to PDF from the CAD package first.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'equipment-list-workflow',
}

const LINE_LIST_CONTEXT = {
  ...context({
    id: 'engineering.line-list',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Line List',
    summary: 'Upload a P&ID, extract the line list with AI, review the 12-column output and export to Excel.',
    articles: [
      article('line-list-workflow', 'Verification workflow', 'The 3-stage process: Upload P&ID → AI Extraction → Line List Output.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/LineList_Workflow.png', alt: 'Line List Workflow — 3 Stage Process: Upload P&ID, AI Extraction, Line List Output' } },
        { heading: '1. Upload P&ID', steps: ['Drag & drop your P&ID PDF into the upload zone (or let AI Document Assist pick it from Wrench).', 'Vector/native PDFs give the fastest, most accurate extraction — scanned drawings work too (≥ 300 DPI).', 'Multi-page P&IDs are supported; each page is OCR-scanned in sequence.'] },
        { heading: '2. AI Document Assist', steps: ['AI Document Assist can fetch the right drawing straight from Wrench.', 'It validates the file and hands it to the upload pipeline automatically.', 'Optional — you can always upload manually instead.'] },
        { heading: '3. Line Number Format', steps: ['Pick the naming profile matching your project: Onshore, Offshore, Industrial, ADNOC, or General (auto-detect).', 'The profile drives how each line designation is split into Size / Service / Sequence / Spec fields.', 'Not sure? "General (Auto-detect)" tries every known format and keeps the best parse.'] },
        { heading: '4. Upload Legends', steps: ['Upload the project legend sheet alongside the drawing.', 'Service-code and insulation codes expand into full descriptions via the legend.', 'Without a legend, codes are kept as-is (still fully usable).'] },
        { heading: '5. Extract Line List', steps: ['OCR reads every label; parsing splits designations per the chosen profile.', 'Computer vision correlates text with line geometry to infer FROM→TO connectivity.', 'Each parsed row is validated against the chosen format profile and legend.'] },
        { heading: '6. Background Processing', steps: ['The job runs server-side with live progress: Upload → OCR → Parse → From→To → Finalize.', 'Dense multi-page P&IDs can take 10–45 minutes — the poller keeps you updated.', 'Nothing is sent to external services; all processing stays in your deployment.'] },
        { heading: '7. Column Extracted', steps: ['Results land in a sortable table — click any column header to sort, use the filter box to search.', 'All 12 columns are shown in canonical order, ready for review.', 'Rows with unparseable designations are kept with the raw detection preserved.'] },
        { heading: '8. Export', steps: ['Export downloads a formatted .xlsx with all 12 columns in canonical order.', 'Column widths are pre-set for readability in Excel.', 'Re-run after drawing revisions — each extraction is a fresh snapshot.'] },
      ]),
      article('line-list-columns', 'Extracted columns', 'The 12 output columns captured per line.', [
        { heading: 'Core columns', steps: ['Line Designation — full raw line number string as detected on the drawing.', 'Size — nominal bore parsed from the designation (e.g. 2").', 'Service Code — fluid/service code letter(s), e.g. D, P, FL.', 'Sequence No. — line sequence identifier within the service.', 'Piping Specification — piping class / spec number (e.g. 033842).', 'Insulation — insulation class code (e.g. N, H, C).', 'From — upstream origin, line tag or equipment tag (vision-inferred).', 'To — downstream destination, line tag or equipment tag.'] },
        { heading: 'Legend-resolved & reference columns', steps: ['Service Description — code expanded to full text when a legend sheet is provided.', 'Insulation Description — insulation class expanded via legend sheet.', 'Dept Deviation — department deviation / modifier code (e.g. X).', 'P&ID No. — source drawing reference for traceability.'] },
      ]),
      article('line-list-best-practices', 'Best practices', 'Get the cleanest line list from every run.', [
        { heading: 'Recommendations', steps: ['Prefer vector PDFs at Upload — embedded text means OCR is skipped where possible.', 'Use AI Document Assist for Wrench — it fetches and prepares the drawing without manual file hunting.', 'Pick the right Line Number Format — a wrong profile splits fields incorrectly; when unsure, run General (auto-detect) first.', 'Upload Legends for full descriptions — service-code and insulation descriptions only resolve with a legend.', 'Let Background Processing finish — the job is async; closing the tab does not cancel it, but you lose live progress.', 'Spot-check Column Extracted output — vision inference is strongest on clear routing; dense areas deserve a quick manual check.'] },
      ]),
      article('line-list-faq', 'FAQ', 'Common questions about line list extraction.', [
        { heading: 'Questions', steps: ['Which Line Number Formats are supported? Onshore, Offshore, Industrial/Project, ADNOC compact, and a General auto-detect mode.', 'Do I need to Upload Legends? No — legends are optional; they expand service/insulation codes into full descriptions.', 'Does it work on scanned P&IDs? Yes — OCR handles raster input; use ≥ 300 DPI, upright, unskewed scans.', 'How long does Background Processing take? Typically 2–10 minutes; dense multi-sheet drawings can take 30–45 minutes.', 'What if a line number does not parse? The row is still included with the raw detection preserved — unparseable fields are left blank rather than guessed.', 'Is my drawing sent to an external AI? No — OCR, parsing and vision correlation all run server-side inside your RAD AI deployment.'] },
      ]),
      article('line-list-formats', 'File formats', 'Supported inputs and expected extraction quality.', [
        { heading: 'Supported formats', steps: ['PDF (vector) — excellent; embedded text gives near-perfect extraction.', 'PDF (scanned) — good; raster PDF via OCR, use ≥ 300 DPI.', 'PNG/JPG/TIFF — good; accepted via OCR, avoid heavy compression around thin lines.', 'DWG/DXF — unsupported; export to PDF from the CAD package first.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'line-list-workflow',
}

const PID_VERIFICATION_V1_CONTEXT = {
  ...context({
    id: 'engineering.pid-verification-v1',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'P&ID Verification V1',
    summary: 'Upload P&ID drawings, run AI quality-rule analysis, review findings and export a report.',
    articles: [
      article('pid-v1-workflow', 'Verification workflow', 'Create a project, upload drawings, run AI analysis, review and export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/PIDVerification_Workflow.png', alt: 'P&ID Verification Workflow — Create project, upload P&ID, AI analysis, review results, export report' } },
        { heading: '1. Create project', steps: ['Click "New Project" in the Project Workspace section.', 'Use a descriptive name — client, area/unit and revision (e.g. "Unit 300 Process Area - Q4 2026").', 'One project holds all sheets of a multi-page P&ID for cross-sheet validation.', 'Projects are saved automatically.'] },
        { heading: '2. Upload P&ID(s)', steps: ['PDF, DWG, PNG, JPG or TIFF drawings are accepted.', 'Use 300+ DPI, upright, high-contrast scans for best OCR accuracy.', 'Include symbol legend sheets so the AI identifies equipment types and symbols accurately.'] },
        { heading: '3. AI analysis', steps: ['The engine validates the drawing against 20+ engineering quality rules.', 'Analysis typically takes 2–5 minutes with real-time progress updates.', 'All processing runs inside your RADAI deployment — drawings are never shared with third parties.'] },
        { heading: '4. Review results', steps: ['Click any finding to mark it resolved, add comments, or adjust severity.', 'AI detects patterns but needs human validation — review each finding critically before accepting.'] },
        { heading: '5. Export report', steps: ['Export findings to PDF report, Excel spreadsheet, or JSON for integration with other tools.', 'Archive generated reports for compliance audits and project documentation.'] },
      ]),
      article('pid-v1-rules', 'Quality rules', 'The AI engine validates P&IDs against 20+ engineering quality rules.', [
        { heading: 'Tag Validation (4 checks)', steps: ['Tag format compliance', 'Duplicate tag detection', 'Missing tag identification', 'Tag naming conventions'] },
        { heading: 'Connectivity (4 checks)', steps: ['Orphaned equipment', 'Open-ended lines', 'Missing connections', 'Valve placement'] },
        { heading: 'Line Sizing (3 checks)', steps: ['Consistent line sizing', 'Size change notation', 'Branch sizing logic'] },
        { heading: 'Compliance (3 checks)', steps: ['Industry standards (API, ASME)', 'Symbol consistency', 'Legend alignment'] },
      ]),
      article('pid-v1-best-practices', 'Best practices', 'Get the most accurate analysis from every run.', [
        { heading: 'Recommendations', steps: ['Upload high-quality scans — 300+ DPI, clear, high-contrast images yield better AI results.', 'Include legend sheets — they help the AI identify equipment types and symbols accurately.', 'Use consistent naming — consistent tag patterns help the AI detect anomalies.', 'Review AI findings — AI detects patterns but needs human validation.', 'Export PDF reports — archive quality reports for compliance audits and documentation.', 'Incremental updates — create new project versions when drawings change to maintain an audit trail.'] },
      ]),
      article('pid-v1-faq', 'FAQ', 'Common questions about P&ID verification.', [
        { heading: 'Questions', steps: ['What file formats are supported? PDF, DWG, PNG, JPG, TIFF — PDF and DWG are recommended for best OCR accuracy.', 'How long does AI analysis take? Typically 2–5 minutes depending on drawing complexity, with real-time progress updates.', 'Can I edit findings after analysis? Yes — click any finding to mark it resolved, add comments, or adjust severity levels.', 'How accurate is the AI? 92–97% on clear scans; always review findings — AI assists but does not replace engineering judgment.', 'What happens to my drawings? All data is encrypted at rest and in transit, stored securely and never shared with third parties.', 'Can I export findings? Yes — PDF report, Excel spreadsheet, or JSON data format.'] },
      ]),
      article('pid-v1-formats', 'File formats', 'Supported inputs and report outputs.', [
        { heading: 'Supported inputs', steps: ['PDF — recommended; best OCR accuracy.', 'DWG — recommended; native CAD drawings.', 'PNG / JPG / TIFF — accepted; use 300+ DPI upright scans.'] },
        { heading: 'Report outputs', steps: ['PDF report — formatted quality report for audits.', 'Excel spreadsheet — findings for filtering and tracking.', 'JSON — raw data for integration with other tools.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'pid-v1-workflow',
}

const PID_CHECKER_V2_CONTEXT = {
  ...context({
    id: 'engineering.pid-checker-v2',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'P&ID Checker V2',
    summary: 'Upload P&ID drawings, run AI quality-rule analysis, review findings and export a report.',
    articles: [
      article('pid-v2-workflow', 'Verification workflow', 'Create a project, upload drawings, run AI analysis, review and export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/PIDVerification_Workflow.png', alt: 'P&ID Checker Workflow — Create project, upload P&ID, AI analysis, review results, export report' } },
        { heading: '1. Create project', steps: ['Click "New Project" in the Project Workspace section.', 'Use a descriptive name — client, area/unit and revision (e.g. "Unit 300 Process Area - Q4 2026").', 'One project holds all sheets of a multi-page P&ID for cross-sheet validation.', 'Projects are saved automatically.'] },
        { heading: '2. Upload P&ID(s)', steps: ['PDF, DWG, PNG, JPG or TIFF drawings are accepted.', 'Use 300+ DPI, upright, high-contrast scans for best OCR accuracy.', 'Include symbol legend sheets so the AI identifies equipment types and symbols accurately.'] },
        { heading: '3. AI analysis', steps: ['The engine validates the drawing against 20+ engineering quality rules.', 'Analysis typically takes 2–5 minutes with real-time progress updates.', 'All processing runs inside your RADAI deployment — drawings are never shared with third parties.'] },
        { heading: '4. Review results', steps: ['Click any finding to mark it resolved, add comments, or adjust severity.', 'AI detects patterns but needs human validation — review each finding critically before accepting.'] },
        { heading: '5. Export report', steps: ['Export findings to PDF report, Excel spreadsheet, or JSON for integration with other tools.', 'Archive generated reports for compliance audits and project documentation.'] },
      ]),
      article('pid-v2-rules', 'Quality rules', 'The AI engine validates P&IDs against 20+ engineering quality rules.', [
        { heading: 'Tag Validation (4 checks)', steps: ['Tag format compliance', 'Duplicate tag detection', 'Missing tag identification', 'Tag naming conventions'] },
        { heading: 'Connectivity (4 checks)', steps: ['Orphaned equipment', 'Open-ended lines', 'Missing connections', 'Valve placement'] },
        { heading: 'Line Sizing (3 checks)', steps: ['Consistent line sizing', 'Size change notation', 'Branch sizing logic'] },
        { heading: 'Compliance (3 checks)', steps: ['Industry standards (API, ASME)', 'Symbol consistency', 'Legend alignment'] },
      ]),
      article('pid-v2-best-practices', 'Best practices', 'Get the most accurate analysis from every run.', [
        { heading: 'Recommendations', steps: ['Upload high-quality scans — 300+ DPI, clear, high-contrast images yield better AI results.', 'Include legend sheets — they help the AI identify equipment types and symbols accurately.', 'Use consistent naming — consistent tag patterns help the AI detect anomalies.', 'Review AI findings — AI detects patterns but needs human validation.', 'Export PDF reports — archive quality reports for compliance audits and documentation.', 'Incremental updates — create new project versions when drawings change to maintain an audit trail.'] },
      ]),
      article('pid-v2-faq', 'FAQ', 'Common questions about P&ID checking.', [
        { heading: 'Questions', steps: ['What file formats are supported? PDF, DWG, PNG, JPG, TIFF — PDF and DWG are recommended for best OCR accuracy.', 'How long does AI analysis take? Typically 2–5 minutes depending on drawing complexity, with real-time progress updates.', 'Can I edit findings after analysis? Yes — click any finding to mark it resolved, add comments, or adjust severity levels.', 'How accurate is the AI? 92–97% on clear scans; always review findings — AI assists but does not replace engineering judgment.', 'What happens to my drawings? All data is encrypted at rest and in transit, stored securely and never shared with third parties.', 'Can I export findings? Yes — PDF report, Excel spreadsheet, or JSON data format.'] },
      ]),
      article('pid-v2-formats', 'File formats', 'Supported inputs and report outputs.', [
        { heading: 'Supported inputs', steps: ['PDF — recommended; best OCR accuracy.', 'DWG — recommended; native CAD drawings.', 'PNG / JPG / TIFF — accepted; use 300+ DPI upright scans.'] },
        { heading: 'Report outputs', steps: ['PDF report — formatted quality report for audits.', 'Excel spreadsheet — findings for filtering and tracking.', 'JSON — raw data for integration with other tools.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'pid-v2-workflow',
}

const CRITICAL_LINE_LIST_CONTEXT = {
  ...context({
    id: 'engineering.critical-line-list',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Critical Line List',
    summary: 'Upload 5 document types, let AI merge them into a 35-column critical line register, review and export to Excel.',
    articles: [
      article('cll-workflow', 'Workflow', 'Project setup, 5-document upload, AI processing, review and Excel export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/CriticalLineList_Workflow.png', alt: 'Critical Line List Workflow — Project setup, document upload, AI processing, review results, export Excel' } },
        { heading: '1. Project Setup (~2 min)', steps: ['Select project classification: Onshore, General (auto-detect) or Offshore.', 'Optionally enable AI Document Assist to fetch reference documents from Wrench DMS.', 'Choose "General" for automatic line-number format detection.'] },
        { heading: '2. Document Upload (~5–10 min)', steps: ['Upload all 5 document types: P&ID, HMB/PFD, PMS, NACE, and Stress Criticality.', 'All 5 documents are required for complete 35-column enrichment.', 'Ensure all documents are from the same project revision; 300+ DPI improves AI accuracy.'] },
        { heading: '3. AI Processing (~3–8 min)', steps: ['AI performs OCR text extraction and table detection on all 5 documents.', 'Line numbers are cross-referenced (fuzzy-matched) and merged into a unified 35-column register.', 'Processing time scales with document size; progress is shown in real time.'] },
        { heading: '4. Review Results (~10–20 min)', steps: ['Review the extracted critical line list in the interactive table.', 'Verify line numbers, sizing, material grades and stress criticality flags.', 'Use filters to isolate high-criticality lines; values below 85% confidence are flagged.'] },
        { heading: '5. Export Excel (~1 min)', steps: ['Generate the Excel workbook with all 35 columns, formatted for engineering review and handover.', 'The export includes a metadata sheet with extraction timestamps; files are auto-named with the project ID.'] },
      ]),
      article('cll-documents', 'Required documents', 'The 5 enrichment documents and optional AI assist from Wrench.', [
        { heading: 'Document slots', steps: ['1 · P&ID Drawing (PDF).', '2 · HMB / PFD (PDF, XLSX or XLS).', '3 · PMS — Piping Material Specification (PDF, XLSX or XLS).', '4 · NACE requirements (PDF, XLSX or XLS).', '5 · Stress Criticality list (PDF, XLSX or XLS — Excel preferred).'] },
        { heading: 'AI Document Assist (optional)', steps: ['Let RAD AI find the right reference document for this project from Wrench DMS.', 'Target each suggestion at the correct upload slot before clicking "Use this".'] },
        { heading: 'Line number formats', steps: ['Onshore — SIZE-FLUID-SEQUENCE-PIPECLASS (e.g. 2-D-5777-033842).', 'Offshore — AREA-FLUID-SIZE-PIPECLASS-SEQUENCE (e.g. 604-HO-8-BC2GA0).', 'General — auto-detect; tries every format and merges the results (recommended).'] },
      ]),
      article('cll-best-practices', 'Best practices', 'Prepare documents and verify data for the cleanest register.', [
        { heading: 'Document preparation', steps: ['Scan documents at 300 DPI or higher for optimal OCR accuracy.', 'Remove password protection from PDFs before upload.', 'Organize multi-page documents in logical sequence.', 'Use consistent naming conventions for easy identification.'] },
        { heading: 'Data quality', steps: ['Verify the line numbering system matches project standards.', 'Cross-check equipment tags between P&ID and HMB.', 'Ensure material class codes are defined in the PMS.', 'Review AI-extracted data for unusual values or outliers.'] },
        { heading: 'AI processing', steps: ['Allow 2–5 minutes for AI analysis depending on document size.', 'Use "Preview Results" before generating full Excel output.', 'Re-upload documents if extraction confidence is below 85%.', 'Leverage AI suggestions for missing or ambiguous data.'] },
        { heading: 'Output & export', steps: ['Export to Excel for further engineering analysis.', 'Use filters to isolate critical lines for stress analysis.', 'Export includes all 35 columns as per industry standards.', 'Save the project before export to preserve AI analysis state.'] },
      ]),
      article('cll-faq', 'FAQ', 'Common questions about the Critical Line List.', [
        { heading: 'Questions', steps: ['How long does AI processing take? Typically 2–5 minutes; large multi-page P&IDs may take up to 10 minutes, with real-time progress.', 'Can I upload documents in batches? Yes — upload all 5 at once; they process in parallel and merge automatically, or upload individually in any order.', 'What if OCR extraction has errors? Values below 85% confidence are flagged in yellow; correct data manually in the table before exporting.', 'How are line numbers matched across documents? Fuzzy matching handles variations (e.g. "10-IA-001-A1" vs "10IA001A1"); unmatched lines are flagged for manual review.', 'Can I reprocess documents? Yes — delete the current analysis and re-upload; the project setup is preserved but data is reprocessed from scratch.', 'What Excel format is the output? Industry-standard 35-column Critical Line List (.xlsx) with headers, data validation and conditional formatting for critical lines.', 'Is there a file size limit? Maximum 50 MB per document; split or compress larger files.', 'How do I mark lines as stress-critical? Upload a Stress Criticality document (Excel preferred); flagged lines are auto-highlighted in red in the output.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'cll-workflow',
}

const PMS_VALVE_MTO_CONTEXT = {
  ...context({
    id: 'engineering.pms-valve-mto',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Piping Material Spec (Valve MTO)',
    summary: 'Extract a valve material take-off from P&ID drawings, review and validate the register, then export the workbook.',
    articles: [
      article('pms-workflow', 'Workflow', 'Project, P&ID upload, AI extraction, register review, validation and export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/ValveMTO_Workflow.png', alt: 'Valve MTO Workflow — select project, upload P&ID, AI extraction, register review, export workbook' } },
        { heading: '1. Select a project', steps: ['Pick or create a project in the Project Organizer — the page is gated by project selection.', 'Each project keeps its own register, revisions and activity trail.'] },
        { heading: '2. Upload P&ID', steps: ['Upload the P&ID PDF in Stage 1.', 'Vector PDFs give best extraction results.'] },
        { heading: '3. PMS Document (optional)', steps: ['Upload your PMS Excel in Stage 2 to auto-fill Rating/Facing and Piping Material Class columns.', 'Skip if not available — fill manually later.'] },
        { heading: '4. RADAI AI Engine', steps: ['Enter your personal API key in Stage 3.', 'Get one from console.anthropic.com (Claude) or platform.openai.com (OpenAI), or raise a ticket with ICT via My Enquiries.', 'Your key is never stored on the server.', 'Choose Claude or OpenAI provider and select your preferred model.', 'Choose Quick or Thorough scan mode.'] },
        { heading: '5. Valve Legend', steps: ['Activate your valve legend in Stage 4 via Legend Manager.', 'Required before extraction can start.'] },
        { heading: '6. Extraction review', steps: ['Review extracted valves in Extraction Review tab before accepting into register.'] },
        { heading: '7. Register', steps: ['Search, filter and edit rows.', 'Allocate quantities to Island and Field.'] },
        { heading: '8. Validate, review & export', steps: ['Check Validation tab for data issues.', 'Set review state and export Excel.'] },
      ]),
      article('pms-validation', 'Validation rules', 'Data-quality checks applied to every register row.', [
        { heading: 'Errors (row status becomes Error)', steps: ['Missing or unconfirmed valve type.', 'Missing piping material class.', 'No observed or allocated quantity.'] },
        { heading: 'Warnings', steps: ['No visible valve tag (manual valves may be untagged).', 'Missing size (NB).', 'Missing P&ID number.', 'Missing or unknown DRG. TITLE for Area.', 'Rating / facing requires PMS or drawing evidence.', 'Connected line number requires verification.'] },
        { heading: 'Row statuses', steps: ['New — added since the last saved revision.', 'Changed — edited after extraction.', 'Reviewed — confirmed by an engineer.', 'Unchanged — carried over as-is.'] },
      ]),
      article('pms-review-approval', 'Review & activity', 'Register-level engineering review and audit trail.', [
        { heading: 'Review states', steps: ['In Review — default state while the register is being checked.', 'Approved — register accepted as a deliverable.', 'Rejected — register returned for correction.'] },
        { heading: 'Activity feed', steps: ['Extraction, import, row add/edit/delete, review, export, legend and save events are recorded per project.', 'Extraction entries show token usage and estimated cost in AED.', 'The feed keeps the most recent 200 entries.'] },
      ]),
      article('pms-best-practices', 'Best practices', 'Get a clean take-off on the first pass.', [
        { heading: 'Recommendations', steps: ['Complete all 4 upload stages — PDF, PMS document, RADAI AI Engine API key, and Legend Manager — before starting extraction.', 'Upload PMS Excel in Stage 2 to automatically fill Rating/Facing and Piping Material Class columns.', 'Use your personal API key for RADAI AI Engine — get one from console.anthropic.com (Claude) or platform.openai.com (OpenAI), or raise a ticket with ICT via My Enquiries.', 'Choose Thorough Scan for dense or low-quality drawings; Quick Scan for clear digital P&IDs.', 'Use vector PDFs — embedded text gives faster, more accurate extraction.', 'Activate a valve legend in Legend Manager — this is required, not optional. Start Extraction stays disabled until a legend is activated and you return to Valve MTO.', 'Clear Extraction Review before building the register — do not accept unreviewed rows.', 'Resolve Error rows first (type, material class, quantity) before requesting approval.', 'Export the workbook after approval and archive it with the project revision.'] },
      ]),
      article('pms-faq', 'FAQ', 'Common questions about Valve MTO.', [
        { heading: 'Questions', steps: ['What can I upload? P&ID PDFs for extraction; existing take-offs can be imported as Excel/CSV spreadsheets.', 'Does extraction run in the background? Yes — the job is asynchronous; the page polls status until done.', 'Can I edit extracted rows? Yes — cells are inline-editable, and rows can be added or deleted manually.', 'How are Island and Field quantities handled? Allocate per row; the totals strip sums Σ Island / Σ Field / Σ Total automatically.', 'Does the legend affect P&ID Verification? No — Valve MTO uses its own isolated legend table.', 'Is my data saved? The register persists server-side per project, with a local offline-friendly cache.', 'Do I need my own API key? Yes — RADAI AI Engine requires a personal API key from either Anthropic (Claude) or OpenAI. To get one: visit console.anthropic.com for a Claude key or platform.openai.com for an OpenAI key. Alternatively raise a ticket with ICT via My Enquiries to get one issued. Your key is used only for extraction and never stored on the server.', 'Will I lose my progress if I go to Legend Manager? No — your uploaded PDF, API key, engine choice and scan mode are all preserved when you navigate to Legend Manager and return.', 'Why are Rating/Facing and Piping Material Class empty? These fields come from your PMS (Piping Material Specification) document, not the P&ID drawing. Upload your PMS Excel in Stage 2 before extraction to auto-fill these columns.', 'Which AI model should I choose? In Stage 3 select your provider (Claude or OpenAI) and model: Claude options — Opus 5.5 (most accurate, higher cost), Sonnet 5.5 (recommended, balanced), Haiku 5.5 (fastest, lowest cost). OpenAI options — GPT-4o (most accurate), GPT-4o mini (recommended, lower cost). For most P&ID drawings Claude Sonnet 5.5 or GPT-4o mini gives the best balance of accuracy and cost.', 'How much does extraction cost? Cost depends on the model chosen and drawing size. After each extraction the Activity tab shows exact token usage and cost in AED. Typical single-page extraction: Claude Sonnet 5.5 ~ AED 0.10-0.50, GPT-4o mini ~ AED 0.05-0.20. These are estimates — actual cost depends on drawing density.'] },
      ]),
      article('pms-formats', 'File formats', 'Supported inputs and workbook outputs.', [
        { heading: 'Inputs', steps: ['PDF (vector) — recommended for extraction.', 'PDF (scanned) — processed by RADAI AI Engine; higher resolution images give better extraction results.', 'Excel / CSV — spreadsheet import of an existing take-off.'] },
        { heading: 'Outputs', steps: ['5-sheet Excel workbook (.xlsx) — register, island, field, combined and metadata.', 'Full data export for integration with other tools.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'pms-workflow',
}

const INSTRUMENT_INDEX_CONTEXT = {
  ...context({
    id: 'engineering.instrument-index',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Instrument Index',
    summary: 'Extract every instrument tag from a P&ID with AI vision, review the categorised index, and export a two-sheet Excel workbook.',
    articles: [
      article('ii-workflow', 'Workflow', 'Upload a P&ID, run the AI vision multi-pass scan, review the index and export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/InstrumentIndex_Workflow.png', alt: 'Instrument Index Workflow — upload P&ID, AI vision multi-pass scan, instrument index table, Excel export' } },
        { heading: '1. Select / create project', steps: ['Choose an existing project or create a new one — every extraction is saved per project.', 'Projects keep their own results, so different P&IDs stay cleanly separated.', 'The project manager also lets you rename, edit and organise projects by client category (ADNOC Gas / Onshore / Offshore).'] },
        { heading: '2. Upload P&ID PDF', steps: ['Drag & drop your P&ID PDF onto the drop zone, or click it to browse from your computer — single or multi-page supported.', 'Vector PDFs give the cleanest symbol detection; scanned drawings work too (≥ 300 DPI).', 'Steps unlock progressively — legend, drawing info and AI key open once the PDF is in place.', 'Your draft (uploaded PDF + drawing info) is auto-saved on this device — you can leave and continue later, e.g. while waiting for an AI key from ICT.'] },
        { heading: '3. Legend cross-check (conditional)', steps: ['Legend verification runs ONLY when a legend is available — it is not automatic in every case.', 'Configure or cross-check symbol legends in the Legends Manager (opens with a return banner so you can come straight back).', 'When a matching legend sheet exists in AWS S3 it is picked up automatically at extraction time.', 'Legends improve tag classification and reduce false positives.'] },
        { heading: '4. AI vision extraction (BYOK-direct)', steps: ['With your own Claude / OpenAI key, every page goes straight to the AI Vision model — the OCR stack (text layer, Tesseract, EasyOCR, PaddleOCR) is skipped for speed.', 'Each page is split into 4 zoomed tiles read in parallel (pages also run in parallel); results are ISA 5.1-classified and deduplicated.', 'Claude default model is Opus 5; you can pick Sonnet for lower cost. The key is used for that run only and never stored. Click Test first — a key with no API credits is reported immediately, and a run stops at the first credit/key error with a clear message.', 'No key? Raise a ticket with ICT via My Enquiries.', 'Runs as an async job with live progress.'] },
        { heading: '5. Review the index', steps: ['Every instrument tag lands in a colour-coded, paginated table with incremental index numbers.', 'Three views: Instrument Table, Category Summary (donut + ranked bars) and the ISA Layout Matrix bubble view (measured variable × function).', 'Edit any row inline (pencil icon) before export; select rows to export a subset.', 'Spot-check tags against the drawing before export.'] },
        { heading: '6. Export to Excel', steps: ['Sheet 1: Instrument Index — every tag with its category and metadata.', 'Sheet 2: Summary — per-category counts for quick review.', 'Re-export anytime; each run reflects the latest extraction.'] },
      ]),
      article('ii-categories', 'Instrument categories', 'The ISA 5.1 categories detected on the drawing.', [
        { heading: 'Core categories', steps: ['Flow — FE, FT, FI, FIC, flow indicators and transmitters.', 'Pressure — PT, PI, PIC, PSV relief and safety valves.', 'Temperature — TE, TT, TI, TIC elements and transmitters.', 'Level — LT, LI, LIC gauges and transmitters.', 'SDV / BDV — shutdown and blowdown valves for safety isolation.', 'MOV — motor-operated valves detected on the drawing.'] },
        { heading: 'Additional categories', steps: ['Analysis — AT, AI analysers for composition and quality measurement.', 'RO / Restriction — restriction orifices and similar fittings.'] },
      ]),
      article('ii-best-practices', 'Best practices', 'Get a complete, correctly categorised index.', [
        { heading: 'Recommendations', steps: ['Use vector PDFs where possible — embedded geometry makes the vision pass faster and more accurate.', 'Configure your project legend in the Legends Manager — when a legend is available, symbol cross-verification sharply reduces mis-classified tags.', 'Use your own Claude / OpenAI key (BYOK) for the highest accuracy on dense drawings — it is never stored.', 'One drawing per run — results stay attributable to a single source drawing.', 'Let the multi-pass finish — the 7-pass scan (rotations + quadrants) catches rotated/partial bubbles.', 'Review categories before export — a quick pass over the colour-coded table catches wrong assignments; fix rows inline with the pencil action.', 'Pair with the Line List — run the same P&ID through Line List for the complementary piping view.'] },
      ]),
      article('ii-faq', 'FAQ', 'Common questions about the Instrument Index.', [
        { heading: 'Questions', steps: ['What does it extract? Every instrument tag on the P&ID — Flow, Pressure, Temperature, Level, Analysis, SDV/BDV, MOV, PSV, RO and more — each with its category and an incremental index number.', 'How does the multi-pass scan work? Standard orientation, 90°/270° rotations, and 4 quadrant tiles — bubbles are detected regardless of orientation.', 'Are results always cross-checked against the legend? No — legend verification is conditional: it runs only when a legend is configured in the Legends Manager or a matching sheet is found in AWS S3. Without one, extraction still works, just without symbol cross-verification.', 'Can I use my own AI key? Yes — the optional BYOK field accepts a Claude (Anthropic) or OpenAI key, used before the shared engines and never stored. If you don’t have one, raise a ticket with ICT via My Enquiries.', 'Do I have to finish in one sitting? No — your uploaded PDF and drawing info are auto-saved on this device per project, so you can return later and continue.', 'Can I correct a row before exporting? Yes — use the pencil action on any row to edit it inline, and tick rows to export only a subset.', 'Is it ISA 5.1 aware? Yes — tag letters are interpreted per ISA 5.1, so first/succeeding letters map to the correct measured variable and function.', 'Is my drawing sent to an external service? No — extraction and classification run inside your RAD AI deployment.'] },
      ]),
      article('ii-formats', 'File formats', 'Supported inputs and workbook output.', [
        { heading: 'Supported inputs', steps: ['PDF (vector) — excellent; embedded geometry gives the most accurate symbol detection.', 'PDF (scanned) — good; handled via vision, use ≥ 300 DPI.', 'PNG / JPG / TIFF — good; avoid heavy compression around thin symbols.', 'DWG / DXF — unsupported; export to PDF from the CAD package first.'] },
        { heading: 'Output', steps: ['Two-sheet Excel workbook (.xlsx) — Instrument Index sheet plus per-category Summary sheet.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'ii-workflow',
}

const IO_LIST_CONTEXT = {
  ...context({
    id: 'engineering.io-list',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'I/O List',
    summary: 'Build a multi-revision Instrument I/O List: upload a P&ID or an existing I/O list, extract I/O points with AI, review and export — revisions tracked automatically.',
    articles: [
      article('io-workflow', 'Workflow', 'Upload, AI extraction, multi-revision I/O table, Excel export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/IOList_Workflow.png', alt: 'IO List Workflow — upload P&ID/IO list, AI extraction, multi-revision IO table, Excel export' } },
        { heading: '1. Select / create project', steps: ['Pick or create a project so documents, revisions and comments stay grouped.', 'Each project tracks its own I/O list revisions independently.'] },
        { heading: '2. Upload document (PDF)', steps: ['Upload an I/O List PDF (Comments Resolution Sheet + structured table) or a P&ID drawing PDF — the type is auto-detected.', 'Drag & drop onto the upload zone or click it to browse from your computer.', 'Steps unlock progressively — legend guidance, document info and the AI key open once a PDF is selected.', 'Your draft (selected file + document info) is auto-saved on this device — you can leave and continue later, e.g. while waiting for an AI key from ICT.'] },
        { heading: '3. Legend cross-check (conditional)', steps: ['Legend verification runs ONLY when an active legend is configured under Manage Legends (Project Legend Sheets panel) — it is not automatic in every case.', 'Without a legend, extraction still works, just without tag-format cross-verification.', 'Facing difficulty with legends? Raise a request with the ICT department via My Enquiries.'] },
        { heading: '4. Extraction', steps: ['I/O List PDFs use free PyMuPDF native text + table extraction — no AI cost.', 'P&ID drawings use AI Vision to read instrument, equipment and line tags — choose Quick or Thorough scan depending on drawing density.', 'Optional BYOK: add your own Claude / OpenAI key (P&ID options) for best accuracy — used for that request only and never stored. No key? Raise a ticket with ICT via My Enquiries, or leave blank for basic OCR.', 'Cost transparency: once a PDF is selected, an estimated BYOK cost (~$ and tokens, per scan mode) is shown before you run — billing is handled by your AI provider directly against your own key.', 'Extraction runs async with a live progress banner — safe to leave the tab.'] },
        { heading: '5. Review I/O table', steps: ['Open a document to the tabbed view: Overview, Comments, I/O Table, Metadata.', 'The I/O Table is fully editable — correct tags, signal types and assignments inline.', 'Extracted comments carry drawing notes alongside the table.'] },
        { heading: '6. Track revisions & export', steps: ['Re-uploading a revised document creates a new revision — history is preserved.', 'Compare revisions to see what changed between issues; previous revisions remain downloadable for traceability.', 'Download the I/O list as a formatted .xlsx ready for issue — export always reflects the latest saved edits.'] },
      ]),
      article('io-columns', 'I/O columns', 'The fields captured per I/O point.', [
        { heading: 'Core columns', steps: ['Tag Number — instrument tag the I/O point belongs to (e.g. FT-1001).', 'Signal Type — AI / AO / DI / DO, the signal direction and type.', 'Service Description — what the point measures or controls.', 'I/O Assignment — system/panel/channel the point is wired to.'] },
        { heading: 'Additional columns', steps: ['Loop Number — control loop the point belongs to.', 'P&ID Reference — source drawing number for traceability.', 'Range / Units — engineering range and units where applicable.', 'Remarks — free-text notes carried with the point.'] },
      ]),
      article('io-best-practices', 'Best practices', 'Keep a clean, auditable multi-revision I/O list.', [
        { heading: 'Recommendations', steps: ['Start from the latest revision — revisions stack, so the newest upload becomes the working copy.', 'Use thorough scan for dense P&IDs; quick scan suits clean drawings.', 'Use your own Claude / OpenAI key (BYOK) for the highest accuracy on P&ID drawings — it is never stored.', 'Review the Comments tab — extracted drawing notes often carry critical I/O caveats.', 'Correct in the I/O Table — edits are saved to the revision rather than fixed in Excel afterwards.', 'Configure a legend under Manage Legends — when active, it improves signal-type classification and tag interpretation.', 'Keep revisions, don\'t delete — revision history is your audit trail; delete only true duplicates.'] },
      ]),
      article('io-faq', 'FAQ', 'Common questions about the I/O List.', [
        { heading: 'Questions', steps: ['What can I upload? PDF only — an I/O List PDF (CRS + structured table) or a P&ID drawing PDF; the type is detected automatically.', 'Do I always need an AI key? No — plain I/O List PDFs never need one (free PyMuPDF extraction). Keys only help with P&ID drawings, and basic OCR is a working fallback.', 'Are uploads always cross-checked against the legend? No — legend verification is conditional on an active legend being configured under Manage Legends.', 'Do I have to finish in one sitting? No — your selected file and document info are auto-saved per project on this device, so you can return later and continue (e.g. after ICT issues your AI key).', 'How are revisions handled? Each new upload creates a new revision; previous revisions stay available for comparison and download.', 'Quick vs thorough scan? Quick is faster for clean drawings; thorough runs more vision passes and suits dense or rotated P&IDs.', 'Can I edit the extracted table? Yes — the I/O Table tab is fully editable and changes are saved against the revision before export.', 'Is my drawing sent to an external service? No — extraction and classification run inside your RAD AI deployment.'] },
      ]),
      article('io-formats', 'File formats', 'Supported inputs and workbook output.', [
        { heading: 'Supported inputs', steps: ['PDF (vector) — excellent; embedded geometry gives clean detection for both I/O lists and P&ID drawings.', 'PDF (scanned) — good; handled via vision, use ≥ 300 DPI.', 'XLSX / CSV — not accepted here; convert to PDF first.', 'DWG / DXF — unsupported; export to PDF from the CAD package first.'] },
        { heading: 'Output', steps: ['Formatted Excel I/O list (.xlsx), ready for issue — each revision exports independently.'] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'io-workflow',
}

const SLD_COMPARISON_CONTEXT = {
  ...context({
    id: 'engineering.sld-comparison',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Single Line Diagram',
    summary: 'Extract electrical tags from a P&ID with AI Vision and compare P&ID, Equipment List and Load List — MATCHED / MISSING / EXTRA.',
    articles: [
      article('sld-workflow', 'Workflow', 'Select a project, complete all 3 stages, analyse, review and export.', [
        { heading: 'Workflow diagram', image: { src: '/assets/images/SLD_Workflow.png', alt: 'Electrical Comparison Workflow — upload documents, AI extraction, compare and classify, review results, export Excel' } },
        { heading: '1. Select a project', steps: ['Pick or create a project — the page is gated by project selection.', 'Each project keeps its own analysis history.'] },
        { heading: '2. Upload files (Stage 1 — required)', steps: ['Upload at least 2 files: P&ID Drawing + Equipment List, P&ID Drawing + Load List, Equipment List + Load List, or all 3 for full comparison.', 'P&ID alone is not enough to proceed.'] },
        { heading: '3. RADAI AI Engine (Stage 2)', steps: ['Required only when a P&ID is uploaded.', 'Provide your personal Claude or OpenAI API key and test the connection.', 'Equipment List + Load List only → no API key needed (completely free).'] },
        { heading: '4. Electrical Legend (Stage 3 — required)', steps: ['Visit Legend Manager, activate your Electrical legend and return.', 'The Analyse button stays disabled until this step is completed.'] },
        { heading: '5. Analyse Drawing', steps: ['Click Analyse Drawing — AI reads the P&ID and compares against your lists.', 'Results show in 4 tabs: P&ID vs Equipment List, P&ID vs Load List, Equipment vs Load List, Full Comparison.'] },
        { heading: '6. Review & Export', steps: [
          'Review MATCHED/MISSING/EXTRA results.',
          "View documents in the interactive canvas viewer — click 'View Documents' to open the drawing with colored boxes: 🟢 Green = Matched tags 🔴 Red = Missing tags 🟡 Yellow = Extra tags 🟣 Purple = Located on scanned drawing. Use the filter buttons to show/hide each status on the drawing.",
          'Export current tab results as Excel. In Combined Results view, export is generated directly in your browser.',
        ] },
        { heading: '7. Drafting Check (AGPS-SP-EDS-002)', steps: [
          'After analysis, view the Drafting Check tab to see if your SLD drawing follows AGPS drafting standards:',
          '✅ PASS — standard followed',
          '❌ FAIL — standard violated',
          '⚠️ REVIEW — needs manual verification (usually due to low scan resolution)',
        ] },
      ]),
      article('sld-comparison-logic', 'Comparison logic', 'How tags are classified across the three documents.', [
        { heading: 'Statuses', steps: ['MATCHED — the tag exists on both sides of the comparison.', 'MISSING — the tag exists in the reference but not on the compared side.', 'EXTRA — the tag appears only on the compared side.'] },
        { heading: 'Tag breakdown', steps: ['Each tag is parsed into area, type code and sequence.', 'The detail panel shows the breakdown plus presence on each side of the comparison.'] },
        { heading: 'Panel verification', steps: ['Panels and motors are different equipment classes, so a direct tag match is not used.', 'The Load List "PANEL TAG:" header is checked against the Equipment List to confirm the panel exists.'] },
        { heading: 'Tab separation', steps: ['P&ID vs Equipment List → panels and switchboards only (U, SB, JB, BD, AB, TSG etc.)', 'P&ID vs Load List → motors and loads only (PM, NPM, RM etc.)', 'This prevents false discrepancies from comparing motors against equipment lists.'] },
        { heading: 'Full Comparison tab statuses', steps: ['fully_matched — tag found in all sources', 'partial — tag found in some sources', 'single_source — tag found in only one'] },
      ]),
      article('sld-best-practices', 'Best practices', 'Reliable comparisons on the first run.', [
        { heading: 'Recommendations', steps: [
          'Complete all 3 stages before analysing — files, API key (if P&ID uploaded), and Electrical Legend activation.',
          'Upload at least 2 files — P&ID alone is not sufficient to start analysis.',
          'Use your personal API key for RADAI AI Engine — get one from console.anthropic.com (Claude) or platform.openai.com (OpenAI), or raise a ticket with ICT.',
          'Activate your Electrical Legend in Legend Manager before analysing — this is required, not optional.',
          'Keep all 3 documents from the same revision for accurate comparison.',
          "Review MISSING rows first — these are tags in your reference lists that don't appear on the drawing.",
          'Use Combined Results to merge findings across multiple SLD uploads in the same project.',
          "View documents in the interactive canvas viewer — click 'View Documents' to open the drawing with colored boxes: 🟢 Green = Matched tags 🔴 Red = Missing tags 🟡 Yellow = Extra tags 🟣 Purple = Located on scanned drawing. Use the filter buttons to show/hide each status on the drawing.",
          'Archive the Excel export (current tab, or browser-generated in Combined Results) after each approved analysis.',
        ] },
      ]),
      article('sld-faq', 'FAQ', 'Common questions about electrical comparison.', [
        { heading: 'Questions', steps: [
          'Can I extract tags without comparing? No — Stage 1 requires at least 2 files before the Analyse button unlocks; P&ID alone is not enough to proceed, even for tag extraction only.',
          'Can I compare without a P&ID? Yes — upload Equipment List + Load List alone; no AI Vision is needed.',
          'What do MATCHED / MISSING / EXTRA mean? Presence of each tag on both sides, only the reference side, or only the compared side.',
          'Why is panel matching different? Panels and motors are different equipment classes, so the Load List "PANEL TAG:" header is verified against the Equipment List instead of a direct tag match.',
          'Is my data sent to an external service? No — extraction and comparison run inside your RAD AI deployment.',
          'Can I retrieve old results? Yes — Previous Analyses supports viewing, downloading and deleting past runs.',
          'Do I need my own API key? Yes — when uploading a P&ID drawing, RADAI AI Engine requires a personal Claude or OpenAI API key. Equipment List + Load List comparison is free and needs no API key.',
          'Which AI model should I choose? Claude options: Sonnet 5 (recommended, balanced), Opus 5 (most accurate, higher cost), Sonnet 4.5 (legacy). OpenAI: GPT-4o. For most SLD drawings Claude Sonnet 5 gives the best balance.',
          'Why is the Analyse button disabled? Complete all 3 stages: upload at least 2 files, configure RADAI AI Engine (if P&ID uploaded), and activate your Electrical Legend in Legend Manager.',
          'What is Combined Results? When a project has multiple SLD uploads, Combined Results merges findings across all of them — a tag found in ANY upload counts as MATCHED, only truly missing tags (in ALL uploads) show as MISSING. Exporting from Combined Results generates the Excel file directly in your browser — no server round-trip needed.',
          "What is the Document Viewer? View documents in the interactive canvas viewer — click 'View Documents' to open the drawing with colored boxes: 🟢 Green = Matched tags 🔴 Red = Missing tags 🟡 Yellow = Extra tags 🟣 Purple = Located on scanned drawing. Use the filter buttons to show/hide each status on the drawing.",
          'What is the Drafting Check? After analysis, the Drafting Check tab automatically verifies your SLD drawing against AGPS-SP-EDS-002 drafting standards. Each check shows PASS, FAIL or NEEDS REVIEW with a detailed explanation per page.',
        ] },
      ]),
      article('sld-formats', 'File formats', 'Supported inputs and outputs.', [
        { heading: 'Supported inputs', steps: [
          'P&ID Drawing (PDF) — optional but required for AI tag extraction.',
          'Equipment List (Excel or PDF) — panels and switchboards register.',
          'Load List (Excel or PDF) — motors and loads register.',
          'At least 2 files required to proceed.',
        ] },
        { heading: 'Output', steps: [
          'Export current tab results as Excel. In Combined Results view, export is generated directly in your browser.',
          "Document Viewer — interactive canvas viewer with colored boxes: 🟢 Green = Matched tags 🔴 Red = Missing tags 🟡 Yellow = Extra tags 🟣 Purple = Located on scanned drawing.",
          'Combined Results — merged view across all SLD uploads in a project.',
        ] },
      ]),
    ],
  }),
  searchableArticles: true,
  selectedArticleId: 'sld-workflow',
}

const ELECTRICAL_CHECKLIST_CONTEXT = {
  ...context({
    id: 'engineering.electrical-checklist',
    moduleCode: 'engineering',
    moduleLabel: 'Engineering',
    featureLabel: 'Electrical Checklist',
    summary: 'Upload electrical inspection checklist PDFs and let AI fill the 11-section UPS / Battery System Inspection Checklist — with handwriting recognition, signature detection and a comparison dashboard.',
    articles: [
    {
      id: 'electrical-checklist-workflow',
      title: 'Workflow & How to Use',
      summary: 'Upload checklist PDFs → AI extraction → review the filled template → export to Excel.',
      sections: [
        {
          heading: 'How It Works',
          body: 'The diagram below shows the end-to-end flow of the Electrical Checklist application, from selecting a project to exporting the filled checklist to Excel.',
          image: { src: '/assets/images/ElectricalChecklist_Workflow.png', alt: 'Electrical Checklist workflow diagram' },
        },
        {
          heading: 'Steps',
          steps: [
            'Select or create a project on the landing page — all extractions, templates and exports are grouped per project.',
            'Upload one or more electrical checklist PDFs (drag & drop or browse). PDF only, max 50 MB each, up to 10 files per batch.',
            'Choose the AI extraction mode — Fast (free OCR), Balanced (recommended), Deep, or Vision-Only — and start the extraction.',
            'Review the filled checklist template — a live template on the left is populated by AI with a real-time progress bar; use the comparison dashboard to verify values against the source PDF.',
            'Export to Excel — download the completed checklist as a formatted Excel workbook from S3 storage.',
          ],
        },
      ],
    },
    {
      id: 'electrical-checklist-extraction-modes',
      title: 'Extraction Modes',
      summary: 'Fast, Balanced, Deep and Vision-Only — trade-off between cost, speed and accuracy.',
      sections: [
        {
          heading: 'Choose the Right Mode',
          body: 'Four extraction modes are available from the AI Mode Selector. Balanced is the recommended default.',
          steps: [
            'Fast — free OCR only (Tesseract). Lowest cost, good for clean printed documents with simple tables.',
            'Balanced (Recommended) — free OCR first, with GPT-4o Vision fallback for low-confidence cells and handwritten fields. Best accuracy-to-cost ratio.',
            'Deep — thorough analysis with extra validation passes, color detection and table-structure analysis. Highest accuracy for complex or poor-quality scans; slower and higher cost.',
            'Vision-Only — sends pages directly to GPT-4o Vision with no pre-OCR. Use for completely handwritten checklists.',
          ],
        },
        {
          heading: 'Special Capabilities',
          steps: [
            'Handwriting recognition — handwritten values are processed synchronously before extraction completes.',
            'Signature detection — OpenCV-based detection identifies signature marks in signature fields.',
            'Color highlighting — checkbox marks and highlighted cells are detected and interpreted.',
            'Extraction cost — the estimated AI cost per job is displayed after extraction completes.',
          ],
        },
      ],
    },
    {
      id: 'electrical-checklist-sections',
      title: 'Checklist Template Sections',
      summary: 'The 11 sections of the UPS / Battery System Inspection Checklist that AI fills in.',
      sections: [
        {
          heading: 'Template Sections',
          body: 'The template is pre-loaded with standard items; AI fills in the values extracted from your uploaded documents.',
          steps: [
            '1. General Inspection — equipment condition, installation and mounting.',
            '2. Documentation Review — drawings, manuals, test certificates and nameplate data.',
            '3. Environment & Ventilation — room conditions, cooling and airflow.',
            '4. Safety, Markings & Labels — warning labels, identification and safety signage.',
            '5. Electrical Safety & Insulation — earthing, insulation and clearances.',
            '6. UPS Performance & Protection — UPS ratings, protection settings and alarms.',
            '7. Battery Performance & Maintenance — battery condition, voltage and maintenance records.',
            '8. Battery Circuit Protection — breakers, fuses and DC protection.',
            '9. Alarms, Indications & Controls — indicators, control panels and alarm functions.',
            '10. Functional & Load Testing — load tests, autonomy and changeover verification.',
            '11. Final Approval — overall acceptance status, signatures and date.',
          ],
        },
      ],
    },
    {
      id: 'electrical-checklist-practices',
      title: 'Best Practices',
      summary: 'How to get the most accurate results from your checklist extraction.',
      sections: [
        {
          heading: 'Recommendations',
          steps: [
            'Upload complete checklist documents — partial pages may leave template sections empty.',
            'Start with Balanced mode; switch to Deep only if key fields are missed on complex scans.',
            'Use Vision-Only for fully handwritten checklists — OCR alone performs poorly on handwriting.',
            'Verify signature fields after extraction — signature detection flags presence, not validity.',
            'Use the comparison dashboard to check extracted values against the source PDF before exporting.',
            'Keep each upload under the 50 MB / 10-file limit; split larger batches into multiple runs.',
          ],
        },
      ],
    },
    {
      id: 'electrical-checklist-faq',
      title: 'Frequently Asked Questions',
      summary: 'Common questions about extraction modes, accuracy and exports.',
      sections: [
        {
          heading: 'Q&A',
          steps: [
            'Which extraction mode should I use? — Balanced for most documents; Fast for clean prints, Deep for poor scans, Vision-Only for handwriting.',
            'Is OCR really free? — Yes, Fast mode uses Tesseract OCR with no AI cost. Only Vision-based extraction consumes AI credits.',
            'Can it read handwritten values? — Yes, handwritten fields go through a dedicated handwriting recognition pipeline.',
            'How are checkboxes interpreted? — Marked checkboxes are detected (including color highlights) and mapped to the template item.',
            'Where is my data stored? — Extracted templates and uploaded files are stored in S3; exports download from there.',
            'Can I re-run an extraction with a different mode? — Yes, upload again and select another mode; templates are grouped per project.',
          ],
        },
      ],
    },
    {
      id: 'electrical-checklist-formats',
      title: 'File Formats & Limits',
      summary: 'Supported inputs, size limits and the Excel export format.',
      sections: [
        {
          heading: 'Upload Requirements',
          steps: [
            'PDF only (.pdf) — Word, images and other formats are not accepted.',
            'Maximum 50 MB per file and up to 10 files per batch.',
            'Scanned checklists should be upright and legible for best OCR results.',
          ],
        },
        {
          heading: 'Export',
          steps: [
            'Excel workbook (.xlsx) — the full 11-section checklist with extracted values, formatted for printing.',
            'Exports are generated server-side and downloaded from S3 storage.',
          ],
        },
      ],
    },
  ],
  }),
  searchableArticles: true,
  selectedArticleId: 'electrical-checklist-workflow',
};

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
  {
    id: 'ai-adoption',
    test: path => ['/admin/ai-champion', '/admin/ai-adoption', '/admin/ai-champion/legacy'].includes(path),
    resolve: params => {
      const selected = adoptionKnowledge.find(topic => topic.id === params.get('tab')) || adoptionKnowledge[0]
      return {
        ...context({
          id: `ai-adoption.${selected.id}`, moduleCode: 'ai_champion', moduleLabel: 'AI Adoption & Champions', featureLabel: selected.title,
          summary: selected.purpose,
          articles: adoptionKnowledge.map(topic => article(topic.id, topic.title, topic.purpose, [
            { heading: 'How to use this view', steps: topic.steps },
            { heading: 'Metrics and definitions', steps: topic.metrics },
            { heading: 'Reporting boundaries', steps: topic.limits },
            { heading: 'Common questions', steps: topic.faq },
          ])),
        }),
        searchableArticles: true,
        selectedArticleId: selected.id,
      }
    },
  },
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
  { id: 'hmb-stream-table-consolidator', test: path => path === '/engineering/process/hmb-stream-table-consolidator', resolve: () => HMB_STREAM_CONSOLIDATOR_CONTEXT },
  { id: 'equipment-list', test: path => path === '/engineering/process/equipment-list', resolve: () => EQUIPMENT_LIST_CONTEXT },
  { id: 'line-list', test: path => path === '/engineering/process/line-list', resolve: () => LINE_LIST_CONTEXT },
  { id: 'pid-verification-v1', test: path => path === '/engineering/process/pid-verification-v1', resolve: () => PID_VERIFICATION_V1_CONTEXT },
  { id: 'pid-checker-v2', test: path => path === '/engineering/process/pid-checker-v2', resolve: () => PID_CHECKER_V2_CONTEXT },
  { id: 'critical-line-list', test: path => path === '/engineering/piping/critical-line-list', resolve: () => CRITICAL_LINE_LIST_CONTEXT },
  { id: 'pms-valve-mto', test: path => path === '/engineering/piping/pms', resolve: () => PMS_VALVE_MTO_CONTEXT },
  { id: 'instrument-index', test: path => path === '/engineering/instrument/index', resolve: () => INSTRUMENT_INDEX_CONTEXT },
  { id: 'io-list', test: path => path === '/engineering/instrument/datasheet/io-list', resolve: () => IO_LIST_CONTEXT },
  { id: 'sld-comparison', test: path => path === '/engineering/electrical/sld', resolve: () => SLD_COMPARISON_CONTEXT },
  { id: 'electrical-checklist', test: path => path === '/engineering/electrical/checklist', resolve: () => ELECTRICAL_CHECKLIST_CONTEXT },
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
