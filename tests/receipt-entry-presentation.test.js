import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptEntrySummary } from '../src/pages/Procurement/receiptEntryPresentation.js';

const line = (overrides = {}) => ({ line_id: 'line:1', description: 'Pipe', uom: 'm', ordered: '10', accepted: '2', pending: '1', available: '7', ...overrides });
const summary = lines => ({ basis: 'quantity', lines });

test('entry totals keep exact large and fractional decimals, including pending reservations', () => {
  const result = receiptEntrySummary(summary([
    line({ ordered: '9007199254740993.600001', accepted: '9007199254740993.1', pending: '0.2', available: '0.300001' }),
    line({ line_id: 'line:2', uom: ' M ', ordered: '0.2', accepted: '0', pending: '0', available: '0.2' }),
  ]), { 'line:1': { received: '0.3' }, 'line:2': { received: '0.2' } });
  assert.deepEqual(result.groups, [{ key: 'quantity:M', label: 'M', ordered: '9007199254740993.800001', previouslyReceived: '9007199254740993.3', received: '0.5', balance: '0.000001' }]);
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
  assert.equal(result.enteredLineCount, 2);
});

test('entry totals separate different units and full coverage considers every group', () => {
  const source = summary([line(), line({ line_id: 'line:2', uom: 'EA', ordered: '3', accepted: '0', pending: '0', available: '3' })]);
  const partial = receiptEntrySummary(source, { 'line:1': { received: '7' } });
  assert.deepEqual(partial.groups.map(group => [group.label, group.ordered, group.received, group.balance]), [['M', '10', '7', '0'], ['EA', '3', '0', '3']]);
  assert.equal(partial.complete, false);
  assert.equal(partial.deliveryStatus, 'partial');
  assert.equal(partial.enteredLineCount, 1);
  assert.equal(receiptEntrySummary(source, { 'line:1': { received: '7' }, 'line:2': { received: '3' } }).complete, true);
  assert.equal(receiptEntrySummary(source, { 'line:1': { received: '7' }, 'line:2': { received: '3' } }).deliveryStatus, 'full');
});

test('proposed rejection retains exact balance while delivery status describes the entered lines', () => {
  const source = summary([
    line({ ordered: '9007199254740993.600001', accepted: '9007199254740993.1', pending: '0.2', available: '0.300001' }),
    line({ line_id: 'line:2', uom: 'EA', ordered: '3', accepted: '0', pending: '0', available: '3' }),
  ]);
  const rejected = receiptEntrySummary(source, { 'line:1': { received: '0.300001', rejected: '0.300001' } });
  assert.equal(rejected.valid, true);
  assert.equal(rejected.enteredLineCount, 1);
  assert.equal(rejected.complete, false);
  assert.equal(rejected.deliveryStatus, 'rejected');
  assert.deepEqual(rejected.groups.map(group => [group.label, group.received, group.balance]), [['M', '0.300001', '0.300001'], ['EA', '0', '3']]);
  const mixed = receiptEntrySummary(source, { 'line:1': { received: '0.300001', rejected: '0.100001' }, 'line:2': { received: '3' } });
  assert.equal(mixed.deliveryStatus, 'partial');
  assert.equal(mixed.groups[0].balance, '0.100001');
  assert.equal(mixed.groups[1].balance, '0');
  assert.equal(mixed.enteredLineCount, 2);
  assert.equal(mixed.complete, false);
});

test('invalid rejection, zero entry and rejected overdelivery cannot create delivery status or readiness', () => {
  for (const draft of [{}, { received: '0', rejected: '0' }, { received: '7.000001', rejected: '7.000001' }, { received: '1', rejected: '2' }, { received: '1', rejected: 'invalid' }, { received: '1', rejected: '0.0000001' }]) {
    const result = receiptEntrySummary(summary([line()]), { 'line:1': draft });
    assert.equal(result.valid, false, JSON.stringify(draft));
    assert.equal(result.complete, false, JSON.stringify(draft));
    assert.equal(result.deliveryStatus, '', JSON.stringify(draft));
    assert.equal(result.enteredLineCount, 0, JSON.stringify(draft));
  }
  assert.equal(receiptEntrySummary(summary([line()]), { 'line:1': { received: '7.000001', rejected: '7.000001' } }).groups[0].balance, null);
});

