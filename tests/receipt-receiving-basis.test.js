import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceivingBasis } from '../src/pages/Procurement/receiptReceivingBasis.js';

test('reviewed goods preserve exact large decimal quantities and explicit units', () => {
  assert.deepEqual(buildReceivingBasis('quantity', [{ description: ' Pipe ', uom: ' m ', ordered: '9007199254740993.123456' }]), {
    basis: 'quantity', lines: [{ description: 'Pipe', uom: 'm', ordered: '9007199254740993.123456' }],
  });
});
test('reviewed service value requires source currency and an explicit positive net amount', () => {
  assert.throws(() => buildReceivingBasis('service_value', [{ description: 'Service', uom: 'USD', ordered: '' }], 'USD'), /positive/);
  assert.throws(() => buildReceivingBasis('service_value', [{ description: 'Service', uom: 'AED', ordered: '10' }], 'USD'), /currency/);
  assert.deepEqual(buildReceivingBasis('service_value', [{ description: 'Service', uom: 'USD', ordered: '1234.5000' }], 'USD').lines[0].ordered, '1234.5000');
});
test('basis selection, line structure and exact precision reject invalid input', () => {
  for (const ordered of ['0', '-2', '1e3', '1.0000001', '1000000000000000000']) assert.throws(() => buildReceivingBasis('quantity', [{ description: 'Pipe', uom: 'EA', ordered }]), /positive/);
  assert.throws(() => buildReceivingBasis('', []), /Select/);
  assert.throws(() => buildReceivingBasis('quantity', []), /between/);
  assert.throws(() => buildReceivingBasis('quantity', [{ description: 'Pipe', uom: '', ordered: '2' }]), /unit/);
  assert.throws(() => buildReceivingBasis('service_value', [{ description: 'Scope', uom: 'USD', ordered: '1.001' }], 'USD'), /two decimal/);
  assert.throws(() => buildReceivingBasis('service_value', [{}, {}], 'USD'), /one service/);
});
