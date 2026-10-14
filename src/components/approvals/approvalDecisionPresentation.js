const text = value => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const firstText = (...values) => values.map(text).find(Boolean) || '';
const humanize = value => text(value).replace(/_/g, ' ');
const explicitNumber = value => ['string', 'number'].includes(typeof value) && text(value)
  && Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function decisionDate(value) {
  const raw = text(value);
  if (!raw) return 'Not reported';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
  return Number.isNaN(parsed.getTime()) ? 'Not reported'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function approvalDecisionTimestamp(item, details = {}) {
  const recorded = [
    ['Submitted', item?.submitted_at], ['Created', item?.created_at],
    ['Requested', item?.requested_at], ['Submitted', item?.date_submitted],
  ].find(([, value]) => text(value));
  if (recorded) return { label: recorded[0], value: decisionDate(recorded[1]) };
  return { label: details.ageBasis === 'Since submission' ? 'Submitted' : 'Record date',
    value: decisionDate(details.submittedAt) };
}

function statusOf(entry, converted = false) {
  const status = text(entry.status).toLowerCase();
  if (status === 'approved') return 'approved';
  if (['rejected', 'not_approved', 'declined'].includes(status)) return 'rejected';
  if (['pending', 'in_review'].includes(status)) {
    return converted && !entry.evidence_requested_at ? 'unknown' : status;
  }
  return 'unknown';
}

function workflowStep(entry, index, state, active = false) {
  const statusLabel = state === 'approved' ? 'Approved' : state === 'rejected' ? 'Rejected'
    : state === 'in_review' ? 'In review' : state === 'pending' ? active ? 'Awaiting review' : 'Pending' : 'Not reported';
  return {
    id: `recorded-${index}`,
    label: firstText(entry.stage, entry.role) || 'Approval step',
    level: explicitNumber(entry.level),
    state: active && ['pending', 'in_review'].includes(state) ? 'current' : state === 'in_review' ? 'current' : state,
    statusLabel,
    person: firstText(state === 'approved' ? entry.approved_by_name : '', entry.user_name, entry.approver,
      entry.user_email, entry.approver_email, entry.email),
    personLabel: state === 'approved' && text(entry.approved_by_name) ? 'Reviewed by' : 'Approver',
    at: ['approved', 'rejected'].includes(state) ? firstText(entry.decided_at, entry.approved_at, entry.date) : '',
  };
}

function requisitionSteps(item) {
  const entries = Array.isArray(item.approval_workflow_config) && item.approval_workflow_config.length
    ? item.approval_workflow_config : Array.isArray(item.approval_hierarchy) ? item.approval_hierarchy : [];
  const valid = entries.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry && typeof entry === 'object' && !Array.isArray(entry));
  const converted = text(item.status).toLowerCase() === 'converted';
  const pending = valid.filter(({ entry }) => ['pending', 'in_review'].includes(statusOf(entry, converted)));
  const levelsKnown = pending.length > 0 && pending.every(({ entry }) => explicitNumber(entry.level) !== null);
  const activeLevel = levelsKnown ? Math.min(...pending.map(({ entry }) => Number(entry.level))) : null;
  const currentIndex = explicitNumber(item.current_approval_step);
  return valid.map(({ entry, index }) => workflowStep(entry, index, statusOf(entry, converted),
    levelsKnown ? Number(entry.level) === activeLevel : currentIndex !== null && index === currentIndex));
}

function orderSteps(item) {
  const entries = Array.isArray(item.approval_log) ? item.approval_log : [];
  const queue = text(item.approval_queue_id).match(/^(.+):(\d+)$/);
  const queueIndex = queue && queue[1] === String(item.id) ? Number(queue[2]) : null;
  const stage = text(item.approval_stage).toLowerCase();
  const matching = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry
    && statusOf(entry) === 'pending' && text(entry.stage).toLowerCase() === stage && stage);
  const assignedIndex = queueIndex ?? (matching.length === 1 ? matching[0].index : null);
  return entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry && typeof entry === 'object')
    .map(({ entry, index }) => workflowStep(entry, index, statusOf(entry), index === assignedIndex));
}

