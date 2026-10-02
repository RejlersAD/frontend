import { expect } from '@playwright/test';
import { proposalReviewPdf } from './sales-proposal-pdf.fixture';

export const proposalRegisterTime = '2026-10-01T06:30:00Z';
export const proposalRegisterDocumentId = '00000000-0000-4000-8000-000000000203';
export const proposalRegisterId = index => `00000000-0000-4000-8000-${String(142 - index).padStart(12, '0')}`;
const folderNames = ['Correspondence', 'Tender', 'Proposal', 'Internal', 'Submitted', 'Award'];
const owners = [{ id: 11, name: 'Aisha Noor', full_name: 'Aisha Noor', first_name: 'Aisha', last_name: 'Noor' },
  { id: 12, name: 'Omar Ali', full_name: 'Omar Ali', first_name: 'Omar', last_name: 'Ali' }];
const titles = ['FEED Engineering Services', 'Electrical Design Review', 'Piping Stress Analysis',
  'Civil Condition Assessment', 'Process Safety Study', 'Instrumentation Upgrade'];
const states = ['internal_review', 'draft', 'ready_to_submit', 'submitted', 'internal_review', 'draft'];
const listFields = ['id', 'quote_number', 'version', 'deal', 'deal_name', 'deal_code', 'submission_due_date', 'service_categories',
  'client', 'client_name', 'status', 'total_amount', 'currency', 'issue_date', 'valid_until', 'prepared_by', 'prepared_by_name',
  'created_at', 'estimated_cost', 'expected_margin_percent', 'approved_by', 'approved_at', 'submitted_version_hash', 'submission_recipient'];
const listProjection = row => Object.fromEntries(listFields.map(key => [key, row[key]]));
const detailProjection = row => Object.fromEntries(Object.entries(row).filter(([key]) => ![
  'deal_code', 'deal_name', 'client_name', 'prepared_by_name', 'submission_due_date', 'service_categories',
].includes(key)));

// All records are synthetic API responses. No fixture writes to the app database.
// The deliberately different Quote/PDF/file revisions catch accidental conflation.
export function proposalRegisterRow(index, changes = {}) {
  const owner = owners[index % owners.length];
  const clientId = `client-${index % 3 + 1}`;
  const dealId = `opportunity-${index + 1}`;
  const status = states[index % states.length];
  const approved = ['ready_to_submit', 'submitted'].includes(status);
  const version = index === 0 ? 2 : index % 3 + 1;
  const submissionDue = `2026-10-${String(9 + index).padStart(2, '0')}`;
  const client = { id: clientId, company_name: `Demo Client ${String.fromCharCode(65 + index % 3)}`,
    status: 'active', new_proposals_permitted: true };
  const deal = { id: dealId, deal_code: `VF-2026-${String(142 - index).padStart(4, '0')}`,
    deal_name: titles[index % titles.length] + (index >= titles.length ? ` ${index + 1}` : ''),
    client: clientId, client_name: client.company_name, owner: owner.id, owner_name: owner.name,
    stage: 'proposal', bid_decision: 'bid', scope_type: 'feed', service_categories: ['engineering_design'],
    submission_due_date: submissionDue, expected_close_date: '2026-12-15', currency: 'AED', estimated_value: '250000.00' };
  return {
    id: proposalRegisterId(index), quote_number: `P-2026-${String(142 - index).padStart(4, '0')}`, version,
    deal: dealId, deal_code: deal.deal_code, deal_name: deal.deal_name, deal_details: deal,
    client: clientId, client_name: client.company_name, client_details: client,
    prepared_by: owner.id, prepared_by_name: owner.name, prepared_by_details: owner,
    status, scope: 'Engineering design and execution approach for the agreed scope.',
    deliverables: ['Design basis', 'Engineering deliverables register'], estimated_hours: { total: 1200 },
    assumptions: [], exclusions: [], disciplines: ['Process'], risks: [], line_items: [],
    subtotal: '250000.00', total_amount: '250000.00', estimated_cost: '190000.00',
    tax_amount: '0.00', discount_amount: '0.00', expected_margin_percent: '24.00', currency: 'AED',
    issue_date: '2026-10-01', valid_until: '2026-12-31', submission_due_date: submissionDue,
    service_categories: ['engineering_design'],
    payment_terms: 'As agreed in the proposal.', notes: '', pdf_file_path: '',
    approved_by: approved ? 12 : null, approved_at: approved ? '2026-09-30T07:00:00Z' : null,
    approval_history: approved ? [{ decision: 'approved', actor_id: '12', at: '2026-09-30T07:00:00Z', comment: 'Proposal content reviewed.' }] : [],
    sent_date: status === 'submitted' ? '2026-10-01T05:00:00Z' : null,
    submitted_version_hash: status === 'submitted' ? 'a'.repeat(64) : '',
    submission_recipient: status === 'submitted' ? 'client@example.test' : '',
    submission_evidence: status === 'submitted' ? 'Synthetic submission receipt 42' : '',
    created_at: proposalRegisterTime, updated_at: proposalRegisterTime,
    ...changes,
  };
}

