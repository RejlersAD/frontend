import { deadlineInfo, displayDate } from './salesOpportunityRegister.js';

export const proposalDeal = row => row?.deal_details || {};
export const isPreparationOpportunity = row => row?.row_kind === 'preparation';
export const proposalRowKey = row => `${isPreparationOpportunity(row) ? 'opportunity' : 'quote'}:${row.id}`;
export const proposalOwnerId = row => isPreparationOpportunity(row) ? row.owner : row.prepared_by;
export const proposalCode = row => row?.deal_code || proposalDeal(row).deal_code || 'Not provided';
export const proposalTitle = row => row?.deal_name || proposalDeal(row).deal_name || row?.quote_number || 'Untitled proposal';
export const proposalClient = row => row?.client_name || row?.client_details?.company_name || proposalDeal(row).client_name || 'Client not provided';
export const proposalDeadline = row => row?.submission_due_date ?? proposalDeal(row).submission_due_date ?? null;
export const proposalOwner = row => (isPreparationOpportunity(row) ? row.owner_name : row?.prepared_by_name)?.trim() || row?.prepared_by_details?.full_name?.trim() || row?.prepared_by_details?.username || (proposalOwnerId(row) ? 'Name unavailable' : 'Unassigned');
export const proposalApproved = row => Boolean(row?.approved_at);
export const proposalSubmitted = row => Boolean(row?.submitted_version_hash && row?.sent_date);
export const proposalRevision = row => Number.isInteger(row?.version) && row.version >= 0 ? `Rev ${String(row.version).padStart(2, '0')}` : 'Revision unavailable';
export const proposalStatus = row => {
  if (isPreparationOpportunity(row)) return 'Proposal preparation';
  if (row?.status === 'internal_review') return 'In review';
  if (row?.status === 'ready_to_submit' && proposalApproved(row)) return 'Approved';
  return String(row?.status || 'Status unavailable').replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
};
export const proposalBucket = row => {
  if (isPreparationOpportunity(row)) return 'preparation';
  if (['draft', 'scope_development', 'estimation'].includes(row.status)) return 'draft';
  if (['internal_review', 'approval'].includes(row.status)) return 'review';
  if (row.status === 'ready_to_submit' && proposalApproved(row)) return 'approved';
  if (['submitted', 'sent', 'viewed'].includes(row.status)) return 'submitted';
  return 'other';
};
export const proposalDate = (value, short = false) => {
  const date = displayDate(value);
  return short ? date.replace(/ \d{4}$/, '') : date;
};

// Follow page numbers only; never follow a response-provided URL outside this API.
export async function loadProposalRegister(fetchPage) {
  const rows = [], seen = new Set();
  let expected;
  for (let page = 1; page <= 200; page += 1) {
    const data = await fetchPage({ page, page_size: 100, ordering: '-created_at,-id' });
    const batch = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(batch)) throw new Error('The proposal register returned an incomplete response. Refresh to try again.');
    if (expected === undefined && Number.isInteger(data.count)) expected = data.count;
    if (Number.isInteger(data.count) && expected !== data.count) throw new Error('The register changed while loading. Refresh to reload it.');
    for (const row of batch) {
      if (!row?.id || seen.has(String(row.id))) throw new Error('The register changed while loading. Refresh to reload it.');
      seen.add(String(row.id)); rows.push(row);
    }
    if (!data.next) {
      if (expected !== undefined && rows.length !== expected) throw new Error('The register changed while loading. Refresh to reload it.');
      return { results: rows, count: rows.length };
    }
    if (!batch.length) break;
  }
  throw new Error('The complete proposal register could not be loaded. Refresh or contact your administrator.');
}

export function filterProposals(rows, { query = '', view = 'all', owner = '', client = '', deadline = '' }, today) {
  const term = query.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (view !== 'all' && proposalBucket(row) !== view) return false;
    if (owner && (owner === 'unassigned' ? Boolean(proposalOwnerId(row)) : String(proposalOwnerId(row)) !== owner)) return false;
    if (client && String(row.client) !== client) return false;
    if (term && ![proposalCode(row), proposalTitle(row), proposalClient(row), row.quote_number].some(value => String(value || '').toLocaleLowerCase().includes(term))) return false;
    const due = deadlineInfo(proposalDeadline(row), today).days;
    if (deadline === 'missing' && due !== null) return false;
    if (deadline === 'overdue' && !(due !== null && due < 0)) return false;
    if (deadline === 'week' && !(due !== null && due >= 0 && due <= 7)) return false;
    return true;
  });
}

export function sortProposals(rows, key, direction) {
  const value = row => ({ code: proposalCode(row), title: proposalTitle(row), revision: row.version, deadline: proposalDeadline(row), status: proposalStatus(row), owner: proposalOwner(row) })[key];
  return [...rows].sort((a, b) => {
    const left = value(a), right = value(b);
    if (left == null || left === '') return right == null || right === '' ? 0 : 1;
    if (right == null || right === '') return -1;
    const result = key === 'revision' ? Number(left) - Number(right) : String(left).localeCompare(String(right), 'en', { numeric: true });
    return result * (direction === 'desc' ? -1 : 1);
  });
}

export const proposalChecklist = row => [
  { label: 'Scope and deliverables recorded', complete: Boolean(row?.scope?.trim()) && Array.isArray(row?.deliverables) && row.deliverables.length > 0 },
  { label: 'Price and estimate recorded', complete: row?.total_amount != null && row.total_amount !== '' && row?.estimated_cost != null && row.estimated_cost !== '' && Number.isFinite(Number(row.total_amount)) && Number.isFinite(Number(row.estimated_cost)) },
  { label: 'Proposal approval recorded', complete: proposalApproved(row) },
];
