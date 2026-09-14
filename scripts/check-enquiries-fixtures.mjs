export const ENQUIRY_CHECK_TIME = '2026-09-14T08:00:00.000Z';
const now = new Date(ENQUIRY_CHECK_TIME).getTime();
const hoursAgo = hours => new Date(now - hours * 3600000).toISOString();
export const enquiryUsers = {
  admin: { id: 601, username: 'alex.morgan', first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_staff: true, is_superuser: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] },
  employee: { id: 602, username: 'casey.lee', first_name: 'Casey', last_name: 'Lee', email: 'casey.lee@example.test', is_staff: false, is_superuser: false, roles: [{ code: 'employee', name: 'Employee' }] },
};
export const enquiryRepresentatives = [
  { id: 601, name: 'Alex Morgan', email: 'alex.morgan@example.test', department: 'Customer Service', job_title: 'Service Coordinator', employee_id: 'SYN-601' },
  { id: 610, name: 'Dana White', email: 'dana.white@example.test', department: 'IT / Digital', job_title: 'Support Engineer', employee_id: 'SYN-610' },
  { id: 611, name: 'Omar Shah', email: 'omar.shah@example.test', department: 'Finance', job_title: 'Finance Coordinator', employee_id: 'SYN-611' },
];
const definitions = [
  ['Access to project document workspace', 'new', 'urgent', 'IT / Digital', null, -8],
  ['Supplier onboarding document clarification', 'assigned', 'high', 'Procurement', 601, 4],
  ['Invoice allocation requires review', 'in_progress', 'normal', 'Finance', 611, -2],
  ['Site access request awaiting requester reply', 'waiting_user', 'normal', 'Facilities', 601, 28],
  ['Engineering deliverable clarification', 'escalated', 'urgent', 'IT / Digital', 610, -30],
  ['Laptop setup completion confirmation', 'pending_confirmation', 'high', 'IT / Digital', 610, -10],
  ['Updated employment certificate', 'resolved', 'normal', 'Human Resources', 601, -8],
  ['Visitor registration correction', 'closed', 'low', 'Facilities', 601, -20],
  ['Duplicate unsolicited marketing message', 'spam', 'low', 'Unrouted', null, null],
  ['Digital model access still unavailable', 'reopened', 'high', 'IT / Digital', 610, -1],
  ['Service desk guidance provided', 'responded', 'normal', 'Customer Service', 601, 12],
  ['New training portal account', 'new', 'normal', 'Human Resources', null, 40],
  ['Project archive retrieval request', 'new', 'low', 'Customer Service', null, 72],
  ['Purchase order delivery clarification', 'assigned', 'high', 'Procurement', 601, 6],
  ['Timesheet approval support', 'in_progress', 'normal', 'Human Resources', 610, 22],
  ['Meeting room equipment request', 'assigned', 'low', 'Facilities', 601, 48],
  ['Contract document upload problem', 'new', 'urgent', 'IT / Digital', null, -5],
  ['Payment advice copy requested', 'waiting_user', 'normal', 'Finance', 611, 30],
  ['Workspace permissions confirmed', 'closed', 'normal', 'IT / Digital', 610, -12],
  ['Office parking permit', 'assigned', 'low', 'Facilities', 601, 66],
  ['Shared mailbox membership', 'in_progress', 'normal', 'IT / Digital', 610, 26],
  ['External engineering enquiry', 'new', 'normal', 'Customer Service', null, null],
  ['Procurement catalogue correction', 'responded', 'low', 'Procurement', 601, 30],
  ['Annual leave workflow guidance', 'assigned', 'normal', 'Human Resources', 601, 36],
];
const typeFor = department => ({ 'IT / Digital': 'it_request', Finance: 'finance_request', Procurement: 'procurement', 'Human Resources': 'hr', Facilities: 'facility_request' }[department] || 'general');
const rows = definitions.map(([subject, status, urgency, department, assignee, dueHours], index) => {
  const id = index + 101;
  const created = hoursAgo(48 + index * 6);
  const due = dueHours === null ? null : hoursAgo(-dueHours);
  const first = index % 3 === 0 ? null : new Date(new Date(created).getTime() + (index % 4) * 3600000).toISOString();
  const completed = ['resolved', 'closed'].includes(status);
  return {
    id, reference: `ENQ-${String(id).padStart(6, '0')}`, name: ['Maya Collins', 'Liam Khan', 'Nadia Hassan', 'Sam Reed'][index % 4], email: `requester${id}@example.test`, phone: '+971500000001', company: index % 3 ? 'Synthetic Engineering LLC' : '', subject,
    message: `${subject}. This synthetic request contains the information needed to verify triage and routing without contacting a real requester.`, service: typeFor(department), inquiry_type: typeFor(department), inquiry_type_label: typeFor(department).replaceAll('_', ' '), department: department === 'Unrouted' ? '' : department,
    urgency, status, admin_notes: '', channel: index % 3 === 0 ? 'public' : 'internal', escalation_level: status === 'escalated' ? 1 : 0,
    escalated_at: status === 'escalated' ? hoursAgo(3) : null, escalation_reason: status === 'escalated' ? 'Recorded response target has passed.' : '',
    resolution_summary: completed || status === 'pending_confirmation' ? 'Requested support was provided.' : '', resolution_proposed_at: completed || status === 'pending_confirmation' ? hoursAgo(6) : null, resolution_confirmed_at: completed ? hoursAgo(3) : null,
    approval_required: index === 4, approval_status: index === 4 ? 'pending' : 'not_required', approved_by: null, approved_at: null,
    requester: { id: id + 1000, name: ['Maya Collins', 'Liam Khan', 'Nadia Hassan', 'Sam Reed'][index % 4], email: `requester${id}@example.test` },
    assigned_to: enquiryRepresentatives.find(person => person.id === assignee) || null, assigned_at: assignee ? hoursAgo(36 + index) : null,
    due_at: due, first_response_at: first, resolved_at: status === 'resolved' ? hoursAgo(10) : null, closed_at: status === 'closed' ? hoursAgo(index === 7 ? 18 : 15) : null,
    is_overdue: Boolean(due && new Date(due).getTime() < now && !['resolved', 'closed', 'spam', 'pending_confirmation'].includes(status)),
    source_ip: null, user_agent: '', created_at: created, updated_at: hoursAgo(index % 8), attachment_count: index === 0 ? 1 : 0,
  };
});
const groupCounts = (records, key) => records.reduce((result, row) => { const value = row[key] || 'Unrouted'; result[value] = (result[value] || 0) + 1; return result; }, {});
export function enquiryStats(records) {
  const active = records.filter(row => !['resolved', 'closed', 'spam'].includes(row.status));
  const completed = records.filter(row => ['resolved', 'closed'].includes(row.status) && row.due_at);
  const met = completed.filter(row => new Date(row.resolved_at || row.closed_at).getTime() <= new Date(row.due_at).getTime()).length;
  const response = records.filter(row => row.first_response_at).map(row => (new Date(row.first_response_at) - new Date(row.created_at)) / 3600000);
  const validResponse = response.filter(hours => Number.isFinite(hours) && hours >= 0).sort((a, b) => a - b);
  const responseSla = records.filter(row => row.first_response_at && row.due_at && new Date(row.first_response_at) >= new Date(row.created_at) && new Date(row.due_at) >= new Date(row.created_at));
  const responseMet = responseSla.filter(row => new Date(row.first_response_at) <= new Date(row.due_at)).length;
  const medianIndex = Math.floor(validResponse.length / 2);
  const ownerCounts = new Map();
  for (const row of records) if (row.assigned_to) ownerCounts.set(row.assigned_to.id, { id: row.assigned_to.id, name: row.assigned_to.name, count: (ownerCounts.get(row.assigned_to.id)?.count || 0) + 1 });
  return {
    success: true, total: records.length, new: records.filter(row => row.status === 'new').length,
    assigned_to_me: active.filter(row => row.assigned_to?.id === 601).length, unassigned: records.filter(row => !row.assigned_to).length, overdue: records.filter(row => row.is_overdue).length,
    by_status: groupCounts(records, 'status'), by_urgency: groupCounts(records, 'urgency'),
    by_department: Object.entries(groupCounts(records, 'department')).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    by_type: Object.entries(groupCounts(records, 'inquiry_type')).map(([name, count]) => ({ name, count })),
    monthly_trend: records.length ? [{ month: 'Sep 2026', count: records.length }] : [],
    // Preserve legacy empty-cohort fallbacks so browser checks prove the new UI uses the measured fields below.
    sla_compliance: completed.length ? Math.round(met / completed.length * 1000) / 10 : 100,
    average_response_hours: response.length ? Math.round(response.reduce((a, b) => a + b, 0) / response.length * 10) / 10 : 0,
    open_count: active.length, active_unassigned: active.filter(row => !row.assigned_to).length,
    median_response_hours: validResponse.length ? (validResponse.length % 2 ? validResponse[medianIndex] : (validResponse[medianIndex - 1] + validResponse[medianIndex]) / 2) : null,
    response_sample_count: validResponse.length,
    first_response_sla_compliance: responseSla.length ? Math.round(responseMet / responseSla.length * 1000) / 10 : null,
    first_response_sla_sample_count: responseSla.length,
    resolved_this_week: records.filter(row => ['resolved', 'closed'].includes(row.status) && row.resolved_at && new Date(row.resolved_at).getTime() >= Date.parse('2026-09-13T20:00:00Z') && new Date(row.resolved_at).getTime() <= now).length,
    owners: [...ownerCounts.values()],
    funnel: { intake: records.length, assigned: records.filter(row => row.assigned_to && row.status !== 'new').length, in_review: records.filter(row => ['in_progress', 'waiting_user', 'responded'].includes(row.status)).length, resolution: completed.length },
    priority_items: [...active].sort((a, b) => ['urgent', 'high', 'normal', 'low'].indexOf(a.urgency) - ['urgent', 'high', 'normal', 'low'].indexOf(b.urgency)).slice(0, 8),
    deadlines: active.filter(row => row.due_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, 5),
  };
}
export function enquiryFixture(name = 'full') {
  let records = name === 'empty' || name === 'zero' ? [] : structuredClone(rows);
  const failures = {};
  if (name === 'error') { failures['/enquiry/'] = 503; failures['/enquiry/stats/'] = 503; }
  if (name === 'restricted') { failures['/enquiry/'] = 403; failures['/enquiry/stats/'] = 403; }
  if (name === 'stats-error') failures['/enquiry/stats/'] = 503;
  if (name === 'list-error') failures['/enquiry/'] = 503;
  if (name === 'representatives-error') failures['/enquiry/representatives/'] = 503;
  if (name === 'current-owner-missing') records[0].assigned_to = { id: 999, name: 'Former owner', email: 'former.owner@example.test' };
  if (name === 'unknown') for (const row of records) { row.due_at = null; row.first_response_at = null; row.is_overdue = false; row.attachment_count = null; }
  if (name === 'zero-sla') { records = [records[0]]; records[0].first_response_at = hoursAgo(7); }
  if (name === 'instant-response') { records = [records[0]]; records[0].first_response_at = records[0].created_at; }
  if (name === 'large') records = Array.from({ length: 115 }, (_, index) => ({ ...structuredClone(rows[index % rows.length]), id: 500 + index, reference: `ENQ-${String(500 + index).padStart(6, '0')}`, subject: `${rows[index % rows.length].subject} ${index + 1}` }));
  if (name === 'formula') records[0].subject = '=HYPERLINK("https://example.invalid","Synthetic formula")';
  return { rows: records, stats: enquiryStats(records), representatives: structuredClone(enquiryRepresentatives), failures };
}
export function enquiryDetail(row) {
  return { ...structuredClone(row), feedback: null,
    messages: [{ id: row.id * 10, body: row.message, sender_type: 'requester', is_internal: false, author: row.requester, created_at: row.created_at }],
    attachments: row.attachment_count ? [{ id: 1, name: 'synthetic-request-context.txt', content_type: 'text/plain', size: 42, url: `/api/v1/enquiry/${row.id}/attachments/1/`, created_at: row.created_at }] : [],
    activities: [{ id: row.id * 100, action: 'created', actor: row.requester, details: {}, created_at: row.created_at }],
  };
}
