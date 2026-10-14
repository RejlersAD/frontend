import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProcurementVat, procurementLineNet, roundProcurementMoney, sumProcurementMoney } from '../src/utils/procurementVat.js';
const addVat = (net, discount = 0) => calculateProcurementVat(net, discount, { basis: 'exclusive' });

test('applies five percent VAT to the reported approved PR net amount', () => {
  assert.deepEqual(addVat('225608.00'), {
    subtotal: 225608, discountAmount: 0, netAmount: 225608, taxAmount: 11280.4, totalAmount: 236888.4, vatRate: 5,
  });
});

test('discount reduces the taxable net before VAT is calculated', () => {
  assert.deepEqual(addVat('100.00', '10.00'), {
    subtotal: 100, discountAmount: 10, netAmount: 90, taxAmount: 4.5, totalAmount: 94.5, vatRate: 5,
  });
  assert.equal(addVat(10, 20).totalAmount, 0);
});

test('VAT uses decimal half-up rounding at a half-cent boundary', () => {
  assert.equal(addVat('.10').taxAmount, 0.01);
  assert.equal(addVat('20.10').taxAmount, 1.01);
  assert.equal(addVat('1.005').netAmount, 1.01);
  assert.equal(roundProcurementMoney('-1.005'), -1.01);
});

test('line calculations retain exact decimal multiplication before currency rounding', () => {
  assert.equal(procurementLineNet('0.29', '100.50'), 29.15);
  assert.equal(procurementLineNet('3', '10.005', '0.005'), 30.01);
  assert.equal(procurementLineNet(2, 5, 15), 0);
  assert.equal(sumProcurementMoney([0.1, 0.2, '0.30']), 0.6);
});

test('missing, invalid or negative amounts do not become a valid zero price', () => {
  for (const value of ['', null, undefined, true, 'invalid', NaN, Infinity, -1]) {
    assert.equal(addVat(value).totalAmount, null);
  }
  assert.equal(addVat(0).totalAmount, 0);
  assert.equal(addVat(5, 'invalid').taxAmount, null);
  assert.equal(procurementLineNet('', 1), null);
  assert.equal(sumProcurementMoney([1, null]), null);
});

test('supports model-sized amounts and scientific number inputs without floating tax drift', () => {
  assert.equal(addVat('999999999999.90').taxAmount, 50000000000);
  assert.equal(roundProcurementMoney(1e-7), 0);
  assert.equal(addVat('1e1000').totalAmount, null);
});

test('unconfirmed VAT never infers a financial amount or applies five percent', () => {
  const result = calculateProcurementVat(225608);
  assert.equal(result.netAmount, null);
  assert.equal(result.taxAmount, null);
  assert.equal(result.totalAmount, null);
  assert.equal(result.vatRate, null);
});

test('included VAT preserves the entered gross, including rounding at small values', () => {
  assert.deepEqual(calculateProcurementVat(100, 0, { basis: 'inclusive' }), {
    subtotal: 100, discountAmount: 0, netAmount: 95.24, taxAmount: 4.76, totalAmount: 100, vatRate: 5,
  });
  assert.equal(calculateProcurementVat('0.10', 0, { basis: 'inclusive' }).totalAmount, 0.1);
  assert.equal(calculateProcurementVat(100, 10, { basis: 'inclusive' }).totalAmount, 90);
});

test('explicit no-VAT confirmation retains the entered amount and zero tax', () => {
  assert.deepEqual(calculateProcurementVat(100, 0, { basis: 'none' }), {
    subtotal: 100, discountAmount: 0, netAmount: 100, taxAmount: 0, totalAmount: 100, vatRate: 0,
  });
});
