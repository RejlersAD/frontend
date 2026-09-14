import { approvalFixture, approvalUsers } from './check-approvals-fixtures.mjs';

export const WORK_HUB_CHECK_TIME = '2026-09-14T08:00:00.000Z';
export const workHubUsers = approvalUsers;
export const baselineFeatures = [
  { id: 'pid', name: 'P&ID Analysis', category: 'engineering', frontend_route: '/pid', description: 'Review engineering drawings', is_active: true },
  { id: 'projects', name: 'Project Control', category: 'project_control', frontend_route: '/projects', description: 'Review project records', is_active: true },
  { id: 'qhse', name: 'QHSE', category: 'quality_assurance', frontend_route: '/qhse', description: 'Quality and assurance records', is_active: true },
  { id: 'sales', name: 'Sales', category: 'sales', frontend_route: '/sales', description: 'Commercial opportunities', is_active: true },
];
export const workHubFeatures = [
  { id: 'pid', name: 'P&ID Analysis', category: 'engineering', frontend_route: '/pid', frontendRoute: '/pid', description: 'Review engineering drawings', is_active: true, status: 'active', module_code: 'pid_analysis' },
  { id: 'projects', name: 'Projects', category: 'project_control', frontend_route: '/projects', frontendRoute: '/projects', description: 'Review project records', is_active: true, status: 'active', module_code: 'project_control' },
  { id: 'qhse', name: 'QHSE', category: 'quality_assurance', frontend_route: '/qhse', frontendRoute: '/qhse', description: 'Quality and assurance records', is_active: true, status: 'active', module_code: 'qhse' },
  { id: 'procurement', name: 'Procurement', category: 'procurement', frontend_route: '/procurement', frontendRoute: '/procurement', description: 'Procurement workspace', is_active: true, status: 'active', module_code: 'procurement' },
  { id: 'sales', name: 'Sales', category: 'sales', frontend_route: '/sales', frontendRoute: '/sales', description: 'Commercial opportunities', is_active: true, status: 'active', module_code: 'sales' },
  { id: 'finance', name: 'Finance', category: 'finance', frontend_route: '/finance', frontendRoute: '/finance', description: 'Financial records', is_active: true, status: 'active', module_code: 'finance' },
].map(feature => ({ ...feature, moduleCode: feature.module_code }));
export const workHubNotifications = [
  { id: 'notice-1', title: 'Project inspection plan requires review', message: 'Review the recorded inspection plan before the scheduled coordination meeting.', priority: 'HIGH', category_name: 'Projects', category_icon: 'folder', is_read: false, created_at: '2026-09-14T07:00:00Z', time_ago: '1 hour', action_url: '/projects?project=project-1', action_label: 'Open project', metadata: {} },
  { id: 'notice-2', title: 'Scheduled workspace maintenance', message: 'The published maintenance notice is available for review.', priority: 'NORMAL', category_name: 'News', category_icon: 'information-circle', is_read: false, created_at: '2026-09-13T08:00:00Z', time_ago: '1 day', action_url: null, action_label: null, metadata: {} },
  { id: 'notice-3', title: 'Leave request approved', message: 'Your annual leave request was approved.', priority: 'NORMAL', category_name: 'HR', category_icon: 'calendar', is_read: true, created_at: '2026-09-12T09:00:00Z', time_ago: '2 days', action_url: '/profile?tab=leave', action_label: 'Review leave', metadata: {} },
  { id: 'notice-4', title: 'Procurement evidence is available', message: 'Recorded supporting documents are available in the approval request.', priority: 'LOW', category_name: 'Procurement', category_icon: 'document', is_read: true, created_at: '2026-09-11T06:00:00Z', time_ago: '3 days', action_url: '/approvals', action_label: 'Review approvals', metadata: {} },
  { id: 'notice-5', title: 'Critical recorded assurance notice', message: 'Review the recorded assurance notice in the source workspace.', priority: 'CRITICAL', category_name: 'QHSE', category_icon: 'information-circle', is_read: false, created_at: '2026-09-10T06:00:00Z', time_ago: '4 days', action_url: '/qhse', action_label: 'Open QHSE', metadata: {} },
  { id: 'notice-6', title: 'Urgent recorded procurement notice', message: 'The procurement notification records an urgent priority.', priority: 'URGENT', category_name: 'Procurement', category_icon: 'document', is_read: true, created_at: '2026-09-09T06:00:00Z', time_ago: '5 days', action_url: '/approvals', action_label: 'Review approvals', metadata: {} },
];