const reviewDocument = () => ({ id: proposalRegisterDocumentId, revision: 3,
  file_id: 'radai-00000000-0000-4000-8000-000000000093', name: 'Technical_Proposal.pdf',
  size: 18432, page_count: 8, created_at: proposalRegisterTime, created_by: owners[0],
  is_current: true, feedback_version: 2 });
const proposalFiles = () => [
  { id: 'radai-00000000-0000-4000-8000-000000000093', name: 'Technical_Proposal.pdf', size: 18432,
    mime_type: 'application/pdf', version: '1', storage_provider: 'radai', is_folder: false,
    modified_at: proposalRegisterTime, created_at: proposalRegisterTime, modified_by: owners[0], web_url: null },
  { id: 'radai-00000000-0000-4000-8000-000000000094', name: 'Commercial_Proposal.xlsx', size: 9120,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', version: '1', storage_provider: 'radai', is_folder: false,
    modified_at: proposalRegisterTime, created_at: proposalRegisterTime, modified_by: owners[1], web_url: null },
  ...['Scope_Clarifications.docx', 'Deliverables_Register.xlsx', 'Tender_Requirements.pdf', 'Cost_Estimate.xlsx'].map((name, index) => ({
    id: `radai-00000000-0000-4000-8000-${String(95 + index).padStart(12, '0')}`, name, size: 2048 + index,
    mime_type: name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream', version: '1', storage_provider: 'radai',
    is_folder: false, modified_at: proposalRegisterTime, created_at: proposalRegisterTime, modified_by: owners[0], web_url: null,
  })),
];

function reviewProjection(row, state) {
  const documents = state.noDocuments ? [] : [reviewDocument()];
  const roots = state.reviewComments.filter(comment => !comment.parent_id);
  return {
    quote: { id: row.id, quote_number: row.quote_number, version: row.version, status: row.status,
      updated_at: row.updated_at, deal_id: row.deal, deal_code: row.deal_code, deal_name: row.deal_name,
      client_name: row.client_name, prepared_by: row.prepared_by_details },
    documents, documents_count: documents.length, selected_document: documents[0] || null,
    comments: state.reviewComments, next_comments_cursor: null, submissions: state.reviewSubmissions,
    submissions_count: state.reviewSubmissions.length,
    counts: { all: roots.length, open: roots.filter(item => !item.is_resolved).length,
      resolved: roots.filter(item => item.is_resolved).length },
    capabilities: { can_preview: true, can_download: true, can_bind: !row.approved_at,
      can_comment: true, can_resolve: true, can_submit: true, deny_reason: '', ...state.reviewCapabilities },
  };
}

const responseStatus = (source, id) => {
  const configured = typeof source === 'number' ? source : source?.[id];
  return Array.isArray(configured) ? configured.shift() || 200 : configured || 200;
};

