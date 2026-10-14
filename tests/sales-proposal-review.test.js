import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalReviewProjection, proposalReviewError, mergeReviewComments, proposalThreads } from '../src/pages/Sales/salesProposalReview.js';

const document = { id: 'document-a', name: 'Tender.pdf', revision: 1, page_count: 4, feedback_version: 2, is_current: true };
const projection = () => ({ quote: { id: 'proposal-a' }, documents: [document], selected_document: document, comments: [], submissions: [], counts: { all: 0, open: 0, resolved: 0 }, capabilities: { can_preview: true, can_comment: true, can_submit: true } });

test('foreign proposal or mismatched selected revision cannot enable commands', () => {
  assert.throws(() => proposalReviewProjection(projection(), 'proposal-b'));
  assert.throws(() => proposalReviewProjection(projection(), 'proposal-a', 'document-b'));
});
test('review capabilities use actual boolean grants and reject invalid revision tokens', () => {
  const response = projection(); response.capabilities = { can_comment: 'true', can_preview: true, can_submit: 1 };
  const parsed = proposalReviewProjection(response, 'proposal-a');
  assert.equal(parsed.capabilities.can_comment, false); assert.equal(parsed.capabilities.can_submit, false); assert.equal(parsed.capabilities.can_preview, true);
  assert.throws(() => proposalReviewProjection({ ...response, selected_document: { ...document, feedback_version: '2' } }, 'proposal-a'));
});
test('unavailable or malformed comments are not presented as an empty successful review', () => {
  assert.throws(() => proposalReviewProjection({ ...projection(), comments: null }, 'proposal-a'));
  assert.throws(() => proposalReviewProjection({ ...projection(), counts: { all: null, open: 0, resolved: 0 } }, 'proposal-a'));
  assert.throws(() => proposalReviewProjection({ ...projection(), comments: [{ id: 'thread-a', body: null, is_resolved: false }] }, 'proposal-a'));
});
test('historical selection remains valid outside a bounded latest-document list', () => {
  const historical = { ...document, id: 'older-document', is_current: false };
  assert.equal(proposalReviewProjection({ ...projection(), selected_document: historical }, 'proposal-a', historical.id).selected_document.id, historical.id);
});
test('pagination merges repeated comments without duplicating threads or losing replies', () => {
  const root = { id: 'thread-a', parent_id: null, body: 'Scope', is_resolved: false };
  const reply = { id: 'reply-a', parent_id: root.id, body: 'Confirmed', is_resolved: false };
  const merged = mergeReviewComments([root], [root, reply]);
  assert.equal(merged.length, 2);
  assert.deepEqual(proposalThreads(merged), [{ ...root, replies: [reply] }]);
});

test('PDF and anchored comment validation explain the server reason without exposing unknown payloads', () => {
  assert.equal(proposalReviewError({ response: { status: 400, data: { file_id: ['Choose an unencrypted, valid PDF containing 1 to 500 pages.'], internal_storage_key: '/private/attachment/key' } } }), 'PDF: Choose an unencrypted, valid PDF containing 1 to 500 pages.');
  assert.equal(proposalReviewError({ response: { status: 400, data: { anchor: 'Select text inside the selected PDF page.', body: ['Enter a comment.'] } } }), 'Comment: Enter a comment. Selection: Select text inside the selected PDF page.');
  const fallback = 'Unable to save this review.';
  assert.equal(proposalReviewError({ response: { data: { detail: '<html>Provider error</html>', file_id: ['<script>secret</script>'] } } }, fallback), fallback);
  assert.equal(proposalReviewError({ response: { data: { body: ['x'.repeat(1001)], unknown: 'Provider payload' } } }, fallback), fallback);
});
