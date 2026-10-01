import { expect } from '@playwright/test';
import { proposalReviewPdf } from './sales-proposal-pdf.fixture';

export const proposalId = 'proposal-one';
export const currentDocumentId = '00000000-0000-4000-8000-000000000002';
export const olderDocumentId = '00000000-0000-4000-8000-000000000001';
const author = { id: 11, name: 'Engineering lead' };
const date = '2026-10-01T05:30:00Z';
const rootOne = '00000000-0000-4000-8000-000000000011';
const rootTwo = '00000000-0000-4000-8000-000000000012';
export const initialThreads = () => [
  { id: rootOne, parent_id: null, body: 'Please confirm whether civil / structural engineering is included in this revision.',
    kind: 'required_change', page_number: 2, context: 'Engineering scope', author, created_at: date,
    anchor: { rects: [{ x: 34 / 612, y: 259 / 842, width: 531 / 612, height: 17 / 842 }], quote: 'The services include process, piping...' },
    is_resolved: false, resolved_by: null, resolved_at: null },
  { id: rootTwo, parent_id: null, body: 'Add a duration and list the client inputs needed to start.', kind: 'comment',
    page_number: 2, context: 'Programme', author: { id: 12, name: 'Sales manager' }, created_at: '2026-10-01T05:45:00Z',
    anchor: { rects: [{ x: 34 / 612, y: 612 / 842, width: 439 / 612, height: 17 / 842 }], quote: '' },
    is_resolved: false, resolved_by: null, resolved_at: null },
  { id: '00000000-0000-4000-8000-000000000013', parent_id: rootTwo,
    body: 'We will add the input register and confirm the duration.', kind: 'comment', page_number: null, context: '',
    author: { id: 13, name: 'Proposal team' }, created_at: '2026-10-01T06:05:00Z', anchor: null,
    is_resolved: false, resolved_by: null, resolved_at: null },
  { id: '00000000-0000-4000-8000-000000000014', parent_id: null,
    body: 'Commercial currency has been checked.', kind: 'comment', page_number: 3, context: 'Commercial overview',
    author, created_at: date, anchor: null, is_resolved: true, resolved_by: author, resolved_at: date },
];
const document = (revision, id) => ({ id, revision, file_id: `radai-${id}`, name: `Proposal_Review_Rev0${revision}.pdf`,
  size: 18524, page_count: 8, created_at: date, created_by: author, is_current: revision === 2, feedback_version: 3 });

