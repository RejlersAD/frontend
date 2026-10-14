// Synthetic records only. These responses never contact production services.
export const APPROVAL_CHECK_TIME = '2026-09-14T08:00:00.000Z';
export const approvalUsers = {
  admin: { id: 'approval-reviewer', first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_superuser: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] },
  employee: { id: 'approval-reviewer', first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', roles: [{ code: 'default', name: 'Employee' }] },
  hr: { id: 'hr-reviewer', first_name: 'Taylor', last_name: 'Reed', email: 'taylor.reed@example.test', roles: [{ code: 'hr_manager', name: 'HR Manager' }] },
};
const day = days => new Date(new Date(APPROVAL_CHECK_TIME).getTime() - days * 86400000).toISOString();
const requisitions = Array.from({ length: 8 }, (_, index) => ({
  id: `pr-${index + 1}`, pr_number: `PR-2026-${String(index + 101).padStart(4, '0')}`,
  title: ['Offshore safety equipment', 'Pump maintenance spares', 'Site survey instruments', 'Pipeline inspection services', 'Office electrical supplies', 'Control valve replacement', 'Workshop consumables', 'Project document services'][index],
  issued_by_name: index % 2 ? 'Omar Shah' : 'Nadia Hassan', requested_by_name: index % 2 ? 'Omar Shah' : 'Nadia Hassan',
  project_name: index % 2 ? 'Northern utilities upgrade' : 'Offshore integrity program', project_code: index % 2 ? 'NUP-42' : 'OIP-21',
  department: index % 2 ? 'Project Control' : 'Engineering', priority: ['urgent', 'high', 'normal', 'low'][index % 4],
  status: index % 2 ? 'in_review' : 'submitted', created_at: day([12, 8, 3, 1, 0, 6, 15, 2][index]), submitted_at: day([11, 7, 3, 1, 0, 5, 14, 2][index]),
  total_price: [185000, 42000, 0, 8200, null, 127500, 640, 19500][index], currency: index === 3 ? 'USD' : index === 4 ? null : 'AED',
  approval_stage: 'technical_review', current_approval: { stage: 'technical_review', approver_name: 'Alex Morgan' },
  can_approve: true, can_review: true, approval_hierarchy: [{ name: 'Technical review', status: 'pending', approver_name: 'Alex Morgan' }],
  review_due_at: index === 0 ? day(1) : index === 1 ? '2026-09-14T12:00:00.000Z' : null,
  items: [{ description: 'Synthetic procurement line for browser verification', quantity: 1, unit_price: 100, total_price: 100 }],
  attachments: [], linked_po_id: null,
}));
const orders = Array.from({ length: 4 }, (_, index) => ({
  id: `po-${index + 1}`, po_number: `PO-2026-${String(index + 201).padStart(4, '0')}`, title: ['Instrumentation equipment order', 'Commissioning support order', 'Inspection tools order', 'Site material order'][index],
  vendor_name: index % 2 ? 'Synthetic Gulf Services' : 'Synthetic Technical Supply', requester_name: 'Sam Reed', created_by_name: 'Sam Reed',
  total_amount: [325000, 18250, 0, null][index], currency: index === 1 ? 'USD' : 'AED', approval_status: 'pending', approval_stage: index % 2 ? 'finance_review' : 'management_approval',
  current_approval: { stage: index % 2 ? 'finance_review' : 'management_approval' }, can_approve: true, can_review: true,
  priority: index ? 'normal' : 'high', created_at: day(index + 2), submitted_at: day(index + 1), project_name: 'Northern utilities upgrade', attachments: [], items: [],
}));
const leaves = [
  { id: 'leave-manager', employee_name: 'Maya Collins', employee_code: 'SYN-101', department: 'Engineering', status: 'PENDING', review_stage: 'reporting_manager', can_review: true, leave_type: 'Annual leave', start_date: '2026-09-21', end_date: '2026-09-23', days_requested: 3, reason: 'Planned annual leave', submitted_at: day(4), created_at: day(4), line_manager_name: 'Alex Morgan' },
  { id: 'leave-hr', employee_name: 'Liam Khan', employee_code: 'SYN-102', department: 'Operations', status: 'RM_APPROVED', review_stage: 'hr_review', can_review: true, leave_type: 'Annual leave', start_date: '2026-09-28', end_date: '2026-09-29', days_requested: 2, reason: 'Family commitment', submitted_at: day(1), created_at: day(1), line_manager_name: 'Alex Morgan' },
  { id: 'leave-other-stage', employee_name: 'Unassigned stage example', employee_code: 'SYN-103', department: 'Operations', status: 'PENDING', review_stage: 'reporting_manager', can_review: false, leave_type: 'Annual leave', start_date: '2026-10-01', end_date: '2026-10-01', days_requested: 1, submitted_at: day(2), created_at: day(2) },
];
const documents = [
  { id: 'identity-1', user_name: 'Ravi Menon', user_email: 'ravi@example.test', employee_name: 'Ravi Menon', document_type: 'emirates_id', document_type_display: 'Emirates ID', verification_status: 'pending', document_number: 'SYNTHETIC-IDENTITY-001', uploaded_at: day(2), created_at: day(2), expiry_date: '2028-12-31', file_name: 'synthetic-id.svg' },
  { id: 'identity-2', user_name: 'Sara Ali', user_email: 'sara@example.test', employee_name: 'Sara Ali', document_type: 'passport', document_type_display: 'Passport', verification_status: 'pending', document_number: 'SYNTHETIC-PASSPORT-002', uploaded_at: day(7), created_at: day(7), expiry_date: '2029-06-30', file_name: 'synthetic-passport.svg' },
];
export function approvalFixture(name = 'full') {
  const queues = {
    '/payroll/leave-requests/': structuredClone(leaves),
    '/payroll/leave-requests/pending-for-me/': structuredClone(leaves.filter(row => row.can_review)),
    '/procurement/requisitions/pending-for-me/': structuredClone(requisitions),
    '/procurement/orders/pending-for-me/': structuredClone(orders),
    '/rbac/profile-documents/pending-verification/': structuredClone(documents),
    // Ordinary registers, intentionally without invented pending-approval flags or actions.
    '/payroll/master-payroll-history/': [{ id: 'payroll-import', month_year: '2026-08', total_employees: 127, total_net: 625000, imported_at: day(5) }],
    '/finance/invoices/': [{ id: 'invoice-register', invoice_number: 'INV-SYN-001', vendor_name: 'Synthetic Supplier', amount: 4000, currency: 'AED', status: 'unpaid', created_at: day(2) }],
  };
  const failures = {};
  const counts = {};
  if (name === 'empty' || name === 'zero') for (const endpoint of Object.keys(queues)) queues[endpoint] = [];
  if (name === 'error') for (const endpoint of Object.keys(queues)) failures[endpoint] = 503;
  if (name === 'restricted') for (const endpoint of Object.keys(queues)) failures[endpoint] = 403;
  if (name === 'partial') failures['/procurement/orders/pending-for-me/'] = 503;
  if (name === 'partial-restricted') failures['/rbac/profile-documents/pending-verification/'] = 403;
  if (name === 'truncated') {
    counts['/procurement/requisitions/pending-for-me/'] = 150;
    counts['/procurement/orders/pending-for-me/'] = 110;
  }
  if (name === 'unknown') for (const row of queues['/procurement/requisitions/pending-for-me/']) {
    row.total_price = null; row.currency = null; row.priority = null; row.created_at = null; row.submitted_at = null; row.issued_by_name = null; row.requested_by_name = null;
  }
  if (name === 'multi-stage') {
    const row = queues['/procurement/orders/pending-for-me/'][0];
    row.approval_queue_id = 'po-queue-a';
    queues['/procurement/orders/pending-for-me/'].push({ ...row, approval_queue_id: 'po-queue-b', approval_stage: 'finance_review' });
  }
  if (name === 'formula') queues['/procurement/requisitions/pending-for-me/'][0].title = '=HYPERLINK("https://example.invalid","Synthetic formula")';
  if (name === 'read-only') {
    queues['/procurement/requisitions/pending-for-me/'][0].can_approve = false;
    queues['/procurement/orders/pending-for-me/'][0].can_approve = false;
  }
  if (name === 'long-summary') {
    const row = queues['/procurement/requisitions/pending-for-me/'][0];
    row.department = 'Engineering and Project Services / Engineering, Procurement and Construction Management';
    row.title = 'Engineering review and approval of long-lead safety equipment for offshore construction';
    row.description_reason = 'The project requires safety equipment for the next offshore construction phase. Engineering has recorded the technical scope and procurement must confirm the delivery schedule, inspection records and supplier documentation before release. The review includes site readiness, inspection coordination, documented commercial terms and the approval authority assigned to each stage. No purchase should be released until the recorded approval sequence is complete.';
    row.approval_workflow_config = ['Engineering technical assessment', 'Project management review', 'Procurement and supply chain review', 'Finance budget authorization', 'Operations management approval', 'Executive delegated authority'].map((stage, index) => ({ stage, level: index + 1, status: index === 0 ? 'approved' : index === 1 ? 'in_review' : 'pending', user_name: ['Nadia Hassan', 'Alex Morgan', 'Taylor Reed', 'Omar Shah', 'Sam Reed', 'Liam Khan'][index], ...(index === 0 ? { approved_by_name: 'Nadia Hassan', approved_at: day(2) } : {}) }));
    row.approval_stage = 'project_management_review';
    row.attachments = [{ id: 'scope', name: 'Technical scope and inspection requirements.pdf' }, { id: 'supplier', name: 'Supplier delivery confirmation.pdf' }];
    row.management_approval_evidence = [{ id: 'management', name: 'Recorded project review.pdf' }];
  }
  return { queues, failures, counts };
}

export function approvalDetail(fixture, endpoint) {
  for (const rows of Object.values(fixture.queues)) for (const row of rows) if (endpoint.endsWith(`/${row.id}/`)) return structuredClone(row);
  return null;
}
