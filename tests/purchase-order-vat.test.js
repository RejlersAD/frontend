import test from 'node:test'
import assert from 'node:assert/strict'
import { purchaseOrderVat, purchaseOrderLineNet } from '../src/pages/Procurement/purchaseOrderVat.js'

test('viewing existing orders preserves their recorded financial values regardless of saved VAT rate', () => {
  const order = { net_amount: '100.00', tax_amount: '20', total_amount: '120', vat_percentage: 20, discount_amount: '10' }
  assert.deepEqual(purchaseOrderVat(order), { subtotal: 110, discountAmount: 10, netAmount: 100, taxAmount: 20, totalAmount: 120, vatRate: 20 })
  assert.equal(purchaseOrderVat({ ...order, vat_basis: 'exclusive' }).totalAmount, 120)
})

test('unconfirmed legacy amounts are never increased or inferred from items', () => {
  const order = { total_amount: '6489', tax_amount: '0', vat_percentage: 0, items: [{ quantity: 2, unit_price: 100 }] }
  for (const preferItems of [false, true]) {
    const result = purchaseOrderVat(order, { preferItems })
    assert.equal(result.totalAmount, 6489)
    assert.equal(result.taxAmount, 0)
    assert.equal(result.netAmount, 6489)
  }
})

test('explicit repricing subtracts line and order discounts before exclusive VAT', () => {
  const order = { vat_basis: 'exclusive', net_amount: 999, discount_amount: '30', items: [{ quantity: 2, unit_price: '100', discount: '20' }] }
  assert.deepEqual(purchaseOrderVat(order, { preferItems: true }), { subtotal: 180, discountAmount: 30, netAmount: 150, taxAmount: 7.5, totalAmount: 157.5, vatRate: 5 })
})

test('the same entered price has distinct inclusive, exclusive and no-VAT outcomes', () => {
  const results = Object.fromEntries(['exclusive', 'inclusive', 'none'].map(vat_basis => [vat_basis, purchaseOrderVat({ vat_basis, price_amount: '100' }, { preferItems: true })]))
  assert.equal(results.exclusive.totalAmount, 105)
  assert.deepEqual([results.inclusive.netAmount, results.inclusive.taxAmount, results.inclusive.totalAmount], [95.24, 4.76, 100])
  assert.deepEqual([results.none.netAmount, results.none.taxAmount, results.none.totalAmount], [100, 0, 100])
})

test('inclusive line prices and discounts retain their input basis', () => {
  const order = { vat_basis: 'inclusive', items: [{ quantity: 2, unit_price: '55', discount: '5' }], discount_amount: '5' }
  const result = purchaseOrderVat(order, { preferItems: true })
  assert.deepEqual([result.subtotal, result.netAmount, result.taxAmount, result.totalAmount], [105, 95.24, 4.76, 100])
})

test('line arithmetic uses decimal rounding and preserves total-only row semantics', () => {
  assert.equal(purchaseOrderLineNet({ quantity: 3, unit_price: '0.335' }), 1.01)
  assert.equal(purchaseOrderLineNet({ total: '90', discount: '10' }), 90)
})

test('missing values stay unavailable and explicit zero remains recorded', () => {
  assert.equal(purchaseOrderVat({}).totalAmount, null)
  assert.equal(purchaseOrderVat({ net_amount: 0, total_amount: 0, tax_amount: 0 }).totalAmount, 0)
})

test('calculating an explicit review never mutates source evidence or financial inputs', () => {
  const order = { vat_basis: 'exclusive', total_amount: '100', tax_amount: '0', items: [{ quantity: 1, unit_price: '100' }], approval_log: [{ status: 'approved' }], attachments: [{ sha256: 'unchanged' }], source_extracted_data: { vat_percentage: 0 } }
  const before = structuredClone(order)
  assert.equal(purchaseOrderVat(order, { preferItems: true }).totalAmount, 105)
  assert.deepEqual(order, before)
})