export async function prepareProposalReview(page, configuration = {}) {
  const state = {
    quote: { id: proposalId, quote_number: 'P-2026-0142', version: 1, status: 'internal_review', updated_at: date,
      deal_id: 'opportunity-0', deal_code: 'VF-2026-0142', deal_name: 'FEED Engineering Services',
      client_name: 'Demo Client A', prepared_by: { id: 13, name: 'Proposal team' } },
    documents: [document(2, currentDocumentId), document(1, olderDocumentId)],
    comments: { [currentDocumentId]: initialThreads(), [olderDocumentId]: [] },
    submissions: [], requests: [], pageErrors: [], uploads: [], mutations: [],
    capabilities: { can_preview: true, can_download: true, can_bind: true, can_comment: true, can_resolve: true, can_submit: true, deny_reason: '' },
    mutationStatuses: {}, reviewStatus: 200, contentStatus: 200, reviewHolds: {}, contentHolds: {},
    pdf: proposalReviewPdf(), maxUploadBytes: 10485760, ...configuration,
  };
  const commands = new Map();
  const projection = id => {
    const selected = state.documents.find(row => row.id === id) || state.documents[0] || null;
    const comments = state.comments[selected?.id] || [];
    const roots = comments.filter(row => !row.parent_id);
    const isCurrent = selected && selected.id === state.documents[0]?.id;
    return { quote: state.quote, documents: state.documents, documents_count: state.documents.length,
      selected_document: selected, comments, next_comments_cursor: null,
      counts: { all: roots.length, open: roots.filter(row => !row.is_resolved).length, resolved: roots.filter(row => row.is_resolved).length },
      submissions: state.submissions.filter(row => row.document_id === selected?.id), submissions_count: state.submissions.length,
      capabilities: { ...state.capabilities, ...(!isCurrent ? { can_comment: false, can_resolve: false, can_submit: false,
        deny_reason: selected ? 'Historical revision. Select the current revision to add feedback.' : '' } : {}) } };
  };
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-01T06:30:00Z'));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-proposal-review-user'));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (!path.startsWith('/api/v1/')) return route.continue();
    const body = request.method() === 'POST' && !request.headers()['content-type']?.includes('multipart') ? request.postDataJSON() : null;
    state.requests.push({ path, search: url.search, method: request.method(), body });
    if (path.endsWith('/rbac/users/me/')) return route.fulfill({ json: {
      id: 11, user: { id: 11, first_name: 'Aisha', last_name: 'Noor', email: 'aisha@example.test', is_superuser: true },
      roles: [{ code: 'super_admin', name: 'Super Administrator' }], modules: [],
    } });
    if (path.endsWith('/my-profile-photo/')) return route.fulfill({ status: 204, body: '' });
    if (path.endsWith('/review/') && request.method() === 'GET') {
      const selected = url.searchParams.get('document_id');
      if (state.reviewHolds[selected]) await state.reviewHolds[selected];
      return route.fulfill({ status: state.reviewStatus, json: state.reviewStatus === 200 ? projection(selected)
        : { detail: state.reviewStatus === 403 ? 'You no longer have access to this proposal.' : 'Review could not be loaded. Try again.' } });
    }
    if (/\/review\/documents\/[^/]+\/(content|download)\/$/.test(path)) {
      const id = path.split('/documents/')[1].split('/')[0];
      if (state.contentHolds[id]) await state.contentHolds[id];
      if (state.contentStatus !== 200) return route.fulfill({ status: state.contentStatus, json: { detail: 'The document is temporarily unavailable.' } });
      const selected = state.documents.find(row => row.id === id);
      return route.fulfill({ contentType: 'application/pdf', headers: { 'content-disposition': `attachment; filename="${selected?.name || 'review.pdf'}"`, 'cache-control': 'no-store, private' },
        body: state.pdfByDocument?.[id] || state.pdf });
    }
    if (path.includes('/review/') && request.method() === 'POST') {
      const action = path.endsWith('/documents/') ? 'bind' : path.endsWith('/comments/') ? 'comment' : path.endsWith('/resolve/') ? 'resolve' : 'submit';
      state.mutations.push({ action, body, path });
      const errors = state.mutationStatuses[action];
      const status = Array.isArray(errors) ? errors.shift() || 200 : errors || 200;
      if (status !== 200) return route.fulfill({ status, json: { detail: status === 409 ? 'Feedback changed. Refresh before trying again.' : 'The action could not be saved. Your input is retained.' } });
      if (commands.has(body.request_id)) return route.fulfill({ json: { ...commands.get(body.request_id), replayed: true } });
      let selected;
      if (action === 'bind') {
        selected = { ...document(state.documents.length + 1, `00000000-0000-4000-8000-${String(200 + state.documents.length).padStart(12, '0')}`),
          file_id: body.file_id, name: 'Uploaded_review.pdf', is_current: true, feedback_version: 0 };
        state.documents.forEach(row => { row.is_current = false; });
        state.documents.unshift(selected);
        state.comments[selected.id] = [];
      } else {
        const id = path.split('/documents/')[1].split('/')[0];
        selected = state.documents.find(row => row.id === id);
        if (!selected || selected.id !== state.documents[0]?.id) return route.fulfill({ status: 409, json: { detail: 'Historical revision cannot be changed.' } });
        if (body.expected_version !== selected.feedback_version) return route.fulfill({ status: 409, json: { detail: 'Feedback changed. Refresh before trying again.' } });
        selected.feedback_version += 1;
      }
      let result = { document_id: selected.id, feedback_version: selected.feedback_version, request_id: body.request_id, replayed: false };
      if (action === 'comment') {
        const comment = { id: `comment-${state.mutations.length}`, parent_id: body.parent_id || null, body: body.body,
          kind: body.kind || 'comment', page_number: body.page_number || null, anchor: body.anchor || null,
          context: body.context || '', author, created_at: '2026-10-01T06:30:00Z', is_resolved: false, resolved_at: null, resolved_by: null };
        state.comments[selected.id].push(comment); result.comment_id = comment.id;
      }
      if (action === 'resolve') {
        const id = path.split('/comments/')[1].split('/')[0];
        const comment = state.comments[selected.id].find(row => row.id === id);
        if (comment) { comment.is_resolved = body.is_resolved; comment.resolved_by = body.is_resolved ? author : null; comment.resolved_at = body.is_resolved ? date : null; }
        result.comment_id = id;
      }
      if (action === 'submit') {
        const submission = { id: `submission-${state.mutations.length}`, document_id: selected.id, outcome: body.outcome, note: body.note, actor: author, created_at: date };
        state.submissions.push(submission); result.submission_id = submission.id;
      }
      commands.set(body.request_id, result);
      return route.fulfill({ status: action === 'bind' || action === 'comment' ? 201 : 200, json: result });
    }
    if (path.endsWith('/workspace/')) return route.fulfill({ json: { status: 'not_configured', can_upload: false,
      radai_storage: { status: 'ready', can_upload: true, max_upload_bytes: state.maxUploadBytes, folders: [] } } });
    if (path.endsWith('/workspace/folders/proposal/files/')) return route.fulfill({ json: { files: state.availableFiles || [{
      id: 'radai-00000000-0000-4000-8000-000000000090', name: 'Uploaded_review.pdf', size: state.pdf.length, mime_type: 'application/pdf', is_folder: false, storage_provider: 'radai',
    }], next_cursor: null } });
    if (path.endsWith('/workspace/folders/proposal/upload/')) {
      state.uploads.push(request.postDataBuffer().toString());
      return route.fulfill({ status: 201, json: { id: 'radai-00000000-0000-4000-8000-000000000090', name: 'Uploaded_review.pdf', size: state.pdf.length, storage_provider: 'radai' } });
    }
    const quote = { ...state.quote, deal: state.quote.deal_id, deal_details: { id: state.quote.deal_id, deal_code: state.quote.deal_code, deal_name: state.quote.deal_name },
      client_name: state.quote.client_name, deal_name: state.quote.deal_name, total_amount: '100000.00', currency: 'AED', valid_until: '2026-11-01' };
    if (path.endsWith('/quotes/')) return route.fulfill({ json: { count: 1, results: [quote], next: null } });
    if (path.endsWith(`/quotes/${proposalId}/`)) return route.fulfill({ json: quote });
    if (request.method() === 'GET') return route.fulfill({ json: { count: 0, results: [], next: null } });
    return route.fulfill({ status: 400, json: { detail: 'Unexpected synthetic action.' } });
  });
  await page.goto(`/tests/fixtures/sales-proposal-preview.html${configuration.entry ? `?entry=${encodeURIComponent(configuration.entry)}` : ''}`, { waitUntil: 'domcontentloaded' });
  if (!configuration.entry) {
    const back = page.getByRole('link', { name: 'Back to proposals', exact: true }).or(page.getByRole('button', { name: 'Back to proposals', exact: true }));
    await expect.poll(async () => state.pageErrors.length > 0 || await back.count() > 0, { timeout: 70000 }).toBe(true);
    expect(state.pageErrors).toEqual([]);
    await expect(back).toBeVisible();
  }
  return state;
}
