import test from 'node:test'
import assert from 'node:assert/strict'
import { businessDate, initialProposalDeadline, opportunityMoney, opportunityTotal } from '../src/pages/Sales/salesOpportunityRegistration.js'
test('opening dates follow Dubai midnight and invalid source dates remain unknown', () => {
  assert.equal(businessDate('2026-09-29T22:30:00Z'), '2026-09-30')
  assert.equal(businessDate('invalid'), '')
})

test('review classification cannot turn a source EOI response date into a proposal deadline', () => {
  assert.equal(initialProposalDeadline({ request_type_code: 'EOI', due_date: '2026-10-10' }, 'tender_opportunity'), '')
  assert.equal(initialProposalDeadline({ classification: { code: 'eoi' }, deadline_date: '2026-10-10' }, 'rfq'), '')
  assert.equal(initialProposalDeadline({ request_type_code: 'RFT', due_date: '2026-10-10' }, 'tender_opportunity'), '2026-10-10')
})
test('partial and mixed-currency totals cannot appear complete, while explicit zero remains known', () => {
  const read = row => row.value
  assert.match(opportunityTotal([{ value: '100', currency: 'AED' }, { value: null, currency: 'AED' }], read), /Incomplete/)
  assert.equal(opportunityTotal([{ value: null, currency: '' }], read), 'Not provided')
  assert.equal(opportunityTotal([{ value: '100', currency: 'AED' }, { value: '10', currency: '' }], read), 'Currency totals unavailable')
  assert.equal(opportunityTotal([{ value: '100', currency: 'AED' }, { value: '10', currency: 'OMR' }], read), 'Currency totals unavailable')
  assert.match(opportunityTotal([{ value: '0', currency: 'AED' }], read), /0/)
  assert.equal(opportunityTotal([{ value: '0', currency: 'AED' }], read).includes('Not provided'), false)
})
test('unknown amounts and malformed currencies remain readable without invented zero or currency', () => {
  assert.equal(opportunityMoney(null, 'AED'), 'Not provided')
  assert.match(opportunityMoney('100', ''), /currency not provided/)
  assert.match(opportunityMoney('100', 'not-a-currency'), /currency not verified/)
})
