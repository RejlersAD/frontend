import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisProgress } from '../src/pages/Sales/salesOpportunityAnalysis.js';

test('queued responses with missing counters report zero progress', () => {
  assert.deepEqual(analysisProgress({ total: 3 }), { total: 3, ready: 0, partial: 0, failed: 0, processed: 0, percent: 0 });
  assert.equal(analysisProgress(null).percent, 0);
});
test('partial and unreadable sources count as processed, not fully read', () => {
  const result = analysisProgress({ total: 3, ready: 1, partial: 1, failed: 1 });
  assert.equal(result.percent, 100);
  assert.equal(result.ready, 1);
});
test('malformed and over-total counters cannot produce NaN or overflow', () => {
  assert.equal(analysisProgress({ total: 3, ready: 99 }).percent, 100);
  assert.equal(analysisProgress({ total: NaN, ready: Infinity }).percent, 0);
  assert.equal(analysisProgress({ total: 3, ready: -2, partial: 'bad' }).processed, 0);
});
