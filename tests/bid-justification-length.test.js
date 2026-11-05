import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBidJustification, conciseGeneratedJustification, GO, NO_GO, wordCount } from '../src/pages/Sales/salesBidDecision.js';

test('Go and No-Go drafts stay short without copying raw correspondence', () => {
  const raw = 'From: supplier Subject: Portal notification https://safelinks.example/?url=' + 'encoded'.repeat(500);
  for (const decision of [GO, NO_GO]) {
    for (const variant of [0, 1, 2]) {
      const draft = generateBidJustification({ deal_name: raw }, decision, variant,
        { available: true, needs: [{ text: raw }], submissions: [{ text: raw }], risks: [{ text: raw }] });
      assert.ok(wordCount(draft) <= 60);
      assert.doesNotMatch(draft, /https:|Subject:|encoded|limited strategic fit|confirmed capacity/);
      assert.match(draft, /Commercial value is unconfirmed/);
    }
  }
});

test('oversized AI output falls back intact rather than truncating caveats', () => {
  const fallback = 'Decline this pursuit. Confirm the reason before saving.';
  assert.equal(conciseGeneratedJustification('word '.repeat(61), fallback), fallback);
  assert.equal(conciseGeneratedJustification('Read https://example.test', fallback), fallback);
  const valid = 'Proceed subject to confirming resources. Capacity is not yet confirmed.';
  assert.equal(conciseGeneratedJustification(valid), valid);
});