// Synthetic read-only inputs for an immutable before screenshot of the replaced dashboard.
export const baselineDashboardResponses = {
  '/dashboard/usage/': { summary: { total_requests: 42, total_tokens: 12000, total_cost: 3.2 }, daily_totals: [], discipline_breakdown: [] },
  '/dashboard/personal/': { usage_stats: { total_30d: 12 }, recent_activity: [], notifications: [], tasks: [] },
  '/dashboard/aws-status/': { status: 'unavailable', message: 'Synthetic storage source is not connected.' },
  '/dashboard/metrics/': { users: { total_users: 127, active_users: 96 }, documents: { total_documents: 240, pid_drawings: 140, pfd_documents: 70, qhse_documents: 30 }, business: { active_projects: 7, pending_approvals: 16 }, performance: {} },
  '/notifications/': { count: 0, results: [] },
  '/projects/stats/': { active_count: 7, total_count: 12 },
  '/pid/stats/': { total_count: 140, processed_count: 132 },
  '/rbac/ai-champion/champion/current/': {},
};

const source = (source, route, extra = {}) => ({ status: 'ready', reason: '', source, route, ...extra });
export function workHubFixture(name = 'full', { year = 2026, month = 9 } = {}) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = day => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const taskRows = Array.from({ length: 8 }, (_, index) => ({ id: `task-${index + 1}`, title: ['Review offshore inspection plan', 'Confirm pump document package', 'Coordinate engineering review', 'Check supplier delivery dates', 'Prepare site quality checklist', 'Review project reporting schedule', 'Confirm scope documentation', 'Update inspection register'][index], project_id: `project-${index % 3 + 1}`, project_code: `RAD-${index % 3 + 1}`, project_name: ['Offshore construction', 'Pump station upgrade', 'Site inspection programme'][index % 3], status: index === 0 ? 'in_progress' : 'todo', priority: index < 2 ? 'high' : 'medium', due_date: index === 0 ? '2026-09-13' : index === 1 ? '2026-09-10' : index === 2 ? '2026-09-14' : index === 7 ? null : '2026-09-18', route: `/projects?project=project-${index % 3 + 1}` }));
  const calendarRows = [
    { id: 'holiday-1', type: 'public_holiday', title: 'Published regional holiday', start_date: date(14), end_date: date(14), region: 'United Arab Emirates', status: 'published', route: '/profile?tab=schedule' },
    { id: 'leave-1', type: 'leave', title: 'Approved annual leave', start_date: date(20), end_date: date(22), region: null, status: 'approved', route: '/profile?tab=leave' },
    { id: 'holiday-2', type: 'public_holiday', title: 'Published office holiday', start_date: date(23), end_date: date(23), region: 'United Kingdom', status: 'published', route: '/profile?tab=schedule' },
  ];
  const activityRows = Array.from({ length: 10 }, (_, index) => ({ id: `activity-${index + 1}`, type: ['datasheet_generated', 'document_uploaded', 'report_generated'][index % 3], category: ['data_management', 'data_management', 'data_management'][index % 3], title: ['Transformer datasheet generated', 'Document uploaded', 'Report generated'][index % 3], source_label: ['Electrical Engineering', 'Documents', 'Reports'][index % 3], description: ['You generated a transformer datasheet.', 'You uploaded a document.', 'You generated a report.'][index % 3], basis: 'recorded_work_action', timestamp: `2026-09-${String(14 - Math.floor(index / 4)).padStart(2, '0')}T${String(8 - index % 4).padStart(2, '0')}:00:00Z`, success: true, route: null }));
  const report = {
    schema_version: '1.0', as_of: WORK_HUB_CHECK_TIME, period: { year, month, start: date(1), end: date(lastDay), timezone: 'Asia/Dubai' },
    tasks: source('assigned_project_tasks', '/projects', { counts: { open: 8, due_today: 1, overdue: 2, due: 3 }, rows: taskRows, total_rows: 8, returned_rows: 8, truncated: false }),
    leave: source('personal_annual_leave_ledger', '/profile?tab=leave', { balance: 12.5, unit: 'days', year, source_updated_at: '2026-09-10T06:00:00Z', source_timestamp_kind: 'ledger_import_or_save_timestamp', basis: 'recorded_annual_ledger', description: 'Recorded annual ledger balance for the selected year, not a selected-month projection. No accrual or ledger synchronization runs on this read.' }),
    hours: source('personal_daily_work_logs', '/profile?tab=daily_tracker', { value: 84.5, unit: 'hours', entry_count: 12, approved_hours: 64.5, basis: 'logged_work_hours', through_date: '2026-09-14', description: 'Hours entered in your Daily Tracker in this month through the stated date, across all approval states. Approved hours are separate; these are not attendance, billable hours or a capacity target.' }),
    calendar: { status: 'ready', reason: '', sources: [{ id: 'own_leave', status: 'ready', reason: '', total_rows: 1, returned_rows: 1, truncated: false }, { id: 'public_holidays', status: 'ready', reason: '', total_rows: 2, returned_rows: 2, truncated: false }], rows: calendarRows, total_rows: 3, returned_rows: 3, truncated: false, partial: false },
    activity: source('personal_system_activity', null, { total_count: 14, basis: 'recorded_user_actions', coverage: 'work_actions_and_workspace_views', deduplication_window_seconds: 30, series: [1, 0, 1, 2, 2, 4, 4].map((count, index) => ({ date: `2026-09-${String(index + 8).padStart(2, '0')}`, count })), rows: activityRows, returned_rows: 10, truncated: true, period_start: '2026-09-08T00:00:00+04:00', period_end: WORK_HUB_CHECK_TIME, description: 'Recorded work actions and workspace visits for your account over seven calendar days through now. Background requests and session telemetry are excluded.' }),
  };
  const approvals = approvalFixture(name === 'zero' ? 'zero' : name === 'approval-partial' ? 'partial' : 'full');
  if (name === 'zero') {
    Object.assign(report.tasks, { counts: { open: 0, due_today: 0, overdue: 0, due: 0 }, rows: [], total_rows: 0, returned_rows: 0 });
    report.leave.balance = 0;
    Object.assign(report.hours, { value: 0, entry_count: 0, approved_hours: 0 });
    Object.assign(report.calendar, { rows: [], total_rows: 0, returned_rows: 0, sources: report.calendar.sources.map(row => ({ ...row, total_rows: 0, returned_rows: 0 })) });
    Object.assign(report.activity, { total_count: 0, series: report.activity.series.map(row => ({ ...row, count: 0 })), rows: [], returned_rows: 0, truncated: false });
  }
  if (name === 'unavailable' || name === 'source-error') {
    const status = name === 'source-error' ? 'error' : 'unavailable';
    const reason = name === 'source-error' ? 'The source could not be read.' : 'This source is not available for this account.';
    Object.assign(report.tasks, { status, reason, route: null, counts: { open: null, due_today: null, overdue: null, due: null }, rows: [], total_rows: null, returned_rows: 0 });
    Object.assign(report.leave, { status, reason, balance: null });
    Object.assign(report.hours, { status, reason, value: null, entry_count: null, approved_hours: null });
    Object.assign(report.calendar, { status, reason, rows: [], total_rows: null, returned_rows: 0, sources: report.calendar.sources.map(row => ({ ...row, status, reason, total_rows: null, returned_rows: 0 })) });
    Object.assign(report.activity, { status, reason, total_count: null, series: [], rows: [], returned_rows: 0, truncated: false });
  }
  if (name === 'calendar-partial') {
    report.calendar.sources[0] = { id: 'own_leave', status: 'error', reason: 'Own leave could not be read.', total_rows: null, returned_rows: 0, truncated: false };
    Object.assign(report.calendar, { partial: true, total_rows: null, rows: calendarRows.filter(row => row.type === 'public_holiday'), returned_rows: 2, reason: 'Calendar covers available sources only.' });
  }
  if (name === 'negative-balance') report.leave.balance = -0.5;
  if (name === 'truncated') {
    report.tasks.rows.push(...Array.from({ length: 92 }, (_, index) => ({ ...taskRows[index % 8], id: `task-${index + 9}`, title: `Additional assigned project task ${index + 9}`, due_date: '2026-09-28' })));
    Object.assign(report.tasks, { counts: { open: 150, due_today: 20, overdue: 12, due: 32 }, total_rows: 150, returned_rows: 100, truncated: true });
    report.calendar.rows.push(...Array.from({ length: 48 }, (_, index) => ({ ...calendarRows[0], id: `additional-holiday-${index}`, title: `Published regional date ${index + 1}`, start_date: date(index % 28 + 1), end_date: date(index % 28 + 1), region: `Published region ${index + 1}` })));
    Object.assign(report.calendar, { total_rows: 70, returned_rows: 51, truncated: true });
    Object.assign(report.calendar.sources[1], { total_rows: 69, returned_rows: 50, truncated: true });
  }
  const notifications = name === 'zero' ? [] : structuredClone(workHubNotifications);
  if (name === 'unsafe-notice') notifications[0].action_url = 'javascript:alert("synthetic")';
  if (name === 'unknown-notice-read') notifications[0].is_read = null;
  if (name === 'recent-friendly') {
    report.activity.rows[1] = { ...report.activity.rows[1], id: 'view:project-control', type: 'workspace_view', category: 'workspace_navigation', basis: 'workspace_view', title: 'Viewed Project Control', source_label: 'Project Control', description: 'You viewed Project Control.', status_label: 'Viewed', route: '/projects' };
    report.activity.rows[2] = { ...report.activity.rows[2], id: 'view:purchase-orders', type: 'workspace_view', category: 'workspace_navigation', basis: 'workspace_view', title: 'Viewed Purchase orders', source_label: 'Purchase orders', description: 'You viewed Purchase orders.', status_label: 'Viewed', route: null };
    report.activity.rows[4] = { ...report.activity.rows[4], type: 'datasheet_generated', title: 'Transformer datasheet generation unsuccessful', source_label: 'Electrical Engineering', description: 'Transformer datasheet generation was unsuccessful.', success: false };
  }
  if (name === 'recent-views-only') {
    Object.assign(report.activity, { total_count: 3, returned_rows: 3, truncated: false,
      series: report.activity.series.map((row, index) => ({ ...row, count: index === 6 ? 3 : 0 })),
      rows: [
        { id: 'view:project-control', type: 'workspace_view', category: 'workspace_navigation', title: 'Viewed Project Control', source_label: 'Project Control', description: 'You viewed Project Control.', basis: 'workspace_view', status_label: 'Viewed', timestamp: WORK_HUB_CHECK_TIME, success: true, route: '/projects' },
        { id: 'view:sales', type: 'workspace_view', category: 'workspace_navigation', title: 'Viewed Sales opportunities', source_label: 'Sales opportunities', description: 'You viewed Sales opportunities.', basis: 'workspace_view', status_label: 'Viewed', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
        { id: 'view:quality', type: 'workspace_view', category: 'workspace_navigation', title: 'Viewed Quality', source_label: 'Quality', description: 'You viewed Quality.', basis: 'workspace_view', status_label: 'Viewed', timestamp: WORK_HUB_CHECK_TIME, success: true, route: '/qhse/general/quality' },
      ] });
  }
  if (name === 'recent-legacy') {
    delete report.activity.basis;
    delete report.activity.coverage;
    report.activity.rows = [
      { id: 'legacy-get', type: 'api_request', category: 'api', description: 'GET /api/v1/dashboard/work-hub/?month=9', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
      { id: 'legacy-post', type: 'api_request', category: 'api', description: 'POST /api/v1/pid/drawings/ HTTP 201', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
      { id: 'legacy-poll', type: 'api_request', category: 'api', description: 'GET /api/v1/notifications/?limit=100', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
      { id: 'legacy-auth', type: 'user_login', category: 'authentication', description: 'User logged in from 192.0.2.1', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
      { id: 'legacy-upload', type: 'document_uploaded', category: 'data_management', description: 'Uploaded an engineering document', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
    ];
    report.activity.returned_rows = 5;
  }
  if (name === 'recent-mixed') {
    report.activity.rows.unshift(
      { id: 'unexpected-api-get', type: 'api_request', category: 'api', title: 'GET /api/v1/dashboard/work-hub/', source_label: 'API', description: 'GET /api/v1/dashboard/work-hub/', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
      { id: 'unexpected-api-post', type: 'api_request', category: 'api', title: 'POST /api/v1/pid/drawings/', source_label: 'API', description: 'POST /api/v1/pid/drawings/', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
      { id: 'unexpected-raw-title', type: 'document_uploaded', category: 'data_management', title: 'GET /api/v1/documents/', source_label: 'Documents', timestamp: WORK_HUB_CHECK_TIME, success: true, route: null },
    );
    report.activity.rows[3].description = 'POST /api/v1/electrical/datasheets/ internal request';
  }
  report.activity.view_count = report.activity.status === 'ready' ? name === 'recent-friendly' ? 2 : name === 'recent-views-only' ? 3 : 0 : null;
  report.activity.work_action_count = report.activity.status === 'ready' ? report.activity.total_count - report.activity.view_count : null;
  report.activity.collapsed_view_count = report.activity.status === 'ready' ? 0 : null;
  return { report, approvals, notifications };
}
