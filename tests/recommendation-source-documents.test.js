import assert from 'node:assert/strict';
import test from 'node:test';
import { getOriginalRecommendationDocuments } from '../src/pages/Procurement/recommendationSourceDocuments.js';

const signed = (sha256, fields = {}) => ({ type: 'signed_purchase_requisition_pdf', sha256, ...fields });

test('the PDF referenced by current approval evidence is first without changing saved attachment indexes', () => {
  const older = signed('older');
  const current = signed('current');
  const later = signed('later', { uploaded_at: '2026-09-16T09:00:00Z' });
  const attachments = [older, current, later];
  assert.deepEqual(getOriginalRecommendationDocuments(attachments, 'current'), [current, later, older]);
  assert.deepEqual(attachments, [older, current, later]);
});

test('without matching approval evidence the latest uploaded signed PDF is first', () => {
  const older = signed('older', { uploaded_at: '2026-09-15T08:00:00Z' });
  const current = signed('current', { uploaded_at: '2026-09-16T08:00:00Z' });
  const quote = { type: 'quotation', uploaded_at: '2026-09-17T08:00:00Z' };
  assert.deepEqual(getOriginalRecommendationDocuments([older, quote, current], 'unknown'), [current, older]);
});

test('legacy sources retain their saved order when no current digest or upload times are known', () => {
  const first = signed('first', { uploaded_at: 'invalid' });
  const second = signed('second');
  assert.deepEqual(getOriginalRecommendationDocuments([null, first, {}, second]), [first, second]);
  assert.deepEqual(getOriginalRecommendationDocuments(null), []);
});

test('a current source without a public link remains selected instead of substituting an older document', () => {
  const older = signed('older', { url: '/media/older.pdf' });
  const current = signed('current', { content_url: '/api/v1/procurement/requisitions/1/uploaded-documents/1/content/' });
  assert.equal(getOriginalRecommendationDocuments([older, current], 'current')[0], current);
});
