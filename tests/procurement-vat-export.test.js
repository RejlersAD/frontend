import assert from 'node:assert/strict';
import test from 'node:test';
import { procurementVatExportValue } from '../src/pages/Procurement/procurementVatExport.js';

test('VAT export does not reinterpret any unconfirmed historical financial value', () => {
  for (const vat_basis of [undefined, '', 'unconfirmed']) {
    const record = { vat_basis, total_amount: '100.00', tax_amount: '15.00', currency: 'AED' };
    assert.equal(procurementVatExportValue(record, 'Amount including VAT', 'po'), undefined);
    assert.equal(procurementVatExportValue(record, 'PO Amount including VAT', 'pr'), undefined);
    assert.equal(record.total_amount, '100.00');
    assert.equal(record.tax_amount, '15.00');
  }
});

test('confirmed VAT exports stored net and gross without adding VAT twice', () => {
  const order = { vat_basis: 'exclusive', net_amount: '100.00', tax_amount: '5.00', total_amount: '105.00', currency: 'AED' };
  assert.equal(procurementVatExportValue(order, 'Amount Curr.', 'po'), '100.00');
  assert.equal(procurementVatExportValue(order, 'Amount including VAT', 'po'), '105.00');
  assert.equal(procurementVatExportValue(order, 'Amount Inc VAT in AED', 'po'), '105.00');
  const requisition = { vat_basis: 'inclusive', net_total_excl_vat: '95.24', total_price: '100.00', currency: 'USD' };
  assert.equal(procurementVatExportValue(requisition, 'PO Amount w/o VAT', 'pr'), '95.24');
  assert.equal(procurementVatExportValue(requisition, 'PO Amount including VAT', 'pr'), '100.00');
  assert.equal(procurementVatExportValue(requisition, 'Amount Excl VAT in AED', 'pr'), undefined);
});

test('confirmed no VAT retains zero amounts rather than treating them as missing', () => {
  assert.equal(procurementVatExportValue({ vat_basis: 'none', net_amount: 0, total_amount: 0 }, 'Amount including VAT', 'po'), 0);
});