function leaveSteps(item) {
  const status = text(item.status).toUpperCase();
  if (!['PENDING', 'RM_APPROVED', 'APPROVED', 'RM_REJECTED', 'REJECTED', 'CANCELLED'].includes(status)) return [];
  const directHR = status === 'PENDING' && item.review_stage === 'hr_review';
  const manager = { id: 'leave-manager', label: 'Manager review', personLabel: 'Reviewer',
    person: firstText(item.rm_reviewed_by_name, item.line_manager_name), at: text(item.rm_reviewed_at), level: null,
    state: 'unknown', statusLabel: 'Not reported' };
  const hr = { id: 'leave-hr', label: 'HR approval', personLabel: 'Reviewer', person: text(item.reviewed_by_name),
    at: text(item.reviewed_at), level: null, state: 'unknown', statusLabel: 'Not reported' };
  if (directHR) Object.assign(manager, { state: 'skipped', statusLabel: 'Not required — direct HR' });
  else if (status === 'RM_REJECTED') Object.assign(manager, { state: 'rejected', statusLabel: 'Rejected' });
  else if (status === 'RM_APPROVED') Object.assign(manager, { state: 'approved', statusLabel: 'Approved' });
  else if (status === 'PENDING') Object.assign(manager, { state: 'current', statusLabel: 'Awaiting review' });
  else if (manager.at) Object.assign(manager, { state: 'reported', statusLabel: 'Review recorded' });
  if (status === 'APPROVED') Object.assign(hr, { state: 'approved', statusLabel: 'Approved' });
  else if (status === 'REJECTED') Object.assign(hr, { state: 'rejected', statusLabel: 'Rejected' });
  else if (directHR || status === 'RM_APPROVED') Object.assign(hr, { state: 'current', statusLabel: 'Awaiting review' });
  else if (status === 'PENDING') Object.assign(hr, { state: 'pending', statusLabel: 'Pending manager review' });
  else if (status === 'RM_REJECTED') Object.assign(hr, { state: 'skipped', statusLabel: 'Not reached' });
  else if (hr.at) Object.assign(hr, { state: 'reported', statusLabel: 'Review recorded' });
  return [manager, hr];
}

export function approvalDecisionWorkflow(item) {
  if (!item) return { steps: [], description: 'Select a request to view approval steps.' };
  const type = item._approvalConfig?.id || item._approvalType;
  const steps = type === 'leave' ? leaveSteps(item) : type === 'purchase_order' ? orderSteps(item)
    : type === 'procurement' ? requisitionSteps(item) : [];
  if (steps.length) {
    const levels = steps.map(step => step.level).filter(level => level !== null);
    return { steps, description: new Set(levels).size < levels.length
      ? 'Approvers at the same level review in parallel.' : 'Review history shown where recorded.' };
  }
  const stage = firstText(item.approval_stage, item.workflow_stage, item.review_stage);
  return { steps: stage ? [{ id: 'current-recorded-stage', label: humanize(stage), state: 'reported',
    statusLabel: 'Recorded stage', person: '', at: '', level: null }] : [],
  description: stage ? 'Open details for the full approval history.' : 'Open details to view the approval workflow.' };
}

const listedRecords = values => Array.isArray(values)
  ? values.filter(value => Boolean(text(value)) || Boolean(value && typeof value === 'object' && Object.keys(value).length)).length : null;

export function approvalDecisionEvidence(item) {
  const attachmentCount = listedRecords(item?.attachments);
  const singleAttachment = text(item?.attachment) ? 1 : null;
  const documents = attachmentCount ?? singleAttachment;
  const management = listedRecords(item?.management_approval_evidence);
  return [
    { id: 'supporting_documents', label: 'Supporting documents', icon: 'documents', state: documents === null ? 'unknown' : 'reported',
      value: documents === null ? 'Not reported' : `${documents} listed`,
      description: 'Open the request to review its supporting documents.' },
    { id: 'management_evidence', label: 'Management evidence', icon: 'management', state: management === null ? 'unknown' : 'reported',
      value: management === null ? 'Not reported' : `${management} listed`,
      description: 'Open the request to review its recorded management evidence.' },
    { id: 'budget_assessment', label: 'Budget assessment', icon: 'budget', state: 'unknown', value: 'Not reported',
      description: 'Budget assessment is not available here. Review the request for supporting details.' },
    { id: 'risk_assessment', label: 'Risk assessment', icon: 'risk', state: 'unknown', value: 'Not reported',
      description: 'Risk assessment is not available here. Review the request for supporting details.' },
  ];
}
