import assert from 'node:assert/strict';
import test from 'node:test';
import { classificationState, classificationTone, commandIdentity, patchDocument } from '../src/pages/Sales/salesDocumentControl.js';

test('document lineage updates the head without changing unrelated records or losing stronger classification', () => {
  const original = [{ id: 'old', document_id: 'document', classification: { revision: 3, origin: 'confirmed' } }, { id: 'other' }];
  assert.equal(patchDocument(original, { id: 'old', classification: { revision: 2, origin: 'ai' } })[0].classification.origin, 'confirmed');
  const result = patchDocument(original, { id: 'new', document_id: 'document', version: '2', classification: { revision: 3, origin: 'confirmed' } });
  assert.equal(result.length, 2); assert.equal(result[0].id, 'new'); assert.equal(original[0].id, 'old'); assert.equal(result[1], original[1]);
});

test('identical retry preserves UUID and reviewed changes create a fresh identity', () => {
  const first = commandIdentity(null, { type: 'tq', revision: 1 });
  assert.equal(commandIdentity(first, { type: 'tq', revision: 1 }), first);
  assert.notEqual(commandIdentity(first, { type: 'tq', revision: 2 }).requestId, first.requestId);
});

test('AI and rule provenance stay distinct and confirmation survives new processing', () => {
  assert.equal(classificationState({ origin: 'ai', status: 'completed' }), 'AI suggestion');
  assert.equal(classificationState({ origin: 'rule', status: 'completed' }), 'Auto');
  assert.match(classificationState({ origin: 'confirmed', status: 'queued' }), /^Manual/);
  assert.equal(classificationTone('violet'), 'purple'); assert.equal(classificationTone('emerald'), 'green'); assert.equal(classificationTone('url(untrusted)'), 'gray');
});