export async function prepareProposalRegister(page, configuration = {}) {
  const state = {
    rows: Array.from({ length: 6 }, (_, index) => proposalRegisterRow(index)),
    requests: [], mutations: [], exports: [], pageErrors: [], unexpected: [],
    listStatus: 200, listPageSize: 3, detailStatuses: {}, detailHolds: {}, reviewStatuses: {}, reviewHolds: {},
    patchStatuses: {}, createStatuses: [200], approveStatuses: {}, submitStatuses: {}, exportStatus: 200,
    reviewComments: [], reviewSubmissions: [], reviewCapabilities: {}, noDocuments: false,
    files: proposalFiles(), pdf: proposalReviewPdf(), ...configuration,
  };
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date(proposalRegisterTime));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-proposal-register-user'));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (!path.startsWith('/api/v1/')) return route.continue();
    const method = request.method();
    const body = ['POST', 'PATCH'].includes(method) && request.headers()['content-type']?.includes('json') ? request.postDataJSON() : null;
    state.requests.push({ path, search: url.search, method, body });
    if (path.endsWith('/rbac/users/me/')) return route.fulfill({ json: {
      id: 11, user: { id: 11, first_name: 'Aisha', last_name: 'Noor', email: 'aisha@example.test', is_superuser: true },
      roles: [{ code: 'super_admin', name: 'Super Administrator' }], modules: [],
    } });
    if (path.endsWith('/my-profile-photo/')) return route.fulfill({ status: 204, body: '' });
    if (path.endsWith('/notifications/push-config/')) return route.fulfill({ json: { enabled: false } });
    if (path.endsWith('/notifications/unread_count/')) return route.fulfill({ json: { unread_count: 0 } });
    if (/\/procurement\/(requisitions|orders)\/pending-for-me\/$/.test(path)) return route.fulfill({ json: { count: 0, results: [] } });
    if (path.endsWith('/quotes/preparation-opportunities/') && method === 'GET') {
      const pending = url.searchParams.get('pending_only') === 'true';
      const status = responseStatus(pending ? state.readinessStatus : state.candidateStatus);
      if (state.candidateHold && !pending) await state.candidateHold;
      if (status !== 200) return route.fulfill({ status, json: { detail: 'Opportunity choices are unavailable with current access.' } });
      const all = state.candidates || state.rows.map(row => ({ ...row.deal_details, has_proposal: true, can_create_proposal: true, blocked_reason: '' }));
      const covered = new Set(state.rows.map(row => row.deal));
      const items = [...new Map(all.map(row => [row.id, row])).values()].filter(row => !pending || !covered.has(row.id));
      const number = Number(url.searchParams.get('page')) || 1, size = state.candidatePageSize || 2, start = (number - 1) * size;
      return route.fulfill({ json: { count: items.length, results: items.slice(start, start + size), previous: number > 1 ? '?page=1' : null, next: start + size < items.length ? `?page=${number + 1}` : null } });
    }
    if (path.endsWith('/quotes/') && method === 'GET') {
      if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { detail: 'The proposal register could not be loaded.' } });
      const pageNumber = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const pageSize = Math.min(Number(url.searchParams.get('page_size')) || state.listPageSize, state.listPageSize);
      const start = (pageNumber - 1) * pageSize;
      return route.fulfill({ json: { count: state.rows.length, results: state.rows.slice(start, start + pageSize).map(listProjection),
        next: start + pageSize < state.rows.length ? `/api/v1/sales/quotes/?page=${pageNumber + 1}` : null } });
    }
    if (path.endsWith('/quotes/') && method === 'POST') {
      state.mutations.push({ action: 'create', body, path });
      const status = state.createStatuses.shift() || 200;
      if (status !== 200) return route.fulfill({ status, json: { scope: ['The proposal could not be saved. Check the scope and retry.'] } });
      const index = state.rows.length;
      const sourceDeal = [...state.rows.map(row => row.deal_details), ...(state.candidates || [])].find(deal => deal.id === body.deal);
      const created = proposalRegisterRow(index, { ...body, id: proposalRegisterId(index + 50), deal_details: sourceDeal,
        deal_code: sourceDeal.deal_code, deal_name: sourceDeal.deal_name, client_name: sourceDeal.client_name });
      state.rows.unshift(created);
      return route.fulfill({ status: 201, json: detailProjection(created) });
    }
    if (path.endsWith('/quotes/export/')) {
      state.exports.push({ body, method });
      if (state.exportStatus !== 200) return route.fulfill({ status: state.exportStatus, json: { detail: 'You do not have permission to export proposals.' } });
      return route.fulfill({ contentType: 'text/csv', headers: { 'content-disposition': 'attachment; filename="sales-proposals.csv"' },
        body: 'VF code,Proposal,Revision\r\nVF-2026-0142,P-2026-0142,2\r\n' });
    }
    const match = path.match(/\/sales\/quotes\/([^/]+)\/(.*)$/);
    if (match) {
      const row = state.rows.find(item => item.id === decodeURIComponent(match[1]));
      if (!row) return route.fulfill({ status: 404, json: { detail: 'This proposal is unavailable.' } });
      const suffix = match[2];
      if (!suffix && method === 'GET') {
        const snapshot = structuredClone(detailProjection(row));
        if (state.detailHolds[row.id]) await state.detailHolds[row.id];
        const status = responseStatus(state.detailStatuses, row.id);
        return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'This proposal is no longer available to you.' } });
      }
      if (!suffix && method === 'PATCH') {
        state.mutations.push({ action: 'edit', body, path });
        const status = responseStatus(state.patchStatuses, row.id);
        if (status !== 200) return route.fulfill({ status, json: { detail: 'Changes could not be saved. Your draft is retained.' } });
        Object.assign(row, body);
        return route.fulfill({ json: detailProjection(row) });
      }
      if (suffix === 'approve/' || suffix === 'send_to_client/') {
        const action = suffix === 'approve/' ? 'approve' : 'submit';
        state.mutations.push({ action, body, path });
        const status = responseStatus(action === 'approve' ? state.approveStatuses : state.submitStatuses, row.id);
        if (status !== 200) return route.fulfill({ status, json: { detail: action === 'approve' ? 'You are not eligible to approve this proposal.' : 'Submission could not be recorded. Keep the recipient and evidence.' } });
        if (action === 'approve') Object.assign(row, { status: 'ready_to_submit', approved_by: 11, approved_at: proposalRegisterTime,
          approval_history: [{ decision: 'approved', actor_id: '11', at: proposalRegisterTime, comment: body.comment || '' }] });
        else Object.assign(row, { status: 'submitted', submission_recipient: body.recipient, submission_evidence: body.evidence,
          submitted_version_hash: 'b'.repeat(64), sent_date: proposalRegisterTime });
        return route.fulfill({ json: detailProjection(row) });
      }
      if (suffix === 'review/' && method === 'GET') {
        const snapshot = reviewProjection(row, state);
        if (state.reviewHolds[row.id]) await state.reviewHolds[row.id];
        const status = responseStatus(state.reviewStatuses, row.id);
        return route.fulfill({ status, json: status === 200 ? snapshot : { detail: 'Review document metadata is unavailable.' } });
      }
      if (/^review\/documents\/[^/]+\/(content|download)\/$/.test(suffix)) return route.fulfill({ contentType: 'application/pdf',
        headers: { 'content-disposition': 'attachment; filename="Technical_Proposal.pdf"' }, body: state.pdf });
    }
    if (path.endsWith('/deals/') && method === 'GET') return route.fulfill({ json: { count: state.rows.length,
      results: state.rows.map(row => row.deal_details), next: null } });
    if (path.endsWith('/clients/') && method === 'GET') return route.fulfill({ json: { count: 3,
      results: [...new Map(state.rows.map(row => [row.client, row.client_details])).values()], next: null } });
    if (path.endsWith('/workspace/')) {
      const counts = [1, 2, state.files.length, 1, 0, 0];
      const folders = folderNames.map((name, index) => ({ key: name.toLowerCase(), name, item_count: counts[index] }));
      return route.fulfill({ json: { status: 'not_configured', can_upload: false, folders,
        radai_storage: { status: 'ready', can_upload: true, max_upload_bytes: 10485760, message: '', folders } } });
    }
    if (path.endsWith('/workspace/folders/proposal/files/')) return route.fulfill({ json: { files: state.files, next_cursor: null } });
    if (/\/sales\/deals\/[^/]+\/$/.test(path)) {
      const id = path.split('/deals/')[1].split('/')[0];
      return route.fulfill({ json: state.rows.find(row => row.deal === id)?.deal_details || {} });
    }
    // Count-only calls belong to the old generic controller and do not carry
    // fixture business records into unrelated Sales modules.
    if (method === 'GET' && /\/sales\/(frameworks|forecasts|project-handovers|email-intakes)\/$/.test(path))
      return route.fulfill({ json: { count: 0, results: [], next: null } });
    state.unexpected.push({ path, method });
    return route.fulfill({ status: 404, json: { detail: 'Unexpected synthetic API request.' } });
  });
  const entry = configuration.entry || `/sales/proposals?record=${proposalRegisterId(0)}`;
  await page.goto(`/tests/fixtures/sales-proposal-preview.html?entry=${encodeURIComponent(entry)}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => state.pageErrors.length > 0 || await page.getByRole('region', { name: 'Proposal register', exact: true }).count() > 0,
    { timeout: 70000 }).toBe(true);
  expect(state.pageErrors).toEqual([]);
  await expect(page.getByRole('region', { name: 'Proposal register', exact: true })).toBeVisible({ timeout: 70000 });
  return state;
}
