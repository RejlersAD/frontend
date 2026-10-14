const text = value => typeof value === 'string' ? value.trim() : '';
const firstText = (...values) => values.map(text).find(Boolean) || '';

export function enquiryTriageRecord(item, detail) {
  if (!item) return null;
  const matching = item.id !== null && item.id !== undefined && detail?.id !== null
    && detail?.id !== undefined && String(item.id) === String(detail.id);
  return matching ? { ...item, ...detail } : item;
}

export function enquiryTriageDate(value, compact = false) {
  const raw = text(value);
  if (!raw) return 'Not recorded';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleString(undefined, compact
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function enquiryTriageTimeline(record) {
  return [
    { id: 'received', label: 'Received', at: record?.created_at },
    { id: 'triaged', label: 'Triaged', at: null },
    { id: 'assigned', label: 'Assigned', at: record?.assigned_at },
    { id: 'resolved', label: 'Resolved', at: record?.resolved_at },
  ].map(step => ({ ...step, state: enquiryTriageDate(step.at) === 'Not recorded' ? 'unknown' : 'recorded' }));
}

export function enquiryTriageFacts(record) {
  if (!record) return [];
  const ownerRecorded = Object.hasOwn(record, 'assigned_to');
  const owner = firstText(record.assigned_to?.name, record.assigned_to?.email)
    || (ownerRecorded && record.assigned_to === null ? 'Unassigned' : 'Not recorded');
  const category = firstText(record.inquiry_type_label, record.inquiry_type?.replace(/_/g, ' ')) || 'Not recorded';
  return [
    { id: 'requester', label: 'Requester', value: firstText(record.name, record.requester?.name, record.email) || 'Not recorded' },
    { id: 'department', label: 'Department', value: text(record.department) || 'Not routed' },
    { id: 'received', label: 'Received', value: enquiryTriageDate(record.created_at) },
    { id: 'deadline', label: 'SLA deadline', value: enquiryTriageDate(record.due_at), overdue: record.is_overdue === true },
    { id: 'category', label: 'Category', value: category },
    { id: 'owner', label: 'Current owner', value: owner },
  ];
}

export const ENQUIRY_TRIAGE_SUGGESTIONS = [
  { id: 'similar_requests', label: 'Similar requests', value: 'Not available' },
  { id: 'suggested_assignment', label: 'Suggested assignment', value: 'Not available' },
  { id: 'knowledge_article', label: 'Knowledge article', value: 'Not available' },
];
