import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, summaryOf, decisionSignals } from '../src/pages/Sales/salesBidDecision.js';
import { RadaiScore } from '../src/pages/Sales/salesOpportunityRadai.js';

test('missing commercial facts remain unknown and genuine zero remains known', () => {
  for (const value of [null, undefined, '', false]) {
    assert.equal(formatMoney(value, 'AED'), 'Not provided');
    assert.equal(summaryOf({ win_probability: value }).winProb, null);
    assert.equal(decisionSignals({ estimated_value: value }).hasValue, false);
  }
  assert.match(formatMoney(0, 'AED'), /0/);
  assert.equal(summaryOf({ win_probability: 0 }).winProb, 0);
  assert.equal(decisionSignals({ estimated_value: 0 }).hasValue, true);
});

test('missing and omitted commercial values give the same advisory score', () => {
  assert.deepEqual(RadaiScore({ estimated_value: null, win_probability: null }), RadaiScore({}));
});