test('service rejection uses exact currency amounts and retains cent validation', () => {
  const source = { basis: 'service_value', currency: 'AED', lines: [line({ uom: 'AED', ordered: '1000', accepted: '200', pending: '100', available: '700' })] };
  const partial = receiptEntrySummary(source, { 'line:1': { received: '125.25', rejected: '25.100000' } });
  assert.equal(partial.valid, true);
  assert.equal(partial.deliveryStatus, 'partial');
  assert.equal(partial.groups[0].balance, '599.85');
  const rejected = receiptEntrySummary(source, { 'line:1': { received: '125.25', rejected: '125.250000' } });
  assert.equal(rejected.deliveryStatus, 'rejected');
  assert.equal(rejected.groups[0].balance, '700');
  const invalid = receiptEntrySummary(source, { 'line:1': { received: '125.25', rejected: '25.001' } });
  assert.equal(invalid.deliveryStatus, '');
  assert.equal(invalid.enteredLineCount, 0);
  assert.match(invalid.validationMessage, /two decimal places/);
});

test('missing units stay in separate unknown groups and prevent readiness', () => {
  const result = receiptEntrySummary(summary([line({ uom: '' }), line({ line_id: 'line:2', uom: null })]), { 'line:1': { received: '7' }, 'line:2': { received: '7' } });
  assert.equal(result.groups.length, 2);
  for (const group of result.groups) assert.deepEqual([group.ordered, group.previouslyReceived, group.received, group.balance], [null, null, null, null]);
  assert.equal(result.valid, false);
  assert.equal(result.complete, false);
  assert.equal(result.enteredLineCount, 0);
});

test('invalid or missing source balances never enable recording or complete coverage', () => {
  for (const patch of [{ ordered: null }, { accepted: '' }, { pending: undefined }, { available: '-1' }, { available: 'invalid' }, { available: '0' }, { ordered: '0' }, { line_id: '' }]) {
    const result = receiptEntrySummary(summary([line(patch)]), { 'line:1': { received: '7' } });
    assert.equal(result.valid, false, JSON.stringify(patch));
    assert.equal(result.complete, false, JSON.stringify(patch));
    assert.match(result.validationMessage, /balances are unavailable/);
  }
  const missing = receiptEntrySummary(summary([line({ accepted: null })]), { 'line:1': { received: '1' } });
  assert.equal(missing.groups[0].previouslyReceived, null);
  for (const source of [null, {}, { basis: 'unavailable', lines: [line()] }, { basis: 'quantity', lines: [] }, summary([line(), line()])]) {
    assert.equal(receiptEntrySummary(source, { 'line:1': { received: '7' } }).valid, false);
  }
});

test('entry validation rejects invalid, excessive, zero and conflicting rejected amounts', () => {
  const source = summary([line()]);
  for (const received of ['-1', 'invalid', 'Infinity', '7.000000000000000001']) {
    const result = receiptEntrySummary(source, { 'line:1': { received } });
    assert.equal(result.valid, false);
    assert.equal(result.complete, false);
    assert.equal(result.enteredLineCount, 0);
    assert.equal(result.groups[0].balance, null);
  }
  for (const received of ['', '0', '0.000']) {
    assert.equal(receiptEntrySummary(source, { 'line:1': { received } }).valid, false);
  }
  assert.match(receiptEntrySummary(source, { 'line:1': { received: '1', rejected: '2' } }).validationMessage, /cannot exceed/);
});

