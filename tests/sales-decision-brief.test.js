import test from 'node:test';
import assert from 'node:assert/strict';
import { noGoBrief } from '../src/pages/Sales/salesDecisionBrief.js';

test('long recorded No-Go reason becomes a short decision briefing', () => {
  const reason = 'Following evaluation, this opportunity does not currently provide sufficient strategic or commercial justification to proceed. '
    + 'The objectives of this engagement include SAP ERP implementation, GBS design and infrastructure activities. '.repeat(20)
    + 'The commercial value is unconfirmed; proposal capacity protects margin and focus.';
  const brief = noGoBrief(reason, 'The opportunity centers on ERP transformation, GBS operating model design, infrastructure design and cybersecurity.');
  assert.match(brief.rationale, /commercial or strategic case/);
  assert.match(brief.tenderContext, /ERP transformation/);
  assert.match(brief.nextAction, /Do not submit a bid/);
  assert.ok(JSON.stringify(brief).length < 500);
  assert.doesNotMatch(JSON.stringify(brief), /The objectives of this engagement/);
});

test('resource-only reason does not invent a commercial concern', () => {
  const brief = noGoBrief('The required specialist resources are unavailable for this bid.', '');
  assert.match(brief.rationale, /resource or proposal-capacity constraints/);
  assert.doesNotMatch(brief.rationale, /commercial/);
  assert.equal(brief.tenderContext, '');
});