test('invalid entries propagate unknown totals without losing unrelated groups', () => {
  const result = receiptEntrySummary(summary([line(), line({ line_id: 'line:2', uom: 'EA' })]), { 'line:1': { received: 'invalid' }, 'line:2': { received: '2' } });
  assert.equal(result.groups[0].received, null);
  assert.equal(result.groups[0].balance, null);
  assert.equal(result.groups[1].received, '2');
  assert.equal(result.groups[1].balance, '5');
  assert.equal(result.valid, false);
});

test('service values use their explicit currency and exact decimal balances', () => {
  const source = { basis: 'service_value', lines: [line({ line_id: 'service:total', uom: 'AED', ordered: '1000.00', accepted: '200.00', pending: '100.00', available: '700.00' })] };
  const result = receiptEntrySummary(source, { 'service:total': { received: '125.25' } }, 'aed');
  assert.deepEqual(result.groups, [{ key: 'currency:AED', label: 'AED', ordered: '1000', previouslyReceived: '300', received: '125.25', balance: '574.75' }]);
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
  assert.equal(receiptEntrySummary(source, { 'service:total': { received: '700' } }, 'AED').complete, true);
  const missing = receiptEntrySummary(source, { 'service:total': { received: '700' } });
  assert.equal(missing.valid, false);
  assert.equal(missing.groups[0].ordered, null);
  assert.equal(receiptEntrySummary({ ...source, currency: 'AED' }, { 'service:total': { received: '700' } }).groups[0].label, 'AED');
  const mismatched = receiptEntrySummary(source, { 'service:total': { received: '700' } }, 'USD');
  assert.equal(mismatched.valid, false);
  assert.equal(mismatched.groups[0].received, null);
});

test('quantity readiness follows the server six written decimal place and 18 integer digit limits', () => {
  const source = summary([line()]);
  for (const received of ['1.000001', '1.000000', '000000000000000001']) {
    assert.equal(receiptEntrySummary(source, { 'line:1': { received } }).valid, true, received);
  }
  for (const received of ['1.0000001', '1.0000000', '0000000000000000001']) {
    const result = receiptEntrySummary(source, { 'line:1': { received } });
    assert.equal(result.valid, false, received);
    assert.equal(result.complete, false);
    assert.equal(result.enteredLineCount, 0);
    assert.match(result.validationMessage, /18 integer digits and six decimal places/);
  }
  const boundary = summary([line({ ordered: '999999999999999999.999999', accepted: '0', pending: '0', available: '999999999999999999.999999' })]);
  assert.equal(receiptEntrySummary(boundary, { 'line:1': { received: '999999999999999999.999999' } }).complete, true);
  for (const patch of [{ ordered: '0000000000000000010' }, { pending: '1.0000000' }, { accepted: '2.0000001' }, { available: '7.0000000' }]) {
    assert.equal(receiptEntrySummary(summary([line(patch)]), { 'line:1': { received: '1' } }).valid, false);
  }
});

test('service readiness allows trailing zeros through six places but rejects nonzero precision after cents', () => {
  const source = { basis: 'service_value', currency: 'AED', lines: [line({ uom: 'AED' })] };
  for (const received of ['1', '1.23', '1.230', '1.230000', '7.000000']) {
    assert.equal(receiptEntrySummary(source, { 'line:1': { received } }).valid, true, received);
  }
  for (const received of ['1.001', '1.230001']) {
    const result = receiptEntrySummary(source, { 'line:1': { received } });
    assert.equal(result.valid, false, received);
    assert.equal(result.complete, false);
    assert.equal(result.enteredLineCount, 0);
    assert.match(result.validationMessage, /two decimal places/);
  }
  assert.match(receiptEntrySummary(source, { 'line:1': { received: '1.2300000' } }).validationMessage, /six decimal places/);
  assert.match(receiptEntrySummary(source, { 'line:1': { received: '2', rejected: '0.001' } }).validationMessage, /two decimal places/);
  assert.equal(receiptEntrySummary(source, { 'line:1': { received: '2', rejected: '0.010000' } }).valid, true);
  assert.match(receiptEntrySummary(source, { 'line:1': { received: '2', rejected: '0.0100000' } }).validationMessage, /six decimal places/);
});
